export type Role = 'pilot' | 'gunner' | 'engineer' | 'commander';

export interface ComponentState {
  health: number;
  maxHealth: number;
  broken: boolean;
}

export interface ShipUpgrades {
  weapons: number;
  thrusters: number;
  shields: number;
  recon: number;
  hasStrafing: boolean;
  hasMountedGuns: boolean;
  hasMissiles: boolean;
  hasHeatSeekingMissiles: boolean;
  hasBunkerBusters: boolean;
  hasActiveScan: boolean;
  hasScoutDrone: boolean;
  hasCollisionShield: boolean;
  hasShieldSponge: boolean;
}

export interface SpaceshipState {
  id: string;
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  angularVelocity: number;
  health: number;
  maxHealth: number;
  shields: number;
  maxShields: number;
  shieldRegenRate: number;
  ore: number;
  thrusterPower: number;
  weaponPower: number;
  shieldPower: number;
  turretAngle: number;
  miningLaserActive: boolean;
  miningLaserTarget: string | null;
  components: {
    thrusters: ComponentState;
    weapons: ComponentState;
    shields: ComponentState;
    recon: ComponentState;
  };
  upgrades: ShipUpgrades;
  mainGunCooldown: number;
  missileCooldown: number;
  missiles: number;
  maxMissiles: number;
  activeScanCooldown: number;
  shieldRegenPaused: boolean;
}

export interface AsteroidState {
  id: string;
  x: number;
  y: number;
  radius: number;
  hasOre: boolean;
  ore: number;
  maxOre: number;
  vertices: { x: number; y: number }[];
  health: number;
  maxHealth: number;
  vx: number;
  vy: number;
  angularVelocity: number;
  angle: number;
}

export interface ProjectileState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  damage: number;
  ownerId: string;
  ownerTeam: 'crew' | 'commander';
  type: 'bullet' | 'missile' | 'heatseeker';
  ttl: number;
  targetId?: string;
}

export interface OreChunkState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  amount: number;
  ttl: number;
}

export type CommanderUnitType = 'attack' | 'mining' | 'scout';
export type CommanderUnitStateType = 'idle' | 'moving' | 'attacking' | 'mining' | 'scouting';
export type CommanderStructureType = 'base' | 'factory' | 'turret' | 'research';

export interface CommanderUnitState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  health: number;
  maxHealth: number;
  type: CommanderUnitType;
  state: CommanderUnitStateType;
  targetId: string | null;
  waypoint: { x: number; y: number } | null;
  attackCooldown: number;
  miningCooldown: number;
  ore: number;
  selected: boolean;
}

export interface CommanderStructureState {
  id: string;
  x: number;
  y: number;
  type: CommanderStructureType;
  health: number;
  maxHealth: number;
  buildQueue: CommanderUnitType[];
  buildProgress: number;
  buildTime: number;
  ore: number;
  angle: number;
  attackCooldown: number;
  range: number;
  damage: number;
}

export interface FogCell {
  revealed: boolean;
  visible: boolean;
}

export interface GameStateData {
  tick: number;
  spaceship: SpaceshipState;
  asteroids: AsteroidState[];
  projectiles: ProjectileState[];
  commanderUnits: CommanderUnitState[];
  commanderStructures: CommanderStructureState[];
  oreChunks: OreChunkState[];
  commanderOre: number;
  commanderFog: FogCell[][];
  phase: 'lobby' | 'playing' | 'gameOver';
  winner: 'crew' | 'commander' | null;
  players: PlayerInfo[];
  techLevel: number;
}

export interface PlayerInfo {
  id: string;
  role: Role | null;
  name: string;
}

// Input types
export interface PilotInput {
  thrust: number;
  rotate: number;
  strafe?: number;
}

export interface GunnerInput {
  angle: number;
  firing: boolean;
  miningLaser: boolean;
  miningTarget?: string;
  missileMode?: boolean;
}

export interface EngineerInput {
  thrusterPower?: number;
  weaponPower?: number;
  shieldPower?: number;
  repairComponent?: string;
  purchaseUpgrade?: string;
}

export interface CommanderInputData {
  type: 'move' | 'build_structure' | 'build_unit' | 'select' | 'attack_move' | 'stop' | 'attack_target';
  position?: { x: number; y: number };
  structureType?: CommanderStructureType;
  unitType?: CommanderUnitType;
  selectedIds?: string[];
  selectionBox?: { x1: number; y1: number; x2: number; y2: number };
  targetId?: string;
  sourceStructureId?: string;
}
