import { ProjectileState } from '../../types/index';

let projCounter = 0;

export function createProjectile(
  x: number, y: number,
  angle: number,
  speed: number,
  damage: number,
  ownerId: string,
  ownerTeam: 'crew' | 'commander',
  type: ProjectileState['type'] = 'bullet',
  targetId?: string
): ProjectileState {
  return {
    id: `proj_${++projCounter}`,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    angle,
    damage,
    ownerId,
    ownerTeam,
    type,
    ttl: type === 'missile' || type === 'heatseeker' ? 300 : 120,
    targetId,
  };
}
