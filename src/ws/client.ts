import { io, Socket } from 'socket.io-client';

import { appEnv } from '../lib/env';
import { logger } from '../lib/logger';

const WS_URL = appEnv.wsUrl();

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  // Disconnect existing socket if any
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  if (!token) {
    logger.error('WebSocket: No token provided, cannot connect');
    throw new Error('Token required for WebSocket connection');
  }

  socket = io(WS_URL, {
    auth: {
      token,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect_error', (error) => {
    logger.warn('WebSocket connection error:', error.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
