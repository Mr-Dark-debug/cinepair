/**
 * @fileoverview Connection state slice for WebRTC peer tracking.
 * @module stores/connectionSlice
 */

import { create } from 'zustand';

interface ConnectionSliceState {
  connectionState: string;
  peerStates: Map<string, RTCPeerConnectionState>;

  setConnectionState: (state: string) => void;
  setPeerState: (userId: string, state: RTCPeerConnectionState) => void;
  removePeerState: (userId: string) => void;
  resetConnection: () => void;
}

export const useConnectionSlice = create<ConnectionSliceState>((set) => ({
  connectionState: 'connecting',
  peerStates: new Map(),

  setConnectionState: (state) => set({ connectionState: state }),

  setPeerState: (userId, state) =>
    set((s) => {
      const newMap = new Map(s.peerStates);
      newMap.set(userId, state);
      return { peerStates: newMap };
    }),

  removePeerState: (userId) =>
    set((s) => {
      const newMap = new Map(s.peerStates);
      newMap.delete(userId);
      return { peerStates: newMap };
    }),

  resetConnection: () => set({ connectionState: 'connecting', peerStates: new Map() }),
}));
