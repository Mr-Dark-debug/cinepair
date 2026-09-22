import { io, Socket } from "socket.io-client";

import { useRoomStore } from "../store/useRoomStore";
import { deriveChatKey, encryptText } from "./useEncryption";

type MediaStateUpdate = {
  cameraOn?: boolean;
  micOn?: boolean;
  screenShareOn?: boolean;
};

type RoomSettingsUpdate = {
  maxParticipants?: number;
  requireApproval?: boolean;
  password?: string | null;
};

let socketInstance: Socket | null = null;

const getStore = () => useRoomStore.getState();

export const getSignalingUrl = () => {
  return import.meta.env.VITE_SIGNALING_URL || "https://cinepair-signaling.onrender.com";
};

// Deterministic avatar seed from a nickname (same nickname => same avatar).
const avatarSeedFor = (nickname: string): string => {
  let h = 0;
  for (let i = 0; i < nickname.length; i++) {
    h = (Math.imul(31, h) + nickname.charCodeAt(i)) | 0;
  }
  return "seed-" + Math.abs(h).toString(36);
};

const connectSocket = (url?: string): Socket => {
  if (socketInstance) {
    return socketInstance;
  }

  const socket = io(url || getSignalingUrl(), {
    transports: ["websocket"],
    autoConnect: true,
    reconnectionAttempts: 5,
  });

  socket.on("connect", () => {
    console.log("Connected to signaling server with SID:", socket.id);
    getStore().setSocketId(socket.id || null);
  });

  socket.on("connect_error", (error) => {
    console.error("Signaling connection error:", error);
    getStore().addToast("Signaling server is waking up. Please hold on...");
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from signaling server.");
  });

  socketInstance = socket;
  return socket;
};

const getSocket = (): Socket | null => {
  return socketInstance;
};

const createRoom = (
  nickname: string,
  password?: string,
  maxParticipants: number = 10,
  requireApproval: boolean = false,
): Promise<any> => {
  return new Promise((resolve) => {
    const socket = getSocket() || connectSocket();

    socket.emit(
      "create_room",
      {
        nickname,
        password,
        max_participants: maxParticipants,
        require_approval: requireApproval,
        avatar_seed: avatarSeedFor(nickname),
      },
      (res: any) => {
        if (res?.success) {
          const store = getStore();
          store.setNickname(nickname);
          store.setRoomCode(res.room.code);
          store.setRoomState(res.room);
          if (password) store.setRoomPasscode(password);
        }
        resolve(res);
      },
    );
  });
};

const joinRoom = (
  roomCode: string,
  nickname: string,
  password?: string,
): Promise<any> => {
  return new Promise((resolve) => {
    const socket = getSocket() || connectSocket();

    socket.emit(
      "join_room",
      {
        room_code: roomCode,
        nickname,
        password,
        avatar_seed: avatarSeedFor(nickname),
      },
      (res: any) => {
        if (res?.success) {
          const store = getStore();
          store.setNickname(nickname);
          if (password) store.setRoomPasscode(password);
          if (res.status === "joined") {
            store.setRoomCode(res.room.code);
            store.setRoomState(res.room);
          } else if (res.status === "waiting") {
            store.setWaiting(true);
          }
        }
        resolve(res);
      },
    );
  });
};

const leaveRoom = () => {
  const socket = getSocket();
  if (socket) {
    socket.disconnect();
  }
  socketInstance = null;
  getStore().resetStore();
};

const admitGuest = (guestSid: string) => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (!socket || !roomCode) {
    return;
  }

  socket.emit(
    "waiting_room_action",
    {
      room_code: roomCode,
      target_sid: guestSid,
      action: "admit",
    },
    (res: any) => {
      if (res?.success && res.room) {
        getStore().setRoomState(res.room);
      }
    },
  );
};

const denyGuest = (guestSid: string) => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (!socket || !roomCode) {
    return;
  }

  socket.emit(
    "waiting_room_action",
    {
      room_code: roomCode,
      target_sid: guestSid,
      action: "deny",
    },
    (res: any) => {
      if (res?.success && res.room) {
        getStore().setRoomState(res.room);
      }
    },
  );
};

const kickUser = (targetSid: string) => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (socket && roomCode) {
    socket.emit("admin_action", {
      room_code: roomCode,
      target_id: targetSid,
      action: "kick",
    });
  }
};

const muteUser = (targetSid: string) => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (socket && roomCode) {
    socket.emit("admin_action", {
      room_code: roomCode,
      target_id: targetSid,
      action: "mute",
    });
  }
};

const transferAdmin = (targetSid: string) => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (socket && roomCode) {
    socket.emit("admin_action", {
      room_code: roomCode,
      target_id: targetSid,
      action: "make_admin",
    });
  }
};

const updateMedia = (mediaStates: MediaStateUpdate) => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (socket && roomCode) {
    socket.emit("update_media", {
      room_code: roomCode,
      camera_on: mediaStates.cameraOn,
      mic_on: mediaStates.micOn,
      screen_share_on: mediaStates.screenShareOn,
    });
  }
};

const sendChatMessage = (text: string, replyTo?: string | null) => {
  const socket = getSocket();
  const store = getStore();

  if (!socket || !store.roomCode) {
    return;
  }

  // The server broadcasts the canonical message to everyone, including sender.
  // Avoid local optimistic inserts because they render as duplicates on echo.
  socket.emit("chat_message", {
    room_code: store.roomCode,
    text,
    reply_to: replyTo,
  });
};

// End-to-end encrypted message (server relays ciphertext only).
const sendEncryptedMessage = (iv: string, ciphertext: string, replyTo?: string | null) => {
  const socket = getSocket();
  const store = getStore();

  if (!socket || !store.roomCode) {
    return;
  }

  socket.emit("chat_message", {
    room_code: store.roomCode,
    encrypted: true,
    iv,
    ciphertext,
    reply_to: replyTo,
  });
};

const shareScreenshot = (base64Image: string) => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (socket && roomCode) {
    socket.emit("share_screenshot", {
      room_code: roomCode,
      image_data: base64Image,
    });
  }
};

const sendReaction = (emoji: string) => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (socket && roomCode) {
    socket.emit("send_reaction", {
      room_code: roomCode,
      emoji,
    });
  }
};

const updateSettings = (settings: RoomSettingsUpdate) => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (socket && roomCode) {
    socket.emit("update_settings", {
      room_code: roomCode,
      max_participants: settings.maxParticipants,
      require_approval: settings.requireApproval,
      password: settings.password === undefined ? "NO_CHANGE" : settings.password,
    });
  }
};

const sendSignal = (targetSid: string, signal: any) => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (socket && roomCode) {
    socket.emit("signal", {
      room_code: roomCode,
      target_id: targetSid,
      signal,
    });
  }
};

const sendMessageReaction = (messageId: string, emoji: string) => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (socket && roomCode) {
    socket.emit("message_reaction", {
      room_code: roomCode,
      message_id: messageId,
      emoji,
    });
  }
};

// --- Watch-together (revamp) ---

const setWatchSource = (source: any) => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (socket && roomCode) {
    socket.emit("set_watch_source", { room_code: roomCode, source });
  }
};

const syncUpdate = (position: number, playing: boolean, rate: number) => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (socket && roomCode) {
    socket.emit("sync_update", { room_code: roomCode, position, playing, rate });
  }
};

const requestSync = () => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (socket && roomCode) {
    socket.emit("request_sync", { room_code: roomCode });
  }
};

const addToQueue = (source: any) => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (socket && roomCode) {
    socket.emit("add_to_queue", { room_code: roomCode, source });
  }
};

const removeFromQueue = (source: any) => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (socket && roomCode) {
    socket.emit("remove_from_queue", { room_code: roomCode, source });
  }
};

const fetchSources = async () => {
  const base = getSignalingUrl().replace(/\/$/, "");
  const res = await fetch(`${base}/sources`);
  if (!res.ok) throw new Error("Failed to fetch sources");
  return res.json();
};

// --- End-to-end encrypted chat (revamp) ---

const chatKeyCache: Record<string, CryptoKey> = {};

const getChatKey = async (roomCode: string, passcode: string): Promise<CryptoKey> => {
  if (chatKeyCache[roomCode]) return chatKeyCache[roomCode];
  const key = await deriveChatKey(roomCode, passcode);
  chatKeyCache[roomCode] = key;
  return key;
};

// Sends a message encrypted when a room passcode is set, else plaintext.
const sendSecureChat = async (text: string, replyTo?: string | null) => {
  const store = getStore();
  if (!store.roomCode || !store.roomPasscode) {
    sendChatMessage(text, replyTo);
    return;
  }
  try {
    const key = await getChatKey(store.roomCode, store.roomPasscode);
    const { iv, ciphertext } = await encryptText(key, text);
    sendEncryptedMessage(iv, ciphertext, replyTo);
  } catch (e) {
    console.error("E2EE encryption failed, falling back to plaintext:", e);
    sendChatMessage(text, replyTo);
  }
};

const socketService = {
  connectSocket,
  getSocket,
  createRoom,
  joinRoom,
  leaveRoom,
  admitGuest,
  denyGuest,
  kickUser,
  muteUser,
  transferAdmin,
  updateMedia,
  sendChatMessage,
  sendEncryptedMessage,
  shareScreenshot,
  sendReaction,
  updateSettings,
  sendSignal,
  sendMessageReaction,
  setWatchSource,
  syncUpdate,
  requestSync,
  addToQueue,
  removeFromQueue,
  fetchSources,
  sendSecureChat,
};

export const useSocket = () => socketService;
