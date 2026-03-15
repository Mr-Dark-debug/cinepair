# 🎬 CinePair – Private Movie Co-Watching for Couples

> **Watch together, anywhere.** A private, anonymous desktop app for couples to watch movies, YouTube, or any content together in real-time with video calls and chat.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Electron](https://img.shields.io/badge/Electron_40-47848F?style=flat&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite_6-646CFF?style=flat&logo=vite&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=flat&logo=webrtc&logoColor=white)

---

## ✨ Features

- 🔒 **No sign-up, no accounts** — completely anonymous and private
- 🎲 **Unique 8-char room codes** — collision-resistant via nanoid
- 🔐 **Optional room password** — set by the room creator
- ✅ **Join approval system** — admin can require approval for joining
- 🖥️ **Screen sharing** — share your entire screen, specific window, or browser tab
- 🔊 **System audio capture** — hear YouTube, movies, and any audio perfectly in sync
- 📹 **Video calls** — always-on webcam streams (toggleable)
- 💬 **Real-time chat** — P2P via WebRTC DataChannel with emoji support
- 🌐 **P2P communication** — no media goes through any server
- 🎨 **Beautiful dark UI** — cinematic design with glassmorphism and neon accents

---

## 🏗️ Architecture

```
┌──────────────────┐         ┌──────────────────┐
│   User A (Admin) │         │  User B (Partner) │
│                  │         │                   │
│  Electron + React│◄───────►│  Electron + React │
│  (Renderer)      │ WebRTC  │  (Renderer)       │
│                  │  P2P    │                   │
└────────┬─────────┘         └────────┬──────────┘
         │                            │
         │    Socket.IO Signaling     │
         └──────────┬─────────────────┘
                    │
           ┌────────▼─────────┐
           │  Signaling Server │
           │  (Node.js + Express│
           │   + Socket.IO)    │
           └──────────────────┘
```

- **Signaling server** handles room management, password validation, and WebRTC offer/answer/ICE relay
- **All media streams** (video, screen, audio) flow directly P2P via WebRTC
- **Chat messages** use WebRTC DataChannel primarily, with Socket.IO fallback

---

## 📁 Project Structure

```
cinepair/
├── server/                    # Signaling server
│   ├── src/
│   │   ├── index.ts           # Express + Socket.IO server entry
│   │   ├── RoomManager.ts     # OOP room lifecycle management
│   │   ├── types.ts           # Shared TypeScript types
│   │   └── utils/
│   │       └── Logger.ts      # Structured logger
│   ├── package.json
│   └── tsconfig.json
├── client/                    # Electron desktop app
│   ├── src/
│   │   ├── main/
│   │   │   └── index.ts       # Electron main process
│   │   ├── preload.ts         # Context bridge (main ↔ renderer)
│   │   └── renderer/
│   │       ├── main.tsx        # React entry point
│   │       ├── App.tsx         # Root component + routing
│   │       ├── index.css       # Global styles + Tailwind
│   │       ├── components/
│   │       │   ├── Home.tsx           # Landing screen
│   │       │   ├── CreateRoom.tsx     # Room creation
│   │       │   ├── JoinRoom.tsx       # Room joining
│   │       │   ├── RoomLobby.tsx      # Admin waiting room
│   │       │   ├── MainRoom.tsx       # Co-watching screen
│   │       │   ├── Chat.tsx           # Chat sidebar
│   │       │   └── AdminControls.tsx  # Screen share controls
│   │       ├── stores/
│   │       │   └── roomStore.ts       # Zustand state management
│   │       ├── lib/
│   │       │   ├── signaling.ts       # Socket.IO client
│   │       │   └── peerConnection.ts  # WebRTC peer handler
│   │       └── types/
│   │           └── global.d.ts        # Window type augmentation
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── package.json
│   └── entitlements.mac.plist         # macOS permissions
├── .env.example
├── README.md
└── LICENSE
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 22+** (LTS recommended)
- **npm 10+**
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/cinepair.git
cd cinepair
```

### 2. Start the Signaling Server

```bash
cd server
npm install
cp ../.env.example .env   # Or create .env with defaults

# Development (with hot reload)
npm run dev

# Production
npm run build && npm start
```

The server will start on `http://localhost:3001`.

### 3. Start the Electron Client

```bash
cd client
npm install
cp ../.env.example .env   # Ensure VITE_SIGNALING_URL points to your server

# Development (Vite + Electron with hot reload)
npm run electron:dev
```

---

## 🌍 Deploying the Signaling Server

The signaling server is lightweight and can run on any free hosting:

### Option 1: Render.com (Free)
1. Push your `server/` directory to a Git repo
2. Create a new Web Service on Render
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Add environment variables from `.env`

### Option 2: Railway.app (Free tier)
1. Connect your repo
2. Set root directory to `server/`
3. Railway will auto-detect Node.js

### Option 3: Fly.io (Free tier)
```bash
cd server
fly launch
fly deploy
```

### Option 4: ngrok (Local testing)
```bash
# Start server locally
cd server && npm run dev

# In another terminal, expose it
ngrok http 3001
```
Update `VITE_SIGNALING_URL` in the client `.env` to the ngrok URL.

---

## 🖥️ Building for Distribution

```bash
cd client

# Build for current platform
npm run build

# Outputs:
# Windows: release/*.exe (NSIS installer)
# macOS:   release/*.dmg
# Linux:   release/*.AppImage
```

---

## ⚙️ Platform-Specific Permissions

### Windows
- No special permissions needed
- Camera/microphone access prompts will appear automatically

### macOS
- **Camera**: Requires `NSCameraUsageDescription` (included in package.json build config)
- **Microphone**: Requires `NSMicrophoneUsageDescription` (included)
- **System Audio**: Requires `NSAudioCaptureUsageDescription` (included)
- For macOS 14.2+: The entitlements.mac.plist file handles code signing permissions
- **Screen Recording**: macOS will prompt for Screen Recording permission in System Settings > Privacy & Security

### Linux
- Camera/mic should work out of the box on most distros
- For PipeWire systems: PulseAudio compatibility layer handles audio capture
- AppImage may need `--no-sandbox` flag on some systems: `./CinePair.AppImage --no-sandbox`

---

## 🧪 Test Plan (20+ Test Cases)

| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 1 | Create room without password | Room created, 8-char code displayed | ✅ |
| 2 | Create room with password | Room created, password shown | ✅ |
| 3 | Copy room code | Copied to clipboard, toast shown | ✅ |
| 4 | Join with correct code (no password) | Direct join, enters room | ✅ |
| 5 | Join with correct code + password | Direct join, enters room | ✅ |
| 6 | Join with wrong password | Red error: "Wrong password" | ✅ |
| 7 | Join non-existent room | Error: "Room not found" | ✅ |
| 8 | Join full room (2 users already) | Error: "Room is full" | ✅ |
| 9 | Toggle "Require Approval" | Setting changes, notification shown | ✅ |
| 10 | Join with approval ON | "Waiting for approval" state shown | ✅ |
| 11 | Admin approves join request | Partner joins the room | ✅ |
| 12 | Admin denies join request | Partner sees denial message | ✅ |
| 13 | Share entire screen | Screen visible to partner with audio | ✅ |
| 14 | Share specific window | Window visible to partner | ✅ |
| 15 | System audio capture | Partner hears movie/YouTube audio | ✅ |
| 16 | Stop screen sharing | Partner sees placeholder, admin controls reset | ✅ |
| 17 | Toggle camera ON/OFF | Video feed starts/stops | ✅ |
| 18 | Toggle microphone ON/OFF | Audio mute/unmute works | ✅ |
| 19 | Send chat message | Message appears for both users | ✅ |
| 20 | Emoji in chat | Emoji renders correctly | ✅ |
| 21 | Partner leaves | Admin notified, status back to "waiting" | ✅ |
| 22 | Admin leaves | Room closed, partner notified | ✅ |
| 23 | Disconnection recovery | Reconnects automatically via Socket.IO | ✅ |
| 24 | Room expiry (24h) | Expired rooms cleaned up | ✅ |
| 25 | Fullscreen toggle | App enters/exits fullscreen | ✅ |
| 26 | Health check endpoint | GET /health returns OK + stats | ✅ |

---

## 🛠️ Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Desktop Shell | Electron 40+ | Cross-platform desktop app with native system APIs |
| Frontend | React 19 + TypeScript | Modern UI with strict type safety |
| Build Tool | Vite 6 | Lightning-fast HMR and builds |
| CSS | Tailwind CSS 3 | Utility-first styling for rapid UI development |
| State | Zustand 5 | Lightweight, no-boilerplate state management |
| WebRTC | Native RTCPeerConnection | Direct P2P for video, screen, and data |
| Signaling | Socket.IO 4 | Reliable WebSocket connections with fallback |
| Server | Node.js 22 + Express 5 | Fast, lightweight signaling server |
| Unique IDs | nanoid 5 | Cryptographically secure, collision-resistant |
| Packaging | electron-builder | Cross-platform installers (.exe, .dmg, .AppImage) |

---

## 📄 License

MIT License – see [LICENSE](./LICENSE) for details.

---

<p align="center">
  Made with ❤️ for movie nights
</p>