/**
 * @fileoverview Signaling gateway — handles WebRTC SDP/ICE relay and chat.
 * All payloads validated with Zod. Rate-limited per socket.
 * @module socket/signalingGateway
 */

import type { Server, Socket } from 'socket.io';
import type { RoomService } from '../services/roomService.js';
import {
  socketSignalingRelaySchema,
  socketChatMessageSchema,
  socketScreenShareSchema,
} from '../validation/schemas.js';
import { socketRateLimiters } from './socketServer.js';
import { createLogger, safeRoomCode } from '../observability/logger.js';

const logger = createLogger('SignalingGateway');

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

export function registerSignalingGateway(io: Server, roomService: RoomService): void {
  io.on('connection', (socket: Socket) => {
    // ─── WebRTC Signaling Relay ──────────────────────────

    socket.on('signaling:relay', async (payload: unknown) => {
      // Rate limit: 60 events/sec
      try {
        await socketRateLimiters.signaling.consume(socket.id);
      } catch {
        socket.emit('error', { code: 'RATE_LIMIT', message: 'Signaling rate limit exceeded' });
        return;
      }

      const parsed = socketSignalingRelaySchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', validationError(parsed.error));
        return;
      }

      const input = parsed.data;
      const room = roomService.getRoom(input.code);
      if (!room || !room.users.some((u) => u.userId === socket.data.userId && u.connectionState === 'connected')) {
        logger.warn({ roomCode: safeRoomCode(input.code), userId: socket.data.userId }, 'Unauthorized signaling');
        return;
      }

      // Find target user's socket
      const targetUser = room.users.find((u) => u.userId === input.targetUserId);
      if (!targetUser || targetUser.connectionState !== 'connected') return;

      const targetSocket = io.sockets.sockets.get(targetUser.socketId);
      if (targetSocket) {
        targetSocket.emit('signaling:relay', {
          data: input.data,
          type: input.type,
          streamType: input.streamType,
          senderUserId: socket.data.userId,
        });
      }
    });

    // ─── Chat Messages ──────────────────────────────────

    socket.on('chat:message', async (payload: unknown) => {
      // Rate limit: 5 messages/sec
      try {
        await socketRateLimiters.chat.consume(socket.id);
      } catch {
        socket.emit('error', { code: 'RATE_LIMIT', message: 'Chat rate limit exceeded' });
        return;
      }

      const parsed = socketChatMessageSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', validationError(parsed.error));
        return;
      }

      const input = parsed.data;
      const room = roomService.getRoom(input.code);
      if (!room || !room.users.some((u) => u.userId === socket.data.userId && u.connectionState === 'connected')) {
        return;
      }

      // Store in ring buffer with dedup
      const result = roomService.addChatMessage(
        input.code,
        socket.data.userId,
        socket.data.nickname,
        input.message,
        input.timestamp,
        input.clientMessageId,
      );

      if (!result || result.isDuplicate) return;

      // Broadcast to room except sender
      socket.to(input.code.toUpperCase()).emit('chat:message', {
        id: result.id,
        senderId: socket.data.userId,
        senderNickname: socket.data.nickname,
        message: input.message,
        timestamp: input.timestamp,
        clientMessageId: input.clientMessageId,
      });
    });

    // ─── Screen Share Toggle ────────────────────────────

    socket.on('screen:toggle', async (payload: unknown) => {
      try {
        await socketRateLimiters.general.consume(socket.id);
      } catch { return; }

      const parsed = socketScreenShareSchema.safeParse(payload);
      if (!parsed.success) {
        socket.emit('error', validationError(parsed.error));
        return;
      }

      const success = roomService.toggleScreenShare(
        parsed.data.code,
        parsed.data.isSharing,
        socket.data.userId,
      );

      if (success) {
        socket.to(parsed.data.code.toUpperCase()).emit('screen:toggle', {
          isSharing: parsed.data.isSharing,
          sharerUserId: socket.data.userId,
        });
      }
    });
  });
}
