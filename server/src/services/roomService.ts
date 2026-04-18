/**
 * @fileoverview Room lifecycle service.
 * Handles creation, joining, approval, reconnection, and cleanup.
 * Uses argon2id for password hashing. Never returns password hashes.
 * @module services/roomService
 */

import { customAlphabet } from 'nanoid';
import * as argon2 from 'argon2';
import type { RoomStore } from '../state/RoomStore.js';
import type { Room, RoomUser, JoinRequest } from '../state/RoomManager.js';
import { createLogger, safeRoomCode } from '../observability/logger.js';
import type { AppConfig } from '../config/env.js';

const logger = createLogger('RoomService');

/** Generates collision-resistant 8-character alphanumeric room codes */
const generateRoomCode = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 8);

/** Generates unique request/message IDs */
const generateId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 16);

export type JoinAction =
  | { action: 'join'; room: Room }
  | { action: 'request'; room: Room; request: JoinRequest }
  | { action: 'reconnect'; room: Room; user: RoomUser }
  | { action: 'error'; errorCode: string; error: string };

export class RoomService {
  private readonly store: RoomStore;
  private readonly config: AppConfig;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectInterval: ReturnType<typeof setInterval> | null = null;

  constructor(store: RoomStore, config: AppConfig) {
    this.store = store;
    this.config = config;
    this.startCleanupScheduler();
    this.startReconnectPurger();
    logger.info('RoomService initialized');
  }

  // ─── Room Creation ────────────────────────────────────────

  async createRoom(
    userId: string,
    sessionId: string,
    socketId: string,
    nickname: string,
    password: string | null,
    requireApproval: boolean,
  ): Promise<Room> {
    let code: string;
    let attempts = 0;
    do {
      code = generateRoomCode();
      attempts++;
      if (attempts > 10) throw new Error('ROOM_CODE_GENERATION_FAILED');
    } while (this.store.getRoom(code));

    const passwordHash = password ? await argon2.hash(password, { type: argon2.argon2id }) : null;
    const now = Date.now();

    const adminUser: RoomUser = {
      userId,
      sessionId,
      socketId,
      nickname,
      role: 'admin',
      joinedAt: now,
      connectionState: 'connected',
      disconnectedAt: null,
    };

    const room: Room = {
      code,
      passwordHash,
      requireApproval,
      status: 'waiting',
      users: [adminUser],
      pendingRequests: [],
      adminUserId: userId,
      createdAt: now,
      lastActivity: now,
      isScreenSharing: false,
      screenSharingUserId: null,
      chatMessages: [],
    };

    this.store.createRoom(room);
    logger.info({ roomCode: safeRoomCode(code), hasPassword: !!password, requireApproval }, 'Room created');
    return room;
  }

  // ─── Room Retrieval ───────────────────────────────────────

  getRoom(code: string): Room | undefined {
    return this.store.getRoom(code);
  }

  findUserRoom(userId: string): { room: Room; user: RoomUser } | null {
    return this.store.findUserRoom(userId);
  }

  getStats() {
    return this.store.getStats();
  }

  // ─── Join Flow ────────────────────────────────────────────

  async validateJoin(
    code: string,
    password: string | null,
    userId: string,
    sessionId: string,
    socketId: string,
    nickname: string,
  ): Promise<JoinAction> {
    const room = this.store.getRoom(code.toUpperCase());

    if (!room) return { action: 'error', error: 'Room not found', errorCode: 'ROOM_NOT_FOUND' };
    if (room.status === 'closed') return { action: 'error', error: 'Room has been closed', errorCode: 'ROOM_CLOSED' };

    // Check for reconnecting user
    const existingUser = room.users.find((u) => u.userId === userId);
    if (existingUser && existingUser.connectionState === 'reconnecting') {
      existingUser.socketId = socketId;
      existingUser.sessionId = sessionId;
      existingUser.connectionState = 'connected';
      existingUser.disconnectedAt = null;
      room.lastActivity = Date.now();
      this.store.updateRoom(room.code, room);
      logger.info({ roomCode: safeRoomCode(code), userId }, 'User reconnected');
      return { action: 'reconnect', room, user: existingUser };
    }

    // Already in room (connected)
    if (existingUser && existingUser.connectionState === 'connected') {
      return { action: 'error', error: 'Already in this room', errorCode: 'ALREADY_IN_ROOM' };
    }

    // Count connected users
    const connectedUsers = room.users.filter((u) => u.connectionState !== 'disconnected');
    if (connectedUsers.length >= this.config.maxUsersPerRoom) {
      return { action: 'error', error: 'Room is full', errorCode: 'ROOM_FULL' };
    }

    // Password check
    if (room.passwordHash) {
      if (!password) return { action: 'error', error: 'Password required', errorCode: 'PASSWORD_REQUIRED' };
      const valid = await argon2.verify(room.passwordHash, password);
      if (!valid) return { action: 'error', error: 'Wrong password', errorCode: 'WRONG_PASSWORD' };
    }

    // Check existing pending request
    const existingRequest = room.pendingRequests.find(
      (r) => r.userId === userId && r.status === 'pending'
    );
    if (existingRequest) {
      return { action: 'error', error: 'Join request already pending', errorCode: 'REQUEST_PENDING' };
    }

    room.lastActivity = Date.now();

    // Approval required?
    if (room.requireApproval) {
      const request: JoinRequest = {
        id: generateId(),
        socketId,
        userId,
        nickname,
        status: 'pending',
        createdAt: Date.now(),
      };
      room.pendingRequests.push(request);
      this.store.updateRoom(room.code, room);
      logger.info({ roomCode: safeRoomCode(code), requestId: request.id }, 'Join request created');
      return { action: 'request', room, request };
    }

    return { action: 'join', room };
  }

  addUserToRoom(
    code: string,
    userId: string,
    sessionId: string,
    socketId: string,
    nickname: string,
  ): Room {
    const room = this.store.getRoom(code.toUpperCase());
    if (!room) throw new Error('ROOM_NOT_FOUND');

    const connectedUsers = room.users.filter((u) => u.connectionState !== 'disconnected');
    if (connectedUsers.length >= this.config.maxUsersPerRoom) throw new Error('ROOM_FULL');

    const newUser: RoomUser = {
      userId,
      sessionId,
      socketId,
      nickname,
      role: 'partner',
      joinedAt: Date.now(),
      connectionState: 'connected',
      disconnectedAt: null,
    };

    room.users.push(newUser);
    room.status = 'active';
    room.lastActivity = Date.now();
    this.store.updateRoom(room.code, room);
    logger.info({ roomCode: safeRoomCode(code), userId, userCount: room.users.length }, 'User joined room');
    return room;
  }

  // ─── Join Response ────────────────────────────────────────

  processJoinResponse(
    code: string,
    requestId: string,
    approved: boolean,
    adminUserId: string,
  ): JoinRequest | null {
    const room = this.store.getRoom(code.toUpperCase());
    if (!room) return null;
    if (room.adminUserId !== adminUserId) return null;

    const request = room.pendingRequests.find((r) => r.id === requestId && r.status === 'pending');
    if (!request) return null;

    request.status = approved ? 'approved' : 'denied';
    room.lastActivity = Date.now();
    this.store.updateRoom(room.code, room);
    logger.info({ roomCode: safeRoomCode(code), requestId, approved }, 'Join request processed');
    return request;
  }

  // ─── Room Settings ────────────────────────────────────────

  toggleApproval(code: string, requireApproval: boolean, adminUserId: string): boolean {
    const room = this.store.getRoom(code.toUpperCase());
    if (!room || room.adminUserId !== adminUserId) return false;

    room.requireApproval = requireApproval;
    room.lastActivity = Date.now();
    this.store.updateRoom(room.code, room);
    return true;
  }

  toggleScreenShare(code: string, isSharing: boolean, userId: string): boolean {
    const room = this.store.getRoom(code.toUpperCase());
    if (!room) return false;

    // Only admin can control screen sharing
    if (room.adminUserId !== userId) return false;

    room.isScreenSharing = isSharing;
    room.screenSharingUserId = isSharing ? userId : null;
    room.lastActivity = Date.now();
    this.store.updateRoom(room.code, room);
    return true;
  }

  // ─── Chat ─────────────────────────────────────────────────

  addChatMessage(
    code: string,
    senderId: string,
    senderNickname: string,
    message: string,
    timestamp: number,
    clientMessageId?: string,
  ): { id: string; isDuplicate: boolean } | null {
    const room = this.store.getRoom(code.toUpperCase());
    if (!room) return null;

    // Dedup check
    if (clientMessageId) {
      const existing = room.chatMessages.find((m) => m.clientMessageId === clientMessageId);
      if (existing) return { id: existing.id, isDuplicate: true };
    }

    const id = generateId();
    const msg = {
      id,
      clientMessageId: clientMessageId || null,
      senderId,
      senderNickname,
      message,
      timestamp,
    };

    room.chatMessages.push(msg);

    // Ring buffer: keep last 500 messages
    if (room.chatMessages.length > 500) {
      room.chatMessages = room.chatMessages.slice(-500);
    }

    room.lastActivity = Date.now();
    this.store.updateRoom(room.code, room);
    return { id, isDuplicate: false };
  }

  // ─── Disconnect / Reconnection ────────────────────────────

  /**
   * Marks a user as "reconnecting" instead of immediately removing them.
   * After the grace period, the reconnect purger will clean them up.
   */
  markUserDisconnected(userId: string): {
    room: Room;
    user: RoomUser;
    wasAdmin: boolean;
    shouldCloseRoom: boolean;
  } | null {
    const result = this.store.findUserRoom(userId);
    if (!result) return null;

    const { room, user } = result;

    // Mark as reconnecting
    user.connectionState = 'reconnecting';
    user.disconnectedAt = Date.now();
    room.lastActivity = Date.now();

    // If admin disconnects, we still keep the room alive for the grace period
    const wasAdmin = user.role === 'admin';

    this.store.updateRoom(room.code, room);
    logger.info(
      { roomCode: safeRoomCode(room.code), userId, wasAdmin },
      'User marked as reconnecting'
    );

    return { room, user, wasAdmin, shouldCloseRoom: false };
  }

  /**
   * Permanently removes a user from a room (explicit leave or grace period expired).
   */
  removeUser(userId: string): {
    room: Room;
    removedUser: RoomUser;
    roomClosed: boolean;
  } | null {
    const result = this.store.findUserRoom(userId);
    if (!result) return null;

    const { room, user } = result;

    room.users = room.users.filter((u) => u.userId !== userId);
    room.pendingRequests = room.pendingRequests.filter((r) => r.userId !== userId);
    room.lastActivity = Date.now();

    const roomClosed = user.role === 'admin';
    if (roomClosed) {
      room.status = 'closed';
      this.store.deleteRoom(room.code);
      logger.info({ roomCode: safeRoomCode(room.code) }, 'Room closed (admin left)');
    } else {
      room.status = room.users.some((u) => u.connectionState === 'connected') ? 'waiting' : 'waiting';
      room.isScreenSharing = false;
      room.screenSharingUserId = null;
      this.store.updateRoom(room.code, room);
      logger.info({ roomCode: safeRoomCode(room.code), userId }, 'User removed from room');
    }

    return { room, removedUser: user, roomClosed };
  }

  removePendingRequest(socketId: string): string | null {
    const result = this.store.findPendingRequestBySocketId(socketId);
    if (!result) return null;

    const { room, request } = result;
    room.pendingRequests = room.pendingRequests.filter((r) => r.id !== request.id);
    this.store.updateRoom(room.code, room);
    return room.code;
  }

  // ─── Cleanup Schedulers ───────────────────────────────────

  private startCleanupScheduler(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredRooms();
    }, 15 * 60 * 1000); // Every 15 minutes
  }

  private startReconnectPurger(): void {
    this.reconnectInterval = setInterval(() => {
      this.purgeExpiredReconnections();
    }, 10 * 1000); // Every 10 seconds
  }

  cleanupExpiredRooms(): number {
    const now = Date.now();
    const expiryMs = this.config.roomExpiryHours * 60 * 60 * 1000;
    let cleaned = 0;

    for (const [, room] of this.store.getAllRooms()) {
      if (now - room.lastActivity > expiryMs) {
        this.store.deleteRoom(room.code);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info({ cleaned }, 'Expired rooms cleaned up');
    }
    return cleaned;
  }

  /**
   * Purges users whose reconnection grace period has expired.
   */
  purgeExpiredReconnections(): void {
    const now = Date.now();
    const graceMs = this.config.reconnectGraceSeconds * 1000;

    for (const [, room] of this.store.getAllRooms()) {
      const expiredUsers = room.users.filter(
        (u) =>
          u.connectionState === 'reconnecting' &&
          u.disconnectedAt !== null &&
          now - u.disconnectedAt > graceMs
      );

      for (const user of expiredUsers) {
        logger.info(
          { roomCode: safeRoomCode(room.code), userId: user.userId },
          'Reconnect grace period expired, removing user'
        );
        this.removeUser(user.userId);
      }
    }
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    this.store.clear();
    logger.info('RoomService shut down');
  }
}
