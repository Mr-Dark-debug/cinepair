import { describe, expect, it } from 'vitest';
import {
  chatMessageSchema,
  createRoomSchema,
  iceServersResponseSchema,
  joinRoomSchema,
  publicConfigResponseSchema,
  signalingRelaySchema,
} from './schemas.js';

describe('socket payload schemas', () => {
  it('accepts a valid room create payload and trims nicknames', () => {
    const payload = createRoomSchema.parse({
      nickname: '  Alice  ',
      password: 'secret123',
      requireApproval: true,
    });

    expect(payload).toEqual({
      nickname: 'Alice',
      password: 'secret123',
      requireApproval: true,
    });
  });

  it('rejects malformed room codes', () => {
    const result = joinRoomSchema.safeParse({
      code: 'abc12345',
      nickname: 'Bob',
    });

    expect(result.success).toBe(false);
  });

  it('caps fallback chat messages at 2048 characters', () => {
    const result = chatMessageSchema.safeParse({
      code: 'ABCDEFGH',
      message: 'x'.repeat(2049),
      timestamp: Date.now(),
    });

    expect(result.success).toBe(false);
  });

  it('accepts typed signaling relay payloads', () => {
    const payload = signalingRelaySchema.parse({
      code: 'ABCDEFGH',
      targetSocketId: 'socket-2',
      type: 'ice-candidate',
      streamType: 'screen',
      data: {
        candidate: 'candidate:1 1 udp 1 127.0.0.1 5000 typ host',
      },
    });

    expect(payload.type).toBe('ice-candidate');
    expect(payload.streamType).toBe('screen');
  });
});

describe('HTTP response schemas', () => {
  it('accepts the public config response shape', () => {
    const payload = publicConfigResponseSchema.parse({
      maxUsersPerRoom: 2,
      roomExpiryHours: 24,
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      features: {
        metrics: false,
        electronOrigin: false,
      },
    });

    expect(payload.iceServers).toHaveLength(1);
  });

  it('accepts the ICE servers response shape', () => {
    const payload = iceServersResponseSchema.parse({
      iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(payload.expiresAt).toEqual(expect.any(String));
  });
});
