/**
 * @fileoverview OpenAPI 3.0.3 specification for CinePair Signaling API.
 * Serves as the contract for all REST endpoints.
 * @module docs/openapi
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'CinePair Signaling API',
    version: '1.0.0',
    description: 'Anonymous room-scoped signaling API for CinePair watch-party application.',
  },
  servers: [{ url: '/' }],
  paths: {
    '/health': {
      get: {
        security: [],
        summary: 'Health check',
        tags: ['System'],
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
        tags: ['System'],
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
    '/api/ice-servers': {
      get: {
        security: [],
        summary: 'Get ephemeral ICE server configuration',
        tags: ['WebRTC'],
        description: 'Returns STUN/TURN server configuration with short-lived credentials. Client must call this post-join.',
        responses: {
          '200': {
            description: 'ICE servers with ephemeral credentials',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/IceServersResponse' },
              },
            },
          },
        },
      },
    },
    '/api/rooms': {
      post: {
        summary: 'Create a new room',
        tags: ['Rooms'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateRoomRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Room created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateRoomResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/Error' },
          '429': { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/api/rooms/{roomCode}/join': {
      post: {
        summary: 'Join a room or create join request',
        tags: ['Rooms'],
        parameters: [{ $ref: '#/components/parameters/RoomCode' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/JoinRoomRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Joined room directly',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JoinRoomResponse' },
              },
            },
          },
          '202': {
            description: 'Approval required — waiting for admin',
          },
          '403': { $ref: '#/components/responses/Error' },
          '404': { $ref: '#/components/responses/Error' },
          '409': { $ref: '#/components/responses/Error' },
          '429': { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/metrics': {
      get: {
        summary: 'Prometheus metrics',
        tags: ['System'],
        responses: {
          '200': { description: 'Prometheus text metrics' },
          '401': { $ref: '#/components/responses/Error' },
          '404': { $ref: '#/components/responses/Error' },
        },
      },
    },
    '/docs': {
      get: {
        security: [],
        summary: 'Swagger UI',
        tags: ['System'],
        responses: { '200': { description: 'Interactive API documentation' } },
      },
    },
    '/api/docs': {
      get: {
        security: [],
        summary: 'Swagger UI alias',
        tags: ['System'],
        responses: { '200': { description: 'Interactive API documentation' } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Room-scoped anonymous session JWT',
      },
    },
    parameters: {
      RoomCode: {
        name: 'roomCode',
        in: 'path',
        required: true,
        schema: { type: 'string', pattern: '^[A-Z2-9]{8}$' },
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
            required: ['totalRooms', 'activeRooms', 'waitingRooms', 'socketsConnected'],
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
            properties: { roomStore: { type: 'string', enum: ['memory'] } },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      IceServer: {
        type: 'object',
        required: ['urls'],
        properties: {
          urls: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
          username: { type: 'string' },
          credential: { type: 'string' },
        },
      },
      IceServersResponse: {
        type: 'object',
        required: ['iceServers', 'expiresAt'],
        properties: {
          iceServers: { type: 'array', items: { $ref: '#/components/schemas/IceServer' } },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateRoomRequest: {
        type: 'object',
        required: ['nickname', 'requireApproval'],
        properties: {
          nickname: { type: 'string', minLength: 1, maxLength: 32 },
          password: { type: 'string', minLength: 4, maxLength: 64 },
          requireApproval: { type: 'boolean' },
        },
      },
      CreateRoomResponse: {
        type: 'object',
        required: ['roomCode', 'userId', 'role', 'sessionToken', 'requireApproval', 'hasPassword'],
        properties: {
          roomCode: { type: 'string' },
          userId: { type: 'string' },
          role: { type: 'string', enum: ['admin'] },
          sessionToken: { type: 'string' },
          requireApproval: { type: 'boolean' },
          hasPassword: { type: 'boolean' },
        },
      },
      JoinRoomRequest: {
        type: 'object',
        required: ['nickname'],
        properties: {
          nickname: { type: 'string', minLength: 1, maxLength: 32 },
          password: { type: 'string', maxLength: 64 },
        },
      },
      JoinRoomResponse: {
        type: 'object',
        required: ['roomCode', 'userId', 'role', 'sessionToken'],
        properties: {
          roomCode: { type: 'string' },
          userId: { type: 'string' },
          role: { type: 'string', enum: ['partner'] },
          sessionToken: { type: 'string' },
          requireApproval: { type: 'boolean' },
          hasPassword: { type: 'boolean' },
          users: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                nickname: { type: 'string' },
                role: { type: 'string', enum: ['admin', 'partner'] },
              },
            },
          },
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
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
} as const;
