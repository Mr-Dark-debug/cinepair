import { create } from 'zustand';

export interface Participant {
  id: string;
  nickname: string;
  is_admin: boolean;
  camera_on: boolean;
  mic_on: boolean;
  screen_share_on: boolean;
}

export interface WaitingParticipant {
  id: string;
  nickname: string;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_nickname: string;
  text: string;
  timestamp: number;
  reply_to?: string | null;
  image_data?: string | null; // base64 screenshot attachment
}

export interface RoomState {
  roomCode: string | null;
  nickname: string | null;
  participants: Participant[];
  waitingList: WaitingParticipant[];
  isAdmin: boolean;
  isWaiting: boolean;
  messages: ChatMessage[];
  pinnedId: string | null; // ID of the pinned participant (large stage view)
  
  // Local media control state
  cameraEnabled: boolean;
  micEnabled: boolean;
  screenShareEnabled: boolean;
  screenAudioEnabled: boolean;

  // Media streams
  localStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  peerStreams: Record<string, MediaStream>; // remote sid -> MediaStream

  // Emoji reactions overlay
  reactions: Array<{ id: string; senderId: string; emoji: string }>;

  // UI state
  isChatOpen: boolean;

  // Actions
  setRoomCode: (code: string | null) => void;
  setNickname: (nickname: string | null) => void;
  setRoomState: (state: {
    code: string;
    admin_id: string;
    participants: Participant[];
    waiting_list: WaitingParticipant[];
  }) => void;
  setWaiting: (waiting: boolean) => void;
  addMessage: (msg: ChatMessage) => void;
  setPinnedId: (id: string | null) => void;
  
  setCameraEnabled: (enabled: boolean) => void;
  setMicEnabled: (enabled: boolean) => void;
  setScreenShareEnabled: (enabled: boolean) => void;
  setScreenAudioEnabled: (enabled: boolean) => void;
  
  setLocalStream: (stream: MediaStream | null) => void;
  setLocalScreenStream: (stream: MediaStream | null) => void;
  addPeerStream: (sid: string, stream: MediaStream) => void;
  removePeerStream: (sid: string) => void;
  
  addReaction: (reaction: { senderId: string; emoji: string }) => void;
  removeReaction: (id: string) => void;
  toggleChat: () => void;
  
  resetStore: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomCode: null,
  nickname: null,
  participants: [],
  waitingList: [],
  isAdmin: false,
  isWaiting: false,
  messages: [],
  pinnedId: null,
  
  cameraEnabled: false,
  micEnabled: false,
  screenShareEnabled: false,
  screenAudioEnabled: false,
  
  localStream: null,
  localScreenStream: null,
  peerStreams: {},
  
  reactions: [],
  isChatOpen: true,

  setRoomCode: (code) => set({ roomCode: code }),
  setNickname: (nickname) => set({ nickname }),
  
  setRoomState: (state) => set((store) => {
    
    // Fallback: If localStream exists and socketId matches admin
    const isNowAdmin = state.participants.find(p => p.id === state.admin_id && p.nickname === store.nickname) !== undefined;

    return {
      roomCode: state.code,
      isAdmin: isNowAdmin,
      participants: state.participants,
      waitingList: state.waiting_list,
    };
  }),

  setWaiting: (waiting) => set({ isWaiting: waiting }),
  
  addMessage: (msg) => set((store) => ({
    messages: [...store.messages, msg]
  })),

  setPinnedId: (id) => set({ pinnedId: id }),

  setCameraEnabled: (enabled) => set({ cameraEnabled: enabled }),
  setMicEnabled: (enabled) => set({ micEnabled: enabled }),
  setScreenShareEnabled: (enabled) => set({ screenShareEnabled: enabled }),
  setScreenAudioEnabled: (enabled) => set({ screenAudioEnabled: enabled }),

  setLocalStream: (stream) => set({ localStream: stream }),
  setLocalScreenStream: (stream) => set({ localScreenStream: stream }),
  
  addPeerStream: (sid, stream) => set((store) => ({
    peerStreams: { ...store.peerStreams, [sid]: stream }
  })),

  removePeerStream: (sid) => set((store) => {
    const nextStreams = { ...store.peerStreams };
    delete nextStreams[sid];
    
    // If pinned stream belongs to user who disconnected, unpin it
    const pinnedId = store.pinnedId === sid ? null : store.pinnedId;

    return {
      peerStreams: nextStreams,
      pinnedId
    };
  }),

  addReaction: (reaction) => set((store) => {
    const newReaction = {
      id: Math.random().toString(36).substring(2, 9),
      ...reaction
    };
    return {
      reactions: [...store.reactions, newReaction]
    };
  }),

  removeReaction: (id) => set((store) => ({
    reactions: store.reactions.filter((r) => r.id !== id)
  })),

  toggleChat: () => set((store) => ({ isChatOpen: !store.isChatOpen })),

  resetStore: () => set((store) => {
    // Gracefully clean up any active local streams before clearing
    if (store.localStream) {
      store.localStream.getTracks().forEach(track => track.stop());
    }
    if (store.localScreenStream) {
      store.localScreenStream.getTracks().forEach(track => track.stop());
    }
    return {
      roomCode: null,
      participants: [],
      waitingList: [],
      isAdmin: false,
      isWaiting: false,
      messages: [],
      pinnedId: null,
      cameraEnabled: false,
      micEnabled: false,
      screenShareEnabled: false,
      screenAudioEnabled: false,
      localStream: null,
      localScreenStream: null,
      peerStreams: {},
      reactions: []
    };
  })
}));
