/**
 * @fileoverview Preload script for CinePair Electron app.
 * Exposes a safe, typed API to the renderer process via contextBridge.
 * This is the ONLY bridge between the main process and the renderer.
 * @module preload
 */

import { contextBridge, ipcRenderer } from 'electron';

/** Type definition for screen source data passed from main process */
export interface ScreenSource {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  appIconDataUrl: string | null;
  displayId: string;
}

/**
 * The CinePair API exposed to the renderer process.
 * Accessible via `window.cinepair` in the renderer.
 */
const cinepairAPI = {
  /**
   * Gets available screen/window sources for screen sharing.
   * @returns Promise resolving to an array of screen sources
   */
  getScreenSources: (): Promise<ScreenSource[]> => {
    return ipcRenderer.invoke('get-screen-sources');
  },

  /**
   * Notifies the main process that the user selected a screen source.
   * @param sourceId - The ID of the selected source
   */
  selectScreenSource: (sourceId: string): void => {
    ipcRenderer.send('screen-source-selected', sourceId);
  },

  /**
   * Notifies the main process that screen source selection was cancelled.
   */
  cancelScreenSourceSelection: (): void => {
    ipcRenderer.send('screen-source-cancelled');
  },

  /**
   * Listens for screen sources pushed from the main process
   * (triggered by setDisplayMediaRequestHandler).
   * @param callback - Handler for received sources
   * @returns Cleanup function to remove the listener
   */
  onScreenSources: (callback: (sources: ScreenSource[]) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, sources: ScreenSource[]) => {
      callback(sources);
    };
    ipcRenderer.on('screen-sources', handler);
    return () => {
      ipcRenderer.removeListener('screen-sources', handler);
    };
  },

  /**
   * Toggles fullscreen mode for the application window.
   * @returns Promise resolving to the new fullscreen state
   */
  toggleFullscreen: (): Promise<boolean> => {
    return ipcRenderer.invoke('toggle-fullscreen');
  },

  /**
   * Gets the current platform (win32, darwin, linux).
   * @returns Promise resolving to the platform string
   */
  getPlatform: (): Promise<string> => {
    return ipcRenderer.invoke('get-platform');
  },
};

// Expose the API to the renderer via contextBridge
contextBridge.exposeInMainWorld('cinepair', cinepairAPI);

/** Type for the exposed API (used in renderer type declarations) */
export type CinePairAPI = typeof cinepairAPI;
