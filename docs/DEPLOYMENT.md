# Deployment Guide

This guide covers building the CinePair client and deploying the Python backend.

## Table of Contents
- [Building the Windows Installer (.exe)](#building-the-windows-installer-exe)
- [Deploying the Backend to Render](#deploying-the-backend-to-render)
- [Production Environment Variables](#production-environment-variables)
- [TURN Server Configuration](#turn-server-configuration)

---

## Building the Windows Installer (.exe)

### Prerequisites
- Node.js 20+ LTS
- Windows 10/11 (for native module compilation)

### Steps
1. **Install Dependencies**:
   ```bash
   cd client
   npm install
   ```
2. **Set Production URL**:
   Update `VITE_SIGNALING_URL` in `client/.env.production` to your deployed backend URL.
3. **Build & Package**:
   ```bash
   npm run build
   npx electron-builder --win --x64
   ```

---

## Deploying the Backend to Render

CinePair's Python backend is optimized for hosting on **Render** (Web Service).

### Step-by-Step
1. **Connect GitHub**: Link your repository to Render.
2. **Create Web Service**:
   - **Runtime**: `Python`
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt` (or `pip install .` if using pyproject.toml)
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. **Environment Variables**: Add the required variables listed below.

---

## Production Environment Variables

| Variable | Recommendation |
|----------|----------------|
| `ENVIRONMENT` | `production` |
| `JWT_SECRET` | Generate a 32-character hex string. |
| `CORS_ORIGINS` | `app://cinepair` |
| `ALLOW_ELECTRON_ORIGIN` | `True` |
| `LOG_LEVEL` | `INFO` |

---

## TURN Server Configuration

WebRTC P2P connections fail for ~15% of users due to restrictive NATs. A TURN server is required for these cases.

### Using Metered.ca (Recommended)
1. Get your TURN URL and Shared Secret from Metered.ca.
2. Set `TURN_URL` and `TURN_SECRET` in your backend environment.
3. The backend will automatically generate ephemeral credentials via `GET /api/ice-servers`.

### Self-Hosted coturn
If using `coturn`, ensure `static-auth-secret` is configured and matches `TURN_SECRET` on the CinePair backend.
