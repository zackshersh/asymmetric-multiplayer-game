// Physics integration using simple Euler integration (Matter.js used for collision detection)
// We keep it lightweight for server performance

export const MAP_WIDTH = 8000;
export const MAP_HEIGHT = 8000;
export const MAX_SPEED = 350;

export function clampSpeed(vx: number, vy: number, max: number): { vx: number; vy: number } {
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed > max) {
    return { vx: (vx / speed) * max, vy: (vy / speed) * max };
  }
  return { vx, vy };
}

export function wrapPosition(x: number, y: number): { x: number; y: number } {
  let nx = x;
  let ny = y;
  if (nx < 0) nx += MAP_WIDTH;
  if (nx > MAP_WIDTH) nx -= MAP_WIDTH;
  if (ny < 0) ny += MAP_HEIGHT;
  if (ny > MAP_HEIGHT) ny -= MAP_HEIGHT;
  return { x: nx, y: ny };
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleTo(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

export function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
