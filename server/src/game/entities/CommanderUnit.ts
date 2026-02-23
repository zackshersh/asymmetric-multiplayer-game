import { CommanderUnitState, CommanderUnitType } from '../../types/index';

let unitCounter = 0;

const UNIT_STATS: Record<CommanderUnitType, { speed: number; health: number; damage: number; fireRate: number; range: number; mineRate: number; discoverRadius: number }> = {
  attack: { speed: 150, health: 100, damage: 10, fireRate: 1000, range: 250, mineRate: 0, discoverRadius: 150 },
  mining: { speed: 100, health: 80, damage: 3, fireRate: 2000, range: 100, mineRate: 5, discoverRadius: 100 },
  scout:  { speed: 250, health: 50, damage: 0, fireRate: 0, range: 0, mineRate: 0, discoverRadius: 300 },
};

export function getUnitStats(type: CommanderUnitType) {
  return UNIT_STATS[type];
}

export function createCommanderUnit(x: number, y: number, type: CommanderUnitType): CommanderUnitState {
  const stats = UNIT_STATS[type];
  return {
    id: `unit_${++unitCounter}`,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: 0,
    health: stats.health,
    maxHealth: stats.health,
    type,
    state: 'idle',
    targetId: null,
    waypoint: null,
    attackCooldown: 0,
    miningCooldown: 0,
    ore: 0,
    selected: false,
  };
}
