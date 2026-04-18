/**
 * @fileoverview Pino-based structured JSON logger for CinePair.
 * NEVER logs passwords, TURN credentials, SDP bodies, or full room codes.
 * @module observability/logger
 */

import pino from 'pino';
import { config } from '../config/env.js';

/**
 * Root pino logger instance.
 * In development, uses pino-pretty for human-readable output.
 * In production, outputs structured JSON for log aggregators.
 */
export const rootLogger = pino({
  level: config.logLevel,
  name: 'cinepair',
  ...(config.isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
  // Redaction rules: NEVER log sensitive data
  redact: {
    paths: [
      'password',
      'passwordHash',
      'credential',
      'turnCredential',
      'sdp',
      'sessionToken',
      'jwtSecret',
      'req.headers.authorization',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
});

/**
 * Creates a child logger scoped to a specific module/context.
 * @param context - Module or class name
 */
export function createLogger(context: string): pino.Logger {
  return rootLogger.child({ context });
}

/**
 * Returns a short hash of a room code for safe logging.
 * Logs the first 3 chars + "..." instead of the full code.
 */
export function safeRoomCode(code: string): string {
  if (!code || code.length < 3) return '***';
  return `${code.slice(0, 3)}…`;
}
