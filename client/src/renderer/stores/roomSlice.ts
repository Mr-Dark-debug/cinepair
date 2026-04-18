/**
 * @fileoverview Room state slice — navigation, room info, users, and approval.
 * @module stores/roomSlice
 */

import { create } from 'zustand';

export interface RoomUser {
  userId: string;
  nickname: string;
  role: 'admin' | 'partner';
}

export interface JoinRequest {
  id: string;
  userId: string;
  nickname: string;
  createdAt: number;
}

export type AppScreen = 'home' | 'create-room' | 'join-room' | 'lobby' | 'room' | 'settings';

interface RoomSliceState {
  currentScreen: AppScreen;
  roomCode: string | null;
  password: string | null;
  requireApproval: boolean;
  isAdmin: boolean;
  nickname: string;
  userId: string;
  sessionToken: string;
  roomStatus: 'idle' | 'connecting' | 'waiting' | 'active' | 'error';
  users: RoomUser[];
  pendingRequests: JoinRequest[];

  setScreen: (screen: AppScreen) => void;
  setRoomInfo: (data: {
    code: string;
    password?: string;
    requireApproval: boolean;
    isAdmin: boolean;
    userId?: string;
    sessionToken?: string;
  }) => void;
  setNickname: (nickname: string) => void;
  setUserId: (userId: string) => void;
  setSessionToken: (token: string) => void;
  setUsers: (users: RoomUser[]) => void;
  addUser: (user: RoomUser) => void;
  removeUser: (userId: string) => void;
  addJoinRequest: (request: JoinRequest) => void;
  removeJoinRequest: (requestId: string) => void;
  setRequireApproval: (value: boolean) => void;
  setRoomStatus: (status: RoomSliceState['roomStatus']) => void;
  resetRoom: () => void;
}

const initialRoomState = {
  currentScreen: 'home' as AppScreen,
  roomCode: null as string | null,
  password: null as string | null,
  requireApproval: true,
  isAdmin: false,
  nickname: '',
  userId: '',
  sessionToken: '',
  roomStatus: 'idle' as RoomSliceState['roomStatus'],
  users: [] as RoomUser[],
  pendingRequests: [] as JoinRequest[],
};

export const useRoomSlice = create<RoomSliceState>((set) => ({
  ...initialRoomState,

  setScreen: (screen) => set({ currentScreen: screen }),

  setRoomInfo: (data) =>
    set({
      roomCode: data.code,
      password: data.password || null,
      requireApproval: data.requireApproval,
      isAdmin: data.isAdmin,
      userId: data.userId || '',
      sessionToken: data.sessionToken || '',
    }),

  setNickname: (nickname) => set({ nickname }),
  setUserId: (userId) => set({ userId }),
  setSessionToken: (token) => set({ sessionToken: token }),

  setUsers: (users) => set({ users }),
  addUser: (user) =>
    set((state) => ({
      users: [...state.users.filter((u) => u.userId !== user.userId), user],
    })),
  removeUser: (userId) =>
    set((state) => ({
      users: state.users.filter((u) => u.userId !== userId),
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
  resetRoom: () => set(initialRoomState),
}));
