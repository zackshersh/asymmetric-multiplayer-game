import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../socket';
import { GameStateData, GunnerInput } from '../types';
import GameCanvas from '../components/GameCanvas';

interface Props { gameState: GameStateData; }

export default function GunnerView({ gameState }: Props) {
  const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });
  const turretAngle = useRef(0);
  const firing = useRef(false);
  const miningLaser = useRef(false);
  const missileMode = useRef(false);

  useEffect(() => {
    const onResize = () => setDims({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const ship = gameState.spaceship;

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dims.w / 2;
      const dy = e.clientY - dims.h / 2;
      turretAngle.current = Math.atan2(dy, dx);

      const input: GunnerInput = {
        angle: turretAngle.current,
        firing: firing.current,
        miningLaser: miningLaser.current,
        missileMode: missileMode.current,
      };
      socket.emit('gunnerInput', input);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        firing.current = true;
      } else if (e.button === 2) {
        miningLaser.current = true;
      }
      const input: GunnerInput = {
        angle: turretAngle.current,
        firing: firing.current,
        miningLaser: miningLaser.current,
      };
      socket.emit('gunnerInput', input);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) firing.current = false;
      else if (e.button === 2) { miningLaser.current = false; }
      const input: GunnerInput = {
        angle: turretAngle.current,
        firing: firing.current,
        miningLaser: miningLaser.current,
      };
      socket.emit('gunnerInput', input);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') missileMode.current = !missileMode.current;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('contextmenu', e => e.preventDefault());

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [dims, ship]);

  const renderExtra = useCallback((ctx: CanvasRenderingContext2D, toScreen: (wx: number, wy: number) => { x: number; y: number }) => {
    // Draw turret aim line
    const s = toScreen(ship.x, ship.y);
    const turretLen = 60;
    const angle = ship.turretAngle;
    ctx.beginPath();
    ctx.moveTo(s.x + Math.cos(angle) * 20, s.y + Math.sin(angle) * 20);
    ctx.lineTo(s.x + Math.cos(angle) * turretLen, s.y + Math.sin(angle) * turretLen);
    ctx.strokeStyle = '#00ff4188';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Mining laser beam line (show direction)
    if (miningLaser.current) {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + Math.cos(angle) * 500, s.y + Math.sin(angle) * 500);
      ctx.strokeStyle = '#ffaa0066';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Crosshair at cursor center
    const cx = dims.w / 2;
    const cy = dims.h / 2;
    ctx.strokeStyle = '#00ff41';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy); ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy + 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.strokeStyle = '#00ff4144';
    ctx.stroke();
  }, [ship, dims]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#0a0a0f', cursor: 'none' }}>
      <GameCanvas
        gameState={gameState}
        cameraX={ship.x}
        cameraY={ship.y}
        zoom={1}
        width={dims.w}
        height={dims.h}
        onRender={renderExtra}
      />

      {/* HUD */}
      <div style={{
        position: 'absolute', top: 16, left: 16,
        fontFamily: "'Courier New', Courier, monospace",
        color: '#00bfff', fontSize: 13, pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>◆ GUNNER STATION</div>
        <div style={{ color: '#888', fontSize: 11 }}>
          <div>TURRET: {(ship.turretAngle * 180 / Math.PI).toFixed(1)}°</div>
          <div>COOLDOWN: {ship.mainGunCooldown > 0 ? `${ship.mainGunCooldown}ms` : 'READY'}</div>
          {ship.upgrades.hasMissiles && (
            <div style={{ marginTop: 4 }}>
              MISSILES: {ship.missiles}/{ship.maxMissiles}
              {missileMode.current && <span style={{ color: '#ffaa00' }}> [MISSILE MODE]</span>}
            </div>
          )}
          <div style={{ marginTop: 8, color: '#444' }}>
            <div>LMB: Fire main gun</div>
            <div>RMB: Mining laser (aim at asteroid)</div>
            <div>M: Missile mode</div>
          </div>
        </div>
      </div>

      {/* Health/shield */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        fontFamily: "'Courier New', Courier, monospace",
        color: '#888', fontSize: 11, pointerEvents: 'none',
      }}>
        <div style={{ marginBottom: 4 }}>HULL: {ship.health.toFixed(0)}/{ship.maxHealth}</div>
        <div style={{ width: 150, height: 6, background: '#222', border: '1px solid #333', marginBottom: 6 }}>
          <div style={{ width: `${(ship.health / ship.maxHealth) * 100}%`, height: '100%', background: '#00ff41' }} />
        </div>
        <div style={{ marginBottom: 4 }}>SHIELDS: {ship.shields.toFixed(0)}/{ship.maxShields}</div>
        <div style={{ width: 150, height: 6, background: '#222', border: '1px solid #333' }}>
          <div style={{ width: `${(ship.shields / ship.maxShields) * 100}%`, height: '100%', background: '#00bfff' }} />
        </div>
      </div>

      {/* Mining laser indicator */}
      {miningLaser.current && (
        <div style={{
          position: 'absolute', top: '50%', right: 20,
          fontFamily: "'Courier New', Courier, monospace",
          color: '#ffaa00', fontSize: 12, pointerEvents: 'none',
        }}>
          ◆ MINING LASER ACTIVE {ship.miningLaserTarget ? '— LOCKED' : '— SCANNING'}
        </div>
      )}
    </div>
  );
}
