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
  // Map of Emoji -> List of users who reacted
  reactions?: Record<string, Array<{ id: string; nickname: string }>>;
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
  peerScreenStreams: Record<string, MediaStream>; // remote sid -> screen/video share stream
  peerAudioVolumes: Record<string, { mic: number; screen: number }>;

  // Emoji reactions overlay
  reactions: Array<{ id: string; senderId: string; emoji: string }>;

  // UI state
  isChatOpen: boolean;
  isSelfViewHidden: boolean; // Tracks whether local overlay camera is hidden during screen watching
  isAppForeground: boolean;
  isCompactChatOpen: boolean;
  toasts: Array<{ id: string; text: string }>;
  unreadCount: number;

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
  addWaitingParticipant: (participant: WaitingParticipant) => void;
  addMessage: (msg: ChatMessage) => void;
  setPinnedId: (id: string | null) => void;
  
  setCameraEnabled: (enabled: boolean) => void;
  setMicEnabled: (enabled: boolean) => void;
  setScreenShareEnabled: (enabled: boolean) => void;
  setScreenAudioEnabled: (enabled: boolean) => void;
  
  setLocalStream: (stream: MediaStream | null) => void;
  setLocalScreenStream: (stream: MediaStream | null) => void;
  addPeerStream: (sid: string, stream: MediaStream) => void;
  addPeerScreenStream: (sid: string, stream: MediaStream) => void;
  removePeerStream: (sid: string) => void;
  setPeerMicVolume: (sid: string, volume: number) => void;
  setPeerScreenVolume: (sid: string, volume: number) => void;
  
  addReaction: (reaction: { senderId: string; emoji: string }) => void;
  removeReaction: (id: string) => void;
  toggleChat: () => void;
  toggleSelfView: () => void;
  setAppForeground: (foreground: boolean) => void;
  toggleCompactChat: () => void;
  setCompactChatOpen: (open: boolean) => void;
  toggleMessageReaction: (msgId: string, emoji: string, userId: string, nickname: string) => void;
  addToast: (text: string) => void;
  incrementUnread: () => void;
  resetUnread: () => void;
  
  // Local settings
  defaultNickname: string;
  defaultCameraOn: boolean;
  defaultMicOn: boolean;
  autoCheckUpdates: boolean;
  
  setDefaultNickname: (name: string) => void;
  setDefaultCameraOn: (enabled: boolean) => void;
  setDefaultMicOn: (enabled: boolean) => void;
  setAutoCheckUpdates: (enabled: boolean) => void;

  // Updater state
  updaterStatus: "idle" | "checking" | "available" | "downloading" | "downloaded" | "error" | "done";
  updaterProgress: number;
  updaterInfo: any;
  updaterError: string;
  updaterDownloadedSize: string;
  updaterTotalSize: string;

  setUpdaterStatus: (status: "idle" | "checking" | "available" | "downloading" | "downloaded" | "error" | "done") => void;
  setUpdaterProgress: (progress: number) => void;
  setUpdaterInfo: (info: any) => void;
  setUpdaterError: (error: string) => void;
  setUpdaterDownloadedSize: (size: string) => void;
  setUpdaterTotalSize: (size: string) => void;

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
  peerScreenStreams: {},
  peerAudioVolumes: {},
  
  reactions: [],
  isChatOpen: true,
  isSelfViewHidden: false,
  isAppForeground: true,
  isCompactChatOpen: false,
  toasts: [],
  unreadCount: 0,

  // Local settings initial values loaded from localStorage
  defaultNickname: localStorage.getItem("defaultNickname") || "",
  defaultCameraOn: localStorage.getItem("defaultCameraOn") !== "false",
  defaultMicOn: localStorage.getItem("defaultMicOn") !== "false",
  autoCheckUpdates: localStorage.getItem("autoCheckUpdates") !== "false",

  // Updater initial states
  updaterStatus: "idle",
  updaterProgress: 0,
  updaterInfo: null,
  updaterError: "",
  updaterDownloadedSize: "",
  updaterTotalSize: "",

  setRoomCode: (code) => set({ roomCode: code }),
  setNickname: (nickname) => set({ nickname }),
  
  setRoomState: (state) => set((store) => {
    const isNowAdmin = state.participants.find(p => p.id === state.admin_id && p.nickname === store.nickname) !== undefined;

    return {
      roomCode: state.code,
      isAdmin: isNowAdmin,
      participants: state.participants,
      waitingList: state.waiting_list,
    };
  }),

  setWaiting: (waiting) => set({ isWaiting: waiting }),
  addWaitingParticipant: (participant) => set((store) => {
    if (store.waitingList.some((p) => p.id === participant.id)) {
      return {};
    }
    return {
      waitingList: [...store.waitingList, participant]
    };
  }),
  
  addMessage: (msg) => set((store) => {
    // Deduplication: skip if a message with the same id already exists
    if (store.messages.some((m) => m.id === msg.id)) {
      return {};
    }
    return {
      messages: [...store.messages, msg],
      // Auto-increment unread if chat is closed and it's not a local message
      unreadCount: store.isChatOpen ? store.unreadCount : store.unreadCount + 1
    };
  }),

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

  addPeerScreenStream: (sid, stream) => set((store) => ({
    peerScreenStreams: { ...store.peerScreenStreams, [sid]: stream }
  })),

  removePeerStream: (sid) => set((store) => {
    const nextStreams = { ...store.peerStreams };
    const nextScreenStreams = { ...store.peerScreenStreams };
    const nextVolumes = { ...store.peerAudioVolumes };
    delete nextStreams[sid];
    delete nextScreenStreams[sid];
    delete nextVolumes[sid];
    
    // If pinned stream belongs to user who disconnected, unpin it
    const pinnedId = store.pinnedId === sid ? null : store.pinnedId;

    return {
      peerStreams: nextStreams,
      peerScreenStreams: nextScreenStreams,
      peerAudioVolumes: nextVolumes,
      pinnedId
    };
  }),

  setPeerMicVolume: (sid, volume) => set((store) => {
    const current = store.peerAudioVolumes[sid] || { mic: 1, screen: 1 };
    return {
      peerAudioVolumes: {
        ...store.peerAudioVolumes,
        [sid]: { ...current, mic: Math.max(0, Math.min(volume, 1.5)) }
      }
    };
  }),

  setPeerScreenVolume: (sid, volume) => set((store) => {
    const current = store.peerAudioVolumes[sid] || { mic: 1, screen: 1 };
    return {
      peerAudioVolumes: {
        ...store.peerAudioVolumes,
        [sid]: { ...current, screen: Math.max(0, Math.min(volume, 1.5)) }
      }
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

  toggleChat: () => set((store) => ({
    isChatOpen: !store.isChatOpen,
    // Reset unread count when opening the chat
    unreadCount: !store.isChatOpen ? 0 : store.unreadCount
  })),
  toggleSelfView: () => set((store) => ({ isSelfViewHidden: !store.isSelfViewHidden })),
  setAppForeground: (foreground) => set({ isAppForeground: foreground }),
  toggleCompactChat: () => set((store) => ({ isCompactChatOpen: !store.isCompactChatOpen })),
  setCompactChatOpen: (open) => set({ isCompactChatOpen: open }),
  addToast: (text) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((store) => ({ toasts: [...store.toasts, { id, text }] }));
    setTimeout(() => {
      set((store) => ({ toasts: store.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  incrementUnread: () => set((store) => ({ unreadCount: store.unreadCount + 1 })),
  resetUnread: () => set({ unreadCount: 0 }),
  
  toggleMessageReaction: (msgId, emoji, userId, nickname) => set((store) => {
    const nextMessages = store.messages.map((msg) => {
      if (msg.id !== msgId) return msg;

      const currentReactions = { ...(msg.reactions || {}) };
      const list = currentReactions[emoji] ? [...currentReactions[emoji]] : [];
      const userIndex = list.findIndex((u) => u.id === userId);

      if (userIndex > -1) {
        // Toggle off
        list.splice(userIndex, 1);
      } else {
        // Toggle on
        list.push({ id: userId, nickname });
      }

      if (list.length === 0) {
        delete currentReactions[emoji];
      } else {
        currentReactions[emoji] = list;
      }

      return { ...msg, reactions: currentReactions };
    });

    return { messages: nextMessages };
  }),

  setDefaultNickname: (name) => {
    localStorage.setItem("defaultNickname", name);
    set({ defaultNickname: name });
  },
  setDefaultCameraOn: (enabled) => {
    localStorage.setItem("defaultCameraOn", enabled ? "true" : "false");
    set({ defaultCameraOn: enabled });
  },
  setDefaultMicOn: (enabled) => {
    localStorage.setItem("defaultMicOn", enabled ? "true" : "false");
    set({ defaultMicOn: enabled });
  },
  setAutoCheckUpdates: (enabled) => {
    localStorage.setItem("autoCheckUpdates", enabled ? "true" : "false");
    set({ autoCheckUpdates: enabled });
  },

  setUpdaterStatus: (status) => set({ updaterStatus: status }),
  setUpdaterProgress: (progress) => set({ updaterProgress: progress }),
  setUpdaterInfo: (info) => set({ updaterInfo: info }),
  setUpdaterError: (error) => set({ updaterError: error }),
  setUpdaterDownloadedSize: (size) => set({ updaterDownloadedSize: size }),
  setUpdaterTotalSize: (size) => set({ updaterTotalSize: size }),

  resetStore: () => set((store) => {
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
      peerScreenStreams: {},
      peerAudioVolumes: {},
      reactions: [],
      isSelfViewHidden: false,
      isCompactChatOpen: false
    };
  })
}));
