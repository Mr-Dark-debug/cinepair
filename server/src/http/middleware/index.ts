/**
 * @fileoverview HTTP middleware: error handler, rate limiting, helmet, etc.
 * @module http/middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { createLogger } from '../../observability/logger.js';

const logger = createLogger('Middleware');

// ─── Rate Limiters ──────────────────────────────────────────

/** Room creation: 5 per minute per IP */
const roomCreateLimiter = new RateLimiterMemory({
  keyPrefix: 'room_create',
  points: 5,
  duration: 60,
});

/** Room join: 20 per minute per IP */
const roomJoinLimiter = new RateLimiterMemory({
  keyPrefix: 'room_join',
  points: 20,
  duration: 60,
});

/** General API: 100 per minute per IP */
const generalLimiter = new RateLimiterMemory({
  keyPrefix: 'general',
  points: 100,
  duration: 60,
});

export function createRateLimiter(type: 'create' | 'join' | 'general') {
  const limiter = type === 'create' ? roomCreateLimiter : type === 'join' ? roomJoinLimiter : generalLimiter;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = req.ip || req.socket.remoteAddress || 'unknown';
      await limiter.consume(key);
      next();
    } catch {
      logger.warn({ ip: req.ip, type }, 'Rate limit exceeded');
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
        },
      });
    }
  };
}

// ─── Error Handler ──────────────────────────────────────────

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal server error occurred',
    },
  });
}

// ─── 404 Handler ────────────────────────────────────────────

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found',
    },
  });
}
