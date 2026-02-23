import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import { GameStateData, EngineerInput } from '../types';

interface Props { gameState: GameStateData; }

const UPGRADES = [
  { key: 'weapons_1', label: 'Weapons Mk.I', cost: 80, track: 'weapons', level: 1 },
  { key: 'weapons_2', label: 'Weapons Mk.II', cost: 150, track: 'weapons', level: 2 },
  { key: 'weapons_3', label: 'Weapons Mk.III', cost: 250, track: 'weapons', level: 3 },
  { key: 'weapons_4', label: 'Weapons Mk.IV', cost: 400, track: 'weapons', level: 4 },
  { key: 'thrusters_1', label: 'Thruster Mk.I', cost: 80, track: 'thrusters', level: 1 },
  { key: 'thrusters_2', label: 'Thruster Mk.II', cost: 150, track: 'thrusters', level: 2 },
  { key: 'thrusters_3', label: 'Thruster Mk.III', cost: 250, track: 'thrusters', level: 3 },
  { key: 'thrusters_4', label: 'Thruster Mk.IV', cost: 400, track: 'thrusters', level: 4 },
  { key: 'shields_1', label: 'Shield Mk.I', cost: 80, track: 'shields', level: 1 },
  { key: 'shields_2', label: 'Shield Mk.II', cost: 150, track: 'shields', level: 2 },
  { key: 'shields_3', label: 'Shield Mk.III', cost: 250, track: 'shields', level: 3 },
  { key: 'shields_4', label: 'Shield Mk.IV', cost: 400, track: 'shields', level: 4 },
  { key: 'hasStrafing', label: 'Strafing Jets', cost: 100, track: 'special', level: 0 },
  { key: 'hasMountedGuns', label: 'Mounted Guns', cost: 120, track: 'special', level: 0 },
  { key: 'hasMissiles', label: 'Missile Bays', cost: 200, track: 'special', level: 0 },
  { key: 'hasActiveScan', label: 'Active Scan', cost: 150, track: 'special', level: 0 },
  { key: 'hasCollisionShield', label: 'Collision Shield', cost: 100, track: 'special', level: 0 },
];

const BTN_STYLE: React.CSSProperties = {
  background: '#0d1a0d',
  border: '1px solid #00ff41',
  color: '#00ff41',
  padding: '6px 12px',
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: 11,
  cursor: 'pointer',
  marginBottom: 4,
  width: '100%',
  textAlign: 'left',
};

const DISABLED_BTN: React.CSSProperties = {
  ...BTN_STYLE,
  opacity: 0.35,
  cursor: 'not-allowed',
  border: '1px solid #333',
  color: '#555',
};

const OWNED_BTN: React.CSSProperties = {
  ...BTN_STYLE,
  border: '1px solid #555',
  color: '#555',
  cursor: 'default',
};

// Small ship canvas component
function ShipWindow({ ship }: { ship: GameStateData['spaceship'] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const shipRef = useRef(ship);
  const thrustTimeRef = useRef(0);
  useEffect(() => { shipRef.current = ship; }, [ship]);

  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const W = 200, H = 200;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, W, H);
      // Grid dots
      ctx.fillStyle = '#ffffff22';
      for (let gx = 0; gx < W; gx += 20) {
        for (let gy = 0; gy < H; gy += 20) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const s = shipRef.current;
      const cx = W / 2, cy = H / 2;
      const z = 1.2;
      if (s.thrusting) thrustTimeRef.current++;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(s.angle);
      // Flame
      if (s.thrusting) {
        const fl = (0.6 + 0.4 * Math.sin(thrustTimeRef.current * 0.03)) * 28 * z;
        ctx.beginPath();
        ctx.moveTo(-12 * z, 0);
        ctx.lineTo(-12 * z - fl, (Math.random() - 0.5) * 4 * z);
        ctx.strokeStyle = '#ff6600';
        ctx.lineWidth = 3 * z;
        ctx.globalAlpha = 0.85;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // Shield
      if (s.shields > 0) {
        const alpha = Math.min(0.4, s.shields / s.maxShields * 0.4);
        ctx.beginPath();
        ctx.arc(0, 0, 40 * z, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,191,255,${alpha})`;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(30 * z, 0);
      ctx.lineTo(-20 * z, 18 * z);
      ctx.lineTo(-12 * z, 0);
      ctx.lineTo(-20 * z, -18 * z);
      ctx.closePath();
      ctx.strokeStyle = '#00ff41';
      ctx.fillStyle = '#0d1a0d';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(12 * z, 0, 6 * z, 0, Math.PI * 2);
      ctx.fillStyle = '#00bfff44';
      ctx.strokeStyle = '#00bfff';
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <canvas ref={canvasRef} width={200} height={200}
      style={{ display: 'block', border: '1px solid #1a1a2e', borderRadius: 4 }} />
  );
}

export default function EngineerView({ gameState }: Props) {
  const ship = gameState.spaceship;
  const [thrust, setThrust] = useState(Math.round(ship.thrusterPower * 100));
  const [weapon, setWeapon] = useState(Math.round(ship.weaponPower * 100));
  const [shield, setShield] = useState(Math.round(ship.shieldPower * 100));

  // Sync from server (only when not actively editing)
  const lastSentRef = useRef({ t: thrust, w: weapon, s: shield });
  useEffect(() => {
    setThrust(Math.round(ship.thrusterPower * 100));
    setWeapon(Math.round(ship.weaponPower * 100));
    setShield(Math.round(ship.shieldPower * 100));
  }, [ship.thrusterPower, ship.weaponPower, ship.shieldPower]);

  const sendEnergy = (t: number, w: number, s: number) => {
    lastSentRef.current = { t, w, s };
    const input: EngineerInput = {
      thrusterPower: t / 100,
      weaponPower: w / 100,
      shieldPower: s / 100,
    };
    socket.emit('engineerInput', input);
  };

  // When one slider increases and would exceed 100%, steal from others proportionally
  // When one slider decreases, don't auto-raise others
  const handleThrust = (v: number) => {
    if (v > thrust) {
      // Increasing: take from others
      const excess = (v + weapon + shield) - 100;
      if (excess > 0) {
        const total = weapon + shield;
        const w = total > 0 ? Math.max(0, Math.round(weapon - excess * (weapon / total))) : 0;
        const s = total > 0 ? Math.max(0, 100 - v - w) : Math.max(0, shield - excess);
        setThrust(v); setWeapon(w); setShield(s);
        sendEnergy(v, w, s);
      } else {
        setThrust(v);
        sendEnergy(v, weapon, shield);
      }
    } else {
      // Decreasing: just lower this slider
      setThrust(v);
      sendEnergy(v, weapon, shield);
    }
  };

  const handleWeapon = (v: number) => {
    if (v > weapon) {
      const excess = (thrust + v + shield) - 100;
      if (excess > 0) {
        const total = thrust + shield;
        const t = total > 0 ? Math.max(0, Math.round(thrust - excess * (thrust / total))) : 0;
        const s = total > 0 ? Math.max(0, 100 - v - t) : Math.max(0, shield - excess);
        setWeapon(v); setThrust(t); setShield(s);
        sendEnergy(t, v, s);
      } else {
        setWeapon(v);
        sendEnergy(thrust, v, shield);
      }
    } else {
      setWeapon(v);
      sendEnergy(thrust, v, shield);
    }
  };

  const handleShield = (v: number) => {
    if (v > shield) {
      const excess = (thrust + weapon + v) - 100;
      if (excess > 0) {
        const total = thrust + weapon;
        const t = total > 0 ? Math.max(0, Math.round(thrust - excess * (thrust / total))) : 0;
        const w = total > 0 ? Math.max(0, 100 - v - t) : Math.max(0, weapon - excess);
        setShield(v); setThrust(t); setWeapon(w);
        sendEnergy(t, w, v);
      } else {
        setShield(v);
        sendEnergy(thrust, weapon, v);
      }
    } else {
      setShield(v);
      sendEnergy(thrust, weapon, v);
    }
  };

  const repairComponent = (name: string) => {
    socket.emit('engineerInput', { repairComponent: name } as EngineerInput);
  };

  const purchaseUpgrade = (key: string) => {
    socket.emit('engineerInput', { purchaseUpgrade: key } as EngineerInput);
  };

  const total = thrust + weapon + shield;
  const utilization = Math.min(100, total);

  const isUpgradeOwned = (upg: typeof UPGRADES[0]) => {
    const upgrades = ship.upgrades;
    if (upg.track === 'weapons') return upgrades.weapons >= upg.level;
    if (upg.track === 'thrusters') return upgrades.thrusters >= upg.level;
    if (upg.track === 'shields') return upgrades.shields >= upg.level;
    return !!(upgrades as unknown as Record<string, unknown>)[upg.key];
  };

  const isUpgradeAvailable = (upg: typeof UPGRADES[0]) => {
    if (isUpgradeOwned(upg)) return false;
    const upgrades = ship.upgrades;
    if (upg.track === 'weapons') return upgrades.weapons === upg.level - 1;
    if (upg.track === 'thrusters') return upgrades.thrusters === upg.level - 1;
    if (upg.track === 'shields') return upgrades.shields === upg.level - 1;
    return true;
  };

  const S = {
    container: {
      width: '100vw', height: '100vh', background: '#0a0a0f',
      fontFamily: "'Courier New', Courier, monospace",
      color: '#00ff41', padding: 20, overflowY: 'auto' as const,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr 200px',
      gap: 20,
    },
    panel: {
      border: '1px solid #1a1a2e',
      padding: 16, background: '#0d0d1a',
    },
    title: { color: '#00bfff', fontSize: 13, marginBottom: 12, letterSpacing: 2 },
    label: { color: '#888', fontSize: 11, marginBottom: 4 },
    slider: { width: '100%', accentColor: '#00ff41', marginBottom: 8 },
    compBox: (broken: boolean, _hp: number, _maxHp: number) => ({
      border: `1px solid ${broken ? '#ff4444' : '#333'}`,
      padding: 10, marginBottom: 8,
      background: broken ? '#1a0000' : '#0d0d1a',
      cursor: broken ? 'pointer' : 'default',
    }),
  };

  return (
    <div style={S.container}>
      {/* Energy Management */}
      <div style={S.panel}>
        <div style={S.title}>◆ ENERGY DISTRIBUTION</div>

        <div style={{ marginBottom: 16 }}>
          <div style={S.label}>THRUSTERS: {thrust}%</div>
          <input type="range" min={0} max={100} value={thrust} onChange={e => handleThrust(+e.target.value)} style={S.slider} />
          <div style={{ width: '100%', height: 6, background: '#222', border: '1px solid #333' }}>
            <div style={{ width: `${thrust}%`, height: '100%', background: '#00ff41' }} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={S.label}>WEAPONS: {weapon}%</div>
          <input type="range" min={0} max={100} value={weapon} onChange={e => handleWeapon(+e.target.value)} style={{ ...S.slider, accentColor: '#ff4444' }} />
          <div style={{ width: '100%', height: 6, background: '#222', border: '1px solid #333' }}>
            <div style={{ width: `${weapon}%`, height: '100%', background: '#ff4444' }} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={S.label}>SHIELDS: {shield}%</div>
          <input type="range" min={0} max={100} value={shield} onChange={e => handleShield(+e.target.value)} style={{ ...S.slider, accentColor: '#00bfff' }} />
          <div style={{ width: '100%', height: 6, background: '#222', border: '1px solid #333' }}>
            <div style={{ width: `${shield}%`, height: '100%', background: '#00bfff' }} />
          </div>
        </div>

        {/* Energy utilization meter */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>
            ENERGY UTILIZATION: {utilization}%
            {total > 100 && <span style={{ color: '#ff4444' }}> ⚠ OVER BUDGET</span>}
          </div>
          <div style={{ width: '100%', height: 8, background: '#222', border: '1px solid #333' }}>
            <div style={{
              width: `${utilization}%`, height: '100%',
              background: total > 100 ? '#ff4444' : total > 85 ? '#ffaa00' : '#00ff41',
              transition: 'width 0.1s',
            }} />
          </div>
        </div>

        <div style={{ marginTop: 16, borderTop: '1px solid #1a1a2e', paddingTop: 12 }}>
          <div style={S.label}>SHIP STATUS</div>
          <div style={{ fontSize: 12, color: '#888' }}>
            <div>HULL: {ship.health.toFixed(0)}/{ship.maxHealth}</div>
            <div style={{ width: '100%', height: 5, background: '#222', margin: '3px 0 8px' }}>
              <div style={{ width: `${(ship.health / ship.maxHealth) * 100}%`, height: '100%', background: '#00ff41' }} />
            </div>
            <div>SHIELDS: {ship.shields.toFixed(0)}/{ship.maxShields}</div>
            <div style={{ width: '100%', height: 5, background: '#222', margin: '3px 0' }}>
              <div style={{ width: `${(ship.shields / ship.maxShields) * 100}%`, height: '100%', background: '#00bfff' }} />
            </div>
            <div style={{ marginTop: 8 }}>ORE: <span style={{ color: '#ffaa00' }}>{ship.ore}</span></div>
          </div>
        </div>
      </div>

      {/* Components */}
      <div style={S.panel}>
        <div style={S.title}>◆ SHIP COMPONENTS</div>
        {Object.entries(ship.components).map(([name, comp]) => (
          <div
            key={name}
            style={S.compBox(comp.broken, comp.health, comp.maxHealth)}
            onClick={() => comp.broken && repairComponent(name)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ color: comp.broken ? '#ff4444' : '#00ff41', textTransform: 'uppercase', fontSize: 12 }}>
                {comp.broken ? '✗ ' : '✓ '}{name}
              </span>
              <span style={{ color: '#888', fontSize: 11 }}>{comp.health.toFixed(0)}/{comp.maxHealth}</span>
            </div>
            <div style={{ width: '100%', height: 5, background: '#222' }}>
              <div style={{
                width: `${(comp.health / comp.maxHealth) * 100}%`, height: '100%',
                background: comp.broken ? '#ff4444' : comp.health / comp.maxHealth > 0.5 ? '#00ff41' : '#ffaa00',
              }} />
            </div>
            {comp.broken && (
              <div style={{ color: '#ff4444', fontSize: 10, marginTop: 4 }}>CLICK TO REPAIR (+20 HP)</div>
            )}
          </div>
        ))}
      </div>

      {/* Upgrades */}
      <div style={S.panel}>
        <div style={S.title}>◆ UPGRADES</div>
        <div style={{ color: '#ffaa00', fontSize: 13, marginBottom: 12 }}>
          ORE: {ship.ore}
        </div>

        {['weapons', 'thrusters', 'shields', 'special'].map(track => (
          <div key={track} style={{ marginBottom: 16 }}>
            <div style={{ color: '#555', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 2 }}>
              {track}
            </div>
            {UPGRADES.filter(u => u.track === track).map(upg => {
              const owned = isUpgradeOwned(upg);
              const available = isUpgradeAvailable(upg);
              const canAfford = ship.ore >= upg.cost;
              if (owned) {
                return <button key={upg.key} style={OWNED_BTN} disabled>✓ {upg.label}</button>;
              }
              return (
                <button
                  key={upg.key}
                  style={available && canAfford ? BTN_STYLE : DISABLED_BTN}
                  disabled={!available || !canAfford}
                  onClick={() => purchaseUpgrade(upg.key)}
                >
                  {upg.label} [{upg.cost} ore]
                  {!canAfford && available && <span style={{ color: '#ff4444' }}> ⚠</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Ship window */}
      <div style={{ ...S.panel, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={S.title}>◆ SHIP CAM</div>
        <ShipWindow ship={ship} />
        <div style={{ color: '#555', fontSize: 10, textAlign: 'center' }}>
          <div>HULL {((ship.health / ship.maxHealth) * 100).toFixed(0)}%</div>
          <div>SHIELD {((ship.shields / ship.maxShields) * 100).toFixed(0)}%</div>
          <div style={{ color: ship.thrusting ? '#00ff41' : '#333', marginTop: 4 }}>
            {ship.thrusting ? '▲ THRUSTING' : '— COASTING'}
          </div>
        </div>
      </div>
    </div>
  );
}
