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

const MAP_SIZE = 8000;
// Dot grid spacing in world units
const GRID_SPACING = 200;

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

function drawSpaceship(
  ctx: CanvasRenderingContext2D,
  ship: SpaceshipState,
  sx: number,
  sy: number,
  zoom: number,
  thrustTime: number,
) {
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

  // Flame effect when thrusting
  if (ship.thrusting) {
    const flameLen = (0.6 + 0.4 * Math.sin(thrustTime * 0.03)) * 28 * s;
    const flicker = (Math.random() - 0.5) * 4 * s;
    ctx.beginPath();
    ctx.moveTo(-12 * s, 0);
    ctx.lineTo(-12 * s - flameLen, flicker);
    ctx.lineTo(-20 * s, 8 * s);
    ctx.moveTo(-12 * s, 0);
    ctx.lineTo(-12 * s - flameLen * 0.7, -flicker);
    ctx.lineTo(-20 * s, -8 * s);
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 3 * s;
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Inner bright core
    ctx.beginPath();
    ctx.moveTo(-12 * s, 0);
    ctx.lineTo(-12 * s - flameLen * 0.5, flicker * 0.3);
    ctx.strokeStyle = '#ffdd44';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();
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

  // Engine glow (always present, brighter when thrusting)
  const glowAlpha = ship.thrusting ? 0.9 : 0.3;
  ctx.beginPath();
  ctx.arc(-15 * s, 0, 5 * s, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,68,0,${glowAlpha * 0.44})`;
  ctx.strokeStyle = '#ff6600';
  ctx.lineWidth = 1;
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

export default function GameCanvas({ gameState, cameraX, cameraY, zoom, width, height, onRender }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef(gameState);
  const cameraRef = useRef({ x: cameraX, y: cameraY, zoom, width, height });
  const thrustTimeRef = useRef(0);
  const rafRef = useRef<number>(0);
  const onRenderRef = useRef(onRender);

  // Keep refs updated without triggering effects
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { cameraRef.current = { x: cameraX, y: cameraY, zoom, width, height }; }, [cameraX, cameraY, zoom, width, height]);
  useEffect(() => { onRenderRef.current = onRender; }, [onRender]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const gs = gameStateRef.current;
      const cam = cameraRef.current;
      const { x: cX, y: cY, zoom: z, width: w, height: h } = cam;

      const toScreen = (wx: number, wy: number) => ({
        x: (wx - cX) * z + w / 2,
        y: (wy - cY) * z + h / 2,
      });

      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, h);

      // Fixed grid of dots (world-space fixed)
      ctx.fillStyle = '#ffffff22';
      // Find the first grid line just off-screen
      const startGX = Math.floor((cX - w / (2 * z)) / GRID_SPACING) * GRID_SPACING;
      const startGY = Math.floor((cY - h / (2 * z)) / GRID_SPACING) * GRID_SPACING;
      const endGX = cX + w / (2 * z) + GRID_SPACING;
      const endGY = cY + h / (2 * z) + GRID_SPACING;
      for (let gx = startGX; gx < endGX; gx += GRID_SPACING) {
        for (let gy = startGY; gy < endGY; gy += GRID_SPACING) {
          if (gx < 0 || gx > MAP_SIZE || gy < 0 || gy > MAP_SIZE) continue;
          const s = toScreen(gx, gy);
          ctx.beginPath();
          ctx.arc(s.x, s.y, Math.max(1, 1.5 * z), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Map border
      const tl = toScreen(0, 0);
      const br = toScreen(MAP_SIZE, MAP_SIZE);
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 3;
      ctx.strokeRect(tl.x, tl.y, (br.x - tl.x), (br.y - tl.y));

      // Asteroids
      for (const ast of gs.asteroids) {
        const s = toScreen(ast.x, ast.y);
        drawAsteroid(ctx, ast, s.x, s.y, z);
      }

      // Ore chunks
      for (const chunk of gs.oreChunks) {
        const s = toScreen(chunk.x, chunk.y);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 5 * z, 0, Math.PI * 2);
        ctx.fillStyle = '#ffaa00';
        ctx.fill();
      }

      // Commander structures - visually distinct per type
      for (const struct of gs.commanderStructures) {
        const s = toScreen(struct.x, struct.y);
        const sizes: Record<string, number> = { base: 60, factory: 35, turret: 25, research: 30 };
        const sz = (sizes[struct.type] || 30) * z;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.lineWidth = 2;

        if (struct.type === 'base') {
          // Hexagonal base
          ctx.strokeStyle = '#ff4444';
          ctx.fillStyle = '#1a0000';
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
            if (i === 0) ctx.moveTo(Math.cos(a) * sz, Math.sin(a) * sz);
            else ctx.lineTo(Math.cos(a) * sz, Math.sin(a) * sz);
          }
          ctx.closePath();
          ctx.fill(); ctx.stroke();
          // Inner cross
          ctx.beginPath();
          ctx.moveTo(-sz * 0.5, 0); ctx.lineTo(sz * 0.5, 0);
          ctx.moveTo(0, -sz * 0.5); ctx.lineTo(0, sz * 0.5);
          ctx.strokeStyle = '#ff6666';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (struct.type === 'turret') {
          // Turret: circle + barrel
          ctx.strokeStyle = '#ff8800';
          ctx.fillStyle = '#1a0800';
          ctx.beginPath(); ctx.arc(0, 0, sz, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
          // Barrel (rotates slowly)
          const barrelAngle = (Date.now() * 0.0005) % (Math.PI * 2);
          ctx.save();
          ctx.rotate(barrelAngle);
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(sz * 1.6, 0);
          ctx.strokeStyle = '#ffaa44';
          ctx.lineWidth = Math.max(2, 3 * z);
          ctx.stroke();
          ctx.restore();
          // Dot in center
          ctx.beginPath(); ctx.arc(0, 0, sz * 0.25, 0, Math.PI * 2);
          ctx.fillStyle = '#ffaa44'; ctx.fill();
        } else if (struct.type === 'factory') {
          // Factory: rectangle with chimney-like details
          ctx.strokeStyle = '#44aaff';
          ctx.fillStyle = '#000e1a';
          ctx.fillRect(-sz, -sz * 0.7, sz * 2, sz * 1.4);
          ctx.strokeRect(-sz, -sz * 0.7, sz * 2, sz * 1.4);
          // Gear symbol
          ctx.strokeStyle = '#66ccff';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(0, 0, sz * 0.35, 0, Math.PI * 2); ctx.stroke();
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * sz * 0.35, Math.sin(a) * sz * 0.35);
            ctx.lineTo(Math.cos(a) * sz * 0.6, Math.sin(a) * sz * 0.6);
            ctx.stroke();
          }
        } else {
          // Research: diamond with glow
          ctx.strokeStyle = '#aa44ff';
          ctx.fillStyle = '#0a0022';
          ctx.beginPath();
          ctx.moveTo(0, -sz); ctx.lineTo(sz, 0);
          ctx.lineTo(0, sz); ctx.lineTo(-sz, 0);
          ctx.closePath();
          ctx.fill(); ctx.stroke();
          // Inner dot
          ctx.beginPath(); ctx.arc(0, 0, sz * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = '#cc88ff'; ctx.fill();
        }

        // Health bar
        const hpPct = struct.health / struct.maxHealth;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(-sz, sz + 4 * z, sz * 2, 4 * z);
        ctx.fillStyle = '#00ff41';
        ctx.fillRect(-sz, sz + 4 * z, sz * 2 * hpPct, 4 * z);

        // Build progress bar
        if ((struct.type === 'base' || struct.type === 'factory') && struct.buildQueue.length > 0) {
          const buildTime = struct.buildTime * 50; // matches server UNIT_BUILD_TIMES * TICK_RATE_MS
          const unitBuildTimes: Record<string, number> = { attack: 400 * 50, mining: 300 * 50, scout: 200 * 50 };
          const unitTime = unitBuildTimes[struct.buildQueue[0]] || buildTime;
          const pct = Math.min(1, struct.buildProgress / unitTime);
          ctx.fillStyle = '#333';
          ctx.fillRect(-sz, sz + 10 * z, sz * 2, 4 * z);
          ctx.fillStyle = '#ffaa00';
          ctx.fillRect(-sz, sz + 10 * z, sz * 2 * pct, 4 * z);
        }

        ctx.restore();
      }

      // Commander units - visually distinct per type + flame when moving
      for (const unit of gs.commanderUnits) {
        const s = toScreen(unit.x, unit.y);
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(unit.angle);
        const colors: Record<string, string> = { attack: '#ff4444', mining: '#ffaa00', scout: '#00bfff' };
        const color = colors[unit.type] || '#888';
        ctx.strokeStyle = unit.selected ? '#ffffff' : color;
        ctx.fillStyle = unit.selected ? '#ffffff22' : `${color}22`;
        ctx.lineWidth = unit.selected ? 2.5 : 1.5;
        const sz = 10 * z;

        // Flame when moving
        const speed = Math.sqrt(unit.vx * unit.vx + unit.vy * unit.vy);
        if (speed > 10) {
          const flameLen = Math.min(sz * 1.5, speed * 0.04 * z);
          ctx.beginPath();
          ctx.moveTo(-sz, 0);
          ctx.lineTo(-sz - flameLen, (Math.random() - 0.5) * sz * 0.5);
          ctx.strokeStyle = unit.type === 'attack' ? '#ff6600' : unit.type === 'mining' ? '#ffcc00' : '#44aaff';
          ctx.globalAlpha = 0.7;
          ctx.lineWidth = 2 * z;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        if (unit.type === 'attack') {
          ctx.strokeStyle = unit.selected ? '#ffffff' : color;
          ctx.lineWidth = unit.selected ? 2.5 : 1.5;
          ctx.beginPath();
          ctx.moveTo(sz, 0);
          ctx.lineTo(-sz, sz * 0.7);
          ctx.lineTo(-sz * 0.5, 0);
          ctx.lineTo(-sz, -sz * 0.7);
          ctx.closePath();
        } else if (unit.type === 'mining') {
          ctx.strokeStyle = unit.selected ? '#ffffff' : color;
          ctx.lineWidth = unit.selected ? 2.5 : 1.5;
          ctx.beginPath();
          ctx.rect(-sz * 0.8, -sz * 0.8, sz * 1.6, sz * 1.6);
        } else {
          ctx.strokeStyle = unit.selected ? '#ffffff' : color;
          ctx.lineWidth = unit.selected ? 2.5 : 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, sz * 0.7, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
        // Health
        const hpPct = unit.health / unit.maxHealth;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(-sz, sz + 3 * z, sz * 2, 3 * z);
        ctx.fillStyle = '#00ff41';
        ctx.fillRect(-sz, sz + 3 * z, sz * 2 * hpPct, 3 * z);
        ctx.restore();
      }

      // Spaceship
      if (gs.spaceship.thrusting) thrustTimeRef.current++;
      const shipS = toScreen(gs.spaceship.x, gs.spaceship.y);
      drawSpaceship(ctx, gs.spaceship, shipS.x, shipS.y, z, thrustTimeRef.current);

      // Mining laser
      if (gs.spaceship.miningLaserActive && gs.spaceship.miningLaserTarget) {
        const ast = gs.asteroids.find(a => a.id === gs.spaceship.miningLaserTarget);
        if (ast) {
          const astS = toScreen(ast.x, ast.y);
          // Draw beam along aim direction
          ctx.beginPath();
          ctx.moveTo(shipS.x, shipS.y);
          ctx.lineTo(astS.x, astS.y);
          ctx.strokeStyle = '#ffaa00';
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.7;
          ctx.stroke();
          // Impact glow
          ctx.beginPath();
          ctx.arc(astS.x, astS.y, 8 * z, 0, Math.PI * 2);
          ctx.fillStyle = '#ffcc44';
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // Projectiles
      for (const proj of gs.projectiles) {
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
        const trailLen = Math.min(15, speed * 0.03) * z;
        ctx.lineTo(s.x - (proj.vx / speed) * trailLen, s.y - (proj.vy / speed) * trailLen);
        ctx.strokeStyle = color + '88';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Extra renders
      if (onRenderRef.current) onRenderRef.current(ctx, toScreen);

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // only mount/unmount

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', position: 'absolute', top: 0, left: 0 }}
    />
  );
}

