import { io, Socket } from 'socket.io-client';

import { appEnv } from '../lib/env';
import { logger } from '../lib/logger';

const WS_URL = appEnv.wsUrl();

let socket: Socket | null = null;

function cleanToken(raw: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^Bearer\s+/i, '');
  if (!cleaned || cleaned === 'null' || cleaned === 'undefined') return '';
  return cleaned;
}

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

  const cleanedToken = cleanToken(token);
  if (!cleanedToken) {
    logger.error('WebSocket: No token provided, cannot connect');
    throw new Error('Token required for WebSocket connection');
  }

  socket = io(WS_URL, {
    auth: {
      token: cleanedToken,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect_error', (error) => {
    logger.warn('WebSocket connection error:', error.message);

    const msg = String(error?.message || '');
    if (
      /token verification error/i.test(msg) ||
      /invalid or expired access token/i.test(msg) ||
      /invalid or expired token/i.test(msg) ||
      /jwt expired/i.test(msg)
    ) {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
