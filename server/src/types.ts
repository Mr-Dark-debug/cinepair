/**
 * @fileoverview Shared type definitions for the CinePair signaling server.
 * Includes all interfaces for rooms, users, socket events, and configuration.
 * @module types
 */

// ─────────────────────────────────────────────────────────────
// Room & User Types
// ─────────────────────────────────────────────────────────────

/** Possible roles a user can have in a room */
export type UserRole = 'admin' | 'partner';

/** Possible states for a join request */
export type JoinRequestStatus = 'pending' | 'approved' | 'denied';

/** Possible states for a room */
export type RoomStatus = 'waiting' | 'active' | 'closed';

/**
 * Represents a connected user in a room.
 */
export interface RoomUser {
  /** Socket.IO socket ID */
  readonly socketId: string;
  /** Display nickname for the user */
  nickname: string;
  /** Role within the room */
  role: UserRole;
  /** Timestamp when the user joined */
  readonly joinedAt: number;
}

/**
 * Represents a pending join request awaiting admin approval.
 */
export interface JoinRequest {
  /** Unique request identifier */
  readonly id: string;
  /** Socket ID of the requesting user */
  readonly socketId: string;
  /** Display nickname of the requesting user */
  readonly nickname: string;
  /** Current status of the request */
  status: JoinRequestStatus;
  /** Timestamp when the request was created */
  readonly createdAt: number;
}

/**
 * Represents a room in the CinePair system.
 */
export interface Room {
  /** Unique 8-character room code */
  readonly code: string;
  /** Optional room password (hashed) */
  password: string | null;
  /** Whether join approval is required */
  requireApproval: boolean;
  /** Current room status */
  status: RoomStatus;
  /** Connected users in the room (max 2) */
  users: RoomUser[];
  /** Pending join requests */
  pendingRequests: JoinRequest[];
  /** Socket ID of the admin/creator */
  readonly adminSocketId: string;
  /** Timestamp when the room was created */
  readonly createdAt: number;
  /** Timestamp of the last activity */
  lastActivity: number;
  /** Whether screen sharing is currently active */
  isScreenSharing: boolean;
}

// ─────────────────────────────────────────────────────────────
// Socket Event Payloads — Client to Server
// ─────────────────────────────────────────────────────────────

/** Payload for creating a new room */
export interface CreateRoomPayload {
  nickname: string;
  password?: string;
  requireApproval: boolean;
}

/** Payload for joining an existing room */
export interface JoinRoomPayload {
  code: string;
  password?: string;
  nickname: string;
}

/** Payload for responding to a join request */
export interface JoinResponsePayload {
  code: string;
  requestId: string;
  approved: boolean;
  reason?: string;
}

/** Payload for toggling room settings */
export interface ToggleApprovalPayload {
  code: string;
  requireApproval: boolean;
}

/** Payload for WebRTC signaling data */
export interface SignalingPayload {
  code: string;
  targetSocketId: string;
  /** Opaque signaling data (SDP offer/answer or ICE candidate) */
  data: Record<string, unknown>;
  type: 'offer' | 'answer' | 'ice-candidate';
  streamType?: 'webcam' | 'screen';
}

/** Payload for chat messages */
export interface ChatMessagePayload {
  code: string;
  message: string;
  timestamp: number;
}

/** Payload for screen share state changes */
export interface ScreenSharePayload {
  code: string;
  isSharing: boolean;
}

// ─────────────────────────────────────────────────────────────
// Socket Event Payloads — Server to Client
// ─────────────────────────────────────────────────────────────

/** Response after room creation */
export interface RoomCreatedResponse {
  code: string;
  requireApproval: boolean;
  hasPassword: boolean;
}

/** Response after successfully joining a room */
export interface RoomJoinedResponse {
  code: string;
  role: UserRole;
  users: Array<{ socketId: string; nickname: string; role: UserRole }>;
  requireApproval: boolean;
  isScreenSharing: boolean;
}

/** Notification that a new user joined */
export interface UserJoinedNotification {
  socketId: string;
  nickname: string;
  role: UserRole;
}

/** Notification of a pending join request (sent to admin) */
export interface JoinRequestNotification {
  id: string;
  socketId: string;
  nickname: string;
  createdAt: number;
}

/** Response to the joiner about their request */
export interface JoinRequestResponse {
  approved: boolean;
  reason?: string;
}

/** Chat message received from a peer */
export interface ChatMessageReceived {
  senderId: string;
  senderNickname: string;
  message: string;
  timestamp: number;
}

/** Error response from the server */
export interface ServerError {
  code: string;
  message: string;
}

// ─────────────────────────────────────────────────────────────
// Socket Event Maps (for type-safe Socket.IO)
// ─────────────────────────────────────────────────────────────

/** Events emitted from client to server */
export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomPayload, callback: (response: RoomCreatedResponse | ServerError) => void) => void;
  'room:join': (payload: JoinRoomPayload, callback: (response: RoomJoinedResponse | ServerError) => void) => void;
  'room:join-response': (payload: JoinResponsePayload) => void;
  'room:toggle-approval': (payload: ToggleApprovalPayload) => void;
  'room:leave': (payload: { code: string }) => void;
  'signaling:relay': (payload: SignalingPayload) => void;
  'chat:message': (payload: ChatMessagePayload) => void;
  'screen:toggle': (payload: ScreenSharePayload) => void;
}

/** Events emitted from server to client */
export interface ServerToClientEvents {
  'room:created': (response: RoomCreatedResponse) => void;
  'room:joined': (response: RoomJoinedResponse) => void;
  'room:user-joined': (notification: UserJoinedNotification) => void;
  'room:user-left': (data: { socketId: string; nickname: string }) => void;
  'room:join-request': (notification: JoinRequestNotification) => void;
  'room:join-response': (response: JoinRequestResponse) => void;
  'room:approval-changed': (data: { requireApproval: boolean }) => void;
  'room:closed': (data: { reason: string }) => void;
  'signaling:relay': (payload: Omit<SignalingPayload, 'code' | 'targetSocketId'> & { senderSocketId: string }) => void;
  'chat:message': (message: ChatMessageReceived) => void;
  'screen:toggle': (data: { isSharing: boolean; sharerSocketId: string }) => void;
  'error': (error: ServerError) => void;
}

/** Inter-server events (not used in v1, reserved) */
export interface InterServerEvents {
  ping: () => void;
}

/** Data stored on each socket */
export interface SocketData {
  nickname: string;
  roomCode: string | null;
  role: UserRole | null;
}

// ─────────────────────────────────────────────────────────────
// Server Configuration
// ─────────────────────────────────────────────────────────────

/** Server configuration options */
export interface ServerConfig {
  /** Port to listen on */
  port: number;
  /** Allowed CORS origins */
  corsOrigin: string | string[];
  /** Room code length */
  roomCodeLength: number;
  /** Room expiry time in hours */
  roomExpiryHours: number;
  /** Maximum users per room */
  maxUsersPerRoom: number;
}
