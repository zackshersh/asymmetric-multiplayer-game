import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../socket';
import { GameStateData, PilotInput } from '../types';
import GameCanvas from '../components/GameCanvas';

interface Props { gameState: GameStateData; }

export default function PilotView({ gameState }: Props) {
  const keys = useRef<Set<string>>(new Set());
  const inputRef = useRef<PilotInput>({ thrust: 0, rotate: 0, strafe: 0 });
  const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () => setDims({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keys.current.add(e.key.toLowerCase());
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const k = keys.current;
      let thrust = 0, rotate = 0, strafe = 0;
      if (k.has('w') || k.has('arrowup'))    thrust = 1;
      if (k.has('s') || k.has('arrowdown'))  thrust = -0.3;
      if (k.has('a') || k.has('arrowleft'))  rotate = -1;
      if (k.has('d') || k.has('arrowright')) rotate = 1;
      if (k.has('q')) strafe = -1;
      if (k.has('e')) strafe = 1;

      const input: PilotInput = { thrust, rotate, strafe };
      if (JSON.stringify(input) !== JSON.stringify(inputRef.current)) {
        inputRef.current = input;
        socket.emit('pilotInput', input);
      }
    }, 33);
    return () => clearInterval(interval);
  }, []);

  const ship = gameState.spaceship;
  const speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);

  const renderHud = useCallback((ctx: CanvasRenderingContext2D) => {
    const { w, h } = dims;
    // Velocity vector
    ctx.save();
    ctx.translate(w - 80, h - 80);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, Math.PI * 2);
    ctx.stroke();
    if (speed > 0.1) {
      const maxSpd = 350;
      const len = Math.min(50, (speed / maxSpd) * 50);
      const vAngle = Math.atan2(ship.vy, ship.vx);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(vAngle) * len, Math.sin(vAngle) * len);
      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    // Speed text
    ctx.fillStyle = '#00ff41';
    ctx.font = '12px Courier New';
    ctx.fillText(`SPD: ${speed.toFixed(0)}`, w - 120, h - 15);
    ctx.fillText(`ANG: ${(ship.angle * 180 / Math.PI).toFixed(0)}°`, w - 120, h - 30);
  }, [dims, ship, speed]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0a0f' }}>
      <GameCanvas
        gameState={gameState}
        cameraX={ship.x}
        cameraY={ship.y}
        zoom={1}
        width={dims.w}
        height={dims.h}
        onRender={(ctx, _toScreen) => {
          renderHud(ctx);
        }}
      />

      {/* HUD overlay */}
      <div style={{
        position: 'absolute', top: 16, left: 16,
        fontFamily: "'Courier New', Courier, monospace",
        color: '#00ff41', fontSize: 13, pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 14, color: '#00bfff', marginBottom: 8 }}>◆ PILOT STATION</div>

        {/* Health bar */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 2 }}>HULL {ship.health.toFixed(0)}/{ship.maxHealth}</div>
          <div style={{ width: 180, height: 8, background: '#222', border: '1px solid #444' }}>
            <div style={{ width: `${(ship.health / ship.maxHealth) * 100}%`, height: '100%', background: ship.health / ship.maxHealth > 0.5 ? '#00ff41' : '#ff4444', transition: 'width 0.1s' }} />
          </div>
        </div>

        {/* Shield bar */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 2 }}>SHIELDS {ship.shields.toFixed(0)}/{ship.maxShields}{ship.shieldRegenPaused ? ' [REGEN PAUSED]' : ''}</div>
          <div style={{ width: 180, height: 8, background: '#222', border: '1px solid #444' }}>
            <div style={{ width: `${(ship.shields / ship.maxShields) * 100}%`, height: '100%', background: '#00bfff', transition: 'width 0.1s' }} />
          </div>
        </div>

        <div style={{ color: '#888', fontSize: 11, marginTop: 8 }}>
          <div>ORE: {ship.ore}</div>
          <div style={{ marginTop: 4, color: '#444' }}>W/↑ Thrust  S/↓ Brake</div>
          <div style={{ color: '#444' }}>A/← Rotate Left  D/→ Right</div>
          <div style={{ color: '#444' }}>Q/E Strafe (if upgraded)</div>
        </div>
      </div>

      {/* Component status */}
      <div style={{
        position: 'absolute', top: 16, right: 16,
        fontFamily: "'Courier New', Courier, monospace",
        color: '#888', fontSize: 11, pointerEvents: 'none',
      }}>
        {Object.entries(ship.components).map(([name, comp]) => (
          <div key={name} style={{ marginBottom: 4 }}>
            <span style={{ color: comp.broken ? '#ff4444' : '#00ff41', marginRight: 6 }}>
              {comp.broken ? '✗' : '✓'}
            </span>
            <span style={{ textTransform: 'uppercase' }}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
