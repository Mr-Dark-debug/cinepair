/**
 * @fileoverview Main entry point for the CinePair signaling server.
 * Sets up Express + Socket.IO with all event handlers for room management,
 * WebRTC signaling relay, chat messaging, and screen share coordination.
 * @module index
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './RoomManager.js';
import { Logger } from './utils/Logger.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  ServerConfig,
  ServerError,
} from './types.js';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

const config: ServerConfig = {
  port: parseInt(process.env.SIGNALING_PORT || '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  roomCodeLength: parseInt(process.env.ROOM_CODE_LENGTH || '8', 10),
  roomExpiryHours: parseInt(process.env.ROOM_EXPIRY_HOURS || '24', 10),
  maxUsersPerRoom: parseInt(process.env.MAX_USERS_PER_ROOM || '2', 10),
};

const logger = new Logger('Server');

// ─────────────────────────────────────────────────────────────
// Express + HTTP Server Setup
// ─────────────────────────────────────────────────────────────

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

/** Health check endpoint for deployment monitoring */
app.get('/health', (_req, res) => {
  const stats = roomManager.getStats();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    rooms: stats,
    timestamp: new Date().toISOString(),
  });
});

const httpServer = createServer(app);

// ─────────────────────────────────────────────────────────────
// Socket.IO Server Setup
// ─────────────────────────────────────────────────────────────

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
  },
  // Connection settings optimized for WebRTC signaling
  pingTimeout: 30000,
  pingInterval: 15000,
  maxHttpBufferSize: 1e6, // 1MB max payload
});

// ─────────────────────────────────────────────────────────────
// Room Manager Initialization
// ─────────────────────────────────────────────────────────────

const roomManager = new RoomManager(config);

// ─────────────────────────────────────────────────────────────
// Socket.IO Connection Handler
// ─────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Initialize socket data
  socket.data.roomCode = null;
  socket.data.role = null;
  socket.data.nickname = '';

  // ─────────────────────────────────────────────────────────
  // Room Creation
  // ─────────────────────────────────────────────────────────

  socket.on('room:create', (payload, callback) => {
    try {
      const room = roomManager.createRoom(
        socket.id,
        payload.nickname,
        payload.password || null,
        payload.requireApproval
      );

      // Store room info on the socket for disconnect handling
      socket.data.roomCode = room.code;
      socket.data.role = 'admin';
      socket.data.nickname = payload.nickname;

      // Join the Socket.IO room for broadcasting
      void socket.join(room.code);

      // Send response via callback
      callback({
        code: room.code,
        requireApproval: room.requireApproval,
        hasPassword: !!room.password,
      });

      logger.info(`Room created and admin joined Socket.IO room: ${room.code}`);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to create room', err);
      callback({ code: 'CREATE_FAILED', message: error } as ServerError);
    }
  });

  // ─────────────────────────────────────────────────────────
  // Room Joining
  // ─────────────────────────────────────────────────────────

  socket.on('room:join', (payload, callback) => {
    try {
      const result = roomManager.validateJoin(
        payload.code,
        payload.password || null,
        socket.id,
        payload.nickname
      );

      if (result.action === 'error') {
        callback({
          code: result.errorCode || 'JOIN_FAILED',
          message: result.error || 'Failed to join room',
        } as ServerError);
        return;
      }

      if (result.action === 'request' && result.room && result.request) {
        // Approval required: notify admin about the join request
        socket.data.nickname = payload.nickname;

        // Send notification to admin
        io.to(result.room.adminSocketId).emit('room:join-request', {
          id: result.request.id,
          socketId: result.request.socketId,
          nickname: result.request.nickname,
          createdAt: result.request.createdAt,
        });

        // Tell joiner they need to wait
        callback({
          code: 'APPROVAL_REQUIRED',
          message: 'Waiting for admin approval',
        } as ServerError);
        return;
      }

      if (result.action === 'join' && result.room) {
        // Direct join (no approval needed)
        const room = roomManager.addUserToRoom(
          payload.code,
          socket.id,
          payload.nickname
        );

        socket.data.roomCode = room.code;
        socket.data.role = 'partner';
        socket.data.nickname = payload.nickname;

        void socket.join(room.code);

        // Send join response to the new user
        callback({
          code: room.code,
          role: 'partner' as const,
          users: room.users.map((u) => ({
            socketId: u.socketId,
            nickname: u.nickname,
            role: u.role,
          })),
          requireApproval: room.requireApproval,
          isScreenSharing: room.isScreenSharing,
        });

        // Notify existing users about the new member
        socket.to(room.code).emit('room:user-joined', {
          socketId: socket.id,
          nickname: payload.nickname,
          role: 'partner',
        });

        logger.info(`User joined room directly: ${room.code}`, { nickname: payload.nickname });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to join room', err);
      callback({ code: 'JOIN_FAILED', message: error } as ServerError);
    }
  });

  // ─────────────────────────────────────────────────────────
  // Join Request Response (Admin only)
  // ─────────────────────────────────────────────────────────

  socket.on('room:join-response', (payload) => {
    try {
      const request = roomManager.processJoinResponse(
        payload.code,
        payload.requestId,
        payload.approved,
        socket.id
      );

      if (!request) {
        socket.emit('error', {
          code: 'RESPONSE_FAILED',
          message: 'Failed to process join response',
        });
        return;
      }

      if (payload.approved) {
        // Add the user to the room
        const room = roomManager.addUserToRoom(
          payload.code,
          request.socketId,
          request.nickname
        );

        // Get the joiner's socket and update their data
        const joinerSocket = io.sockets.sockets.get(request.socketId);
        if (joinerSocket) {
          joinerSocket.data.roomCode = room.code;
          joinerSocket.data.role = 'partner';
          joinerSocket.data.nickname = request.nickname;

          void joinerSocket.join(room.code);

          // Notify the joiner they've been approved
          joinerSocket.emit('room:join-response', { approved: true });

          // Send full room info to the joiner
          joinerSocket.emit('room:joined', {
            code: room.code,
            role: 'partner',
            users: room.users.map((u) => ({
              socketId: u.socketId,
              nickname: u.nickname,
              role: u.role,
            })),
            requireApproval: room.requireApproval,
            isScreenSharing: room.isScreenSharing,
          });

          // Notify admin about the new member
          socket.emit('room:user-joined', {
            socketId: request.socketId,
            nickname: request.nickname,
            role: 'partner',
          });
        }
      } else {
        // Denied - notify the joiner
        const joinerSocket = io.sockets.sockets.get(request.socketId);
        if (joinerSocket) {
          joinerSocket.emit('room:join-response', {
            approved: false,
            reason: payload.reason,
          });
        }
      }
    } catch (err) {
      logger.error('Failed to process join response', err);
    }
  });

  // ─────────────────────────────────────────────────────────
  // Room Settings
  // ─────────────────────────────────────────────────────────

  socket.on('room:toggle-approval', (payload) => {
    const success = roomManager.toggleApproval(
      payload.code,
      payload.requireApproval,
      socket.id
    );

    if (success) {
      // Notify all users in the room
      io.to(payload.code.toUpperCase()).emit('room:approval-changed', {
        requireApproval: payload.requireApproval,
      });
    }
  });

  // ─────────────────────────────────────────────────────────
  // WebRTC Signaling Relay
  // ─────────────────────────────────────────────────────────

  socket.on('signaling:relay', (payload) => {
    try {
      // Verify the sender is in the room
      const room = roomManager.getRoom(payload.code);
      if (!room || !room.users.some((u) => u.socketId === socket.id)) {
        logger.warn(`Unauthorized signaling attempt`, {
          code: payload.code,
          socketId: socket.id,
        });
        return;
      }

      // Relay the signaling data to the target peer
      const targetSocket = io.sockets.sockets.get(payload.targetSocketId);
      if (targetSocket) {
        targetSocket.emit('signaling:relay', {
          data: payload.data,
          type: payload.type,
          streamType: payload.streamType,
          senderSocketId: socket.id,
        });
      }
    } catch (err) {
      logger.error('Signaling relay error', err);
    }
  });

  // ─────────────────────────────────────────────────────────
  // Chat Messages
  // ─────────────────────────────────────────────────────────

  socket.on('chat:message', (payload) => {
    try {
      const room = roomManager.getRoom(payload.code);
      if (!room || !room.users.some((u) => u.socketId === socket.id)) {
        return;
      }

      // Update room activity
      room.lastActivity = Date.now();

      // Broadcast to everyone in the room except the sender
      socket.to(payload.code.toUpperCase()).emit('chat:message', {
        senderId: socket.id,
        senderNickname: socket.data.nickname,
        message: payload.message,
        timestamp: payload.timestamp,
      });
    } catch (err) {
      logger.error('Chat message error', err);
    }
  });

  // ─────────────────────────────────────────────────────────
  // Screen Share State
  // ─────────────────────────────────────────────────────────

  socket.on('screen:toggle', (payload) => {
    const success = roomManager.toggleScreenShare(
      payload.code,
      payload.isSharing,
      socket.id
    );

    if (success) {
      socket.to(payload.code.toUpperCase()).emit('screen:toggle', {
        isSharing: payload.isSharing,
        sharerSocketId: socket.id,
      });
    }
  });

  // ─────────────────────────────────────────────────────────
  // Room Leave
  // ─────────────────────────────────────────────────────────

  socket.on('room:leave', (payload) => {
    handleDisconnect(socket, payload.code);
  });

  // ─────────────────────────────────────────────────────────
  // Disconnection
  // ─────────────────────────────────────────────────────────

  socket.on('disconnect', (reason) => {
    logger.info(`Client disconnected: ${socket.id}`, { reason });
    handleDisconnect(socket);
  });
});

/**
 * Handles user disconnection from a room, cleaning up state and notifying peers.
 *
 * @param socket - The disconnecting socket
 * @param roomCode - Optional explicit room code (for voluntary leave)
 */
function handleDisconnect(
  socket: ReturnType<typeof io.sockets.sockets.get> extends infer S ? NonNullable<S> : never,
  roomCode?: string
): void {
  try {
    // First check if they have a pending join request
    roomManager.removePendingRequest(socket.id);

    // Then handle room removal
    const result = roomManager.removeUser(socket.id);
    if (!result) return;

    const { room, removedUser, roomClosed } = result;
    const code = roomCode?.toUpperCase() || room.code;

    if (roomClosed) {
      // Notify all remaining users that the room is closed
      io.to(code).emit('room:closed', {
        reason: 'Admin left the room',
      });

      // Remove all sockets from the Socket.IO room
      io.in(code).socketsLeave(code);

      logger.info(`Room closed and all users removed: ${code}`);
    } else {
      // Notify remaining users
      socket.to(code).emit('room:user-left', {
        socketId: socket.id,
        nickname: removedUser.nickname,
      });

      void socket.leave(code);
    }

    // Clear socket data
    socket.data.roomCode = null;
    socket.data.role = null;
  } catch (err) {
    logger.error('Error during disconnect handling', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Server Startup
// ─────────────────────────────────────────────────────────────

httpServer.listen(config.port, () => {
  logger.info(`🎬 CinePair Signaling Server running on port ${config.port}`);
  logger.info(`CORS origin: ${config.corsOrigin}`);
  logger.info(`Room expiry: ${config.roomExpiryHours}h | Max users: ${config.maxUsersPerRoom}`);
});

// ─────────────────────────────────────────────────────────────
// Graceful Shutdown
// ─────────────────────────────────────────────────────────────

const shutdown = (): void => {
  logger.info('Shutting down gracefully...');
  roomManager.shutdown();
  io.close();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
