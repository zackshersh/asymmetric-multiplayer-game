import { useEffect, useRef } from 'react';
import { GameStateData, AsteroidState, SpaceshipState } from '../types';

interface Props {
  gameState: GameStateData;
  cameraX: number;
  cameraY: number;
  zoom: number;
  width: number;
  height: number;
  /** Extra render callback after base world render */
  onRender?: (ctx: CanvasRenderingContext2D, toScreen: (wx: number, wy: number) => { x: number; y: number }) => void;
}

const STAR_COUNT = 200;
const stars: { x: number; y: number; r: number }[] = [];
for (let i = 0; i < STAR_COUNT; i++) {
  stars.push({ x: Math.random() * 8000, y: Math.random() * 8000, r: Math.random() * 1.5 + 0.3 });
}

function drawAsteroid(ctx: CanvasRenderingContext2D, ast: AsteroidState, sx: number, sy: number, zoom: number) {
  if (ast.vertices.length < 3) return;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ast.angle);
  ctx.beginPath();
  ctx.moveTo(ast.vertices[0].x * zoom, ast.vertices[0].y * zoom);
  for (let i = 1; i < ast.vertices.length; i++) {
    ctx.lineTo(ast.vertices[i].x * zoom, ast.vertices[i].y * zoom);
  }
  ctx.closePath();
  ctx.strokeStyle = ast.hasOre ? '#aa8820' : '#555';
  ctx.fillStyle = ast.hasOre ? '#1a1508' : '#111';
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  if (ast.hasOre) {
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawSpaceship(ctx: CanvasRenderingContext2D, ship: SpaceshipState, sx: number, sy: number, zoom: number) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ship.angle);
  const s = zoom;

  // Shield glow
  if (ship.shields > 0) {
    const alpha = Math.min(0.4, ship.shields / ship.maxShields * 0.4);
    ctx.beginPath();
    ctx.arc(0, 0, 40 * s, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,191,255,${alpha})`;
    ctx.fill();
  }

  // Ship body
  ctx.beginPath();
  ctx.moveTo(30 * s, 0);
  ctx.lineTo(-20 * s, 18 * s);
  ctx.lineTo(-12 * s, 0);
  ctx.lineTo(-20 * s, -18 * s);
  ctx.closePath();
  ctx.strokeStyle = '#00ff41';
  ctx.fillStyle = '#0d1a0d';
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  // Cockpit
  ctx.beginPath();
  ctx.arc(12 * s, 0, 6 * s, 0, Math.PI * 2);
  ctx.fillStyle = '#00bfff44';
  ctx.strokeStyle = '#00bfff';
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();

  // Engine glow
  ctx.beginPath();
  ctx.arc(-15 * s, 0, 5 * s, 0, Math.PI * 2);
  ctx.fillStyle = '#ff440044';
  ctx.strokeStyle = '#ff6600';
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

export default function GameCanvas({ gameState, cameraX, cameraY, zoom, width, height, onRender }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const toScreen = (wx: number, wy: number) => ({
    x: (wx - cameraX) * zoom + width / 2,
    y: (wy - cameraY) * zoom + height / 2,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Stars (parallax)
    for (const star of stars) {
      const sx = ((star.x - cameraX * 0.3) % width + width) % width;
      const sy = ((star.y - cameraY * 0.3) % height + height) % height;
      ctx.beginPath();
      ctx.arc(sx, sy, star.r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff44';
      ctx.fill();
    }

    // Map border
    const tl = toScreen(0, 0);
    const br = toScreen(8000, 8000);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 3;
    ctx.strokeRect(tl.x, tl.y, (br.x - tl.x), (br.y - tl.y));

    // Asteroids
    for (const ast of gameState.asteroids) {
      const s = toScreen(ast.x, ast.y);
      drawAsteroid(ctx, ast, s.x, s.y, zoom);
    }

    // Ore chunks
    for (const chunk of gameState.oreChunks) {
      const s = toScreen(chunk.x, chunk.y);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5 * zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#ffaa00';
      ctx.fill();
    }

    // Commander structures
    for (const struct of gameState.commanderStructures) {
      const s = toScreen(struct.x, struct.y);
      const sizes = { base: 60, factory: 35, turret: 25, research: 30 };
      const sz = sizes[struct.type] * zoom;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.strokeStyle = '#ff4444';
      ctx.fillStyle = '#1a0000';
      ctx.lineWidth = 2;
      if (struct.type === 'base') {
        ctx.strokeRect(-sz, -sz, sz * 2, sz * 2);
        ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
        ctx.strokeStyle = '#ff4444';
        ctx.beginPath();
        ctx.moveTo(-sz * 0.5, -sz * 0.5);
        ctx.lineTo(sz * 0.5, -sz * 0.5);
        ctx.lineTo(sz * 0.5, sz * 0.5);
        ctx.lineTo(-sz * 0.5, sz * 0.5);
        ctx.closePath();
        ctx.stroke();
      } else if (struct.type === 'turret') {
        ctx.beginPath();
        ctx.arc(0, 0, sz, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(sz * 1.4, 0);
        ctx.strokeStyle = '#ff6666';
        ctx.lineWidth = 3 * zoom;
        ctx.stroke();
      } else if (struct.type === 'factory') {
        ctx.fillRect(-sz, -sz * 0.7, sz * 2, sz * 1.4);
        ctx.strokeRect(-sz, -sz * 0.7, sz * 2, sz * 1.4);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, sz, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0022';
        ctx.strokeStyle = '#aa44ff';
        ctx.fill();
        ctx.stroke();
      }
      // Health bar
      const hpPct = struct.health / struct.maxHealth;
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(-sz, sz + 4 * zoom, sz * 2, 4 * zoom);
      ctx.fillStyle = '#00ff41';
      ctx.fillRect(-sz, sz + 4 * zoom, sz * 2 * hpPct, 4 * zoom);
      ctx.restore();
    }

    // Commander units
    for (const unit of gameState.commanderUnits) {
      const s = toScreen(unit.x, unit.y);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(unit.angle);
      const colors = { attack: '#ff4444', mining: '#ffaa00', scout: '#00bfff' };
      ctx.strokeStyle = unit.selected ? '#ffffff' : colors[unit.type];
      ctx.fillStyle = unit.selected ? '#ffffff22' : `${colors[unit.type]}22`;
      ctx.lineWidth = unit.selected ? 2.5 : 1.5;
      const sz = 10 * zoom;
      if (unit.type === 'attack') {
        ctx.beginPath();
        ctx.moveTo(sz, 0);
        ctx.lineTo(-sz, sz * 0.7);
        ctx.lineTo(-sz * 0.5, 0);
        ctx.lineTo(-sz, -sz * 0.7);
        ctx.closePath();
      } else if (unit.type === 'mining') {
        ctx.beginPath();
        ctx.rect(-sz * 0.8, -sz * 0.8, sz * 1.6, sz * 1.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, sz * 0.7, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      // Health
      const hpPct = unit.health / unit.maxHealth;
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(-sz, sz + 3 * zoom, sz * 2, 3 * zoom);
      ctx.fillStyle = '#00ff41';
      ctx.fillRect(-sz, sz + 3 * zoom, sz * 2 * hpPct, 3 * zoom);
      ctx.restore();
    }

    // Spaceship
    const shipS = toScreen(gameState.spaceship.x, gameState.spaceship.y);
    drawSpaceship(ctx, gameState.spaceship, shipS.x, shipS.y, zoom);

    // Mining laser
    if (gameState.spaceship.miningLaserActive && gameState.spaceship.miningLaserTarget) {
      const ast = gameState.asteroids.find(a => a.id === gameState.spaceship.miningLaserTarget);
      if (ast) {
        const astS = toScreen(ast.x, ast.y);
        ctx.beginPath();
        ctx.moveTo(shipS.x, shipS.y);
        ctx.lineTo(astS.x, astS.y);
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Projectiles
    for (const proj of gameState.projectiles) {
      const s = toScreen(proj.x, proj.y);
      const color = proj.ownerTeam === 'crew' ? '#00ff41' : '#ff4444';
      ctx.beginPath();
      ctx.arc(s.x, s.y, proj.type === 'bullet' ? 3 : 5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      // Trail
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      const speed = Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy);
      const trailLen = Math.min(15, speed * 0.03) * zoom;
      ctx.lineTo(s.x - (proj.vx / speed) * trailLen, s.y - (proj.vy / speed) * trailLen);
      ctx.strokeStyle = color + '88';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Extra renders
    if (onRender) onRender(ctx, toScreen);
  });

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', position: 'absolute', top: 0, left: 0 }}
    />
  );
}
