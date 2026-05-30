# CinePair Release & Packaging Instructions (v0.1.0)

This folder contains all the assets, drafts, and automated scripts you need to package and launch **CinePair v0.1.0** (Stable) as your first GitHub Release.

---

## 🚀 How to Compile & Package the Windows Installers

Since we are running natively on Windows, you can compile the Windows MSI and NSIS EXE installers automatically with a single command!

### Quick Automated Step (Recommended)
1. Open a PowerShell terminal inside the project root (`D:\projects\cinepair\`).
2. Run the automated build script:
   ```powershell
   .\installer\build.ps1
   ```
3. The script will automatically:
   - Configure your environment variables to bypass Windows Smart App Control blocks.
   - Run the compiler pipeline (`npm run tauri build`).
   - Copy the compiled **`CinePair_0.1.0_x64_en-US.msi`** and **`CinePair_0.1.0_x64.exe`** installers directly into this `installer/` folder!

---

## 📦 How to Create Your First GitHub Release

Once you have compiled the installers, follow these steps to publish them to GitHub:

1. Go to your GitHub repository: [Mr-Dark-debug/cinepair](https://github.com/Mr-Dark-debug/cinepair).
2. Click on **Releases** > **Draft a new release**.
3. Choose a Tag: Type **`v0.1.0`** and click **Create new tag on publish**.
4. Set the Release Title: Copy and paste the title from **`RELEASE_DRAFT.md`**:
   `v0.1.0 - CinePair: The P2P Cinematic Co-Watch Desktop Suite`
5. Copy the entire Markdown content inside **[`RELEASE_DRAFT.md`](file:///D:/projects/cinepair/installer/RELEASE_DRAFT.md)** and paste it into the **Description** box.
6. Drag and drop the compiled installer files located in this `installer/` folder into the **Attach binaries** dropzone:
   - `CinePair_0.1.0_x64_en-US.msi` (Windows MSI Installer)
   - `CinePair_0.1.0_x64.exe` (Windows NSIS Installer)
7. *(Optional)* If you have built macOS or Linux installers on other systems, drag them in as well (filenames are listed in the Asset Manifest table).
8. Click **Publish release**! 🎉

---

## 🛡️ Note on macOS & Linux Installers
Since Apple and Linux binaries must be compiled on their respective host operating systems, they are typically built using:
- **macOS Build:** Running `npm run tauri build` on an Apple computer.
- **Linux Build:** Running `npm run tauri build` on a Linux computer.
- **Automated CI/CD:** Setting up a GitHub Actions workflow (like `.github/workflows/release.yml`) which automatically builds and attaches Windows, macOS, and Linux installers to your GitHub Releases every time you push a git tag like `v*`!
