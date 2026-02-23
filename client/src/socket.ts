import { io } from 'socket.io-client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const SERVER_URL = ((import.meta as unknown as Record<string, Record<string, string>>).env?.VITE_SERVER_URL) || 'http://localhost:3001';

export const socket = io(SERVER_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});
