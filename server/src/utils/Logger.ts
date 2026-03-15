/**
 * @fileoverview Logger utility for consistent logging across the signaling server.
 * Provides structured log output with timestamps, levels, and context.
 * @module utils/Logger
 */

/** Available log levels in order of severity */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** ANSI color codes for terminal output */
const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
};

/** ANSI reset code */
const RESET = '\x1b[0m';

/**
 * Structured logger with contextual prefixing and level filtering.
 * 
 * @example
 * ```typescript
 * const logger = new Logger('RoomManager');
 * logger.info('Room created', { code: 'ABC123XY' });
 * logger.error('Failed to create room', new Error('Duplicate code'));
 * ```
 */
export class Logger {
  /** The context/module name prepended to all log messages */
  private readonly context: string;

  /** Minimum log level to output (defaults to 'debug' in dev, 'info' in prod) */
  private readonly minLevel: LogLevel;

  /** Numeric severity mapping for level comparison */
  private static readonly LEVEL_VALUES: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  /**
   * Creates a new Logger instance.
   * @param context - The module or class name for log prefixing
   * @param minLevel - Optional minimum level override
   */
  constructor(context: string, minLevel?: LogLevel) {
    this.context = context;
    this.minLevel = minLevel ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
  }

  /**
   * Formats and outputs a log message if it meets the minimum level.
   * @param level - The severity level
   * @param message - The log message
   * @param data - Optional additional data to include
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    // Skip if below minimum level
    if (Logger.LEVEL_VALUES[level] < Logger.LEVEL_VALUES[this.minLevel]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const color = COLORS[level];
    const prefix = `${color}[${timestamp}] [${level.toUpperCase()}] [${this.context}]${RESET}`;

    if (data !== undefined) {
      // Format error objects specially
      if (data instanceof Error) {
        console.log(`${prefix} ${message}`, { error: data.message, stack: data.stack });
      } else {
        console.log(`${prefix} ${message}`, data);
      }
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  /** Log a debug message */
  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  /** Log an informational message */
  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  /** Log a warning message */
  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  /** Log an error message */
  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }
}
