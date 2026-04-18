export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'CinePair Signaling API',
    version: '1.0.0',
    description: 'Anonymous room-scoped signaling API for CinePair.',
  },
  servers: [{ url: '/' }],
  paths: {
    '/health': {
      get: {
        security: [],
        summary: 'Health check',
        responses: {
          '200': {
            description: 'Server health',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/ready': {
      get: {
        security: [],
        summary: 'Readiness check',
        responses: {
          '200': {
            description: 'Server readiness',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ReadyResponse' },
              },
            },
          },
        },
      },
    },
    '/config/public': {
      get: {
        security: [],
        summary: 'Public client configuration',
        responses: {
          '200': {
            description: 'Safe public configuration for clients',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PublicConfigResponse' },
              },
            },
          },
        },
      },
    },
    '/api/ice-servers': {
      get: {
        security: [],
        summary: 'Get ICE server configuration',
        responses: {
          '200': {
            description: 'ICE servers',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IceServersResponse' },
              },
            },
          },
        },
      },
    },
    '/metrics': {
      get: {
        summary: 'Prometheus metrics',
        description:
          'Disabled unless ENABLE_METRICS=true. Protected by METRICS_TOKEN when configured.',
        responses: {
          '200': {
            description: 'Prometheus text metrics',
            content: {
              'text/plain': {
                schema: { type: 'string' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Error' },
          '404': { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/openapi.json': {
      get: {
        security: [],
        summary: 'OpenAPI document',
        responses: {
          '200': {
            description: 'OpenAPI specification',
          },
        },
      },
    },
    '/api/openapi.json': {
      get: {
        security: [],
        summary: 'OpenAPI document alias',
        responses: {
          '200': {
            description: 'OpenAPI specification',
          },
        },
      },
    },
    '/docs': {
      get: {
        security: [],
        summary: 'Swagger UI',
        responses: {
          '200': {
            description: 'Interactive API documentation',
          },
        },
      },
    },
    '/api/docs': {
      get: {
        security: [],
        summary: 'Swagger UI alias',
        responses: {
          '200': {
            description: 'Interactive API documentation',
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    parameters: {
      RoomCode: {
        name: 'roomCode',
        in: 'path',
        required: true,
        schema: {
          type: 'string',
          pattern: '^[A-Z2-9]{8}$',
        },
      },
    },
    responses: {
      Error: {
        description: 'Error response',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
    },
    schemas: {
      HealthResponse: {
        type: 'object',
        required: ['status', 'uptime', 'rooms', 'timestamp'],
        properties: {
          status: { type: 'string', enum: ['ok'] },
          uptime: { type: 'number' },
          rooms: {
            type: 'object',
            required: [
              'totalRooms',
              'activeRooms',
              'waitingRooms',
              'socketsConnected',
            ],
            properties: {
              totalRooms: { type: 'integer', minimum: 0 },
              activeRooms: { type: 'integer', minimum: 0 },
              waitingRooms: { type: 'integer', minimum: 0 },
              socketsConnected: { type: 'integer', minimum: 0 },
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      ReadyResponse: {
        type: 'object',
        required: ['status', 'dependencies', 'timestamp'],
        properties: {
          status: { type: 'string', enum: ['ready'] },
          dependencies: {
            type: 'object',
            required: ['roomStore'],
            properties: {
              roomStore: { type: 'string', enum: ['memory'] },
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      PublicConfigResponse: {
        type: 'object',
        required: [
          'maxUsersPerRoom',
          'roomExpiryHours',
          'iceServers',
          'features',
        ],
        properties: {
          maxUsersPerRoom: { type: 'integer', minimum: 1 },
          roomExpiryHours: { type: 'number' },
          iceServers: {
            type: 'array',
            items: { $ref: '#/components/schemas/IceServer' },
          },
          features: {
            type: 'object',
            required: ['metrics', 'electronOrigin'],
            properties: {
              metrics: { type: 'boolean' },
              electronOrigin: { type: 'boolean' },
            },
          },
        },
      },
      IceServer: {
        type: 'object',
        required: ['urls'],
        properties: {
          urls: {
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } },
            ],
          },
          username: { type: 'string' },
          credential: { type: 'string' },
        },
      },
      IceServersResponse: {
        type: 'object',
        required: ['iceServers', 'expiresAt'],
        properties: {
          iceServers: {
            type: 'array',
            items: { $ref: '#/components/schemas/IceServer' },
          },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              requestId: { type: 'string' },
              details: {
                type: 'array',
                items: { type: 'object' },
              },
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
} as const;
