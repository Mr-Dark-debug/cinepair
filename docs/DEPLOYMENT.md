# CinePair Deployment Guide

## Table of Contents

- [Building the Windows Installer (.exe)](#building-the-windows-installer-exe)
- [Deploying the Backend to Render](#deploying-the-backend-to-render)
- [Production Environment Variables](#production-environment-variables)
- [TURN Server Configuration](#turn-server-configuration)
- [Troubleshooting](#troubleshooting)

---

## Building the Windows Installer (.exe)

### Prerequisites

- Node.js 20+ LTS
- npm 9+
- Windows 10/11 (for native module compilation)

### Step 1: Install Dependencies

```bash
cd client
npm install
```

### Step 2: Set Production Signaling URL

Before building, update the signaling server URL to point to your production backend:

**Option A: Environment variable**
```bash
set VITE_SIGNALING_URL=https://cinepair-signaling.onrender.com
```

**Option B: Create/update `.env.production` in client root**
```
VITE_SIGNALING_URL=https://cinepair-signaling.onrender.com
```

### Step 3: Build the Application

```bash
# Build the Vite bundle and Electron main process
npm run build
```

This creates:
- `client/dist/` — compiled React app
- `client/dist-electron/` — compiled Electron main + preload

### Step 4: Package the Installer

```bash
# Build Windows NSIS installer
npx electron-builder --win --x64
```

### Output

The installer is saved to:
```
client/release/<version>/CinePair-<version>-win-x64.exe
```

### Build Options

| Command | Output |
|---------|--------|
| `npx electron-builder --win --x64` | Windows 64-bit NSIS installer |
| `npx electron-builder --win --ia32` | Windows 32-bit NSIS installer |
| `npx electron-builder --mac --universal` | macOS universal DMG |
| `npx electron-builder --linux --x64` | Linux AppImage + deb |

### Installer Behavior

The NSIS installer:
- ✅ Allows choosing install directory
- ✅ Creates desktop shortcut
- ✅ Creates Start Menu shortcut
- ✅ Runs the app after installation
- ✅ Includes an uninstaller that cleans up app data

### Code Signing (Optional but Recommended)

Without code signing, Windows SmartScreen will warn users. To sign:

1. **Get a code signing certificate** from DigiCert, Sectigo, or another CA
2. **Set environment variables before building:**

```bash
set CSC_LINK=C:\path\to\certificate.pfx
set CSC_KEY_PASSWORD=your-certificate-password
```

3. **Build with signing:**
```bash
npx electron-builder --win --x64
```

The installer will be signed automatically.

---

## Deploying the Backend to Render

### Why Render?

- Free tier available (750 hours/month)
- Native Node.js support
- WebSocket support out of the box
- Automatic HTTPS
- Simple environment variable management

### Step-by-Step

#### 1. Push to GitHub

Ensure your code is pushed to a GitHub repository:

```bash
git add .
git commit -m "CinePair v1 production release"
git push origin main
```

#### 2. Create Render Web Service

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account and select the `cinepair` repository

#### 3. Configure Build Settings

| Setting | Value |
|---------|-------|
| **Name** | `cinepair-signaling` |
| **Region** | Choose closest to your users |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node dist/index.js` |
| **Instance Type** | `Free` (or `Starter $7/mo` for no spin-down) |

#### 4. Add Environment Variables

In the Render dashboard → **Environment** tab:

```
NODE_ENV=production
JWT_SECRET=<generate with: openssl rand -hex 32>
CORS_ORIGINS=app://cinepair
ALLOW_ELECTRON_ORIGIN=true
LOG_LEVEL=info
ROOM_EXPIRY_HOURS=12
MAX_USERS_PER_ROOM=2
RECONNECT_GRACE_SECONDS=90
PUBLIC_STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
```

> **Note**: Render automatically sets `PORT` — do NOT set it manually.

#### 5. Deploy

Click **"Create Web Service"**. Render will:
1. Clone your repo
2. Run `npm install && npm run build` in the `server/` directory
3. Start `node dist/index.js`

#### 6. Verify

```bash
# Check health
curl https://cinepair-signaling.onrender.com/health

# Check readiness
curl https://cinepair-signaling.onrender.com/ready

# View API docs
open https://cinepair-signaling.onrender.com/docs
```

### Preventing Free Tier Spin-Down

Free instances spin down after 15 minutes of inactivity. To keep it alive:

1. Create a free account at [UptimeRobot](https://uptimerobot.com)
2. Add a new **HTTP(s)** monitor:
   - URL: `https://cinepair-signaling.onrender.com/health`
   - Interval: **5 minutes**
3. This will ping your server regularly, preventing spin-down

### Custom Domain (Optional)

1. In Render dashboard → **Settings** → **Custom Domains**
2. Add your domain (e.g., `api.cinepair.app`)
3. Update DNS records as instructed
4. Update `CORS_ORIGINS` to include your custom domain

---

## Production Environment Variables

### Generating a Strong JWT Secret

```bash
# Linux/macOS
openssl rand -hex 32

# Windows PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})

# Output example: a3f8c1d2e4b5...
```

### Required for Production

| Variable | How to Set |
|----------|-----------|
| `JWT_SECRET` | Generate with `openssl rand -hex 32` |
| `NODE_ENV` | Set to `production` |
| `CORS_ORIGINS` | Your Electron app origin (`app://cinepair`) |
| `ALLOW_ELECTRON_ORIGIN` | Set to `true` |

### Optional but Recommended

| Variable | Recommendation |
|----------|---------------|
| `LOG_LEVEL` | `info` for production, `debug` for troubleshooting |
| `ROOM_EXPIRY_HOURS` | `12` (shorter than dev to clean up faster) |
| `RECONNECT_GRACE_SECONDS` | `90` (balance between UX and resource cleanup) |

---

## TURN Server Configuration

### When You Need TURN

TURN servers are needed when:
- Users are behind symmetric NATs
- Corporate firewalls block UDP
- One or both peers are on restrictive networks

Without TURN, WebRTC connections may fail for ~10-20% of users.

### Option 1: Metered.ca (Recommended for Hobby Projects)

1. Sign up at [metered.ca](https://www.metered.ca/stun-turn)
2. Create a new app and get your credentials
3. Add to Render environment:

```
TURN_URL=turn:a.relay.metered.ca:443?transport=tcp
TURN_CREDENTIAL=your-metered-api-key
```

Free tier includes 500 GB/month bandwidth.

### Option 2: Cloudflare TURN (For Scale)

1. Create a Cloudflare account
2. Enable TURN service (currently in beta)
3. Follow Cloudflare's API docs for credential generation

### Option 3: Self-Hosted coturn

For maximum control and no bandwidth limits:

```bash
# Install
sudo apt install coturn

# /etc/turnserver.conf
realm=cinepair.yourdomain.com
listening-port=3478
tls-listening-port=5349
use-auth-secret
static-auth-secret=YOUR_LONG_RANDOM_SECRET
no-tcp-relay
allowed-peer-ip=0.0.0.0-255.255.255.255
```

Add to environment:
```
TURN_URL=turn:your-server.com:3478
TURN_CREDENTIAL=YOUR_LONG_RANDOM_SECRET
```

### How Ephemeral Credentials Work

CinePair's server generates time-limited TURN credentials:

1. Client calls `GET /api/ice-servers`
2. Server generates username = `<expiry-timestamp>:cinepair`
3. Server generates credential = `HMAC-SHA1(shared_secret, username)`
4. Client uses these for 1 hour (configurable via `TURN_TTL_SECONDS`)
5. The shared secret is **never** sent to the client

---

## Troubleshooting

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Connection timeout | Server spinning down | Ping `/health` regularly with UptimeRobot |
| CORS error | Wrong `CORS_ORIGINS` | Add your Electron origin to `CORS_ORIGINS` |
| "Room not found" | Room expired | Increase `ROOM_EXPIRY_HOURS` |
| WebRTC fails | No TURN server | Add TURN configuration |
| JWT invalid | Wrong secret | Ensure `JWT_SECRET` matches on server |
| Rate limited | Too many requests | Wait 60 seconds, then retry |

### Server Logs

In production, the server outputs structured JSON logs:

```json
{
  "level": 30,
  "time": 1714123456789,
  "context": "RoomService",
  "roomCode": "ABC…",
  "msg": "Room created"
}
```

Log levels: `10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal`

### Checking Server Status

```bash
# Health check
curl -s https://your-server.onrender.com/health | jq

# Ready check
curl -s https://your-server.onrender.com/ready | jq

# ICE servers (verify TURN is configured)
curl -s https://your-server.onrender.com/api/ice-servers | jq
```

### Debugging WebRTC

1. Open Chrome DevTools → `chrome://webrtc-internals/`
2. Check the ICE candidate pairs
3. Verify TURN candidates appear if configured
4. Check for ICE failures in the connection logs
