/**
 * @fileoverview HTTP controllers for health, rooms, and ICE servers.
 * @module http/controllers
 */

import type { Request, Response, Router } from 'express';
import express from 'express';
import { createRateLimiter } from '../middleware/index.js';
import type { RoomService } from '../../services/roomService.js';
import type { IceServerService } from '../../services/iceServerService.js';
import { signSessionToken } from '../../services/tokenService.js';
import { createRoomBodySchema, joinRoomBodySchema, joinRoomParamsSchema } from '../../validation/schemas.js';
import { createLogger, safeRoomCode } from '../../observability/logger.js';
import { customAlphabet } from 'nanoid';

const logger = createLogger('Controllers');
const generateUserId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 24);
const generateSessionId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 16);

interface ControllerDeps {
  roomService: RoomService;
  iceServerService: IceServerService;
  getSocketCount: () => number;
}

export function createRouter(deps: ControllerDeps): Router {
  const router = express.Router();
  const { roomService, iceServerService, getSocketCount } = deps;

  // ─── Health Check ───────────────────────────────────────

  router.get('/health', (_req: Request, res: Response) => {
    const stats = roomService.getStats();
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      rooms: {
        ...stats,
        socketsConnected: getSocketCount(),
      },
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/ready', (_req: Request, res: Response) => {
    res.json({
      status: 'ready',
      dependencies: { roomStore: 'memory' },
      timestamp: new Date().toISOString(),
    });
  });

  // ─── ICE Servers ────────────────────────────────────────

  router.get('/api/ice-servers', (_req: Request, res: Response) => {
    const iceConfig = iceServerService.getIceServers();
    res.json(iceConfig);
  });

  // ─── Room Creation ──────────────────────────────────────

  router.post('/api/rooms', createRateLimiter('create'), async (req: Request, res: Response) => {
    try {
      const parsed = createRoomBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_FAILED',
            message: parsed.error.issues[0]?.message || 'Invalid request body',
            details: parsed.error.issues,
          },
        });
        return;
      }

      const { nickname, password, requireApproval } = parsed.data;
      const userId = generateUserId();
      const sessionId = generateSessionId();

      const room = await roomService.createRoom(
        userId,
        sessionId,
        '', // socketId will be set when socket connects
        nickname,
        password || null,
        requireApproval,
      );

      const sessionToken = signSessionToken({
        userId,
        sessionId,
        roomCode: room.code,
        role: 'admin',
        nickname,
      });

      res.status(201).json({
        roomCode: room.code,
        userId,
        role: 'admin',
        sessionToken,
        requireApproval: room.requireApproval,
        hasPassword: !!room.passwordHash,
      });

      logger.info({ roomCode: safeRoomCode(room.code) }, 'Room created via REST');
    } catch (err) {
      logger.error({ err }, 'Failed to create room');
      res.status(500).json({
        error: { code: 'CREATE_FAILED', message: 'Failed to create room' },
      });
    }
  });

  // ─── Room Join ──────────────────────────────────────────

  router.post('/api/rooms/:roomCode/join', createRateLimiter('join'), async (req: Request, res: Response) => {
    try {
      const params = joinRoomParamsSchema.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({
          error: { code: 'VALIDATION_FAILED', message: 'Invalid room code format' },
        });
        return;
      }

      const body = joinRoomBodySchema.safeParse(req.body);
      if (!body.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_FAILED',
            message: body.error.issues[0]?.message || 'Invalid request body',
          },
        });
        return;
      }

      const { nickname, password } = body.data;
      const userId = generateUserId();
      const sessionId = generateSessionId();

      const result = await roomService.validateJoin(
        params.data.roomCode,
        password || null,
        userId,
        sessionId,
        '',
        nickname,
      );

      if (result.action === 'error') {
        const statusMap: Record<string, number> = {
          ROOM_NOT_FOUND: 404,
          ROOM_CLOSED: 410,
          ROOM_FULL: 409,
          WRONG_PASSWORD: 403,
          PASSWORD_REQUIRED: 403,
          ALREADY_IN_ROOM: 409,
          REQUEST_PENDING: 409,
        };
        res.status(statusMap[result.errorCode] || 400).json({
          error: { code: result.errorCode, message: result.error },
        });
        return;
      }

      if (result.action === 'request') {
        const sessionToken = signSessionToken({
          userId,
          sessionId,
          roomCode: params.data.roomCode,
          role: 'partner',
          nickname,
        });

        res.status(202).json({
          status: 'APPROVAL_REQUIRED',
          userId,
          sessionToken,
          message: 'Waiting for admin approval',
        });
        return;
      }

      // Direct join
      const room = roomService.addUserToRoom(
        params.data.roomCode,
        userId,
        sessionId,
        '',
        nickname,
      );

      const sessionToken = signSessionToken({
        userId,
        sessionId,
        roomCode: room.code,
        role: 'partner',
        nickname,
      });

      res.status(200).json({
        roomCode: room.code,
        userId,
        role: 'partner',
        sessionToken,
        requireApproval: room.requireApproval,
        hasPassword: !!room.passwordHash,
        users: room.users
          .filter((u) => u.connectionState === 'connected')
          .map((u) => ({
            userId: u.userId,
            nickname: u.nickname,
            role: u.role,
          })),
      });
    } catch (err) {
      logger.error({ err }, 'Failed to join room');
      res.status(500).json({
        error: { code: 'JOIN_FAILED', message: 'Failed to join room' },
      });
    }
  });

  return router;
}
