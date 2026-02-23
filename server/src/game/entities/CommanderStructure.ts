import { CommanderStructureState, CommanderStructureType } from '../../types/index';

let structCounter = 0;

const STRUCTURE_STATS: Record<CommanderStructureType, { health: number; buildTime: number; oreCost: number; range: number; damage: number }> = {
  base:     { health: 2000, buildTime: 0,   oreCost: 0,   range: 400, damage: 15 },
  factory:  { health: 600,  buildTime: 0,   oreCost: 150, range: 0,   damage: 0  },
  turret:   { health: 300,  buildTime: 0,   oreCost: 100, range: 350, damage: 20 },
  research: { health: 400,  buildTime: 0,   oreCost: 200, range: 0,   damage: 0  },
};

export function getStructureOreCost(type: CommanderStructureType): number {
  return STRUCTURE_STATS[type].oreCost;
}

export function createCommanderStructure(x: number, y: number, type: CommanderStructureType): CommanderStructureState {
  const stats = STRUCTURE_STATS[type];
  return {
    id: `struct_${++structCounter}`,
    x,
    y,
    type,
    health: stats.health,
    maxHealth: stats.health,
    buildQueue: [],
    buildProgress: 0,
    buildTime: 500,
    ore: 0,
    angle: 0,
    attackCooldown: 0,
    range: stats.range,
    damage: stats.damage,
  };
}
