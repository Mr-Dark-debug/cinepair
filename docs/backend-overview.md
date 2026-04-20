# Backend Overview

The CinePair backend is a high-performance, real-time signaling server built with **Python**, **FastAPI**, and **Socket.IO**. It serves as the orchestration layer for private watch-parties, handling room lifecycle, WebRTC signaling relay, and presence management.

## Purpose

The backend enables two or more peers to find each other, negotiate a WebRTC connection, and maintain a shared state (chat, screen sharing, room settings) without requiring permanent user accounts or complex infrastructure.

## Architecture Summary

- **Framework**: FastAPI (HTTP) + python-socketio (WebSocket).
- **Language**: Python 3.11+.
- **State Management**: In-memory store (ephemeral). Rooms are lost on server restart.
- **Real-time**: Socket.IO for low-latency events and signaling.
- **Security**: JWT-based anonymous session tokens and Argon2id password hashing.
- **Concurrency**: Fully asynchronous (ASGI) using `uvicorn`.

## Major Modules

| Module | Description |
|--------|-------------|
| `app.api` | REST endpoints for room creation, joining, and health checks. |
| `app.websocket` | Socket.IO event handlers for presence, signaling, and chat. |
| `app.services` | Core business logic (RoomService, TokenService, IceService). |
| `app.state` | In-memory storage for rooms and active users. |
| `app.core` | Configuration, security, and logging setup. |
| `app.schemas` | Pydantic models for request/response validation. |

## Request Flow

### 1. Room Creation (REST)
1. Frontend sends `POST /api/rooms`.
2. Backend generates a unique 8-character room code.
3. Backend creates a `Room` object in memory.
4. Backend returns a `sessionToken` (JWT) and `userId`.

### 2. Joining (REST/Socket)
1. User joins via `POST /api/rooms/{code}/join` or Socket.IO `room:join`.
2. Backend validates password and checks for "Room Full" or "Locked" status.
3. If `require_approval` is enabled, the request is put in a `PENDING` state.
4. Admin receives `room:join-request` via Socket.IO and approves/denies.

### 3. Real-time Interaction (Socket.IO)
1. Once joined, users communicate via Socket.IO for:
   - **Presence**: User joined/left/disconnected notifications.
   - **Signaling**: Relaying WebRTC SDP and ICE candidates.
   - **Chat**: Instant messaging fallback.
   - **Controls**: Toggling screen share or room settings.

## Room Lifecycle

1. **WAITING**: Room created, only admin is present.
2. **ACTIVE**: At least two users connected.
3. **RECONNECTING**: A user disconnected but is within the 90-second grace period.
4. **CLOSED**: Admin left or room expired after 24 hours of inactivity.

## Backend Boundaries

The backend is **stateless** regarding media. It never touches the video/audio streams; it only relays the signaling data (SDP/ICE) required for peers to establish a direct P2P connection. If P2P fails due to NAT issues, the backend provides ephemeral TURN credentials to a separate TURN server (e.g., coturn or Metered.ca).
