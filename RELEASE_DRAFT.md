# GitHub Release Draft: v0.1.0 (Stable)

## 📌 Release Details
* **Tag Version:** `v0.1.0`
* **Release Title:** `v0.1.0 - CinePair: The P2P Cinematic Co-Watch Desktop Suite`
* **Target Branch:** `main`

---

## 🎬 CinePair v0.1.0: First Stable Release

Welcome to the official stable release of **CinePair**! 🎉

CinePair is a premium, native-feeling, and server-free desktop application for couples and friends to watch high-fidelity movie streams together in perfect real-time synchrony. Built using **Tauri v2**, **React/Vite (TypeScript)**, **Tailwind CSS v4**, and a **FastAPI signaling relayer**, CinePair connects you directly to your peers without middle-man databases, registrations, or latency delays.

---

## 🚀 Key Features & Capabilities

### ⚡ Pure P2P WebRTC Perfect Negotiation
* **W3C Standard Sync:** Fully adopted the **WebRTC Perfect Negotiation pattern** to handle connection handshakes natively. This guarantees robust, glitch-free SDP exchanges and NAT traversals through ICE/STUN channels.
* **Zero Latency Pixel Transfers:** Streams flow directly from host to guest with near-zero latency, preserving maximum resolution and frames-per-second.

### 🎨 Vibrant, High-Contrast Premium Dark Theme
* **Contrast-Rich Design:** Swapped pale and dull mediums for a deep midnight canvas (`#0a0a0d`) paired with highly vibrant, glowing pastel cards that pop with maximum contrast and uncompromised legibility.
* **Local CSS Inheritance:** Custom pastel card layers locally override text variables to preserve a perfect rich-black contrast inside card headers and buttons in both Light and Dark themes.

### 🍿 Draggable & Resizable Watcher Badges Overlay
* **Tactile Webcam Tiles:** Overlay your partner's camera directly over the active screenshared movie canvas.
* **Full Geometric Control:** Click and drag the overlay tile anywhere on the screen, toggle between **Circle** and **Square** cropping shapes, resize the frame scaling dynamically, or hide it instantly.

### 🎵 Web Audio System Sound Mixer
* **Seamless Audio Mixing:** Feeds microphone inputs and screenshared system/movie audio tracks together into a single unified `AudioContext` mapping to WebRTC senders on the fly.
* **Echo-Free co-watching:** Automatic gain control and echo-suppression are enabled to ensure movie sounds don't feedback through voice channels.

### 🔒 Host Approval waiting lobbies
* **Complete Room Security:** Hosts can set custom nick names, passcodes, participant capacity limits, and toggle a waiting lobby. Queue requests wait securely in a lobby until the room owner admits or kicks them.

### 💬 Slack-Style Emoji Physics
* **Expressive Co-Watching:** Integrated a reactive emoji physics picker. Hovering over video frames or messages allows users to float animated emoji reactions on top of active screenshares in real-time.

---

## 💿 Installation & Platform Instructions

### 🪟 Windows Installer (`.msi` / `.exe`)
1. Download **`CinePair_0.1.0_x64_en-US.msi`** or **`CinePair_0.1.0_x64.exe`**.
2. Double-click the installer and follow the native Windows install wizard.
3. *Note on Smart App Control (SAC):* If Windows Defender flags the installer as an unsigned binary, click **More Info** > **Run Anyway**. (Exclusion steps are listed inside `README.md` under AppLocker workarounds).

### 🍎 macOS App Bundle (`.dmg`)
1. Download **`CinePair_0.1.0_x64.dmg`** (Intel) or **`CinePair_0.1.0_aarch64.dmg`** (Apple Silicon).
2. Open the `.dmg` container and drag the **CinePair** icon into your **Applications** folder.
3. Launch the application.

### 🐧 Linux Package (`.AppImage` / `.deb`)
1. Download **`CinePair_0.1.0_amd64.AppImage`** or **`cinepair_0.1.0_amd64.deb`**.
2. For the AppImage, grant execution permissions and run:
   ```bash
   chmod +x CinePair_0.1.0_amd64.AppImage
   ./CinePair_0.1.0_amd64.AppImage
   ```

---

## 🛡️ Privacy & Ephemeral Room Commitments
* **No Signups, No Accounts:** CinePair doesn't require names, emails, passwords, or data collection.
* **Serverless Media Transfers:** Movies and cameras flow strictly peer-to-peer. Our signaling backend only relays initial handshakes, meaning no media tracks are ever stored or accessible on the cloud.
* **Auto-Purging Lobbies:** All room codes and session caches automatically purge on termination.

---

## 📦 Asset Manifest & File Outputs

When uploading assets to your GitHub Release, please include:

| Platform | Filename | Description |
| --- | --- | --- |
| **Windows** | `CinePair_0.1.0_x64_en-US.msi` | Native Windows Installer package (64-bit) |
| **Windows** | `CinePair_0.1.0_x64.exe` | Windows standalone executable installer |
| **macOS** | `CinePair_0.1.0_x64.dmg` | macOS installer bundle for Intel processors |
| **macOS** | `CinePair_0.1.0_aarch64.dmg` | macOS installer bundle for Apple Silicon (M1/M2/M3) |
| **Linux** | `CinePair_0.1.0_amd64.AppImage` | Linux portable binary executable |
| **Linux** | `cinepair_0.1.0_amd64.deb` | Debian/Ubuntu system install package |
| **Source** | `Source code (zip)` | Compressed GitHub source archive |
| **Source** | `Source code (tar.gz)` | Compressed Gzip source archive |
