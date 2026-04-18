/**
 * @fileoverview Express app setup with helmet, CORS, and middleware.
 * @module app
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/env.js';
import { createRouter } from './http/controllers/index.js';
import { errorHandler, notFoundHandler } from './http/middleware/index.js';
import { openApiSpec } from './docs/openapi.js';
import type { RoomService } from './services/roomService.js';
import type { IceServerService } from './services/iceServerService.js';

interface AppDeps {
  roomService: RoomService;
  iceServerService: IceServerService;
  getSocketCount: () => number;
}

export function createApp(deps: AppDeps) {
  const app = express();

  // ─── Security ─────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: config.isProd ? undefined : false,
  }));

  // ─── CORS ─────────────────────────────────────────────
  app.use(cors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  }));

  // ─── Body Parsing ─────────────────────────────────────
  app.use(express.json({ limit: '64kb' }));

  // ─── API Routes ───────────────────────────────────────
  const router = createRouter(deps);
  app.use(router);

  // ─── Swagger UI ───────────────────────────────────────
  app.get('/openapi.json', (_req, res) => { res.json(openApiSpec); });
  app.get('/api/openapi.json', (_req, res) => { res.json(openApiSpec); });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  // ─── Error Handling ───────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
