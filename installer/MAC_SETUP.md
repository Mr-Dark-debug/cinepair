# CinePair macOS Setup (Apple Silicon + Intel)

One universal flow — the Mac app joins the **same rooms** as the Windows app
through the shared backend `https://cinepair-signaling.onrender.com`.

## 1. Download
- Go to GitHub Releases and grab `CinePair_<version>_universal.dmg`
  (older tags: `_aarch64.dmg` for M1/M2/M3, `_x64.dmg` for Intel).
- Verify (optional): `shasum -a 256 ~/Downloads/CinePair_*.dmg`

## 2. Install
1. Double-click the `.dmg` → drag **CinePair** into **Applications**.
2. First launch: right-click → **Open** (bypasses Gatekeeper once), or
   System Settings → Privacy & Security → **Open Anyway**.
3. Grant **Camera**, **Microphone**, and **Screen Recording** when prompted
   (Screen Recording is required for movie screen-share with audio).

## 3. Watch together cross-platform
1. Either side creates a room → shares the 6-digit code.
2. The other side joins with the same code — Mac ↔ Windows interop is
   automatic because both builds pin the same `VITE_SIGNALING_URL`.
3. For Netflix/Prime/Hotstar: open the service in a browser, then press
   **Screen-Share** with tab-audio ON (DRM can't play in-app).

## 4. macOS UI notes
- Overlay titlebar: traffic lights float over the app; content is padded
  so nothing hides underneath. Drag the window from the top strip.
- PiP, doodle, encrypted chat, avatars, and updater work identically on Mac.
- Updates: Settings → System Updates → Download & Relaunch (same `latest.json`).

## 5. Troubleshoot
- "Unidentified developer" → right-click Open / Open Anyway.
- Black screen share → allow Screen Recording, then relaunch.
- Can't join room → same code, same backend URL, no VPN blocking WebSockets.
