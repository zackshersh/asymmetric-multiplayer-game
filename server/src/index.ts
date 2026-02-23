import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { GameState } from './game/GameState';
import {
  Role, PilotInput, GunnerInput, EngineerInput, CommanderInputData,
} from './types/index';

const PORT = 3001;
const TICK_RATE_MS = 50;

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const gameState = new GameState();

// Game loop
setInterval(() => {
  if (gameState.getState().phase === 'playing') {
    const state = gameState.tick();
    io.emit('gameState', state);

    if (state.phase === 'gameOver') {
      io.emit('gameOver', { winner: state.winner });
    }
  }
}, TICK_RATE_MS);

io.on('connection', (socket: Socket) => {
  console.log(`Player connected: ${socket.id}`);

  const playerName = `Player_${socket.id.substring(0, 4)}`;
  gameState.addPlayer(socket.id, playerName);

  // Send current state to newly connected player
  socket.emit('gameState', gameState.getState());

  socket.on('joinGame', (data: { role: Role }) => {
    const success = gameState.assignRole(socket.id, data.role);
    if (success) {
      socket.emit('roleAssigned', { role: data.role });
      io.emit('gameState', gameState.getState());

      if (gameState.canStart() && gameState.getState().phase === 'lobby') {
        gameState.startGame();
        io.emit('gameStarted', {});
        io.emit('gameState', gameState.getState());
      }
    } else {
      socket.emit('roleError', { message: 'Role already taken' });
    }
  });

  socket.on('pilotInput', (input: PilotInput) => {
    if (gameState.getRole(socket.id) === 'pilot') {
      gameState.handlePilotInput(input);
    }
  });

  socket.on('gunnerInput', (input: GunnerInput) => {
    if (gameState.getRole(socket.id) === 'gunner') {
      gameState.handleGunnerInput(input);
    }
  });

  socket.on('engineerInput', (input: EngineerInput) => {
    if (gameState.getRole(socket.id) === 'engineer') {
      gameState.handleEngineerInput(input);
    }
  });

  socket.on('commanderInput', (input: CommanderInputData) => {
    if (gameState.getRole(socket.id) === 'commander') {
      gameState.handleCommanderInput(input);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    gameState.removePlayer(socket.id);
    io.emit('gameState', gameState.getState());
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', phase: gameState.getState().phase });
});

httpServer.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
});
