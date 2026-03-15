/**
 * @fileoverview OOP-based Room Manager for the CinePair signaling server.
 * Handles all room lifecycle operations: creation, joining, approval, and cleanup.
 * All room state is stored in-memory using a Map for fast lookups.
 * @module RoomManager
 */

import { customAlphabet } from 'nanoid';
import { Logger } from './utils/Logger.js';
import type {
  Room,
  RoomUser,
  JoinRequest,
  ServerConfig,
} from './types.js';

/**
 * Generates collision-resistant 8-character alphanumeric room codes.
 * Uses uppercase letters and digits for readability (no ambiguous chars like 0/O, 1/I/l).
 */
const generateRoomCode = customAlphabet('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 8);

/**
 * Generates unique join request IDs.
 */
const generateRequestId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12);

/**
 * Manages all room operations for the CinePair signaling server.
 * This is the central state manager for rooms, users, join requests, and approvals.
 *
 * @example
 * ```typescript
 * const config: ServerConfig = { ... };
 * const manager = new RoomManager(config);
 * const room = manager.createRoom('socket123', 'Alice', 'secret', true);
 * ```
 */
export class RoomManager {
  /** In-memory storage for all active rooms, keyed by room code */
  private readonly rooms: Map<string, Room> = new Map();

  /** Logger instance for this module */
  private readonly logger: Logger = new Logger('RoomManager');

  /** Server configuration reference */
  private readonly config: ServerConfig;

  /** Reference to the cleanup interval for graceful shutdown */
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Creates a new RoomManager instance and starts the cleanup scheduler.
   * @param config - Server configuration containing room settings
   */
  constructor(config: ServerConfig) {
    this.config = config;
    this.startCleanupScheduler();
    this.logger.info('RoomManager initialized', {
      maxUsers: config.maxUsersPerRoom,
      expiryHours: config.roomExpiryHours,
      codeLength: config.roomCodeLength,
    });
  }

  // ─────────────────────────────────────────────────────────
  // Room Creation
  // ─────────────────────────────────────────────────────────

  /**
   * Creates a new room with a unique code.
   * Retries code generation if a collision occurs (extremely unlikely with nanoid).
   *
   * @param adminSocketId - Socket ID of the room creator
   * @param nickname - Display name of the admin
   * @param password - Optional room password (stored as-is; hash in production)
   * @param requireApproval - Whether joining requires admin approval
   * @returns The created Room object
   * @throws Error if room creation fails after max retries
   */
  createRoom(
    adminSocketId: string,
    nickname: string,
    password: string | null,
    requireApproval: boolean
  ): Room {
    // Generate a unique room code with collision checking
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = generateRoomCode();
      attempts++;
      if (attempts > maxAttempts) {
        this.logger.error('Failed to generate unique room code after max attempts');
        throw new Error('ROOM_CODE_GENERATION_FAILED');
      }
    } while (this.rooms.has(code));

    const now = Date.now();

    // Create the admin user
    const adminUser: RoomUser = {
      socketId: adminSocketId,
      nickname,
      role: 'admin',
      joinedAt: now,
    };

    // Create the room
    const room: Room = {
      code,
      password: password || null,
      requireApproval,
      status: 'waiting',
      users: [adminUser],
      pendingRequests: [],
      adminSocketId,
      createdAt: now,
      lastActivity: now,
      isScreenSharing: false,
    };

    this.rooms.set(code, room);
    this.logger.info(`Room created: ${code}`, {
      admin: nickname,
      hasPassword: !!password,
      requireApproval,
    });

    return room;
  }

  // ─────────────────────────────────────────────────────────
  // Room Retrieval
  // ─────────────────────────────────────────────────────────

  /**
   * Retrieves a room by its code.
   * @param code - The room code to look up
   * @returns The Room object or undefined if not found
   */
  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  /**
   * Finds the room a user is currently in.
   * @param socketId - The socket ID to search for
   * @returns The Room and user's role, or null if not in any room
   */
  findUserRoom(socketId: string): { room: Room; user: RoomUser } | null {
    for (const room of this.rooms.values()) {
      const user = room.users.find((u) => u.socketId === socketId);
      if (user) {
        return { room, user };
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────
  // Join Flow
  // ─────────────────────────────────────────────────────────

  /**
   * Validates a join attempt and returns the appropriate action.
   *
   * @param code - Room code to join
   * @param password - Provided password (if any)
   * @param socketId - Socket ID of the joining user
   * @param nickname - Display name of the joining user
   * @returns Object with action type and relevant data
   */
  validateJoin(
    code: string,
    password: string | null,
    socketId: string,
    nickname: string
  ): {
    action: 'join' | 'request' | 'error';
    error?: string;
    errorCode?: string;
    room?: Room;
    request?: JoinRequest;
  } {
    const normalizedCode = code.toUpperCase();
    const room = this.rooms.get(normalizedCode);

    // Room doesn't exist
    if (!room) {
      return { action: 'error', error: 'Room not found', errorCode: 'ROOM_NOT_FOUND' };
    }

    // Room is closed
    if (room.status === 'closed') {
      return { action: 'error', error: 'Room has been closed', errorCode: 'ROOM_CLOSED' };
    }

    // Room is full (max 2 users)
    if (room.users.length >= this.config.maxUsersPerRoom) {
      return { action: 'error', error: 'Room is full', errorCode: 'ROOM_FULL' };
    }

    // Password check
    if (room.password && room.password !== (password || '')) {
      return { action: 'error', error: 'Wrong password', errorCode: 'WRONG_PASSWORD' };
    }

    // Check if user is already in the room
    if (room.users.some((u) => u.socketId === socketId)) {
      return { action: 'error', error: 'Already in this room', errorCode: 'ALREADY_IN_ROOM' };
    }

    // Check for existing pending request from this socket
    const existingRequest = room.pendingRequests.find(
      (r) => r.socketId === socketId && r.status === 'pending'
    );
    if (existingRequest) {
      return { action: 'error', error: 'Join request already pending', errorCode: 'REQUEST_PENDING' };
    }

    // Update last activity
    room.lastActivity = Date.now();

    // If approval is required, create a pending request
    if (room.requireApproval) {
      const request: JoinRequest = {
        id: generateRequestId(),
        socketId,
        nickname,
        status: 'pending',
        createdAt: Date.now(),
      };
      room.pendingRequests.push(request);

      this.logger.info(`Join request created for room ${normalizedCode}`, {
        requestId: request.id,
        nickname,
      });

      return { action: 'request', room, request };
    }

    // Direct join (no approval needed)
    return { action: 'join', room };
  }

  /**
   * Adds a user to a room after validation/approval.
   *
   * @param code - Room code
   * @param socketId - Socket ID of the joining user
   * @param nickname - Display name
   * @returns The updated Room object
   * @throws Error if room is full or not found
   */
  addUserToRoom(code: string, socketId: string, nickname: string): Room {
    const normalizedCode = code.toUpperCase();
    const room = this.rooms.get(normalizedCode);

    if (!room) {
      throw new Error('ROOM_NOT_FOUND');
    }

    if (room.users.length >= this.config.maxUsersPerRoom) {
      throw new Error('ROOM_FULL');
    }

    const newUser: RoomUser = {
      socketId,
      nickname,
      role: 'partner',
      joinedAt: Date.now(),
    };

    room.users.push(newUser);
    room.status = 'active';
    room.lastActivity = Date.now();

    this.logger.info(`User joined room ${normalizedCode}`, {
      nickname,
      userCount: room.users.length,
    });

    return room;
  }

  /**
   * Processes an admin's response to a join request.
   *
   * @param code - Room code
   * @param requestId - The join request ID
   * @param approved - Whether the admin approved the request
   * @param adminSocketId - Socket ID of the admin (for verification)
   * @returns The processed JoinRequest or null if not found
   */
  processJoinResponse(
    code: string,
    requestId: string,
    approved: boolean,
    adminSocketId: string
  ): JoinRequest | null {
    const normalizedCode = code.toUpperCase();
    const room = this.rooms.get(normalizedCode);

    if (!room) {
      this.logger.warn(`Join response for non-existent room: ${normalizedCode}`);
      return null;
    }

    // Verify the responder is the admin
    if (room.adminSocketId !== adminSocketId) {
      this.logger.warn(`Non-admin tried to respond to join request`, {
        code: normalizedCode,
        socketId: adminSocketId,
      });
      return null;
    }

    // Find the pending request
    const request = room.pendingRequests.find(
      (r) => r.id === requestId && r.status === 'pending'
    );

    if (!request) {
      this.logger.warn(`Join request not found or already processed: ${requestId}`);
      return null;
    }

    request.status = approved ? 'approved' : 'denied';
    room.lastActivity = Date.now();

    this.logger.info(`Join request ${approved ? 'approved' : 'denied'}`, {
      code: normalizedCode,
      requestId,
      nickname: request.nickname,
    });

    return request;
  }

  // ─────────────────────────────────────────────────────────
  // Room Settings
  // ─────────────────────────────────────────────────────────

  /**
   * Toggles the "require approval" setting for a room.
   * Only the admin can change this setting.
   *
   * @param code - Room code
   * @param requireApproval - New approval setting
   * @param adminSocketId - Socket ID of the admin (for verification)
   * @returns true if setting was changed, false otherwise
   */
  toggleApproval(code: string, requireApproval: boolean, adminSocketId: string): boolean {
    const normalizedCode = code.toUpperCase();
    const room = this.rooms.get(normalizedCode);

    if (!room || room.adminSocketId !== adminSocketId) {
      return false;
    }

    room.requireApproval = requireApproval;
    room.lastActivity = Date.now();

    this.logger.info(`Approval toggled for room ${normalizedCode}`, { requireApproval });
    return true;
  }

  /**
   * Updates the screen sharing state for a room.
   *
   * @param code - Room code
   * @param isSharing - Whether screen is being shared
   * @param socketId - Socket ID of the user toggling sharing
   * @returns true if state was updated
   */
  toggleScreenShare(code: string, isSharing: boolean, socketId: string): boolean {
    const normalizedCode = code.toUpperCase();
    const room = this.rooms.get(normalizedCode);

    if (!room) return false;

    // Only admin can control screen sharing
    if (room.adminSocketId !== socketId) {
      this.logger.warn(`Non-admin tried to toggle screen share`, { code: normalizedCode, socketId });
      return false;
    }

    room.isScreenSharing = isSharing;
    room.lastActivity = Date.now();
    return true;
  }

  // ─────────────────────────────────────────────────────────
  // User Removal & Cleanup
  // ─────────────────────────────────────────────────────────

  /**
   * Removes a user from their room. If the admin leaves, the room is closed.
   *
   * @param socketId - Socket ID of the disconnecting user
   * @returns Object containing the room code and remaining users, or null
   */
  removeUser(socketId: string): {
    room: Room;
    removedUser: RoomUser;
    roomClosed: boolean;
  } | null {
    const result = this.findUserRoom(socketId);
    if (!result) return null;

    const { room, user } = result;

    // Remove the user from the room
    room.users = room.users.filter((u) => u.socketId !== socketId);
    room.lastActivity = Date.now();

    // Also remove any pending requests from this socket
    room.pendingRequests = room.pendingRequests.filter((r) => r.socketId !== socketId);

    // If admin left, close the room
    const roomClosed = user.role === 'admin';
    if (roomClosed) {
      room.status = 'closed';
      this.rooms.delete(room.code);
      this.logger.info(`Room closed (admin left): ${room.code}`);
    } else {
      // Partner left, room goes back to waiting
      room.status = 'waiting';
      room.isScreenSharing = false;
      this.logger.info(`User left room ${room.code}`, { nickname: user.nickname });
    }

    return { room, removedUser: user, roomClosed };
  }

  /**
   * Removes a pending join request (e.g., when the requester disconnects).
   *
   * @param socketId - Socket ID of the requester
   * @returns The room code if a request was found and removed, null otherwise
   */
  removePendingRequest(socketId: string): string | null {
    for (const room of this.rooms.values()) {
      const idx = room.pendingRequests.findIndex(
        (r) => r.socketId === socketId && r.status === 'pending'
      );
      if (idx !== -1) {
        room.pendingRequests.splice(idx, 1);
        this.logger.debug(`Removed pending request from room ${room.code}`, { socketId });
        return room.code;
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────
  // Cleanup & Lifecycle
  // ─────────────────────────────────────────────────────────

  /**
   * Starts the periodic room cleanup scheduler.
   * Removes expired rooms (no activity for configured hours).
   */
  private startCleanupScheduler(): void {
    // Run cleanup every 15 minutes
    const intervalMs = 15 * 60 * 1000;

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredRooms();
    }, intervalMs);

    this.logger.debug('Cleanup scheduler started', { intervalMs });
  }

  /**
   * Removes all rooms that have exceeded the inactivity timeout.
   * @returns Number of rooms cleaned up
   */
  cleanupExpiredRooms(): number {
    const now = Date.now();
    const expiryMs = this.config.roomExpiryHours * 60 * 60 * 1000;
    let cleaned = 0;

    for (const [code, room] of this.rooms.entries()) {
      if (now - room.lastActivity > expiryMs) {
        this.rooms.delete(code);
        cleaned++;
        this.logger.info(`Expired room cleaned up: ${code}`, {
          createdAt: new Date(room.createdAt).toISOString(),
          lastActivity: new Date(room.lastActivity).toISOString(),
        });
      }
    }

    if (cleaned > 0) {
      this.logger.info(`Cleaned up ${cleaned} expired room(s)`, {
        remainingRooms: this.rooms.size,
      });
    }

    return cleaned;
  }

  /**
   * Returns current statistics about room usage.
   */
  getStats(): { totalRooms: number; activeRooms: number; waitingRooms: number } {
    let activeRooms = 0;
    let waitingRooms = 0;

    for (const room of this.rooms.values()) {
      if (room.status === 'active') activeRooms++;
      else if (room.status === 'waiting') waitingRooms++;
    }

    return {
      totalRooms: this.rooms.size,
      activeRooms,
      waitingRooms,
    };
  }

  /**
   * Gracefully shuts down the RoomManager, clearing the cleanup interval.
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.rooms.clear();
    this.logger.info('RoomManager shut down');
  }
}
