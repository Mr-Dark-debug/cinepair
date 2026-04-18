/**
 * @fileoverview Main entry point for the CinePair signaling server.
 * Wires up all modules: Express app, Socket.IO, services, and state.
 * @module index
 */

import 'dotenv/config';
import { createServer } from 'http';
import { config } from './config/env.js';
import { createApp } from './app.js';
import { createSocketServer } from './socket/socketServer.js';
import { registerPresenceGateway } from './socket/presenceGateway.js';
import { registerSignalingGateway } from './socket/signalingGateway.js';
import { MemoryRoomStore } from './state/MemoryRoomStore.js';
import { RoomService } from './services/roomService.js';
import { IceServerService } from './services/iceServerService.js';
import { createLogger } from './observability/logger.js';

const logger = createLogger('Server');

// ─── Initialize Services ──────────────────────────────────

const roomStore = new MemoryRoomStore();
const roomService = new RoomService(roomStore, config);
const iceServerService = new IceServerService(config);

// ─── Create HTTP Server ───────────────────────────────────

const app = createApp({
  roomService,
  iceServerService,
  getSocketCount: () => io.sockets.sockets.size,
});

const httpServer = createServer(app);

// ─── Create Socket.IO Server ──────────────────────────────

const io = createSocketServer(httpServer, config);

// ─── Register Socket Gateways ─────────────────────────────

registerPresenceGateway(io, roomService);
registerSignalingGateway(io, roomService);

// ─── Start Server ─────────────────────────────────────────
// Render free tier: bind to PORT env and 0.0.0.0

const port = Number(process.env.PORT || 3001);
httpServer.listen(port, '0.0.0.0', () => {
  logger.info(
    {
      port,
      host: '0.0.0.0',
      env: config.nodeEnv,
      corsOrigins: config.corsOrigins,
    },
    `CinePair Signaling Server running on 0.0.0.0:${port}`
  );
});

// ─── Graceful Shutdown ────────────────────────────────────

const shutdown = (): void => {
  logger.info('Shutting down gracefully...');
  roomService.shutdown();
  io.close();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
