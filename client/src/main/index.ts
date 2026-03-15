/**
 * @fileoverview Electron main process entry point for CinePair.
 * Creates the main BrowserWindow, sets up IPC handlers, manages
 * screen capture permissions, display media request handling,
 * system tray, and auto-updates.
 * @module main/index
 */

import {
  app,
  BrowserWindow,
  session,
  desktopCapturer,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
} from 'electron';
import path from 'path';
import { AutoUpdaterService } from './autoUpdater';

/** Reference to the main application window */
let mainWindow: BrowserWindow | null = null;

/** Reference to the system tray icon */
let tray: Tray | null = null;

/** Auto-updater service instance */
let autoUpdater: AutoUpdaterService | null = null;

/** Path to the preload script */
const PRELOAD_PATH = path.join(__dirname, '../preload/preload.js');

/** Whether the app is running in development mode */
const isDev = !app.isPackaged;

/** Whether this is the first run after installation */
let isFirstRun = false;

/** Whether the app is quitting (vs hiding to tray) */
let isQuitting = false;

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
    show: false,
    icon: getAppIcon(),
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

    // Notify renderer about first-run status
    if (isFirstRun) {
      mainWindow?.webContents.send('app:first-run');
    }
  });

  // ─── Permission Handling ───────────────────────────────────
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'display-capture'];
    callback(allowedPermissions.includes(permission));
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'display-capture'];
    return allowedPermissions.includes(permission);
  });

  // ─── Display Media Request Handler (Screen Share + System Audio) ──
  // Electron 40+ best practice: callback accepts { video, audio } where
  // audio can be 'loopback' string for system audio capture.
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
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
      mainWindow?.webContents.send(
        'screen-sources',
        sources.map((s) => ({
          id: s.id,
          name: s.name,
          thumbnailDataUrl: s.thumbnail.toDataURL(),
          appIconDataUrl: s.appIcon?.toDataURL() || null,
          displayId: s.display_id,
        }))
      );

      // Wait for user's selection from the renderer
      ipcMain.once('screen-source-selected', (_event, sourceId: string) => {
        const selected = sources.find((s) => s.id === sourceId);
        if (selected) {
          // Electron 40 runtime API accepts { video, audio: 'loopback' }
          // but TypeScript types haven't caught up. Using unknown cast.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (callback as (response: unknown) => void)({
            video: selected,
            audio: 'loopback',
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
    void mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // Cleanup on close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Minimize to tray instead of closing (optional behavior)
  mainWindow.on('close', (event) => {
    if (tray && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

/**
 * Gets the app icon for the current platform.
 */
function getAppIcon(): Electron.NativeImage | undefined {
  try {
    const iconPath = isDev
      ? path.join(process.cwd(), 'public', 'icon.png')
      : path.join(__dirname, '../../public', 'icon.png');
    return nativeImage.createFromPath(iconPath);
  } catch {
    return undefined;
  }
}

/**
 * Creates the system tray icon with context menu.
 */
function createTray(): void {
  const icon = getAppIcon();
  if (!icon) return;

  // Resize for tray (16x16 on most platforms)
  const trayIcon = icon.resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open CinePair',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('CinePair – Watch together');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
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

  // Check first-run status
  ipcMain.handle('is-first-run', () => {
    return isFirstRun;
  });
}

// ─── App Lifecycle ───────────────────────────────────────────

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createMainWindow();
  createTray();

  // Initialize auto-updater (production only)
  if (!isDev) {
    autoUpdater = new AutoUpdaterService(mainWindow);
    autoUpdater.checkForUpdates();
  }

  // Check if first run using settings or presence of a flag
  const { existsSync, writeFileSync } = require('fs');
  const flagPath = path.join(app.getPath('userData'), '.cinepair-initialized');
  if (!existsSync(flagPath)) {
    isFirstRun = true;
    writeFileSync(flagPath, new Date().toISOString());
  }

  // macOS: recreate window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      mainWindow?.show();
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

// Graceful shutdown
app.on('before-quit', () => {
  isQuitting = true;
});
