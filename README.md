# 🎬 CinePair — Watch Together, Anywhere

> Private desktop watch-party app for couples. Screen share, video call, and chat — no sign-up required.

[![Electron](https://img.shields.io/badge/Electron-31-47848F?logo=electron)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socketdotio)](https://socket.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://typescriptlang.org)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick Start (Development)](#quick-start-development)
- [Environment Variables](#environment-variables)
- [Building the Desktop App (.exe)](#building-the-desktop-app-exe)
- [Deploying the Backend to Render](#deploying-the-backend-to-render)
- [TURN Server Setup (Optional)](#turn-server-setup-optional)
- [API Reference](#api-reference)
- [Security](#security)
- [Project Structure](#project-structure)

---

## Features

| Feature | Description |
|---------|-------------|
| 🖥️ Screen Sharing | Share your entire screen or a specific window with real thumbnails |
| 📹 Video Calling | WebRTC peer-to-peer video calls with ICE restart |
| 💬 Real-time Chat | Instant messaging with emoji picker and message dedup |
| 🔒 Room Security | Optional password (argon2id hashed) + admin join approval |
| 🔑 Session Tokens | Anonymous room-scoped JWTs — no account required |
| 🔄 Reconnection | 90-second grace period for dropped connections |
| 📊 Observability | Pino structured JSON logging with sensitive data redaction |

---

## Architecture

```
┌─────────────────┐     WebSocket/HTTPS       ┌──────────────────────┐
│  Electron App   │ ◄───────────────────────► │   Signaling Server   │
│                 │                           │                      │
│  React + Vite   │     Peer-to-Peer (WebRTC) │  Express + Socket.IO │
│  Zustand Stores │ ◄──────────────────────►  │  Pino Logger         │
│  WebRtcEngine   │                           │  Argon2id Hashing    │
│                 │                           │  JWT Session Tokens  │
└─────────────────┘                           └──────────────────────┘
```

### Backend Modules

| Module | Path | Description |
|--------|------|-------------|
| Config | `server/src/config/env.ts` | Zod-validated environment parsing |
| Validation | `server/src/validation/schemas.ts` | Zod schemas for all REST + Socket events |
| State | `server/src/state/` | Abstract `RoomStore` interface + `MemoryRoomStore` |
| Services | `server/src/services/` | `RoomService`, `IceServerService`, `TokenService` |
| HTTP | `server/src/http/` | Express controllers + rate limiting middleware |
| Socket | `server/src/socket/` | Presence + Signaling gateways |
| Observability | `server/src/observability/` | Pino structured logger |
| Docs | `server/src/docs/` | OpenAPI 3.0.3 spec + Swagger UI |

### Frontend Modules

| Module | Path | Description |
|--------|------|-------------|
| Stores | `client/src/renderer/stores/` | Sliced Zustand stores (room, media, chat, connection) |
| WebRTC | `client/src/renderer/lib/webRtcEngine.ts` | Perfect Negotiation, ICE queueing, multi-peer |
| Signaling | `client/src/renderer/lib/signaling.ts` | Socket.IO client with JWT auth |
| Components | `client/src/renderer/components/` | React UI components |

---

## Quick Start (Development)

### Prerequisites

- [Node.js](https://nodejs.org) 20+ (LTS recommended)
- [npm](https://npmjs.com) 9+
- Windows 10/11 for Electron development

### 1. Clone and Install

```bash
git clone https://github.com/your-username/cinepair.git
cd cinepair

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Environment

```bash
# From the project root
cp .env.example .env
```

Edit `.env` with your settings. For local development, the defaults work fine.

### 3. Start the Signaling Server

```bash
cd server
npm run dev
```

The server starts at `http://localhost:3001`. Visit `http://localhost:3001/docs` for Swagger UI.

### 4. Start the Electron Client

```bash
cd client
npm run dev
```

The Electron app opens with hot-reload enabled.

---

## Environment Variables

### Server Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | ✅ | `3001` | HTTP server port |
| `HOST` | ❌ | `0.0.0.0` | Bind address (use `0.0.0.0` for Render) |
| `NODE_ENV` | ❌ | `development` | `development`, `production`, `test` |
| `CORS_ORIGINS` | ✅ | `http://localhost:5173` | Comma-separated allowed origins |
| `ALLOW_ELECTRON_ORIGIN` | ❌ | `false` | Allow `app://cinepair` origin |
| `JWT_SECRET` | ✅ | dev default | **Change in production!** Min 16 chars |
| `JWT_EXPIRES_IN` | ❌ | `24h` | Session token expiry |
| `ROOM_CODE_LENGTH` | ❌ | `8` | Room code length (6-12) |
| `ROOM_EXPIRY_HOURS` | ❌ | `24` | Room auto-cleanup after inactivity |
| `MAX_USERS_PER_ROOM` | ❌ | `2` | Max users per room |
| `RECONNECT_GRACE_SECONDS` | ❌ | `90` | Reconnection grace period |
| `PUBLIC_STUN_URLS` | ❌ | Google STUN | Comma-separated STUN servers |
| `TURN_URL` | ❌ | - | TURN server URL |
| `TURN_USERNAME` | ❌ | - | TURN static username |
| `TURN_CREDENTIAL` | ❌ | - | TURN shared secret (for HMAC credentials) |
| `TURN_TTL_SECONDS` | ❌ | `3600` | TURN credential TTL |
| `LOG_LEVEL` | ❌ | `info` | `debug`, `info`, `warn`, `error`, `fatal` |
| `ENABLE_METRICS` | ❌ | `false` | Enable Prometheus metrics endpoint |

### Client Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_SIGNALING_URL` | ✅ | `http://localhost:3001` | Signaling server URL |

---

## Building the Desktop App (.exe)

### Windows NSIS Installer

```bash
cd client

# Build the production bundle
npm run build

# Package as NSIS installer
npx electron-builder --win --x64
```

The installer will be at: `client/release/<version>/CinePair-<version>-win-x64.exe`

### Build Configuration

The `electron-builder.config.js` produces:
- **Windows**: NSIS installer (`.exe`) — customizable install directory, desktop shortcut
- **macOS**: DMG (universal binary) with hardened runtime
- **Linux**: AppImage + `.deb`

### Code Signing (Optional)

For production distribution, set these environment variables before building:

```bash
# Windows (requires certificate)
set CSC_LINK=path/to/certificate.pfx
set CSC_KEY_PASSWORD=your-certificate-password

# macOS (requires Apple Developer account)
set APPLE_ID=your@apple.id
set APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
set APPLE_TEAM_ID=XXXXXXXXXX
```

### Auto-Update

To enable auto-update via GitHub Releases:

1. Update `publish.owner` and `publish.repo` in `electron-builder.config.js`
2. Create a GitHub release with the built artifacts
3. The app will check for updates on startup

---

## Deploying the Backend to Render

### Step-by-Step Guide

#### 1. Create a Render Account

Sign up at [render.com](https://render.com) (free tier works).

#### 2. Create a New Web Service

1. Click **"New" → "Web Service"**
2. Connect your GitHub repository
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `cinepair-signaling` |
| **Root Directory** | `server` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node dist/index.js` |
| **Instance Type** | Free |

#### 3. Set Environment Variables

In the Render dashboard, go to **Environment** and add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` (Render assigns this automatically) |
| `JWT_SECRET` | Generate: `openssl rand -hex 32` |
| `CORS_ORIGINS` | `https://your-app-domain.com` |
| `ALLOW_ELECTRON_ORIGIN` | `true` |
| `LOG_LEVEL` | `info` |
| `ROOM_EXPIRY_HOURS` | `12` |
| `RECONNECT_GRACE_SECONDS` | `90` |

> ⚠️ **Critical**: Generate a strong `JWT_SECRET` for production!

#### 4. Deploy

Click **"Deploy"** — Render will build and start your server.

Your server URL will be: `https://cinepair-signaling.onrender.com`

#### 5. Update Client Environment

In your Electron app's `.env` or build config:

```bash
VITE_SIGNALING_URL=https://cinepair-signaling.onrender.com
```

#### 6. Verify Deployment

```bash
# Health check
curl https://cinepair-signaling.onrender.com/health

# Expected response:
# {"status":"ok","uptime":42,"rooms":{"totalRooms":0,...},"timestamp":"..."}

# API documentation
# Visit: https://cinepair-signaling.onrender.com/docs
```

### Render Free Tier Notes

- **Spin-down**: Free instances spin down after 15 min of inactivity. First request takes ~30s to cold-start.
- **Workaround**: Use [UptimeRobot](https://uptimerobot.com) to ping `/health` every 14 minutes.
- **Limitations**: 750 hours/month, 512 MB RAM.

---

## TURN Server Setup (Optional)

WebRTC needs a TURN server when peers are behind symmetric NATs. Options:

### Option 1: Metered TURN (Easiest)

1. Sign up at [metered.ca/stun-turn](https://www.metered.ca/stun-turn)
2. Get your API key and TURN credentials
3. Add to your `.env`:

```bash
TURN_URL=turn:a.relay.metered.ca:443?transport=tcp
TURN_CREDENTIAL=your-metered-api-key
```

### Option 2: Self-Hosted coturn

```bash
# Install coturn
sudo apt install coturn

# Configure /etc/turnserver.conf
realm=cinepair.yourdomain.com
use-auth-secret
static-auth-secret=YOUR_SHARED_SECRET_HERE
no-tcp-relay
```

Then set in your `.env`:
```bash
TURN_URL=turn:your-server.com:3478
TURN_CREDENTIAL=YOUR_SHARED_SECRET_HERE
```

The server generates ephemeral TURN credentials via HMAC-SHA1, so the client never sees your shared secret.

---

## API Reference

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Server health + room stats |
| `GET` | `/ready` | Readiness probe |
| `GET` | `/api/ice-servers` | Ephemeral ICE/TURN credentials |
| `POST` | `/api/rooms` | Create a new room |
| `POST` | `/api/rooms/:code/join` | Join a room |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/openapi.json` | OpenAPI spec |

### Socket.IO Events

#### Client → Server

| Event | Description |
|-------|-------------|
| `room:create` | Create a new room |
| `room:join` | Join an existing room |
| `room:leave` | Leave the current room |
| `room:join-response` | Admin responds to join request |
| `room:toggle-approval` | Toggle join approval |
| `signaling:relay` | Relay SDP/ICE candidates |
| `chat:message` | Send a chat message |
| `screen:toggle` | Toggle screen sharing |
| `peer:ready` | Signal peer readiness |

#### Server → Client

| Event | Description |
|-------|-------------|
| `room:user-joined` | A user joined the room |
| `room:user-left` | A user left the room |
| `room:user-disconnected` | A user disconnected (reconnecting) |
| `room:user-reconnected` | A user reconnected |
| `room:join-request` | New join request (admin only) |
| `room:join-response` | Response to join request |
| `room:joined` | Full room data after approval |
| `room:closed` | Room was closed |
| `signaling:relay` | Incoming SDP/ICE from peer |
| `chat:message` | Incoming chat message |
| `peer:start-negotiation` | Server-triggered negotiation |

---

## Security

### Production Checklist

- [x] **Passwords**: Hashed with `argon2id` — never stored in plaintext
- [x] **JWT Tokens**: Room-scoped, anonymous session tokens with configurable expiry
- [x] **CORS**: Strict origin checking — no wildcards in production
- [x] **Helmet**: HTTP security headers enabled
- [x] **Rate Limiting**: 5/min room creation, 20/min join, 100/min general
- [x] **Input Validation**: All payloads validated with Zod schemas
- [x] **Logging Redaction**: Passwords, SDP, credentials, tokens never logged
- [x] **ICE Credentials**: Ephemeral TURN credentials via server-side HMAC
- [x] **No Account Auth**: No user accounts — room-scoped only
- [x] **Electron CSP**: Content Security Policy configured

### What to NEVER do

- ❌ Set `JWT_SECRET` to the default in production
- ❌ Use `*` as CORS origin in production
- ❌ Expose TURN shared secrets in client-side environment variables
- ❌ Deploy with `NODE_ENV=development`

---

## Project Structure

```
cinepair/
├── .env.example                # Environment template
├── docs/
│   └── realtime-events.md      # WebSocket event documentation
├── server/                     # Signaling server
│   ├── src/
│   │   ├── index.ts            # Entry point (wires everything)
│   │   ├── app.ts              # Express app factory
│   │   ├── config/
│   │   │   └── env.ts          # Environment config (Zod-validated)
│   │   ├── validation/
│   │   │   └── schemas.ts      # All Zod schemas
│   │   ├── state/
│   │   │   ├── RoomStore.ts    # Abstract store interface
│   │   │   ├── RoomManager.ts  # Type definitions
│   │   │   ├── MemoryRoomStore.ts  # In-memory implementation
│   │   │   └── RedisRoomStore.ts   # Phase 2 stub
│   │   ├── services/
│   │   │   ├── roomService.ts      # Room lifecycle
│   │   │   ├── iceServerService.ts # ICE credential generation
│   │   │   └── tokenService.ts     # JWT operations
│   │   ├── http/
│   │   │   ├── controllers/    # REST handlers
│   │   │   └── middleware/     # Rate limiting, errors
│   │   ├── socket/
│   │   │   ├── socketServer.ts     # Socket.IO initialization
│   │   │   ├── presenceGateway.ts  # Room events
│   │   │   └── signalingGateway.ts # WebRTC + chat events
│   │   ├── observability/
│   │   │   └── logger.ts      # Pino structured logging
│   │   └── docs/
│   │       └── openapi.ts     # OpenAPI 3.0.3 spec
│   └── package.json
└── client/                    # Electron + React app
    ├── src/
    │   ├── main/              # Electron main process
    │   ├── preload/           # Context bridge
    │   └── renderer/          # React app
    │       ├── stores/
    │       │   ├── roomSlice.ts
    │       │   ├── mediaSlice.ts
    │       │   ├── chatSlice.ts
    │       │   ├── connectionSlice.ts
    │       │   └── settingsStore.ts
    │       ├── lib/
    │       │   ├── signaling.ts     # Socket.IO client
    │       │   └── webRtcEngine.ts  # Perfect Negotiation engine
    │       └── components/
    │           ├── Home.tsx
    │           ├── CreateRoom.tsx
    │           ├── JoinRoom.tsx
    │           ├── RoomLobby.tsx
    │           ├── MainRoom.tsx
    │           ├── Chat.tsx
    │           ├── ScreenSourcePicker.tsx
    │           └── AdminControls.tsx
    ├── electron-builder.config.js
    └── package.json
```

---

## License

MIT © CinePair Contributors