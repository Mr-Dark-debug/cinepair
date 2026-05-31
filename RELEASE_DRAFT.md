# GitHub Release Draft: v0.1.4

## Release Details
* **Tag Version:** `v0.1.4`
* **Release Title:** `v0.1.4 - CinePair: Realtime Screen Share, Chat Dedupe & Overlay Controls`
* **Target Branch:** `main`

---

## CinePair v0.1.4: Realtime Watch Room Quality Update

This release focuses on the core meeting experience: cleaner chat delivery, more reliable screen-share playback, separated camera/screen streams, receiver-side audio controls, improved overlay behavior, and version-aligned desktop update UI.

---

## Key Improvements & Fixes

### 1. Chat Reliability
* Fixed duplicate outgoing chat messages by removing the local optimistic chat insert and relying on the server's canonical broadcast.
* Kept join/leave activity visible inside the room chat, while toast notifications now appear near the bottom of the app instead of blocking the top UI.
* Added regression coverage for chat message sending and message reaction toggling.

### 2. Realtime Screen Sharing
* Separated remote camera/mic streams from remote screen-share streams so the main stage prioritizes the live screen video instead of accidentally rendering a stale camera frame.
* Added screen-capture constraints targeting smooth 30 FPS display capture with 1080p ideal resolution.
* Added WebRTC sender tuning for screen video, camera video, microphone audio, and screen audio using RTP encoding parameters.
* Added media `contentHint` values for motion screen/video and speech/music audio to help browsers optimize realtime encoding.

### 3. Audio Controls
* Added receiver-side audio sliders for pinned remote participants, allowing separate voice and screen-share volume adjustment.
* Screen audio is now sent as a dedicated track when the platform provides it, which avoids mixing it into the microphone feed and improves clarity.

### 4. Overlay UX
* Floating participant overlays no longer display while the app is in the foreground during watch mode.
* Added a right-click overlay menu with attached view, close own view, circle/square shape, size increase/decrease, and pin-to-corner controls.
* Added a compact chat dock that can be shown or hidden from the bottom meeting control deck when the full chat sidebar is closed.

### 5. Desktop Updates & Versioning
* Bumped the app version to `0.1.4` in `package.json`, `package-lock.json`, and `src-tauri/tauri.conf.json`.
* Updated the settings modal to read and display the native Tauri app version instead of a stale hard-coded version.

---

## Upload Checklist

Upload all generated installer assets from your `v0.1.4` build output, including:

| Platform | Filename Pattern | Description |
| --- | --- | --- |
| Windows | `CinePair_0.1.4_x64_en-US.msi` | Native Windows installer |
| Windows | `CinePair_0.1.4_x64_en-US.msi.sig` | Required updater signature |
| Windows | `CinePair_0.1.4_x64.exe` | Windows executable installer |
| Updater | `latest.json` | Tauri updater manifest |
| macOS | `CinePair_0.1.4_*.dmg` | macOS installer bundle |
| Linux | `CinePair_0.1.4_*.AppImage` / `cinepair_0.1.4_*.deb` | Linux packages |
| Source | `Source_code_v0.1.4.zip` / `Source_code_v0.1.4.tar.gz` | GitHub source archives |

---

## Notes For Release Testing

Before publishing, verify a two-device room with:

* Create room, join room, and leave room flows.
* Chat send, reply, emoji reaction, and join/leave system messages.
* Camera, microphone, screen share, and screen audio.
* Remote voice and screen volume sliders.
* Overlay right-click controls and compact chat dock.
* Auto-update check against the published `latest.json`.
