# CinePair Multi-Platform Manual Build Guide

This guide details the exact terminal commands required to manually compile, build, and package the CinePair native desktop installers for Windows, macOS, and Linux locally on your machine.

---

## 🪟 1. Native Windows Build (`.msi` / `.exe`)

You can compile Windows installers locally in two ways:

### Option A: Automated Build Pipeline (Recommended)
This production script automatically bundles the front-end, builds the Rust binary, compiles both the MSI and NSIS EXE, and copies them to the local `installer/` directory:
```powershell
powershell -ExecutionPolicy Bypass -File .\installer\build.ps1
```
*   **Result Location:** Your compiled `.msi` and `.exe` installers will be ready inside the [installer/](file:///D:/projects/cinepair/installer/) folder.

### Option B: Raw Tauri Builder
To run the raw Tauri packaging loop manually without gathering files:
```bash
npm run tauri build
```
*   **MSI Location:** `src-tauri\target\release\bundle\msi\CinePair_0.1.0_x64_en-US.msi`
*   **NSIS EXE Location:** `src-tauri\target\release\bundle\nsis\CinePair_0.1.0_x64-setup.exe`

---

## 🍏 2. macOS App Bundle (`.dmg`)
*(Requires a macOS environment)*

To compile a dual-architecture **Universal DMG** installer (supporting both Intel and Apple Silicon chips inside a single bundle), run this command on your Mac:
```bash
npm run tauri build -- --target universal-apple-darwin
```
*   **Result DMG Location:** `src-tauri/target/universal-apple-darwin/release/bundle/dmg/CinePair_0.1.0_universal.dmg`

---

## 🐧 3. Linux Package (`.deb` / `.AppImage`)
*(Requires a Linux environment)*

Ensure webkit2gtk-4.1 system dependencies are installed before building. Run the manual package compiler:
```bash
npm run tauri build
```
*   **Debian Package Location:** `src-tauri/target/release/bundle/deb/cinepair_0.1.0_amd64.deb`
*   **AppImage Location:** `src-tauri/target/release/bundle/appimage/CinePair_0.1.0_amd64.AppImage`

---

## ☁️ 4. Note on Automated Releases (GitHub Actions)
Rather than manually compiling across three different operating systems, you can let your configured CI/CD pipeline handle it:
1. Tag your commit: `git tag v0.1.0`
2. Push your tag: `git push origin main --tags`
3. **GitHub Actions** will spin up, compile all matrices in the cloud, sign the bundles, generate the `latest.json` auto-updater manifest, and attach everything to a draft release!
