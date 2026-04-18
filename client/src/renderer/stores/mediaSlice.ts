/**
 * @fileoverview Media state slice — camera, mic, screen sharing.
 * @module stores/mediaSlice
 */

import { create } from 'zustand';

interface MediaSliceState {
  isScreenSharing: boolean;
  isCameraOn: boolean;
  isMicOn: boolean;
  isRemoteScreenSharing: boolean;
  screenSharingUserId: string | null;

  setScreenSharing: (isSharing: boolean) => void;
  setRemoteScreenSharing: (isSharing: boolean, userId?: string) => void;
  toggleCamera: () => void;
  toggleMic: () => void;
  resetMedia: () => void;
}

const initialMediaState = {
  isScreenSharing: false,
  isCameraOn: true,
  isMicOn: true,
  isRemoteScreenSharing: false,
  screenSharingUserId: null as string | null,
};

export const useMediaSlice = create<MediaSliceState>((set) => ({
  ...initialMediaState,

  setScreenSharing: (isSharing) => set({ isScreenSharing: isSharing }),
  setRemoteScreenSharing: (isSharing, userId) =>
    set({ isRemoteScreenSharing: isSharing, screenSharingUserId: userId || null }),
  toggleCamera: () => set((s) => ({ isCameraOn: !s.isCameraOn })),
  toggleMic: () => set((s) => ({ isMicOn: !s.isMicOn })),
  resetMedia: () => set(initialMediaState),
}));
