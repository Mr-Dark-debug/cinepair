/**
 * @fileoverview Zustand store for room state management in CinePair.
 * Manages room creation, joining, approval flow, and user presence.
 * @module stores/roomStore
 */

import { create } from 'zustand';

/** Represents a user in the room */
export interface RoomUser {
  socketId: string;
  nickname: string;
  role: 'admin' | 'partner';
}

/** Represents a pending join request */
export interface JoinRequest {
  id: string;
  socketId: string;
  nickname: string;
  createdAt: number;
}

/** Chat message */
export interface ChatMessage {
  id: string;
  senderId: string;
  senderNickname: string;
  message: string;
  timestamp: number;
  isSelf: boolean;
}

/** App navigation screens */
export type AppScreen = 'home' | 'create-room' | 'join-room' | 'lobby' | 'room';

/** Room store state */
interface RoomState {
  // ─── Navigation ────────────────────────────────────
  currentScreen: AppScreen;
  setScreen: (screen: AppScreen) => void;

  // ─── Room Info ─────────────────────────────────────
  roomCode: string | null;
  password: string | null;
  requireApproval: boolean;
  isAdmin: boolean;
  nickname: string;
  roomStatus: 'idle' | 'connecting' | 'waiting' | 'active' | 'error';

  // ─── Users ─────────────────────────────────────────
  users: RoomUser[];
  pendingRequests: JoinRequest[];

  // ─── Media State ───────────────────────────────────
  isScreenSharing: boolean;
  isCameraOn: boolean;
  isMicOn: boolean;
  isRemoteScreenSharing: boolean;

  // ─── Chat ──────────────────────────────────────────
  messages: ChatMessage[];

  // ─── Actions ───────────────────────────────────────
  setRoomInfo: (data: {
    code: string;
    password?: string;
    requireApproval: boolean;
    isAdmin: boolean;
  }) => void;
  setNickname: (nickname: string) => void;
  setUsers: (users: RoomUser[]) => void;
  addUser: (user: RoomUser) => void;
  removeUser: (socketId: string) => void;
  addJoinRequest: (request: JoinRequest) => void;
  removeJoinRequest: (requestId: string) => void;
  setRequireApproval: (value: boolean) => void;
  setRoomStatus: (status: RoomState['roomStatus']) => void;
  setScreenSharing: (isSharing: boolean) => void;
  setRemoteScreenSharing: (isSharing: boolean) => void;
  toggleCamera: () => void;
  toggleMic: () => void;
  addMessage: (message: ChatMessage) => void;
  resetRoom: () => void;
}

/** Default initial state values */
const initialState = {
  currentScreen: 'home' as AppScreen,
  roomCode: null as string | null,
  password: null as string | null,
  requireApproval: true,
  isAdmin: false,
  nickname: '',
  roomStatus: 'idle' as RoomState['roomStatus'],
  users: [] as RoomUser[],
  pendingRequests: [] as JoinRequest[],
  isScreenSharing: false,
  isCameraOn: true,
  isMicOn: true,
  isRemoteScreenSharing: false,
  messages: [] as ChatMessage[],
};

/**
 * Main Zustand store for CinePair room state.
 * Provides reactive state management for room lifecycle, users, media, and chat.
 */
export const useRoomStore = create<RoomState>((set) => ({
  ...initialState,

  setScreen: (screen) => set({ currentScreen: screen }),

  setRoomInfo: (data) =>
    set({
      roomCode: data.code,
      password: data.password || null,
      requireApproval: data.requireApproval,
      isAdmin: data.isAdmin,
    }),

  setNickname: (nickname) => set({ nickname }),

  setUsers: (users) => set({ users }),

  addUser: (user) =>
    set((state) => ({
      users: [...state.users.filter((u) => u.socketId !== user.socketId), user],
    })),

  removeUser: (socketId) =>
    set((state) => ({
      users: state.users.filter((u) => u.socketId !== socketId),
    })),

  addJoinRequest: (request) =>
    set((state) => ({
      pendingRequests: [...state.pendingRequests, request],
    })),

  removeJoinRequest: (requestId) =>
    set((state) => ({
      pendingRequests: state.pendingRequests.filter((r) => r.id !== requestId),
    })),

  setRequireApproval: (value) => set({ requireApproval: value }),

  setRoomStatus: (status) => set({ roomStatus: status }),

  setScreenSharing: (isSharing) => set({ isScreenSharing: isSharing }),

  setRemoteScreenSharing: (isSharing) => set({ isRemoteScreenSharing: isSharing }),

  toggleCamera: () =>
    set((state) => ({ isCameraOn: !state.isCameraOn })),

  toggleMic: () =>
    set((state) => ({ isMicOn: !state.isMicOn })),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  resetRoom: () => set(initialState),
}));
