import { socket } from '../socket';
import { GameStateData, Role } from '../types';

const ROLES: { role: Role; title: string; desc: string; color: string }[] = [
  { role: 'pilot',     title: '[ PILOT ]',     color: '#00ff41', desc: 'Control the spaceship thrust and rotation. Navigate through asteroid fields and enemy fire.' },
  { role: 'gunner',    title: '[ GUNNER ]',    color: '#00bfff', desc: 'Aim the turret with your mouse. Fire the main cannon and mining laser. Switch to missiles.' },
  { role: 'engineer',  title: '[ ENGINEER ]',  color: '#ffaa00', desc: 'Manage energy distribution between thrusters, weapons, and shields. Repair components and purchase upgrades.' },
  { role: 'commander', title: '[ COMMANDER ]', color: '#ff4444', desc: 'Command RTS units on a tactical map. Build structures, produce units, gather ore, and destroy the crew.' },
];

interface Props {
  gameState: GameStateData;
  myRole: Role | null;
}

export default function LobbyView({ gameState, myRole }: Props) {
  const takenRoles = new Map<Role, string>();
  for (const p of gameState.players) {
    if (p.role) takenRoles.set(p.role, p.name);
  }

  const handleJoin = (role: Role) => {
    socket.emit('joinGame', { role });
  };

  const phase = gameState.phase;

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#0a0a0f',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Courier New', Courier, monospace",
    }}>
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 36, color: '#00ff41', letterSpacing: 8, marginBottom: 8 }}>
          ◆ ASYMMETRIC WARFARE ◆
        </div>
        <div style={{ fontSize: 14, color: '#444', letterSpacing: 4 }}>
          TACTICAL MULTIPLAYER SPACESHIP COMBAT
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 40 }}>
        {ROLES.map(({ role, title, desc, color }) => {
          const taken = takenRoles.get(role);
          const isMe = myRole === role;
          const isTaken = !!taken && !isMe;
          return (
            <div
              key={role}
              onClick={() => !isTaken && handleJoin(role)}
              style={{
                width: 220,
                border: `2px solid ${isMe ? color : isTaken ? '#333' : '#333'}`,
                background: isMe ? `${color}22` : '#0d0d1a',
                padding: 20,
                cursor: isTaken ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                opacity: isTaken ? 0.5 : 1,
                position: 'relative',
              }}
              onMouseEnter={e => { if (!isTaken) (e.currentTarget as HTMLDivElement).style.borderColor = color; }}
              onMouseLeave={e => { if (!isTaken && !isMe) (e.currentTarget as HTMLDivElement).style.borderColor = '#333'; }}
            >
              <div style={{ color, fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>{title}</div>
              <div style={{ color: '#888', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>{desc}</div>
              {taken ? (
                <div style={{ color: isMe ? color : '#666', fontSize: 12 }}>
                  {isMe ? '► YOU' : `► ${taken}`}
                </div>
              ) : (
                <div style={{ color: '#444', fontSize: 12 }}>► AVAILABLE</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', color: '#555' }}>
        {phase === 'lobby' ? (
          <>
            <div style={{ marginBottom: 10 }}>
              {gameState.players.length} player(s) connected
            </div>
            <div style={{ color: '#444', fontSize: 13 }}>
              Game starts automatically when Pilot + Commander are ready
            </div>
          </>
        ) : (
          <div style={{ color: '#ffaa00' }}>Game in progress — spectating</div>
        )}
      </div>

      <div style={{ marginTop: 30, color: '#333', fontSize: 12 }}>
        PLAYERS: {gameState.players.map(p => `${p.name}${p.role ? `:${p.role}` : ''}`).join(' | ')}
      </div>
    </div>
  );
}
