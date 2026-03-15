/**
 * @fileoverview Global type declarations for the CinePair renderer process.
 * Extends the Window interface with the preload bridge API.
 */

import type { CinePairAPI } from '../preload';

declare global {
  interface Window {
    /** CinePair preload API exposed via contextBridge */
    cinepair: CinePairAPI;
  }
}

export {};
