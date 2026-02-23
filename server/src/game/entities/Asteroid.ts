import { AsteroidState } from '../../types/index';

let asteroidCounter = 0;

function generateAsteroidVertices(radius: number, numPoints: number): { x: number; y: number }[] {
  const verts: { x: number; y: number }[] = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const r = radius * (0.7 + Math.random() * 0.6);
    verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  return verts;
}

export function createAsteroid(x: number, y: number, radius: number, hasOre: boolean): AsteroidState {
  const id = `asteroid_${++asteroidCounter}`;
  const maxOre = hasOre ? Math.floor(50 + Math.random() * 100) : 0;
  const hp = Math.floor(radius * 3);
  return {
    id,
    x,
    y,
    radius,
    hasOre,
    ore: maxOre,
    maxOre,
    vertices: generateAsteroidVertices(radius, 8 + Math.floor(Math.random() * 4)),
    health: hp,
    maxHealth: hp,
    vx: (Math.random() - 0.5) * 10,
    vy: (Math.random() - 0.5) * 10,
    angularVelocity: (Math.random() - 0.5) * 0.01,
    angle: 0,
  };
}
