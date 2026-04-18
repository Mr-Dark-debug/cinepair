/**
 * @fileoverview Comprehensive Zod validation schemas for ALL CinePair events and payloads.
 * Used by both REST endpoints and Socket.IO event handlers.
 * @module validation/schemas
 */

import { z } from 'zod';

// ─── Primitives ─────────────────────────────────────────────

export const roomCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z2-9]{8}$/u, 'Room code must be 8 characters using A-Z and 2-9');

export const nicknameSchema = z.string().trim().min(1, 'Nickname is required').max(32, 'Nickname too long');

export const roomPasswordSchema = z.string().min(4, 'Password must be at least 4 characters').max(64);

export const userIdSchema = z.string().trim().min(1).max(64);

export const sessionIdSchema = z.string().trim().min(1).max(64);

export const sessionTokenSchema = z.string().trim().min(1);

// ─── REST API Schemas ───────────────────────────────────────

/** POST /api/rooms — Create a new room */
export const createRoomBodySchema = z.object({
  nickname: nicknameSchema,
  password: roomPasswordSchema.optional(),
  requireApproval: z.boolean(),
});

/** POST /api/rooms/:roomCode/join — Join a room */
export const joinRoomBodySchema = z.object({
  nickname: nicknameSchema,
  password: z.string().max(64).optional(),
});

export const joinRoomParamsSchema = z.object({
  roomCode: roomCodeSchema,
});

// ─── ICE Server Response ────────────────────────────────────

export const iceServerSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
});

export const iceServersResponseSchema = z.object({
  iceServers: z.array(iceServerSchema),
  expiresAt: z.string().datetime(),
});

// ─── Health / Ready ─────────────────────────────────────────

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  uptime: z.number(),
  rooms: z.object({
    totalRooms: z.number().int().nonnegative(),
    activeRooms: z.number().int().nonnegative(),
    waitingRooms: z.number().int().nonnegative(),
    socketsConnected: z.number().int().nonnegative(),
  }),
  timestamp: z.string().datetime(),
});

// ─── Socket.IO Event Schemas ────────────────────────────────

/** room:create event payload */
export const socketCreateRoomSchema = z.object({
  nickname: nicknameSchema,
  password: roomPasswordSchema.optional(),
  requireApproval: z.boolean(),
});

/** room:join event payload */
export const socketJoinRoomSchema = z.object({
  code: roomCodeSchema,
  nickname: nicknameSchema,
  password: z.string().max(64).optional(),
});

/** room:join-response event payload (admin response to join request) */
export const socketJoinResponseSchema = z.object({
  code: roomCodeSchema,
  requestId: z.string().trim().min(1).max(64),
  approved: z.boolean(),
  reason: z.string().trim().max(160).optional(),
});

/** room:toggle-approval event payload */
export const socketToggleApprovalSchema = z.object({
  code: roomCodeSchema,
  requireApproval: z.boolean(),
});

/** room:leave event payload */
export const socketLeaveRoomSchema = z.object({
  code: roomCodeSchema,
});

/** signaling:relay event payload */
export const socketSignalingRelaySchema = z.object({
  code: roomCodeSchema,
  targetUserId: z.string().trim().min(1).max(128),
  data: z.record(z.string(), z.unknown()),
  type: z.enum(['offer', 'answer', 'ice-candidate']),
  streamType: z.enum(['webcam', 'screen']).optional(),
});

/** chat:message event payload */
export const socketChatMessageSchema = z.object({
  code: roomCodeSchema,
  message: z.string().trim().min(1).max(2048),
  timestamp: z.number().int().positive(),
  clientMessageId: z.string().trim().min(1).max(64).optional(),
});

/** screen:toggle event payload */
export const socketScreenShareSchema = z.object({
  code: roomCodeSchema,
  isSharing: z.boolean(),
});

/** peer:ready event payload */
export const socketPeerReadySchema = z.object({
  code: roomCodeSchema,
});

// ─── Socket.IO Auth Schema ─────────────────────────────────

export const socketAuthSchema = z.object({
  sessionToken: sessionTokenSchema.optional(),
  clientId: z.string().trim().min(1).max(64).optional(),
});

// ─── Error Response ─────────────────────────────────────────

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.array(z.object({}).passthrough()).optional(),
  }),
});

export const publicConfigResponseSchema = z.object({
  maxUsersPerRoom: z.number().int().positive(),
  roomExpiryHours: z.number().positive(),
  iceServers: z.array(iceServerSchema),
  features: z.object({
    metrics: z.boolean(),
    electronOrigin: z.boolean(),
  }),
});

// ─── Inferred Types ─────────────────────────────────────────

export type CreateRoomBody = z.infer<typeof createRoomBodySchema>;
export type JoinRoomBody = z.infer<typeof joinRoomBodySchema>;
export type SocketCreateRoom = z.infer<typeof socketCreateRoomSchema>;
export type SocketJoinRoom = z.infer<typeof socketJoinRoomSchema>;
export type SocketJoinResponse = z.infer<typeof socketJoinResponseSchema>;
export type SocketToggleApproval = z.infer<typeof socketToggleApprovalSchema>;
export type SocketLeaveRoom = z.infer<typeof socketLeaveRoomSchema>;
export type SocketSignalingRelay = z.infer<typeof socketSignalingRelaySchema>;
export type SocketChatMessage = z.infer<typeof socketChatMessageSchema>;
export type SocketScreenShare = z.infer<typeof socketScreenShareSchema>;
export type SocketPeerReady = z.infer<typeof socketPeerReadySchema>;
export type SocketAuth = z.infer<typeof socketAuthSchema>;
