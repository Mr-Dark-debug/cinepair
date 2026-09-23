# CinePair deployment on Render Free

The repository root `render.yaml` describes a free Python web service and a static frontend. The existing Render services may need their settings updated manually; changing a Blueprint file alone does not change a separately created service. The frontend must build with `VITE_SIGNALING_URL=https://cinepair-signaling.onrender.com`, and `CORS_ALLOWED_ORIGINS` on the backend must include the exact frontend origin.

## Backend

- Root directory: `backend`
- Build: `pip install -r requirements.txt`
- Start: `python -m uvicorn app.main:socket_app --host 0.0.0.0 --port $PORT --proxy-headers`
- Health check: `GET /healthz` returns `{"status":"ok"}` when account storage is reachable.
- `DATABASE_URL`: a durable PostgreSQL URL is required for accounts and sessions to survive Render restarts. Without it, SQLite uses `DB_PATH=/tmp/cinepair.db`, which is temporary on Render Free. Do not use the temporary database for real accounts.
- `CORS_ALLOWED_ORIGINS`: comma-separated public web origins (for example `https://cinepair-frontend.onrender.com,https://mr-dark-debug.github.io`). Socket.IO rejects other browser origins.
- Optional `TURN_URLS` (comma-separated TURN URLs) and `TURN_SHARED_SECRET` (coturn REST shared secret): enable short-lived TURN credentials for peers behind restrictive networks. Without TURN, some calls cannot connect.

The React web app can be deployed as a Render static site, or served by another static host with its origin added to `CORS_ALLOWED_ORIGINS`. Set `VITE_SIGNALING_URL` during the frontend build. Desktop releases use the same signaling URL set in `.github/workflows/release.yml`.

## Free-plan availability

`.github/workflows/render-health-ping.yml` requests the JSON health route roughly every ten minutes. This may reduce idle spin-down while the service has free instance hours available. Scheduled GitHub Actions can be delayed or missed. The ping cannot prevent suspension after the workspace exhausts Render's free hours, and it cannot preserve a SQLite file across restarts. The health-check setting detects unhealthy running instances; it is not an always-on entitlement.

If Render shows **Free usage limit reached**, the backend stays unavailable until the next billing period unless the workspace changes its hosting arrangement. A health ping cannot override that suspension. The frontend can still load, but rooms and accounts require the Python backend.

## Release check

1. Ensure a durable `DATABASE_URL` is configured before inviting account users.
2. Confirm `/healthz` returns HTTP 200 and `{"status":"ok"}` on the actual Render URL.
3. Join one protected room from two browsers and test encrypted chat and a public embeddable video.
4. Test camera, microphone, screen share, and TURN-assisted calls from distinct networks with user-granted permissions.
5. Verify GitHub Actions tests and native installer jobs before publishing a release.
