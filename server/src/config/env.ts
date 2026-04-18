/**
 * @fileoverview Centralized environment configuration for CinePair server.
 * All process.env parsing happens here. No other module should read process.env directly.
 * @module config/env
 */

import { z } from 'zod';

/**
 * Zod schema for the full environment configuration.
 * Defaults are tuned for Render free tier + local dev.
 */
const envSchema = z.object({
  // ─── Server ───────────────────────────────────────────
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // ─── CORS ─────────────────────────────────────────────
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  ALLOW_ELECTRON_ORIGIN: z.coerce.boolean().default(false),

  // ─── JWT ──────────────────────────────────────────────
  JWT_SECRET: z.string().min(16).default('cinepair-dev-secret-change-me-in-production'),
  JWT_EXPIRES_IN: z.string().default('24h'),

  // ─── Room Settings ────────────────────────────────────
  ROOM_CODE_LENGTH: z.coerce.number().int().min(6).max(12).default(8),
  ROOM_EXPIRY_HOURS: z.coerce.number().positive().default(24),
  MAX_USERS_PER_ROOM: z.coerce.number().int().min(2).max(10).default(2),
  RECONNECT_GRACE_SECONDS: z.coerce.number().int().min(30).max(300).default(90),

  // ─── ICE / TURN ───────────────────────────────────────
  PUBLIC_STUN_URLS: z.string().default('stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302'),
  TURN_URL: z.string().optional(),
  TURN_USERNAME: z.string().optional(),
  TURN_CREDENTIAL: z.string().optional(),
  TURN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),

  // ─── Observability ────────────────────────────────────
  ENABLE_METRICS: z.coerce.boolean().default(false),
  METRICS_TOKEN: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Parsed and validated environment configuration.
 * Reads from process.env once at startup.
 */
function parseEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

const env = parseEnv();

/**
 * Parsed CORS origins as an array.
 */
function getCorsOrigins(): string[] {
  const origins = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  if (env.ALLOW_ELECTRON_ORIGIN && !origins.includes('app://cinepair')) {
    origins.push('app://cinepair');
  }
  return origins;
}

/**
 * Parsed STUN URLs as an array.
 */
function getStunUrls(): string[] {
  return env.PUBLIC_STUN_URLS.split(',').map((u) => u.trim()).filter(Boolean);
}

/**
 * The canonical application config derived from environment variables.
 */
export const config = {
  // Server
  port: env.PORT,
  host: env.HOST,
  nodeEnv: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',

  // CORS
  corsOrigins: getCorsOrigins(),
  allowElectronOrigin: env.ALLOW_ELECTRON_ORIGIN,

  // JWT
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN,

  // Room
  roomCodeLength: env.ROOM_CODE_LENGTH,
  roomExpiryHours: env.ROOM_EXPIRY_HOURS,
  maxUsersPerRoom: env.MAX_USERS_PER_ROOM,
  reconnectGraceSeconds: env.RECONNECT_GRACE_SECONDS,

  // ICE/TURN
  stunUrls: getStunUrls(),
  turnUrl: env.TURN_URL || null,
  turnUsername: env.TURN_USERNAME || null,
  turnCredential: env.TURN_CREDENTIAL || null,
  turnTtlSeconds: env.TURN_TTL_SECONDS,

  // Observability
  enableMetrics: env.ENABLE_METRICS,
  metricsToken: env.METRICS_TOKEN || null,
  logLevel: env.LOG_LEVEL,
} as const;

export type AppConfig = typeof config;
