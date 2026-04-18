import { z } from 'zod';

export const roomCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z2-9]{8}$/u, 'Room code must be 8 characters using A-Z and 2-9');

export const nicknameSchema = z.string().trim().min(1).max(32);

export const roomPasswordSchema = z.string().min(4).max(64);

export const createRoomSchema = z.object({
  nickname: nicknameSchema,
  password: roomPasswordSchema.optional(),
  requireApproval: z.boolean(),
});

export const joinRoomSchema = z.object({
  code: roomCodeSchema,
  nickname: nicknameSchema,
  password: z.string().max(64).optional(),
});

export const joinResponseSchema = z.object({
  code: roomCodeSchema,
  requestId: z.string().trim().min(1).max(64),
  approved: z.boolean(),
  reason: z.string().trim().max(160).optional(),
});

export const toggleApprovalSchema = z.object({
  code: roomCodeSchema,
  requireApproval: z.boolean(),
});

export const signalingRelaySchema = z.object({
  code: roomCodeSchema,
  targetSocketId: z.string().trim().min(1).max(128),
  data: z.record(z.string(), z.unknown()),
  type: z.enum(['offer', 'answer', 'ice-candidate']),
  streamType: z.enum(['webcam', 'screen']).optional(),
});

export const chatMessageSchema = z.object({
  code: roomCodeSchema,
  message: z.string().trim().min(1).max(2048),
  timestamp: z.number().int().positive(),
});

export const screenShareSchema = z.object({
  code: roomCodeSchema,
  isSharing: z.boolean(),
});

export const leaveRoomSchema = z.object({
  code: roomCodeSchema,
});

export const iceServerSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
});

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

export const publicConfigResponseSchema = z.object({
  maxUsersPerRoom: z.number().int().positive(),
  roomExpiryHours: z.number().positive(),
  iceServers: z.array(iceServerSchema),
  features: z.object({
    metrics: z.boolean(),
    electronOrigin: z.boolean(),
  }),
});

export const iceServersResponseSchema = z.object({
  iceServers: z.array(iceServerSchema),
  expiresAt: z.string().datetime(),
});

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.array(z.object({}).passthrough()).optional(),
  }),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type JoinResponseInput = z.infer<typeof joinResponseSchema>;
export type ToggleApprovalInput = z.infer<typeof toggleApprovalSchema>;
export type SignalingRelayInput = z.infer<typeof signalingRelaySchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type ScreenShareInput = z.infer<typeof screenShareSchema>;
