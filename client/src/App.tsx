import { useState, useEffect } from 'react';
import { socket } from './socket';
import { GameStateData, Role } from './types';
import LobbyView from './views/LobbyView';
import PilotView from './views/PilotView';
import GunnerView from './views/GunnerView';
import EngineerView from './views/EngineerView';
import CommanderView from './views/CommanderView';
import './App.css';

export default function App() {
  const [gameState, setGameState] = useState<GameStateData | null>(null);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [connected, setConnected] = useState(false);
  const [gameOver, setGameOver] = useState<{ winner: string } | null>(null);

  useEffect(() => {
    socket.connect();

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('gameState', (state: GameStateData) => setGameState(state));
    socket.on('roleAssigned', (data: { role: Role }) => setMyRole(data.role));
    socket.on('gameOver', (data: { winner: string }) => setGameOver(data));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('gameState');
      socket.off('roleAssigned');
      socket.off('gameOver');
    };
  }, []);

  if (!connected) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 24, color: '#00ff41' }}>◌ CONNECTING TO SERVER...</div>
        <div style={{ color: '#444', fontSize: 14 }}>Make sure the server is running on port 3001</div>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 20 }}>
        <div style={{ fontSize: 48, color: gameOver.winner === 'crew' ? '#00ff41' : '#ff4444' }}>
          {gameOver.winner === 'crew' ? '◆ CREW VICTORIOUS ◆' : '◆ COMMANDER VICTORIOUS ◆'}
        </div>
        <div style={{ color: '#888' }}>Refresh to play again</div>
      </div>
    );
  }

  if (!gameState) return null;

  if (gameState.phase === 'lobby' || !myRole) {
    return <LobbyView gameState={gameState} myRole={myRole} />;
  }

  switch (myRole) {
    case 'pilot':     return <PilotView gameState={gameState} />;
    case 'gunner':    return <GunnerView gameState={gameState} />;
    case 'engineer':  return <EngineerView gameState={gameState} />;
    case 'commander': return <CommanderView gameState={gameState} />;
    default:          return <LobbyView gameState={gameState} myRole={myRole} />;
  }
}
