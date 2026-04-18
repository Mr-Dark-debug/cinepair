/**
 * @fileoverview Presence gateway — handles room join/leave/reconnect via Socket.IO.
 * All payloads validated with Zod. Rate-limited.
 * @module socket/presenceGateway
 */

import type { Server, Socket } from 'socket.io';
import { customAlphabet } from 'nanoid';
import type { RoomService } from '../services/roomService.js';
import { signSessionToken } from '../services/tokenService.js';
import {
  socketCreateRoomSchema,
  socketJoinRoomSchema,
  socketJoinResponseSchema,
  socketToggleApprovalSchema,
  socketLeaveRoomSchema,
  socketPeerReadySchema,
} from '../validation/schemas.js';
import { socketRateLimiters } from './socketServer.js';
import { createLogger, safeRoomCode } from '../observability/logger.js';

const logger = createLogger('PresenceGateway');
const generateUserId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 24);
const generateSessionId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 16);

interface ServerError {
  code: string;
  message: string;
}

function validationError(zodError: { issues: Array<{ path: PropertyKey[]; message: string }> }): ServerError {
  const issue = zodError.issues[0];
  return {
    code: 'VALIDATION_FAILED',
    message: issue ? `${String(issue.path.join('.')) || 'payload'}: ${issue.message}` : 'Invalid payload',
  };
}

export function registerPresenceGateway(io: Server, roomService: RoomService): void {
  io.on('connection', (socket: Socket) => {
    logger.info({ socketId: socket.id }, 'Client connected');

    // ─── Room Creation ──────────────────────────────────

    socket.on('room:create', async (payload: unknown, callback: (response: unknown) => void) => {
      try {
        await socketRateLimiters.general.consume(socket.id);
      } catch {
        callback({ code: 'RATE_LIMIT', message: 'Too many requests' });
        return;
      }

      const parsed = socketCreateRoomSchema.safeParse(payload);
      if (!parsed.success) {
        callback(validationError(parsed.error));
        return;
      }

      try {
        const input = parsed.data;
        const userId = socket.data.userId || generateUserId();
        const sessionId = socket.data.sessionId || generateSessionId();

        const room = await roomService.createRoom(
          userId,
          sessionId,
          socket.id,
          input.nickname,
          input.password || null,
          input.requireApproval,
        );

        socket.data.userId = userId;
        socket.data.sessionId = sessionId;
        socket.data.roomCode = room.code;
        socket.data.role = 'admin';
        socket.data.nickname = input.nickname;

        void socket.join(room.code);

        const sessionToken = signSessionToken({
          userId,
          sessionId,
          roomCode: room.code,
          role: 'admin',
          nickname: input.nickname,
        });

        callback({
          code: room.code,
          userId,
          sessionToken,
          requireApproval: room.requireApproval,
          hasPassword: !!room.passwordHash,
        });

        logger.info({ roomCode: safeRoomCode(room.code) }, 'Room created via socket');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error({ err }, 'Failed to create room');
        callback({ code: 'CREATE_FAILED', message: msg } as ServerError);
      }
    });

    // ─── Room Joining ───────────────────────────────────

    socket.on('room:join', async (payload: unknown, callback: (response: unknown) => void) => {
      try {
        await socketRateLimiters.general.consume(socket.id);
      } catch {
        callback({ code: 'RATE_LIMIT', message: 'Too many requests' });
        return;
      }

      const parsed = socketJoinRoomSchema.safeParse(payload);
      if (!parsed.success) {
        callback(validationError(parsed.error));
        return;
      }

      try {
        const input = parsed.data;
        const userId = socket.data.userId || generateUserId();
        const sessionId = socket.data.sessionId || generateSessionId();

        const result = await roomService.validateJoin(
          input.code,
          input.password || null,
          userId,
          sessionId,
          socket.id,
          input.nickname,
        );

        if (result.action === 'error') {
          callback({ code: result.errorCode, message: result.error } as ServerError);
          return;
        }

        if (result.action === 'request' && result.room && result.request) {
          socket.data.userId = userId;
          socket.data.sessionId = sessionId;
          socket.data.nickname = input.nickname;

          // Notify admin
          const adminUser = result.room.users.find((u) => u.role === 'admin');
          if (adminUser) {
            io.to(adminUser.socketId).emit('room:join-request', {
              id: result.request.id,
              userId: result.request.userId,
              nickname: result.request.nickname,
              createdAt: result.request.createdAt,
            });
          }

          callback({ code: 'APPROVAL_REQUIRED', message: 'Waiting for admin approval' });
          return;
        }

        if (result.action === 'reconnect' && result.room && result.user) {
          socket.data.userId = result.user.userId;
          socket.data.sessionId = result.user.sessionId;
          socket.data.roomCode = result.room.code;
          socket.data.role = result.user.role;
          socket.data.nickname = result.user.nickname;

          void socket.join(result.room.code);

          const sessionToken = signSessionToken({
            userId: result.user.userId,
            sessionId: result.user.sessionId,
            roomCode: result.room.code,
            role: result.user.role,
            nickname: result.user.nickname,
          });

          callback({
            code: result.room.code,
            userId: result.user.userId,
            role: result.user.role,
            sessionToken,
            users: result.room.users
              .filter((u) => u.connectionState === 'connected')
              .map((u) => ({ userId: u.userId, nickname: u.nickname, role: u.role })),
            requireApproval: result.room.requireApproval,
            isScreenSharing: result.room.isScreenSharing,
            reconnected: true,
          });

          socket.to(result.room.code).emit('room:user-reconnected', {
            userId: result.user.userId,
            nickname: result.user.nickname,
          });
          return;
        }

        if (result.action === 'join' && result.room) {
          const room = roomService.addUserToRoom(
            input.code,
            userId,
            sessionId,
            socket.id,
            input.nickname,
          );

          socket.data.userId = userId;
          socket.data.sessionId = sessionId;
          socket.data.roomCode = room.code;
          socket.data.role = 'partner';
          socket.data.nickname = input.nickname;

          void socket.join(room.code);

          const sessionToken = signSessionToken({
            userId,
            sessionId,
            roomCode: room.code,
            role: 'partner',
            nickname: input.nickname,
          });

          callback({
            code: room.code,
            userId,
            role: 'partner',
            sessionToken,
            users: room.users
              .filter((u) => u.connectionState === 'connected')
              .map((u) => ({ userId: u.userId, nickname: u.nickname, role: u.role })),
            requireApproval: room.requireApproval,
            isScreenSharing: room.isScreenSharing,
          });

          socket.to(room.code).emit('room:user-joined', {
            userId,
            nickname: input.nickname,
            role: 'partner',
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error({ err }, 'Failed to join room');
        callback({ code: 'JOIN_FAILED', message: msg } as ServerError);
      }
    });

    // ─── Join Response (Admin) ──────────────────────────

    socket.on('room:join-response', (payload: unknown) => {
      const parsed = socketJoinResponseSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', validationError(parsed.error));
        return;
      }

      const input = parsed.data;
      const adminUserId = socket.data.userId;
      if (!adminUserId) return;

      const request = roomService.processJoinResponse(
        input.code,
        input.requestId,
        input.approved,
        adminUserId,
      );

      if (!request) {
        socket.emit('error', { code: 'RESPONSE_FAILED', message: 'Failed to process' });
        return;
      }

      if (input.approved) {
        // Find the joiner's socket by their stored socketId
        const joinerSocket = [...io.sockets.sockets.values()].find(
          (s) => s.data.userId === request.userId || s.id === request.socketId
        );

        if (joinerSocket) {
          const sessionId = joinerSocket.data.sessionId || generateSessionId();
          const room = roomService.addUserToRoom(
            input.code,
            request.userId,
            sessionId,
            joinerSocket.id,
            request.nickname,
          );

          joinerSocket.data.userId = request.userId;
          joinerSocket.data.sessionId = sessionId;
          joinerSocket.data.roomCode = room.code;
          joinerSocket.data.role = 'partner';
          joinerSocket.data.nickname = request.nickname;

          void joinerSocket.join(room.code);

          const sessionToken = signSessionToken({
            userId: request.userId,
            sessionId,
            roomCode: room.code,
            role: 'partner',
            nickname: request.nickname,
          });

          joinerSocket.emit('room:join-response', { approved: true });
          joinerSocket.emit('room:joined', {
            code: room.code,
            userId: request.userId,
            role: 'partner',
            sessionToken,
            users: room.users
              .filter((u) => u.connectionState === 'connected')
              .map((u) => ({ userId: u.userId, nickname: u.nickname, role: u.role })),
            requireApproval: room.requireApproval,
            isScreenSharing: room.isScreenSharing,
          });

          socket.emit('room:user-joined', {
            userId: request.userId,
            nickname: request.nickname,
            role: 'partner',
          });
        }
      } else {
        const joinerSocket = [...io.sockets.sockets.values()].find(
          (s) => s.data.userId === request.userId || s.id === request.socketId
        );
        if (joinerSocket) {
          joinerSocket.emit('room:join-response', {
            approved: false,
            reason: input.reason,
          });
        }
      }
    });

    // ─── Toggle Approval ────────────────────────────────

    socket.on('room:toggle-approval', async (payload: unknown) => {
      try {
        await socketRateLimiters.general.consume(socket.id);
      } catch { return; }

      const parsed = socketToggleApprovalSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', validationError(parsed.error));
        return;
      }

      const success = roomService.toggleApproval(
        parsed.data.code,
        parsed.data.requireApproval,
        socket.data.userId,
      );

      if (success) {
        io.to(parsed.data.code.toUpperCase()).emit('room:approval-changed', {
          requireApproval: parsed.data.requireApproval,
        });
      }
    });

    // ─── Peer Ready ─────────────────────────────────────

    socket.on('peer:ready', async (payload: unknown) => {
      const parsed = socketPeerReadySchema.safeParse(payload);
      if (!parsed.success) return;

      const room = roomService.getRoom(parsed.data.code);
      if (!room) return;

      const connectedUsers = room.users.filter((u) => u.connectionState === 'connected');
      if (connectedUsers.length >= 2) {
        // Both peers are ready — determine polite/impolite
        const admin = connectedUsers.find((u) => u.role === 'admin');
        const partner = connectedUsers.find((u) => u.role === 'partner');

        if (admin && partner) {
          // Admin is impolite (creates offers), partner is polite
          io.to(admin.socketId).emit('peer:start-negotiation', {
            targetUserId: partner.userId,
            polite: false,
          });
          io.to(partner.socketId).emit('peer:start-negotiation', {
            targetUserId: admin.userId,
            polite: true,
          });
        }
      }
    });

    // ─── Room Leave ─────────────────────────────────────

    socket.on('room:leave', (payload: unknown) => {
      const parsed = socketLeaveRoomSchema.safeParse(payload);
      if (!parsed.success) return;

      handleLeave(socket, io, roomService);
    });

    // ─── Disconnect ─────────────────────────────────────

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'Client disconnected');
      handleDisconnect(socket, io, roomService);
    });
  });
}

/**
 * Handles explicit room leave — removes user immediately.
 */
function handleLeave(socket: Socket, io: Server, roomService: RoomService): void {
  const userId = socket.data.userId;
  if (!userId) return;

  roomService.removePendingRequest(socket.id);
  const result = roomService.removeUser(userId);
  if (!result) return;

  const { room, removedUser, roomClosed } = result;

  if (roomClosed) {
    socket.to(room.code).emit('room:closed', { reason: 'Admin left the room' });
    io.in(room.code).socketsLeave(room.code);
  } else {
    socket.to(room.code).emit('room:user-left', {
      userId: removedUser.userId,
      nickname: removedUser.nickname,
    });
    void socket.leave(room.code);
  }

  socket.data.roomCode = null;
  socket.data.role = null;
}

/**
 * Handles unexpected disconnect — marks user as "reconnecting" with grace period.
 */
function handleDisconnect(socket: Socket, _io: Server, roomService: RoomService): void {
  const userId = socket.data.userId;
  if (!userId) return;

  roomService.removePendingRequest(socket.id);
  const result = roomService.markUserDisconnected(userId);
  if (!result) return;

  const { room, user } = result;

  // Notify other users about the disconnection
  socket.to(room.code).emit('room:user-disconnected', {
    userId: user.userId,
    nickname: user.nickname,
    reconnecting: true,
  });
}
