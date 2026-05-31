# GitHub Release Draft: v0.1.2 (Stable Hotfix)

## 📌 Release Details
* **Tag Version:** `v0.1.2`
* **Release Title:** `v0.1.2 - CinePair: Auto-Updates, WebRTC Stability & Backend Resilience`
* **Target Branch:** `main`

---

## 🎬 CinePair v0.1.2: Stability & Auto-Updater Integration

Welcome to the stable release of **CinePair v0.1.2**! 🚀

This release introduces seamless Tauri v2 auto-update mechanisms, solves critical WebRTC room-joining race conditions, hardens the user interface against rare render-state synchronization exceptions (white-screen crashes), and packages a lightweight, console-resilient backend keep-alive agent to maintain high-responsiveness on free-tier hosting networks.

---

## 🚀 Key Improvements & Hotfixes

### ⚡ 1. Auto-Updater Integration & Permission Fixes
* **Tauri v2 Capabilities Adoption:** Fully integrated native update checks (`updater:default`) and application restart permissions (`process:allow-restart`) inside the default capability layout `src-tauri/capabilities/default.json`. The app can now check, download, and install updates automatically and relaunch natively!
* **Automated `latest.json` Generator:** Hardened the local packaging pipeline (`installer/build.ps1`) to bypass strict command warnings on standard error, ensuring Windows installers, cryptographic `.sig` digital signatures, and the updater manifest (`latest.json`) compile successfully all the way to completion.

### 🛡️ 2. Room Joining White-Screen Crash & Layout Safety
* **Direct Socket ID Mapping:** Replaced brittle nickname-based local client lookups with direct, immediate socket instance inquiries (`socketService.getSocket()?.id`). This identifies local and remote streams with 100% precision.
* **Universal UI Null-Safety:** Added defensive null-safety guards around initials parsing (`p.nickname || "CP"`) and status text extraction across `<Stage>`, `<VideoTile>`, `<FloatingOverlay>`, and `<ChatSidebar>` templates. The application is now fully immune to intermediate render-phase state synchronization mismatches.
* **Stable WebRTC handshakes:** Refactored perfect-negotiation (polite/impolite) parameters to query socket IDs dynamically. This prevents race conditions and SDP negotiation collisions when a second user joins.
* **Speaker Detection Buffer Safety:** Wrapped the active microphone speaker analyzer (`onaudioprocess`) in try-catch guards to handle empty or uninitialized tracks safely.

### 🔌 3. Render Signaling Keep-Alive Agent
* **Standard-Library Python Agent:** Written a lightweight, standard-library-only `keep_alive.py` script.
* **Cold-Start Resilience:** Configured request timeouts up to **60 seconds** to patiently accommodate Render's initial spin-up latency when waking up from a deep sleep.
* **Windows Console Encoding Fix:** Replaced Unicode emojis inside status statements with clean, standard ASCII bracket tags (`[SUCCESS]`, `[WARNING]`, `[ERROR]`), preventing fatal `UnicodeEncodeError` crashes on Windows consoles.

### 🎨 4. Premium Branded App Settings UI
* **Custom Updates Branding:** Refactored the `AppSettings` updating panel to display your branded logo assets dynamically in dark or light mode.
* **Main Header Clean-Up:** Relocated the duplicate "Dark Mode" switch from the main screen's top-right header into the App Settings modal under the User Profile tab, keeping the main interface clean and distraction-free.

---

## 💿 Installation & Platform Instructions

### 🪟 Windows Installer (`.msi` / `.exe`)
1. Download **`CinePair_0.1.2_x64_en-US.msi`** or **`CinePair_0.1.2_x64.exe`**.
2. Double-click the installer and follow the native Windows install wizard.
3. *Note on Smart App Control (SAC):* If Windows Defender flags the installer as an unsigned binary, click **More Info** > **Run Anyway**. (Exclusion steps are listed inside `README.md` under AppLocker workarounds).

### 🍎 macOS App Bundle (`.dmg`)
1. Download **`CinePair_0.1.2_x64.dmg`** (Intel) or **`CinePair_0.1.2_aarch64.dmg`** (Apple Silicon).
2. Open the `.dmg` container and drag the **CinePair** icon into your **Applications** folder.

### 🐧 Linux Package (`.AppImage` / `.deb`)
1. Download **`CinePair_0.1.2_amd64.AppImage`** or **`cinepair_0.1.2_amd64.deb`**.
2. For the AppImage, grant execution permissions and run:
   ```bash
   chmod +x CinePair_0.1.2_amd64.AppImage
   ./CinePair_0.1.2_amd64.AppImage
   ```

---

## 📦 Asset Manifest & File Outputs

When uploading assets to your GitHub Release, please include the generated files inside `installer/v0.1.2/`:

| Platform | Filename | Description |
| --- | --- | --- |
| **Windows** | `CinePair_0.1.2_x64_en-US.msi` | Native Windows Installer package (64-bit) |
| **Windows** | `CinePair_0.1.2_x64_en-US.msi.sig` | Cryptographic signature file (required by Auto-Updater) |
| **Windows** | `CinePair_0.1.2_x64.exe` | Windows standalone executable installer |
| **Updater** | `latest.json` | Tauri Auto-Updater platform manifest definitions |
| **macOS** | `CinePair_0.1.2_x64.dmg` | macOS installer bundle for Intel processors |
| **macOS** | `CinePair_0.1.2_aarch64.dmg` | macOS installer bundle for Apple Silicon (M1/M2/M3) |
| **Linux** | `CinePair_0.1.2_amd64.AppImage` | Linux portable binary executable |
| **Linux** | `cinepair_0.1.2_amd64.deb` | Debian/Ubuntu system install package |
| **Source** | `Source_code_v0.1.2.zip` | Compressed GitHub source archive |
| **Source** | `Source_code_v0.1.2.tar.gz` | Compressed Gzip source archive |
