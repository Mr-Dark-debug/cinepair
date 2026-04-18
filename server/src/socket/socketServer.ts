/**
 * @fileoverview Socket.IO server initialization and authentication middleware.
 * Validates JWT session tokens on connection.
 * @module socket/socketServer
 */

import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { verifySessionToken } from '../services/tokenService.js';
import { socketAuthSchema } from '../validation/schemas.js';
import { createLogger } from '../observability/logger.js';
import type { AppConfig } from '../config/env.js';

const logger = createLogger('SocketServer');

/** Socket data stored per connection */
export interface CinePairSocketData {
  userId: string;
  sessionId: string;
  roomCode: string | null;
  role: 'admin' | 'partner' | null;
  nickname: string;
}

/** Rate limiters for socket events */
export const socketRateLimiters = {
  /** Signaling: 60 events/sec burst per socket */
  signaling: new RateLimiterMemory({
    keyPrefix: 'ws_signaling',
    points: 60,
    duration: 1,
  }),
  /** Chat: 5 messages/sec, max 2KB per socket */
  chat: new RateLimiterMemory({
    keyPrefix: 'ws_chat',
    points: 5,
    duration: 1,
  }),
  /** General events: 30/sec per socket */
  general: new RateLimiterMemory({
    keyPrefix: 'ws_general',
    points: 30,
    duration: 1,
  }),
};

/**
 * Creates and configures the Socket.IO server with auth middleware.
 */
export function createSocketServer(
  httpServer: HttpServer,
  config: AppConfig,
): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigins,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 30000,
    pingInterval: 15000,
    maxHttpBufferSize: 1e6, // 1MB
    connectionStateRecovery: {
      maxDisconnectionDuration: config.reconnectGraceSeconds * 1000,
      skipMiddlewares: false,
    },
  });

  // ─── Auth Middleware ─────────────────────────────────────
  io.use((socket, next) => {
    try {
      const authResult = socketAuthSchema.safeParse(socket.handshake.auth);

      if (authResult.success && authResult.data.sessionToken) {
        // Verify JWT
        const payload = verifySessionToken(authResult.data.sessionToken);
        if (payload) {
          socket.data = {
            userId: payload.userId,
            sessionId: payload.sessionId,
            roomCode: payload.roomCode,
            role: payload.role,
            nickname: payload.nickname,
          } satisfies CinePairSocketData;
          next();
          return;
        }
      }

      // Allow unauthenticated connections (they'll get a token on room create/join)
      socket.data = {
        userId: '',
        sessionId: '',
        roomCode: null,
        role: null,
        nickname: '',
      } satisfies CinePairSocketData;
      next();
    } catch (err) {
      logger.warn({ err }, 'Socket auth failed');
      next(new Error('Authentication failed'));
    }
  });

  // ─── Unknown Event Rejection ────────────────────────────
  // Socket.IO doesn't have built-in unknown event rejection,
  // but we wrap all handlers with validation in the gateways.

  logger.info({ corsOrigins: config.corsOrigins }, 'Socket.IO server created');
  return io;
}
