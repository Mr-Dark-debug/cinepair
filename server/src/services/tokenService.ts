/**
 * @fileoverview JWT session token utilities.
 * Room-scoped, anonymous JWTs. No user accounts.
 * @module services/tokenService
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { createLogger } from '../observability/logger.js';

const logger = createLogger('TokenService');

export interface SessionTokenPayload {
  userId: string;
  sessionId: string;
  roomCode: string;
  role: 'admin' | 'partner';
  nickname: string;
}

/**
 * Signs a room-scoped session JWT.
 */
export function signSessionToken(payload: SessionTokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: '24h' as unknown as number,
    issuer: 'cinepair',
  } as jwt.SignOptions);
}

/**
 * Verifies and decodes a session JWT.
 * Returns null if invalid/expired.
 */
export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret, { issuer: 'cinepair' });
    return decoded as SessionTokenPayload;
  } catch (err) {
    logger.debug({ err }, 'Invalid session token');
    return null;
  }
}
