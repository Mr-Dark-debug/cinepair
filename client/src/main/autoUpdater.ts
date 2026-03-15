/**
 * @fileoverview Auto-updater service for CinePair using electron-updater.
 * Checks for updates on app start, downloads silently, and notifies the user.
 * Supports GitHub Releases and generic HTTP server update providers.
 * @module main/autoUpdater
 */

import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow } from 'electron';

/**
 * OOP service class for managing automatic application updates.
 * Uses electron-updater under the hood.
 *
 * @example
 * ```typescript
 * const updater = new AutoUpdaterService(mainWindow);
 * updater.checkForUpdates();
 * ```
 */
export class AutoUpdaterService {
  /** Reference to the main window for sending IPC messages */
  private mainWindow: BrowserWindow | null;

  /** Whether an update is currently being downloaded */
  private isDownloading: boolean = false;

  constructor(mainWindow: BrowserWindow | null) {
    this.mainWindow = mainWindow;
    this.configure();
    this.setupEventListeners();
  }

  /**
   * Configures the auto-updater behavior.
   */
  private configure(): void {
    // Don't auto-download — we'll control the flow
    autoUpdater.autoDownload = false;

    // Don't auto-install on quit — let the user choose
    autoUpdater.autoInstallOnAppQuit = true;

    // Allow pre-release updates (set to false for production)
    autoUpdater.allowPrerelease = false;

    // Enable update logging
    autoUpdater.logger = console;
  }

  /**
   * Sets up event listeners for the auto-update lifecycle.
   */
  private setupEventListeners(): void {
    autoUpdater.on('checking-for-update', () => {
      console.log('[AutoUpdater] Checking for updates...');
      this.sendToRenderer('update:checking');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      console.log(`[AutoUpdater] Update available: v${info.version}`);
      this.sendToRenderer('update:available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });

      // Auto-download the update silently
      if (!this.isDownloading) {
        this.isDownloading = true;
        void autoUpdater.downloadUpdate();
      }
    });

    autoUpdater.on('update-not-available', () => {
      console.log('[AutoUpdater] App is up to date.');
      this.sendToRenderer('update:not-available');
    });

    autoUpdater.on('download-progress', (progress) => {
      console.log(`[AutoUpdater] Download: ${Math.round(progress.percent)}%`);
      this.sendToRenderer('update:progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        total: progress.total,
        transferred: progress.transferred,
      });
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      console.log(`[AutoUpdater] Update downloaded: v${info.version}`);
      this.isDownloading = false;
      this.sendToRenderer('update:downloaded', {
        version: info.version,
      });
    });

    autoUpdater.on('error', (err: Error) => {
      console.error('[AutoUpdater] Error:', err.message);
      this.isDownloading = false;
      this.sendToRenderer('update:error', { message: err.message });
    });
  }

  /**
   * Checks for available updates.
   */
  checkForUpdates(): void {
    try {
      void autoUpdater.checkForUpdatesAndNotify();
    } catch (err) {
      console.error('[AutoUpdater] Check failed:', err);
    }
  }

  /**
   * Quits and installs the downloaded update.
   */
  quitAndInstall(): void {
    autoUpdater.quitAndInstall(false, true);
  }

  /**
   * Sends an IPC message to the renderer process.
   */
  private sendToRenderer(channel: string, data?: Record<string, unknown>): void {
    try {
      this.mainWindow?.webContents?.send(channel, data);
    } catch {
      // Window may be destroyed
    }
  }
}
