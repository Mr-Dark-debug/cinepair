# CinePair Versioning & Release Process SOP

This document defines the official versioning standards, release checklist, and publication processes for the **CinePair** application.

---

## 📈 1. Versioning Strategy (Patch-to-Minor Rule)

We follow semantic versioning modified for our specific release increments:

$$\text{Format: } \mathbf{v0}.\mathbf{Y}.\mathbf{Z}$$

* **$\mathbf{Z}$ (3rd Decimal / Patch Version):** 
  * Incremented by exactly $1$ for every standard release, feature addition, or update (e.g. `v0.1.0` $\rightarrow$ `v0.1.1` $\rightarrow$ `v0.1.2` ...).
* **$\mathbf{Y}$ (2nd Decimal / Minor Version):**
  * When the 3rd decimal $Z$ reaches **$100$**, the minor version $Y$ is incremented by $1$, and $Z$ is reset to $0$:
    $$\text{Example: } \mathbf{v0.1.99} \rightarrow \mathbf{v0.1.100} \rightarrow \mathbf{v0.2.0}$$

---

## 📋 2. Step-by-Step Release Checklist

When you are ready to publish a new update, follow these steps in order:

### Step A: Update Code Files
Update the version string inside the following files:

1. **[package.json](file:///D:/projects/cinepair/package.json):**
   ```json
   "version": "0.1.1"
   ```
2. **[src-tauri/tauri.conf.json](file:///D:/projects/cinepair/src-tauri/tauri.conf.json):**
   ```json
   "version": "0.1.1"
   ```

### Step B: Add Offline Fallback Release Notes
To ensure the website displays your beautiful release notes instantly and falls back safely when GitHub API rates are throttled:

1. Open **[website/release-notes.js](file:///D:/projects/cinepair/website/release-notes.js)**.
2. Scroll down to `getOfflineFallbackReleases()`.
3. Add your new release object at the **top** of the array (so it shows first):
   ```javascript
   {
     tag_name: 'v0.1.1',
     name: 'Your Release Title (e.g., Audio Optimization & Performance Sync)',
     published_at: new Date().toISOString(),
     body: `## 🚀 Features & Changes
   * Briefly list your awesome new features here...
   * Detail specific changes and optimizations here...`
   }
   ```

### Step C: Compile & Verify the Client Locally
Run a production bundle check to make sure there are no syntax errors:
```bash
npm run build
```

---

## 🚀 3. Triggering the Automated Release

Once your files are updated and verified:

1. **Commit and push your changes:**
   ```bash
   git add .
   git commit -m "chore: release version 0.1.1"
   git push origin main
   ```
2. **Tag the release and push the tag:**
   ```bash
   git tag v0.1.1
   git push origin main --tags
   ```

### What Happens Automatically:
* **CI/CD Pipeline Spins Up:** GitHub Actions reads the new tag `v0.1.1` and runs the release workflow.
* **Multi-Platform Signatures:** Compiles Windows MSI/EXE, macOS universal DMG, and Linux Deb/AppImage.
* **Auto-Updater Manifest (`latest.json`):** Generates and publishes the updater links and secure signatures.
* **Release Draft:** Creates a draft release on GitHub with all binaries attached, ready for you to publish!
