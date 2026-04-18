import type { Express, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import type { AppConfig } from './config.js';
import type { RoomManager } from './RoomManager.js';
import { openApiSpec } from './docs/openapi.js';
import {
  healthResponseSchema,
  iceServersResponseSchema,
  publicConfigResponseSchema,
} from './schemas.js';

interface HttpRouteDeps {
  app: Express;
  config: AppConfig;
  roomManager: RoomManager;
  getSocketCount: () => number;
}

function requireMetricsToken(
  req: Request,
  res: Response,
  token: string | null,
): boolean {
  if (!token) return true;

  const authHeader = req.header('authorization');
  if (authHeader === `Bearer ${token}`) return true;

  res.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Metrics token is required',
    },
  });
  return false;
}

function getIceServersResponse(config: AppConfig): {
  iceServers: Array<{ urls: string }>;
  expiresAt: string;
} {
  return {
    iceServers: config.publicStunUrls.map((urls) => ({ urls })),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

export function registerHttpRoutes({
  app,
  config,
  roomManager,
  getSocketCount,
}: HttpRouteDeps): void {
  app.get('/health', (_req, res) => {
    const response = {
      status: 'ok' as const,
      uptime: process.uptime(),
      rooms: {
        ...roomManager.getStats(),
        socketsConnected: getSocketCount(),
      },
      timestamp: new Date().toISOString(),
    };

    res.json(healthResponseSchema.parse(response));
  });

  app.get('/ready', (_req, res) => {
    res.json({
      status: 'ready',
      dependencies: {
        roomStore: 'memory',
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/config/public', (_req, res) => {
    const response = {
      maxUsersPerRoom: config.maxUsersPerRoom,
      roomExpiryHours: config.roomExpiryHours,
      iceServers: getIceServersResponse(config).iceServers,
      features: {
        metrics: config.enableMetrics,
        electronOrigin: config.allowElectronOrigin,
      },
    };

    res.json(publicConfigResponseSchema.parse(response));
  });

  app.get('/api/ice-servers', (_req, res) => {
    res.json(iceServersResponseSchema.parse(getIceServersResponse(config)));
  });

  app.get('/metrics', (req, res) => {
    if (!config.enableMetrics) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Metrics are disabled',
        },
      });
      return;
    }

    if (!requireMetricsToken(req, res, config.metricsToken)) return;

    const stats = roomManager.getStats();
    res
      .type('text/plain')
      .send(
        [
          `cinepair_rooms_total ${stats.totalRooms}`,
          `cinepair_rooms_active ${stats.activeRooms}`,
          `cinepair_rooms_waiting ${stats.waitingRooms}`,
          `cinepair_sockets_connected ${getSocketCount()}`,
          `process_resident_memory_bytes ${process.memoryUsage().rss}`,
          `nodejs_heap_size_used_bytes ${process.memoryUsage().heapUsed}`,
        ].join('\n') + '\n',
      );
  });

  app.get('/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });

  app.get('/api/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
}
