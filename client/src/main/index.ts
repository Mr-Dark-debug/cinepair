/**
 * @fileoverview Electron main process entry point for CinePair.
 * Creates the main BrowserWindow, sets up IPC handlers, and manages
 * screen capture permissions and display media request handling.
 * @module main/index
 */

import { app, BrowserWindow, session, desktopCapturer, ipcMain } from 'electron';
import path from 'path';

/** Reference to the main application window */
let mainWindow: BrowserWindow | null = null;

/** Path to the preload script */
const PRELOAD_PATH = path.join(__dirname, '../preload/preload.js');

/** Whether the app is running in development mode */
const isDev = !app.isPackaged;

/**
 * Creates and configures the main application window.
 * Sets up display media request handler for screen sharing with system audio.
 */
function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'CinePair',
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'darwin' ? false : true,
    show: false, // Show when ready to prevent flash
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  // Show window when content is ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  // ─── Permission Handling ───────────────────────────────────
  // Grant media permissions (camera, microphone, screen) automatically
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'display-capture'];
    callback(allowedPermissions.includes(permission));
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'display-capture'];
    return allowedPermissions.includes(permission);
  });

  // ─── Display Media Request Handler (Screen Share + System Audio) ──
  // This is the 2026 best practice for Electron 40+ screen capture
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      // Get all available screen and window sources
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true,
      });

      if (sources.length === 0) {
        callback({});
        return;
      }

      // Send sources to renderer for user selection
      mainWindow?.webContents.send('screen-sources', sources.map((s) => ({
        id: s.id,
        name: s.name,
        thumbnailDataUrl: s.thumbnail.toDataURL(),
        appIconDataUrl: s.appIcon?.toDataURL() || null,
        displayId: s.display_id,
      })));

      // Wait for user's selection from the renderer
      ipcMain.once('screen-source-selected', (_event, sourceId: string) => {
        const selected = sources.find((s) => s.id === sourceId);
        if (selected) {
          callback({
            video: selected,
            audio: 'loopback' as unknown as Electron.DesktopCapturerSource, // System audio loopback
            enableLocalEcho: false, // Don't echo system audio back to admin
          });
        } else {
          callback({});
        }
      });

      // Handle cancellation
      ipcMain.once('screen-source-cancelled', () => {
        callback({});
      });
    } catch (err) {
      console.error('[Main] Display media request handler error:', err);
      callback({});
    }
  });

  // ─── Load Content ──────────────────────────────────────────
  if (isDev) {
    // In development, load from Vite dev server
    void mainWindow.loadURL('http://localhost:5173');
    // Auto-open DevTools in dev mode
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // In production, load the built index.html
    void mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // Cleanup on close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── IPC Handlers ────────────────────────────────────────────

/**
 * Sets up IPC handlers for renderer ↔ main process communication.
 */
function setupIpcHandlers(): void {
  // Get desktop capturer sources for screen sharing picker
  ipcMain.handle('get-screen-sources', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true,
      });

      return sources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnailDataUrl: source.thumbnail.toDataURL(),
        appIconDataUrl: source.appIcon?.toDataURL() || null,
        displayId: source.display_id,
      }));
    } catch (err) {
      console.error('[Main] Failed to get screen sources:', err);
      return [];
    }
  });

  // Toggle fullscreen
  ipcMain.handle('toggle-fullscreen', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      return mainWindow.isFullScreen();
    }
    return false;
  });

  // Get platform info
  ipcMain.handle('get-platform', () => {
    return process.platform;
  });
}

// ─── App Lifecycle ───────────────────────────────────────────

app.whenReady().then(() => {
  setupIpcHandlers();
  createMainWindow();

  // macOS: recreate window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Quit when all windows are closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
