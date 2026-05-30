# CinePair Deployment Guide - Render

This guide provides step-by-step instructions for deploying the **CinePair** application to [Render](https://render.com). CinePair consists of two main components:
1. **Backend Web Service**: A FastAPI signaling server using Socket.IO for WebRTC peer negotiation.
2. **Frontend Static Site**: A Vite-powered React application that connects directly to the signaling server.

---

## 📋 Table of Contents
- [Architecture Overview](#-architecture-overview)
- [Prerequisites](#-prerequisites)
- [Option A: Automated Deployment via Blueprint (Recommended)](#-option-a-automated-deployment-via-blueprint-recommended)
- [Option B: Manual Deployment](#-option-b-manual-deployment)
  - [Step 1: Deploy the FastAPI Backend](#step-1-deploy-the-fastapi-backend)
  - [Step 2: Deploy the React Frontend](#step-2-deploy-the-react-frontend)
- [Verification & Troubleshooting](#-verification--troubleshooting)

---

## 🏗️ Architecture Overview

CinePair is built strictly on top of WebRTC Peer-to-Peer channels. The architecture operates as follows:
- **Signaling Service**: Coordinates WebRTC handshakes, chat synchronization, and participant listings. It does **not** stream movie/video bandwidth, keeping hosting cost and latency near-zero.
- **Web App**: Built with Vite and React. Deployed as static HTML/JS/CSS assets.

---

## 🔑 Prerequisites

1. A **GitHub** account containing your CinePair repository.
2. A free or premium account on [Render](https://render.com).
3. Ensure your files are structured correctly:
   - Root Directory: React frontend application (`package.json`, `index.html`, etc.)
   - `/backend` Directory: FastAPI backend application (`requirements.txt`, `app/main.py`, etc.)

---

## ⚡ Option A: Automated Deployment via Blueprint (Recommended)

Render Blueprints allow you to deploy your entire stack (Frontend + Backend) simultaneously by defining services inside a single `render.yaml` file in the root of your repository.

### 1. Create a Root `render.yaml`

Create a file named `render.yaml` in the root of your project directory with the following content:

```yaml
services:
  # 1. FastAPI Signaling Backend (Optimized with Astral uv)
  - type: web
    name: cinepair-signaling
    runtime: python
    rootDir: backend
    buildCommand: "pip install uv && uv pip install -r requirements.txt"
    startCommand: "uv run uvicorn app.main:socket_app --host 0.0.0.0 --port $PORT"
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.0

  # 2. Vite React Frontend
  - type: web
    name: cinepair-frontend
    runtime: static
    buildCommand: "npm install && npm run build"
    staticPublishPath: dist
    envVars:
      - key: VITE_SIGNALING_URL
        fromService:
          name: cinepair-signaling
          type: web
          property: host
```

> [!TIP]
> **Astral `uv` Optimization**:
> We use Astral's `uv` instead of standard `pip` to resolve and install Python packages. This is significantly faster, cutting container deployment times on Render by up to 80%!

> [!TIP]
> **Blueprint Advantages**:
> The `fromService` block automatically extracts the backend service's URL and feeds it to the frontend build environment (`VITE_SIGNALING_URL`), ensuring zero manual configuration.

### 2. Launch the Blueprint on Render
1. Go to the **Render Dashboard**.
2. Click **New +** at the top right and select **Blueprint**.
3. Connect your GitHub repository.
4. Render will parse the root `render.yaml` file, spin up both services, and automatically link their URLs.

---

## 🛠️ Option B: Manual Deployment

If you prefer deploying the services individually via the Render web UI, follow these steps:

### Step 1: Deploy the FastAPI Backend

We will deploy the signaling server inside the `/backend` subfolder as a Python **Web Service**.

1. Click **New +** -> **Web Service**.
2. Connect your GitHub repository.
3. Configure the following service settings:
   - **Name**: `cinepair-signaling`
   - **Runtime**: `Python`
   - **Root Directory**: `backend` *(Crucial! Tells Render to build from the backend folder)*
   - **Build Command**: `pip install uv && uv pip install -r requirements.txt`
   - **Start Command**: `uv run uvicorn app.main:socket_app --host 0.0.0.0 --port $PORT`
4. Expand the **Advanced** section to add Environment Variables:
   - Add a key `PYTHON_VERSION` with value `3.11.0`.
5. Click **Create Web Service**.
6. Once deployed successfully, copy your backend service URL (e.g., `https://cinepair-signaling.onrender.com`).

---

### Step 2: Deploy the React Frontend

We will deploy the Vite application from the repository root as a **Static Site**.

1. Click **New +** -> **Static Site**.
2. Connect your GitHub repository.
3. Configure the following service settings:
   - **Name**: `cinepair-app`
   - **Root Directory**: *(Leave blank to build from repository root)*
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Expand the **Advanced** section to configure Environment Variables:
   - Add a key `VITE_SIGNALING_URL` and paste your backend service URL copied from Step 1 (e.g., `https://cinepair-signaling.onrender.com`).
5. Click **Create Static Site**.

---

## 🔍 Verification & Troubleshooting

### Checking Logs
- Check your Backend **Events** and **Logs** tabs in the Render dashboard. You should see Python successfully resolve dependencies and print:
  ```text
  INFO:     Started server process [1]
  INFO:     Waiting for application startup.
  INFO:     Application startup complete.
  INFO:     Uvicorn running on http://0.0.0.0:10000 (Press CTRL+C to quit)
  ```

### Handling Cold Starts on Free Tier
> [!WARNING]
> **Free Instances Spin-Down**:
> If you are using Render's Free tier, the backend service will spin down after 15 minutes of inactivity. When a new user attempts to join or create a room, the first load may experience a 30-50 second delay ("Cold Start") while the signaling service re-activates. Static frontend assets are served instantly via Render CDN.

### WebSocket Connection Failure (CORSMiddleware)
If clients experience handshake connectivity errors in browser developer tools:
1. Ensure `VITE_SIGNALING_URL` environment variable uses `https://` and does **not** contain a trailing slash (e.g., `https://cinepair-signaling.onrender.com`).
2. Verify that FastAPI CORS settings inside `/backend/app/main.py` contain `allow_origins=["*"]` or explicitly list your frontend Render URL.
