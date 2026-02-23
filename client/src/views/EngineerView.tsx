import { useState, useEffect } from 'react';
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

export default function EngineerView({ gameState }: Props) {
  const ship = gameState.spaceship;
  const [thrust, setThrust] = useState(Math.round(ship.thrusterPower * 100));
  const [weapon, setWeapon] = useState(Math.round(ship.weaponPower * 100));
  const [shield, setShield] = useState(Math.round(ship.shieldPower * 100));

  // Sync from server
  useEffect(() => {
    setThrust(Math.round(ship.thrusterPower * 100));
    setWeapon(Math.round(ship.weaponPower * 100));
    setShield(Math.round(ship.shieldPower * 100));
  }, [ship.thrusterPower, ship.weaponPower, ship.shieldPower]);

  const sendEnergy = (t: number, w: number, s: number) => {
    const total = t + w + s;
    if (Math.abs(total - 100) <= 2) {
      const input: EngineerInput = {
        thrusterPower: t / 100,
        weaponPower: w / 100,
        shieldPower: s / 100,
      };
      socket.emit('engineerInput', input);
    }
  };

  const handleThrust = (v: number) => {
    const remaining = 100 - v;
    const wRatio = weapon / (weapon + shield || 1);
    const w = Math.round(remaining * wRatio);
    const s = remaining - w;
    setThrust(v); setWeapon(w); setShield(s);
    sendEnergy(v, w, s);
  };

  const handleWeapon = (v: number) => {
    const remaining = 100 - v;
    const tRatio = thrust / (thrust + shield || 1);
    const t = Math.round(remaining * tRatio);
    const s = remaining - t;
    setWeapon(v); setThrust(t); setShield(s);
    sendEnergy(t, v, s);
  };

  const handleShield = (v: number) => {
    const remaining = 100 - v;
    const tRatio = thrust / (thrust + weapon || 1);
    const t = Math.round(remaining * tRatio);
    const w = remaining - t;
    setShield(v); setThrust(t); setWeapon(w);
    sendEnergy(t, w, v);
  };

  const repairComponent = (name: string) => {
    socket.emit('engineerInput', { repairComponent: name } as EngineerInput);
  };

  const purchaseUpgrade = (key: string) => {
    socket.emit('engineerInput', { purchaseUpgrade: key } as EngineerInput);
  };

  const total = thrust + weapon + shield;

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
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 20,
    },
    panel: {
      border: '1px solid #1a1a2e',
      padding: 16, background: '#0d0d1a',
    },
    title: { color: '#00bfff', fontSize: 13, marginBottom: 12, letterSpacing: 2 },
    label: { color: '#888', fontSize: 11, marginBottom: 4 },
    slider: { width: '100%', accentColor: '#00ff41', marginBottom: 8 },
    compBox: (broken: boolean, hp: number, maxHp: number) => ({
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

        <div style={{ color: Math.abs(total - 100) > 2 ? '#ff4444' : '#555', fontSize: 11 }}>
          TOTAL: {total}% {Math.abs(total - 100) > 2 ? '⚠ MUST SUM TO 100%' : '✓'}
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
    </div>
  );
}
