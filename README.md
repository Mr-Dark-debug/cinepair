# 🎬 CinePair — Watch Together, Anywhere

> Private desktop watch-party app for couples. Screen share, video call, and chat — no sign-up required.

[![Electron](https://img.shields.io/badge/Electron-31-47848F?logo=electron)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-5.11-010101?logo=socketdotio)](https://socket.io)

---

## Table of Contents
- [Features](#features)
- [Architecture](#architecture)
- [Quick Start (Development)](#quick-start-development)
- [Documentation](#documentation)
- [Environment Variables](#environment-variables)
- [Building the App](#building-the-app)
- [Security](#security)

---

## Features
- 🖥️ **Screen Sharing**: Low-latency screen sharing with real thumbnails.
- 📹 **Video Calling**: WebRTC P2P calls with automatic ICE restart.
- 💬 **Real-time Chat**: Instant messaging with emoji support and deduplication.
- 🔒 **Privacy First**: Optional Argon2id password hashing + Admin join approval.
- 🔑 **Session Tokens**: Anonymous room-scoped JWTs — no registration needed.
- 🔄 **Reconnection**: 90-second grace period for dropped connections.
- 📊 **Observability**: Structured JSON logging with `structlog`.

---

## Architecture
```
┌─────────────────┐     WebSocket/HTTPS       ┌──────────────────────┐
│  Electron App   │ ◄───────────────────────► │   Signaling Server   │
│                 │                           │                      │
│  React + Vite   │     Peer-to-Peer (WebRTC) │  FastAPI + Socket.IO │
│  Zustand Stores │ ◄──────────────────────►  │  Structlog           │
│  WebRtcEngine   │                           │  Argon2id Hashing    │
│                 │                           │  JWT Session Tokens  │
└─────────────────┘                           └──────────────────────┘
```

---

## Quick Start (Development)

### 1. Clone & Install
```bash
git clone https://github.com/your-username/cinepair.git
cd cinepair

# Backend
cd backend
python -m venv venv
source venv/bin/activate  # venv\Scripts\activate on Windows
pip install .

# Client
cd ../client
npm install
```

### 2. Configure & Run
```bash
# Start Backend (on port 3001)
uvicorn app.main:app --reload --port 3001

# Start Electron Client
npm run dev
```

---

## Documentation

Detailed technical documentation is available in the `docs/` folder:

- [Architecture Overview](docs/architecture.md)
- [Backend Overview](docs/backend-overview.md)
- [API Reference](docs/api-reference.md)
- [WebSocket Events](docs/websocket-events.md)
- [Rooms and Signaling](docs/rooms-and-signaling.md)
- [Settings System](docs/settings-system.md)
- [Deployment Guide](docs/deployment.md)
- [Debugging Guide](docs/debugging-guide.md)

---

## Environment Variables

### Backend Variables (.env)
| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | (dev-default) | **Change in production!** |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed origins. |
| `RECONNECT_GRACE_SECONDS` | `90` | Reconnection window. |
| `STUN_URLS` | Google STUN | Comma-separated list. |

### Client Variables (.env)
| Variable | Value |
|----------|-------|
| `VITE_SIGNALING_URL` | `http://localhost:3001` |

---

## Building the App

### Windows Installer
```bash
cd client
npm run build
npx electron-builder --win --x64
```

---

## Security
CinePair is built with a focus on privacy and security:
- **Anonymous**: No PII (Personally Identifiable Information) is ever collected.
- **Passwords**: Hashed with Argon2id; the server never sees plaintext.
- **Tokens**: JWTs are scoped to a single room and expire automatically.
- **P2P**: Video/audio data flows directly between users, not through the server.

---

## License
MIT © CinePair Contributors