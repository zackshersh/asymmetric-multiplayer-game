import {
  GameStateData, SpaceshipState, AsteroidState, ProjectileState,
  CommanderUnitState, CommanderStructureState, OreChunkState,
  PlayerInfo, Role, PilotInput, GunnerInput, EngineerInput, CommanderInputData,
  FogCell, CommanderUnitType, CommanderStructureType,
} from '../types/index';
import { createSpaceship } from './entities/Spaceship';
import { createAsteroid } from './entities/Asteroid';
import { createProjectile } from './entities/Projectile';
import { createCommanderUnit, getUnitStats } from './entities/CommanderUnit';
import { createCommanderStructure, getStructureOreCost } from './entities/CommanderStructure';
import { MAP_WIDTH, MAP_HEIGHT, MAX_SPEED, clampSpeed, distance, angleTo, normalizeAngle } from './Physics';

const TICK_RATE_MS = 50; // 20 ticks/sec
const FOG_COLS = 100;
const FOG_ROWS = 100;
const FOG_CELL_W = MAP_WIDTH / FOG_COLS;
const FOG_CELL_H = MAP_HEIGHT / FOG_ROWS;

// Upgrade costs in ore
const UPGRADE_COSTS: Record<string, number> = {
  weapons_1: 80, weapons_2: 150, weapons_3: 250, weapons_4: 400,
  thrusters_1: 80, thrusters_2: 150, thrusters_3: 250, thrusters_4: 400,
  shields_1: 80, shields_2: 150, shields_3: 250, shields_4: 400,
  recon_1: 80, recon_2: 150, recon_3: 250, recon_4: 400,
  hasStrafing: 100, hasMountedGuns: 120, hasMissiles: 200,
  hasHeatSeekingMissiles: 300, hasBunkerBusters: 350,
  hasActiveScan: 150, hasScoutDrone: 180,
  hasCollisionShield: 100, hasShieldSponge: 120,
};

const UNIT_BUILD_COSTS: Record<CommanderUnitType, number> = {
  attack: 60, mining: 40, scout: 30,
};
const UNIT_BUILD_TIMES: Record<CommanderUnitType, number> = {
  attack: 400, mining: 300, scout: 200,
};

export class GameState {
  private state: GameStateData;
  private players: Map<string, PlayerInfo & { role: Role | null }>;
  private selectedUnits: Map<string, Set<string>>; // commanderId -> set of unit ids
  private pilotInput: PilotInput = { thrust: 0, rotate: 0, strafe: 0 };
  private gunnerInput: GunnerInput = { angle: 0, firing: false, miningLaser: false };
  private engineerInput: EngineerInput = {};
  private shieldHitTimer = 0;
  private _miningLaserCooldown = 0;

  constructor() {
    this.players = new Map();
    this.selectedUnits = new Map();
    this.state = this.createInitialState();
  }

  private createInitialState(): GameStateData {
    const asteroids: AsteroidState[] = [];
    // Generate 30 asteroids, 15 with ore
    for (let i = 0; i < 30; i++) {
      let x: number, y: number;
      do {
        x = 500 + Math.random() * 7000;
        y = 500 + Math.random() * 7000;
      } while (distance(x, y, 1000, 4000) < 600 || distance(x, y, 7000, 4000) < 600);
      const radius = 40 + Math.random() * 80;
      asteroids.push(createAsteroid(x, y, radius, i < 15));
    }

    const fog: FogCell[][] = [];
    for (let r = 0; r < FOG_ROWS; r++) {
      fog[r] = [];
      for (let c = 0; c < FOG_COLS; c++) {
        fog[r][c] = { revealed: false, visible: false };
      }
    }

    const base = createCommanderStructure(7000, 4000, 'base');

    return {
      tick: 0,
      spaceship: createSpaceship(),
      asteroids,
      projectiles: [],
      commanderUnits: [],
      commanderStructures: [base],
      oreChunks: [],
      commanderOre: 200,
      commanderFog: fog,
      phase: 'lobby',
      winner: null,
      players: [],
      techLevel: 0,
    };
  }

  addPlayer(id: string, name: string): void {
    this.players.set(id, { id, role: null, name });
    this.syncPlayers();
  }

  removePlayer(id: string): void {
    this.players.delete(id);
    this.syncPlayers();
  }

  assignRole(playerId: string, role: Role): boolean {
    // Check if role is taken
    for (const [pid, p] of this.players) {
      if (p.role === role && pid !== playerId) return false;
    }
    const player = this.players.get(playerId);
    if (!player) return false;
    player.role = role;
    this.syncPlayers();
    return true;
  }

  getRole(playerId: string): Role | null {
    return this.players.get(playerId)?.role ?? null;
  }

  canStart(): boolean {
    let hasPilot = false;
    let hasCommander = false;
    for (const p of this.players.values()) {
      if (p.role === 'pilot') hasPilot = true;
      if (p.role === 'commander') hasCommander = true;
    }
    return hasPilot && hasCommander;
  }

  startGame(): void {
    this.state.phase = 'playing';
  }

  private syncPlayers(): void {
    this.state.players = Array.from(this.players.values()).map(p => ({
      id: p.id, role: p.role, name: p.name,
    }));
  }

  handlePilotInput(input: PilotInput): void {
    this.pilotInput = input;
  }

  handleGunnerInput(input: GunnerInput): void {
    this.gunnerInput = input;
  }

  handleEngineerInput(input: EngineerInput): void {
    this.engineerInput = { ...input };
  }

  handleCommanderInput(input: CommanderInputData): void {
    if (input.type === 'select') {
      if (input.selectedIds) {
        // Direct selection
        for (const u of this.state.commanderUnits) {
          u.selected = input.selectedIds.includes(u.id);
        }
      } else if (input.selectionBox) {
        const { x1, y1, x2, y2 } = input.selectionBox;
        const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
        for (const u of this.state.commanderUnits) {
          u.selected = u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY;
        }
      }
    } else if (input.type === 'move' && input.position) {
      const selected = this.state.commanderUnits.filter(u => u.selected);
      for (const u of selected) {
        u.waypoint = { ...input.position! };
        u.state = 'moving';
        u.targetId = null;
      }
    } else if (input.type === 'attack_move' && input.position) {
      const selected = this.state.commanderUnits.filter(u => u.selected);
      for (const u of selected) {
        u.waypoint = { ...input.position! };
        u.state = 'moving';
      }
    } else if (input.type === 'attack_target' && input.targetId) {
      const selected = this.state.commanderUnits.filter(u => u.selected);
      for (const u of selected) {
        u.targetId = input.targetId!;
        u.state = 'attacking';
      }
    } else if (input.type === 'stop') {
      for (const u of this.state.commanderUnits.filter(u => u.selected)) {
        u.state = 'idle';
        u.waypoint = null;
        u.targetId = null;
      }
    } else if (input.type === 'build_structure' && input.structureType && input.position) {
      const cost = getStructureOreCost(input.structureType);
      if (this.state.commanderOre >= cost) {
        this.state.commanderOre -= cost;
        this.state.commanderStructures.push(createCommanderStructure(input.position.x, input.position.y, input.structureType));
      }
    } else if (input.type === 'build_unit' && input.unitType && input.sourceStructureId) {
      const struct = this.state.commanderStructures.find(s => s.id === input.sourceStructureId);
      const cost = UNIT_BUILD_COSTS[input.unitType!];
      if (struct && (struct.type === 'base' || struct.type === 'factory') && this.state.commanderOre >= cost) {
        this.state.commanderOre -= cost;
        struct.buildQueue.push(input.unitType!);
      }
    }
  }

  tick(): GameStateData {
    if (this.state.phase !== 'playing') return this.state;

    this.state.tick++;
    const dt = TICK_RATE_MS / 1000;

    this.updateSpaceship(dt);
    this.updateProjectiles(dt);
    this.updateAsteroids(dt);
    this.updateOreChunks(dt);
    this.updateCommanderUnits(dt);
    this.updateCommanderStructures(dt);
    this.updateFogOfWar();
    this.checkWinConditions();

    return this.state;
  }

  private updateSpaceship(dt: number): void {
    const ship = this.state.spaceship;

    // Apply engineer energy input - accept any valid values (0..1), don't require total = 1
    if (this.engineerInput.thrusterPower !== undefined) {
      ship.thrusterPower = Math.max(0, Math.min(1, this.engineerInput.thrusterPower));
      ship.weaponPower = Math.max(0, Math.min(1, this.engineerInput.weaponPower ?? ship.weaponPower));
      ship.shieldPower = Math.max(0, Math.min(1, this.engineerInput.shieldPower ?? ship.shieldPower));
    }

    // Handle repair
    if (this.engineerInput.repairComponent) {
      const comp = ship.components[this.engineerInput.repairComponent as keyof typeof ship.components];
      if (comp) {
        comp.health = Math.min(comp.maxHealth, comp.health + 20);
        comp.broken = comp.health > 0;
      }
      this.engineerInput.repairComponent = undefined;
    }

    // Handle upgrade purchase
    if (this.engineerInput.purchaseUpgrade) {
      this.tryPurchaseUpgrade(this.engineerInput.purchaseUpgrade);
      this.engineerInput.purchaseUpgrade = undefined;
    }

    // Compute effective multipliers from components
    const thrusterMult = ship.components.thrusters.broken ? 0.1 : ship.thrusterPower * (1 + ship.upgrades.thrusters * 0.25);
    const weaponMult = ship.components.weapons.broken ? 0.1 : ship.weaponPower * (1 + ship.upgrades.weapons * 0.2);

    // Pilot thrust/rotation using angular velocity (inertia-based)
    const thrustForce = 200 * thrusterMult;
    const rotateTorque = 5.0; // angular acceleration in rad/s^2
    const angularDrag = 0.88; // per tick drag on angular velocity

    ship.thrusting = this.pilotInput.thrust > 0.1 && !ship.components.thrusters.broken;
    ship.rotatingDir = this.pilotInput.rotate;

    if (!ship.components.thrusters.broken) {
      ship.vx += Math.cos(ship.angle) * this.pilotInput.thrust * thrustForce * dt;
      ship.vy += Math.sin(ship.angle) * this.pilotInput.thrust * thrustForce * dt;
      // Strafe
      if (ship.upgrades.hasStrafing && this.pilotInput.strafe) {
        ship.vx += Math.cos(ship.angle + Math.PI / 2) * this.pilotInput.strafe * thrustForce * 0.6 * dt;
        ship.vy += Math.sin(ship.angle + Math.PI / 2) * this.pilotInput.strafe * thrustForce * 0.6 * dt;
      }
      // Rotation via angular velocity (inertia-based)
      ship.angularVelocity += this.pilotInput.rotate * rotateTorque * dt;
    }
    ship.angularVelocity *= angularDrag;
    ship.angle += ship.angularVelocity * dt;

    // Drag
    ship.vx *= 0.985;
    ship.vy *= 0.985;

    const clamped = clampSpeed(ship.vx, ship.vy, MAX_SPEED);
    ship.vx = clamped.vx;
    ship.vy = clamped.vy;

    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;

    // Wrap around map
    if (ship.x < 0) ship.x += MAP_WIDTH;
    if (ship.x > MAP_WIDTH) ship.x -= MAP_WIDTH;
    if (ship.y < 0) ship.y += MAP_HEIGHT;
    if (ship.y > MAP_HEIGHT) ship.y -= MAP_HEIGHT;

    // Asteroid collision for ship
    for (const ast of this.state.asteroids) {
      const d = distance(ship.x, ship.y, ast.x, ast.y);
      const minDist = ast.radius + 28;
      if (d < minDist && d > 0) {
        const nx = (ship.x - ast.x) / d;
        const ny = (ship.y - ast.y) / d;
        ship.x = ast.x + nx * minDist;
        ship.y = ast.y + ny * minDist;
        // Reflect velocity
        const dot = ship.vx * nx + ship.vy * ny;
        ship.vx -= 2 * dot * nx;
        ship.vy -= 2 * dot * ny;
        ship.vx *= 0.5;
        ship.vy *= 0.5;
        this.damageShip(5);
      }
    }

    // Shield regen
    if (this.shieldHitTimer > 0) {
      this.shieldHitTimer -= TICK_RATE_MS;
      ship.shieldRegenPaused = true;
    } else {
      ship.shieldRegenPaused = false;
      if (!ship.components.shields.broken) {
        const shieldMax = ship.maxShields * (1 + ship.upgrades.shields * 0.2);
        const regenRate = ship.shieldRegenRate * ship.shieldPower * (1 + ship.upgrades.shields * 0.15);
        ship.shields = Math.min(shieldMax, ship.shields + regenRate);
      }
    }

    // Gunner input: update turret angle
    ship.turretAngle = this.gunnerInput.angle;

    // Fire main gun - 8 rounds/sec = 125ms cooldown
    if (ship.mainGunCooldown > 0) ship.mainGunCooldown -= TICK_RATE_MS;
    if (this.gunnerInput.firing && !ship.components.weapons.broken && ship.mainGunCooldown <= 0) {
      const cooldown = Math.max(60, 125 - ship.upgrades.weapons * 10);
      ship.mainGunCooldown = cooldown / weaponMult;
      const projSpeed = 900 + ship.upgrades.weapons * 80;
      const dmg = 15 * (1 + ship.upgrades.weapons * 0.2) * weaponMult;
      const spread = ship.upgrades.hasMountedGuns ? 0.05 : 0;
      this.state.projectiles.push(createProjectile(
        ship.x + Math.cos(ship.turretAngle) * 30,
        ship.y + Math.sin(ship.turretAngle) * 30,
        ship.turretAngle + (Math.random() - 0.5) * spread,
        projSpeed, dmg, ship.id, 'crew', 'bullet'
      ));
      if (ship.upgrades.hasMountedGuns) {
        // Side guns
        for (const offset of [-0.15, 0.15]) {
          this.state.projectiles.push(createProjectile(
            ship.x + Math.cos(ship.turretAngle + offset) * 30,
            ship.y + Math.sin(ship.turretAngle + offset) * 30,
            ship.turretAngle + offset,
            projSpeed * 0.9, dmg * 0.7, ship.id, 'crew', 'bullet'
          ));
        }
      }
    }

    // Mining laser - direction-based, knocks ore chunks off asteroid
    ship.miningLaserActive = this.gunnerInput.miningLaser;
    if (ship.miningLaserActive) {
      // Find asteroid in the direction of the turret angle
      const laserAngle = this.gunnerInput.angle;
      const LASER_RANGE = 500;
      let hitAsteroid: typeof this.state.asteroids[0] | null = null;
      let hitDist = LASER_RANGE;
      for (const ast of this.state.asteroids) {
        if (!ast.hasOre || ast.ore <= 0) continue;
        const d = distance(ship.x, ship.y, ast.x, ast.y);
        if (d > LASER_RANGE + ast.radius) continue;
        // Check if asteroid is roughly in the direction of the laser
        const angleToAst = angleTo(ship.x, ship.y, ast.x, ast.y);
        const angleDiff = Math.abs(normalizeAngle(angleToAst - laserAngle));
        if (angleDiff < Math.asin(Math.min(1, ast.radius / Math.max(1, d))) + 0.15) {
          if (d < hitDist + ast.radius) {
            hitDist = d;
            hitAsteroid = ast;
          }
        }
      }
      ship.miningLaserTarget = hitAsteroid?.id ?? null;

      if (hitAsteroid) {
        // Knock ore chunk off the asteroid periodically
        this._miningLaserCooldown -= TICK_RATE_MS;
        if (this._miningLaserCooldown <= 0) {
          this._miningLaserCooldown = 600; // spawn chunk every 600ms
          const mineAmount = Math.min(10, hitAsteroid.ore);
          if (mineAmount > 0) {
            hitAsteroid.ore -= mineAmount;
            if (hitAsteroid.ore <= 0) hitAsteroid.hasOre = false;
            // Spawn chunk flying away from asteroid (not directly at ship)
            const chunkAngle = laserAngle + Math.PI + (Math.random() - 0.5) * 1.5;
            const speed = 60 + Math.random() * 80;
            this.state.oreChunks.push({
              id: `ore_chunk_${Date.now()}_${Math.random()}`,
              x: hitAsteroid.x + Math.cos(laserAngle + Math.PI) * (hitAsteroid.radius + 5),
              y: hitAsteroid.y + Math.sin(laserAngle + Math.PI) * (hitAsteroid.radius + 5),
              vx: Math.cos(chunkAngle) * speed,
              vy: Math.sin(chunkAngle) * speed,
              amount: mineAmount,
              ttl: 400,
            });
          }
        }
      } else {
        this._miningLaserCooldown = 0;
      }
    } else {
      ship.miningLaserTarget = null;
      this._miningLaserCooldown = 0;
    }

    // Cooldown active scan
    if (ship.activeScanCooldown > 0) ship.activeScanCooldown -= TICK_RATE_MS;
  }

  private tryPurchaseUpgrade(upgradeKey: string): void {
    const ship = this.state.spaceship;
    const cost = UPGRADE_COSTS[upgradeKey];
    if (!cost || ship.ore < cost) return;

    if (upgradeKey.startsWith('weapons_')) {
      const lvl = parseInt(upgradeKey.split('_')[1]);
      if (ship.upgrades.weapons === lvl - 1) { ship.upgrades.weapons = lvl; ship.ore -= cost; }
    } else if (upgradeKey.startsWith('thrusters_')) {
      const lvl = parseInt(upgradeKey.split('_')[1]);
      if (ship.upgrades.thrusters === lvl - 1) { ship.upgrades.thrusters = lvl; ship.ore -= cost; }
    } else if (upgradeKey.startsWith('shields_')) {
      const lvl = parseInt(upgradeKey.split('_')[1]);
      if (ship.upgrades.shields === lvl - 1) { ship.upgrades.shields = lvl; ship.ore -= cost; }
    } else if (upgradeKey.startsWith('recon_')) {
      const lvl = parseInt(upgradeKey.split('_')[1]);
      if (ship.upgrades.recon === lvl - 1) { ship.upgrades.recon = lvl; ship.ore -= cost; }
    } else {
      const flag = upgradeKey as keyof typeof ship.upgrades;
      if (typeof ship.upgrades[flag] === 'boolean' && !ship.upgrades[flag]) {
        (ship.upgrades as unknown as Record<string, unknown>)[flag] = true;
        ship.ore -= cost;
        if (upgradeKey === 'hasMissiles') {
          ship.missiles = ship.maxMissiles;
        }
      }
    }
  }

  private updateProjectiles(dt: number): void {
    const ship = this.state.spaceship;
    const toRemove = new Set<string>();

    for (const proj of this.state.projectiles) {
      proj.ttl--;

      // Heat-seeking behavior
      if (proj.type === 'heatseeker' && proj.targetId) {
        const target = this.state.commanderUnits.find(u => u.id === proj.targetId)
          || this.state.commanderStructures.find(s => s.id === proj.targetId);
        if (target) {
          const desiredAngle = angleTo(proj.x, proj.y, target.x, target.y);
          const diff = normalizeAngle(desiredAngle - proj.angle);
          proj.angle += Math.sign(diff) * Math.min(Math.abs(diff), 0.08);
          const speed = Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy);
          proj.vx = Math.cos(proj.angle) * speed;
          proj.vy = Math.sin(proj.angle) * speed;
        }
      }

      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      if (proj.ttl <= 0) { toRemove.add(proj.id); continue; }
      if (proj.x < 0 || proj.x > MAP_WIDTH || proj.y < 0 || proj.y > MAP_HEIGHT) {
        toRemove.add(proj.id); continue;
      }

      if (proj.ownerTeam === 'crew') {
        // Check vs commander units
        for (const unit of this.state.commanderUnits) {
          if (distance(proj.x, proj.y, unit.x, unit.y) < 20) {
            unit.health -= proj.damage;
            toRemove.add(proj.id);
            break;
          }
        }
        // Check vs commander structures
        if (!toRemove.has(proj.id)) {
          for (const struct of this.state.commanderStructures) {
            const size = struct.type === 'base' ? 80 : 40;
            if (distance(proj.x, proj.y, struct.x, struct.y) < size) {
              struct.health -= proj.damage;
              toRemove.add(proj.id);
              break;
            }
          }
        }
      } else {
        // Commander projectile hits spaceship
        if (distance(proj.x, proj.y, ship.x, ship.y) < 35) {
          this.damageShip(proj.damage);
          toRemove.add(proj.id);
        }
      }

      // Projectiles vs asteroids
      if (!toRemove.has(proj.id)) {
        for (const ast of this.state.asteroids) {
          if (distance(proj.x, proj.y, ast.x, ast.y) < ast.radius * 0.8) {
            ast.health -= proj.damage * 0.5;
            toRemove.add(proj.id);
            break;
          }
        }
      }
    }

    // Remove dead units and structures
    this.state.commanderUnits = this.state.commanderUnits.filter(u => u.health > 0);
    this.state.commanderStructures = this.state.commanderStructures.filter(s => s.health > 0);
    this.state.projectiles = this.state.projectiles.filter(p => !toRemove.has(p.id));

    // Remove dead asteroids, spawn ore chunks
    this.state.asteroids = this.state.asteroids.filter(ast => {
      if (ast.health <= 0) {
        if (ast.hasOre && ast.ore > 0) {
          this.spawnOreChunk(ast.x, ast.y, ast.ore);
        }
        return false;
      }
      return true;
    });
  }

  private damageShip(amount: number): void {
    const ship = this.state.spaceship;
    this.shieldHitTimer = 3000;
    if (ship.shields > 0) {
      const absorbed = Math.min(ship.shields, amount);
      ship.shields -= absorbed;
      amount -= absorbed;
      // Damage shield component
      ship.components.shields.health -= 3;
      if (ship.components.shields.health <= 0) ship.components.shields.broken = true;
    }
    if (amount > 0) {
      ship.health -= amount;
      // Random component damage
      const comps = ['thrusters', 'weapons', 'shields', 'recon'] as const;
      const comp = comps[Math.floor(Math.random() * comps.length)];
      ship.components[comp].health -= 5;
      if (ship.components[comp].health <= 0) ship.components[comp].broken = true;
    }
  }

  private spawnOreChunk(x: number, y: number, amount: number): void {
    const chunks = Math.ceil(amount / 20);
    for (let i = 0; i < chunks; i++) {
      this.state.oreChunks.push({
        id: `ore_${Date.now()}_${i}`,
        x: x + (Math.random() - 0.5) * 60,
        y: y + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        amount: Math.floor(amount / chunks),
        ttl: 600,
      });
    }
  }

  private updateAsteroids(dt: number): void {
    for (const ast of this.state.asteroids) {
      ast.x += ast.vx * dt;
      ast.y += ast.vy * dt;
      ast.angle += ast.angularVelocity;
      if (ast.x < 0) ast.x += MAP_WIDTH;
      if (ast.x > MAP_WIDTH) ast.x -= MAP_WIDTH;
      if (ast.y < 0) ast.y += MAP_HEIGHT;
      if (ast.y > MAP_HEIGHT) ast.y -= MAP_HEIGHT;
    }
  }

  private updateOreChunks(dt: number): void {
    const ship = this.state.spaceship;
    const toRemove = new Set<string>();

    for (const chunk of this.state.oreChunks) {
      chunk.ttl--;
      chunk.vx *= 0.99;
      chunk.vy *= 0.99;
      chunk.x += chunk.vx * dt;
      chunk.y += chunk.vy * dt;

      if (chunk.ttl <= 0) { toRemove.add(chunk.id); continue; }

      // Ship collects ore chunks
      if (distance(chunk.x, chunk.y, ship.x, ship.y) < 50) {
        ship.ore += chunk.amount;
        toRemove.add(chunk.id);
        continue;
      }

      // Commander mining units collect ore
      for (const unit of this.state.commanderUnits) {
        if (unit.type === 'mining' && distance(chunk.x, chunk.y, unit.x, unit.y) < 40) {
          unit.ore += chunk.amount;
          toRemove.add(chunk.id);
          break;
        }
      }
    }

    this.state.oreChunks = this.state.oreChunks.filter(c => !toRemove.has(c.id));
  }

  private updateCommanderUnits(dt: number): void {
    const ship = this.state.spaceship;

    for (const unit of this.state.commanderUnits) {
      const stats = getUnitStats(unit.type);

      // Auto-return ore to base
      if (unit.ore >= 50) {
        const base = this.state.commanderStructures.find(s => s.type === 'base');
        if (base) {
          const d = distance(unit.x, unit.y, base.x, base.y);
          if (d < 80) {
            this.state.commanderOre += unit.ore;
            unit.ore = 0;
          } else {
            unit.waypoint = { x: base.x, y: base.y };
            unit.state = 'moving';
          }
        }
      }

      // Mining unit behavior
      if (unit.type === 'mining' && unit.ore < 50) {
        if (unit.state === 'idle') {
          // Find nearest ore asteroid
          let nearest: AsteroidState | null = null;
          let nearestDist = Infinity;
          for (const ast of this.state.asteroids) {
            if (!ast.hasOre || ast.ore <= 0) continue;
            const d = distance(unit.x, unit.y, ast.x, ast.y);
            if (d < nearestDist) { nearestDist = d; nearest = ast; }
          }
          if (nearest) {
            unit.waypoint = { x: nearest.x, y: nearest.y };
            unit.state = 'mining';
            unit.targetId = nearest.id;
          }
        }
        if (unit.state === 'mining' && unit.targetId) {
          const ast = this.state.asteroids.find(a => a.id === unit.targetId);
          if (ast && ast.hasOre && ast.ore > 0) {
            const hoverDist = ast.radius + 25;
            const d = distance(unit.x, unit.y, ast.x, ast.y);
            if (d < hoverDist + 10) {
              // Hover at orbit distance - stop at the edge
              if (d < hoverDist) {
                const nx = (unit.x - ast.x) / (d || 1);
                const ny = (unit.y - ast.y) / (d || 1);
                unit.x = ast.x + nx * hoverDist;
                unit.y = ast.y + ny * hoverDist;
                unit.vx = 0;
                unit.vy = 0;
              }
              // Mine
              unit.miningCooldown -= TICK_RATE_MS;
              if (unit.miningCooldown <= 0) {
                const mined = Math.min(5, ast.ore);
                ast.ore -= mined;
                unit.ore += mined;
                unit.miningCooldown = 500;
                if (ast.ore <= 0) ast.hasOre = false;
              }
              unit.waypoint = null;
            } else {
              // Move to hover position at edge of asteroid
              const angleToAst = angleTo(unit.x, unit.y, ast.x, ast.y);
              unit.waypoint = {
                x: ast.x - Math.cos(angleToAst) * hoverDist,
                y: ast.y - Math.sin(angleToAst) * hoverDist,
              };
            }
          } else {
            unit.state = 'idle';
            unit.targetId = null;
          }
        }
      }

      // Scout behavior - auto-explore
      if (unit.type === 'scout' && unit.state === 'idle') {
        unit.waypoint = {
          x: 500 + Math.random() * 7000,
          y: 500 + Math.random() * 7000,
        };
        unit.state = 'moving';
      }

      // Attack behavior
      if (unit.type === 'attack') {
        if (unit.state === 'idle' || unit.state === 'moving') {
          // Auto-attack ship if close enough
          const d = distance(unit.x, unit.y, ship.x, ship.y);
          if (d < stats.range * 1.5) {
            unit.state = 'attacking';
            unit.targetId = ship.id;
          }
        }
        if (unit.state === 'attacking') {
          const d = distance(unit.x, unit.y, ship.x, ship.y);
          if (d <= stats.range) {
            unit.attackCooldown -= TICK_RATE_MS;
            if (unit.attackCooldown <= 0) {
              unit.attackCooldown = stats.fireRate;
              const angle = angleTo(unit.x, unit.y, ship.x, ship.y);
              this.state.projectiles.push(createProjectile(
                unit.x, unit.y, angle, 300, stats.damage, unit.id, 'commander', 'bullet'
              ));
            }
          } else if (d > stats.range * 2) {
            unit.state = 'moving';
            unit.waypoint = { x: ship.x, y: ship.y };
          }
        }
      }

      // Move toward waypoint
      if (unit.waypoint) {
        const dx = unit.waypoint.x - unit.x;
        const dy = unit.waypoint.y - unit.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 5) {
          const speed = stats.speed;
          unit.vx = (dx / d) * speed;
          unit.vy = (dy / d) * speed;
          unit.angle = Math.atan2(dy, dx);
          unit.x += unit.vx * dt;
          unit.y += unit.vy * dt;
        } else {
          unit.vx = 0;
          unit.vy = 0;
          if (unit.state === 'moving') {
            unit.state = 'idle';
            unit.waypoint = null;
          }
        }
      }

      // Asteroid collision for commander units
      for (const ast of this.state.asteroids) {
        const d = distance(unit.x, unit.y, ast.x, ast.y);
        const minDist = ast.radius + 14;
        if (d < minDist && d > 0) {
          const nx = (unit.x - ast.x) / d;
          const ny = (unit.y - ast.y) / d;
          unit.x = ast.x + nx * minDist;
          unit.y = ast.y + ny * minDist;
          unit.vx *= -0.3;
          unit.vy *= -0.3;
        }
      }

      // Keep in bounds
      unit.x = Math.max(0, Math.min(MAP_WIDTH, unit.x));
      unit.y = Math.max(0, Math.min(MAP_HEIGHT, unit.y));
    }
  }

  private updateCommanderStructures(dt: number): void {
    const ship = this.state.spaceship;

    for (const struct of this.state.commanderStructures) {
      // Production
      if ((struct.type === 'base' || struct.type === 'factory') && struct.buildQueue.length > 0) {
        struct.buildProgress += TICK_RATE_MS;
        const unitType = struct.buildQueue[0];
        const buildTime = UNIT_BUILD_TIMES[unitType] * TICK_RATE_MS;
        if (struct.buildProgress >= buildTime) {
          struct.buildProgress = 0;
          struct.buildQueue.shift();
          const offsetAngle = Math.random() * Math.PI * 2;
          this.state.commanderUnits.push(createCommanderUnit(
            struct.x + Math.cos(offsetAngle) * 100,
            struct.y + Math.sin(offsetAngle) * 100,
            unitType
          ));
        }
      }

      // Turrets and base attack ship
      if ((struct.type === 'turret' || struct.type === 'base') && struct.range > 0) {
        const d = distance(struct.x, struct.y, ship.x, ship.y);
        if (d <= struct.range) {
          struct.attackCooldown -= TICK_RATE_MS;
          if (struct.attackCooldown <= 0) {
            struct.attackCooldown = 1500;
            const angle = angleTo(struct.x, struct.y, ship.x, ship.y);
            this.state.projectiles.push(createProjectile(
              struct.x, struct.y, angle + (Math.random() - 0.5) * 0.1,
              350, struct.damage, struct.id, 'commander', 'bullet'
            ));
          }
        }
      }
    }

    // Update tech level
    const researchCount = this.state.commanderStructures.filter(s => s.type === 'research').length;
    this.state.techLevel = researchCount;
  }

  private updateFogOfWar(): void {
    const fog = this.state.commanderFog;

    // Reset visible
    for (let r = 0; r < FOG_ROWS; r++) {
      for (let c = 0; c < FOG_COLS; c++) {
        fog[r][c].visible = false;
      }
    }

    // Reveal around structures
    for (const struct of this.state.commanderStructures) {
      this.revealFog(struct.x, struct.y, 3);
    }

    // Reveal around units
    for (const unit of this.state.commanderUnits) {
      const stats = getUnitStats(unit.type);
      const revealRadius = Math.ceil(stats.discoverRadius / FOG_CELL_W);
      this.revealFog(unit.x, unit.y, revealRadius);
    }
  }

  private revealFog(worldX: number, worldY: number, cellRadius: number): void {
    const fog = this.state.commanderFog;
    const centerC = Math.floor(worldX / FOG_CELL_W);
    const centerR = Math.floor(worldY / FOG_CELL_H);
    for (let r = centerR - cellRadius; r <= centerR + cellRadius; r++) {
      for (let c = centerC - cellRadius; c <= centerC + cellRadius; c++) {
        if (r >= 0 && r < FOG_ROWS && c >= 0 && c < FOG_COLS) {
          fog[r][c].visible = true;
          fog[r][c].revealed = true;
        }
      }
    }
  }

  private checkWinConditions(): void {
    const ship = this.state.spaceship;
    if (ship.health <= 0) {
      this.state.phase = 'gameOver';
      this.state.winner = 'commander';
      return;
    }
    const base = this.state.commanderStructures.find(s => s.type === 'base');
    if (!base) {
      this.state.phase = 'gameOver';
      this.state.winner = 'crew';
    }
  }

  getState(): GameStateData {
    return this.state;
  }
}
