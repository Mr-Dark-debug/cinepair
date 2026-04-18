import type { ServerConfig } from './types.js';

export interface AppConfig extends ServerConfig {
  host: string;
  nodeEnv: string;
  allowElectronOrigin: boolean;
  enableMetrics: boolean;
  metricsToken: string | null;
  publicStunUrls: string[];
}

const DEFAULT_CORS_ORIGIN = 'http://localhost:5173';
const DEFAULT_STUN_URLS = ['stun:stun.l.google.com:19302'];

function parseIntegerEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  const value = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid integer for ${name}: ${rawValue}`);
  }

  return value;
}

function parseBooleanEnv(name: string, fallback = false): boolean {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  return ['1', 'true', 'yes', 'on'].includes(rawValue.toLowerCase());
}

function parseListEnv(name: string, fallback: string[]): string[] {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  const values = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? values : fallback;
}

function parseCorsOrigins(allowElectronOrigin: boolean): string[] {
  const configuredOrigins = parseListEnv(
    'CORS_ORIGINS',
    parseListEnv('CORS_ORIGIN', [DEFAULT_CORS_ORIGIN]),
  );

  if (allowElectronOrigin && !configuredOrigins.includes('app://cinepair')) {
    configuredOrigins.push('app://cinepair');
  }

  return configuredOrigins;
}

export function loadConfig(): AppConfig {
  const allowElectronOrigin = parseBooleanEnv('ALLOW_ELECTRON_ORIGIN', false);

  return {
    host: process.env.HOST || '0.0.0.0',
    port: parseIntegerEnv('PORT', parseIntegerEnv('SIGNALING_PORT', 3001)),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: parseCorsOrigins(allowElectronOrigin),
    allowElectronOrigin,
    roomCodeLength: parseIntegerEnv('ROOM_CODE_LENGTH', 8),
    roomExpiryHours: parseIntegerEnv('ROOM_EXPIRY_HOURS', 24),
    maxUsersPerRoom: parseIntegerEnv('MAX_USERS_PER_ROOM', 2),
    enableMetrics: parseBooleanEnv('ENABLE_METRICS', false),
    metricsToken: process.env.METRICS_TOKEN || null,
    publicStunUrls: parseListEnv('PUBLIC_STUN_URLS', DEFAULT_STUN_URLS),
  };
}
