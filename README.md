# CinePair

CinePair is a watch room for couples and friends. Two people can join with a six-character code, chat, react, share a screen, and keep supported videos in sync. The desktop client uses Tauri, React, and TypeScript. Signaling and account APIs are entirely Python (FastAPI, Socket.IO, SQLAlchemy).

## What works

- Guest rooms with optional passcode, capacity, approval lobby, host controls, and room settings.
- Accounts, sessions, pairing codes, password changes, and unpairing. Configure `DATABASE_URL` with a durable PostgreSQL database for hosted accounts.
- AES-GCM chat, screenshots, and drawing in passcode rooms. The passcode derives the browser-side key; the server receives a separate verifier and relays ciphertext. Participants must share the passcode out of band. Rooms without a passcode have unencrypted chat.
- Synchronized public, embeddable YouTube videos and direct HTTPS MP4/WebM/Ogg files. The player provides source errors, a queue, sync recovery, and picture-in-picture where the browser supports it.
- Shortcuts to Netflix, Prime Video, JioHotstar, Disney+, Hulu, Max, Vimeo, Dailymotion, and Twitch. These open separately; provider DRM and embed rules prevent CinePair from promising synchronized playback or capture there.
- WebRTC camera, microphone, and screen sharing, with configurable TURN support. Pixel avatars appear when cameras are off; the couple toolkit includes reactions and drawing.

## Run locally

Use Python 3.11+ and Node 22+.

```powershell
python -m pip install -r backend/requirements.txt
cd backend
$env:DB_PATH = "./cinepair-dev.db"
python -m uvicorn app.main:socket_app --host 127.0.0.1 --port 8000
```

In another terminal:

```powershell
npm ci
$env:VITE_SIGNALING_URL = "http://127.0.0.1:8000"
npm run dev
```

Open `http://127.0.0.1:1420/app.html`. For the desktop shell, run `npm run tauri dev` instead of `npm run dev`.

## Verify

```powershell
npm test
npm run test:backend
npm run build
```

The GitHub verification workflow also runs backend tests against PostgreSQL. A passing build does not prove camera permissions, protected streaming services, or a deployed Render service; test those on the target devices and deployment.

See [deployment](DEPLOYMENT_GUIDE.md) for the Render free-plan configuration and its availability limits. See [release process](RELEASE_PROCESS.md) for versioning and GitHub artifacts.
