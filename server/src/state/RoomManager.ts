/**
 * @fileoverview Core room types and data structures.
 * Identity is decoupled from socket.id — userId and sessionId are stable.
 * @module state/RoomManager
 */

/** Possible roles a user can have in a room */
export type UserRole = 'admin' | 'partner';

/** Possible states for a join request */
export type JoinRequestStatus = 'pending' | 'approved' | 'denied';

/** Possible states for a room */
export type RoomStatus = 'waiting' | 'active' | 'closed';

/** User connection state for reconnection support */
export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

/**
 * Represents a connected user in a room.
 * Identity is decoupled from socket.id via stable userId.
 */
export interface RoomUser {
  /** Stable user identifier (UUID, persists across reconnections) */
  readonly userId: string;
  /** Current session identifier */
  sessionId: string;
  /** Current Socket.IO socket ID (changes on reconnect) */
  socketId: string;
  /** Display nickname */
  nickname: string;
  /** Role within the room */
  role: UserRole;
  /** Timestamp when the user joined */
  readonly joinedAt: number;
  /** Current connection state */
  connectionState: ConnectionState;
  /** Timestamp of last disconnect (for grace period tracking) */
  disconnectedAt: number | null;
}

/**
 * Represents a pending join request awaiting admin approval.
 */
export interface JoinRequest {
  /** Unique request identifier */
  readonly id: string;
  /** Socket ID of the requesting user */
  readonly socketId: string;
  /** UserId of the requesting user */
  readonly userId: string;
  /** Display nickname */
  readonly nickname: string;
  /** Current status */
  status: JoinRequestStatus;
  /** Timestamp when created */
  readonly createdAt: number;
}

/**
 * Chat message stored in the room's ring buffer.
 */
export interface StoredChatMessage {
  /** Server-assigned message ID */
  readonly id: string;
  /** Client-provided dedup key */
  readonly clientMessageId: string | null;
  /** Sender's userId */
  readonly senderId: string;
  /** Sender's nickname at time of send */
  readonly senderNickname: string;
  /** Message text */
  readonly message: string;
  /** Timestamp */
  readonly timestamp: number;
}

/**
 * Represents a room in the CinePair system.
 */
export interface Room {
  /** Unique 8-character room code */
  readonly code: string;
  /** Argon2id password hash (null if no password) */
  passwordHash: string | null;
  /** Whether join approval is required */
  requireApproval: boolean;
  /** Current room status */
  status: RoomStatus;
  /** Connected users (max configurable) */
  users: RoomUser[];
  /** Pending join requests */
  pendingRequests: JoinRequest[];
  /** userId of the admin/creator */
  readonly adminUserId: string;
  /** Timestamp when created */
  readonly createdAt: number;
  /** Timestamp of last activity */
  lastActivity: number;
  /** Whether screen sharing is active */
  isScreenSharing: boolean;
  /** UserId of the screen sharer (null if not sharing) */
  screenSharingUserId: string | null;
  /** Ring buffer for chat messages (last N messages) */
  chatMessages: StoredChatMessage[];
}
