# API Reference

The CinePair backend provides a RESTful API for room management, health monitoring, and WebRTC configuration.

## Base URL
Default development URL: `http://localhost:3001`

---

## Health & Stats

### `GET /health`
Returns server health, uptime, and room statistics.

**Response (200 OK)**:
```json
{
  "status": "ok",
  "uptime": 3600,
  "rooms": {
    "totalRooms": 5,
    "activeRooms": 2,
    "waitingRooms": 3
  },
  "timestamp": 1714123456789
}
```

### `GET /ready`
Readiness probe for deployment environments (e.g., Kubernetes, Render).

**Response (200 OK)**:
```json
{
  "status": "ready",
  "dependencies": {
    "memory_store": "ok"
  }
}
```

---

## WebRTC Configuration

### `GET /api/ice-servers`
Fetches STUN/TURN server configurations with ephemeral credentials.

**Response (200 OK)**:
```json
[
  { "urls": "stun:stun.l.google.com:19302" },
  {
    "urls": "turn:your-turn-server.com:3478",
    "username": "1714127056:cinepair",
    "credential": "base64-hmac-credential..."
  }
]
```

---

## Room Management

### `POST /api/rooms`
Creates a new ephemeral room.

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nickname` | string | Yes | Admin's display name |
| `password` | string | No | Optional room password |
| `require_approval` | boolean | No (Default: true) | Whether joining requires admin approval |
| `max_users` | integer | No (Default: 2) | Max participants (2-10) |

**Response (201 Created)**:
```json
{
  "roomCode": "ABCDEFGH",
  "userId": "user_...",
  "role": "admin",
  "sessionToken": "jwt.token.here",
  "requireApproval": true,
  "hasPassword": false
}
```

### `GET /api/rooms/{room_code}`
Fetches public metadata for a room.

**Response (200 OK)**:
```json
{
  "code": "ABCDEFGH",
  "hasPassword": false,
  "requireApproval": true,
  "userCount": 1,
  "maxUsers": 2,
  "status": "waiting",
  "isLocked": false
}
```

### `POST /api/rooms/{room_code}/join`
Joins an existing room.

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nickname` | string | Yes | Joiner's display name |
| `password` | string | No | Room password (if enabled) |

**Response (200 OK - Direct Join)**:
```json
{
  "code": "ABCDEFGH",
  "userId": "user_...",
  "role": "partner",
  "sessionToken": "jwt.token.here",
  "users": [...],
  "requireApproval": false,
  "isScreenSharing": false
}
```

**Response (202 Accepted - Approval Pending)**:
```json
{
  "status": "APPROVAL_REQUIRED",
  "message": "Your join request has been sent to the room admin",
  "userId": "user_..."
}
```

### `POST /api/rooms/{room_code}/approve`
Admin approves or denies a pending join request. Requires `Authorization: Bearer <admin_token>`.

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `request_id` | string | Yes | ID of the join request |
| `approved` | boolean | Yes | true to approve, false to deny |
| `reason` | string | No | Optional reason for denial |

---

## Error Codes

| Code | Description |
|------|-------------|
| `ROOM_NOT_FOUND` | The specified room code does not exist. |
| `ROOM_FULL` | The room has reached its `max_users` limit. |
| `WRONG_PASSWORD` | The provided password does not match. |
| `UNAUTHORIZED` | Invalid or missing JWT session token. |
| `FORBIDDEN` | User does not have permission (e.g., non-admin changing settings). |
| `VALIDATION_FAILED` | Request payload failed schema validation. |
| `RATE_LIMIT` | Too many requests from this IP. |
| `CHAT_DISABLED` | Chat has been disabled by the room admin. |
| `SCREEN_SHARE_DISABLED` | Screen sharing has been disabled for partners by the admin. |
| `INTERNAL_ERROR` | An unexpected server error occurred. |
