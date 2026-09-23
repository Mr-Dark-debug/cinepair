import { io, Socket } from "socket.io-client";

import { useRoomStore } from "../store/useRoomStore";
import { deriveChatKey, deriveRoomCredential, encryptText } from "./useEncryption";

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
let rtcConfiguration: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
const setRtcConfiguration = (config?: RTCConfiguration) => {
  if (config?.iceServers?.length) rtcConfiguration = config;
};
const getRtcConfiguration = () => rtcConfiguration;

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
    transports: ["websocket", "polling"],
    tryAllTransports: true,
    autoConnect: true,
    reconnection: true,
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
    const store = getStore();
    if (store.roomCode || store.isWaiting) {
      store.resetStore();
      store.addToast("Connection lost. The room has closed; create or join a room again.");
    }
  });

  socketInstance = socket;
  return socket;
};

const getSocket = (): Socket | null => {
  return socketInstance;
};

const createRoom = async (
  nickname: string,
  password?: string,
  maxParticipants: number = 10,
  requireApproval: boolean = false,
): Promise<any> => {
  if (password && (password.length < 8 || password.length > 128)) return { success: false, error: "Use a room passcode of 8 to 128 characters." };
  const credential = password ? await deriveRoomCredential(password) : undefined;
  return new Promise((resolve) => {
    const socket = getSocket() || connectSocket();

    socket.timeout(90000).emit(
      "create_room",
      {
        nickname,
        password: credential,
        max_participants: maxParticipants,
        require_approval: requireApproval,
        avatar_seed: avatarSeedFor(nickname),
        avatar_palette: getStore().defaultAvatarPalette,
      },
      (err: Error | null, res: any) => {
        if (err) return resolve({ success: false, error: "Could not reach the room server. Please retry." });
        if (res?.success) {
          setRtcConfiguration(res.rtc_configuration);
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

const joinRoom = async (
  roomCode: string,
  nickname: string,
  password?: string,
): Promise<any> => {
  const credential = password ? await deriveRoomCredential(password) : undefined;
  return new Promise((resolve) => {
    const socket = getSocket() || connectSocket();

    socket.timeout(90000).emit(
      "join_room",
      {
        room_code: roomCode,
        nickname,
        password: credential,
        avatar_seed: avatarSeedFor(nickname),
        avatar_palette: getStore().defaultAvatarPalette,
      },
      (err: Error | null, res: any) => {
        if (err) return resolve({ success: false, error: "Could not reach the room server. Please retry." });
        if (res?.success) {
          setRtcConfiguration(res.rtc_configuration);
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
  getStore().resetStore();
  if (socket) {
    socket.disconnect();
  }
  socketInstance = null;
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

const shareScreenshot = async (base64Image: string): Promise<void> => {
  const socket = getSocket();
  const { roomCode, roomPasscode } = getStore();
  if (!socket || !roomCode) throw new Error("Room is disconnected.");
  if (!base64Image.startsWith("data:image/png;base64,") || base64Image.length > 5 * 1024 * 1024) {
    throw new Error("Image must be a PNG smaller than 5 MB.");
  }
  const payload = roomPasscode
    ? { room_code: roomCode, encrypted: true, ...await encryptText(await deriveChatKey(roomCode, roomPasscode), base64Image) }
    : { room_code: roomCode, image_data: base64Image };
  const event = roomPasscode ? "chat_message" : "share_screenshot";
  await new Promise<void>((resolve, reject) => socket.timeout(15000).emit(event, payload,
    (err: Error | null, res: any) => err || !res?.success ? reject(new Error(res?.error || "Image was not sent.")) : resolve()));
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

const updateSettings = async (settings: RoomSettingsUpdate): Promise<{ success: boolean; error?: string }> => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (!socket || !roomCode) return Promise.resolve({ success: false, error: "Room is disconnected." });
  if (settings.password && (settings.password.length < 8 || settings.password.length > 128)) return { success: false, error: "Use a room passcode of 8 to 128 characters." };
  const password = settings.password === undefined ? "NO_CHANGE" : settings.password ? await deriveRoomCredential(settings.password) : null;
  return new Promise((resolve) => {
    socket.timeout(10000).emit("update_settings", {
      room_code: roomCode,
      max_participants: settings.maxParticipants,
      require_approval: settings.requireApproval,
      password,
    }, (err: Error | null, res: any) => {
      if (err) return resolve({ success: false, error: "Settings could not be saved. Please retry." });
      if (res?.success && settings.password !== undefined) getStore().setRoomPasscode(settings.password || null);
      resolve(res || { success: false, error: "Settings could not be saved." });
    });
  });
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

const setWatchSource = (source: any): Promise<{ success: boolean; error?: string }> => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (!socket || !roomCode) return Promise.resolve({ success: false, error: "Room is disconnected." });
  return new Promise((resolve) => socket.timeout(10000).emit("set_watch_source", { room_code: roomCode, source },
    (err: Error | null, res: any) => resolve(err ? { success: false, error: "Could not select source." } : res || { success: false, error: "Could not select source." })));
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

const changeQueue = (event: "add_to_queue" | "remove_from_queue", source: any): Promise<{ success: boolean; error?: string }> => {
  const socket = getSocket();
  const { roomCode } = getStore();

  if (!socket || !roomCode) return Promise.resolve({ success: false, error: "Room is disconnected." });
  return new Promise((resolve) => socket.timeout(10000).emit(event, { room_code: roomCode, source },
    (err: Error | null, res: any) => resolve(err ? { success: false, error: "Queue update timed out." } : res || { success: false, error: "Queue update failed." })));
};

const addToQueue = (source: any) => changeQueue("add_to_queue", source);
const removeFromQueue = (source: any) => changeQueue("remove_from_queue", source);

const fetchSources = async () => {
  const base = getSignalingUrl().replace(/\/$/, "");
  const res = await fetch(`${base}/sources`);
  if (!res.ok) throw new Error("Failed to fetch sources");
  return res.json();
};

// --- End-to-end encrypted chat (revamp) ---

// Protected rooms fail closed: an encryption error never sends plaintext.
const sendSecureChat = async (text: string, replyTo?: string | null): Promise<void> => {
  const store = getStore();
  const socket = getSocket();
  if (!socket || !store.roomCode) throw new Error("Room is disconnected.");
  if (!store.roomCode || !store.roomPasscode) {
    await new Promise<void>((resolve, reject) => socket.timeout(10000).emit("chat_message", {
      room_code: store.roomCode, text, reply_to: replyTo,
    }, (err: Error | null, res: any) => err || !res?.success ? reject(new Error(res?.error || "Message was not sent.")) : resolve()));
    return;
  }
  const key = await deriveChatKey(store.roomCode, store.roomPasscode);
  const { iv, ciphertext } = await encryptText(key, text);
  await new Promise<void>((resolve, reject) => socket.timeout(10000).emit("chat_message", {
    room_code: store.roomCode, encrypted: true, iv, ciphertext, reply_to: replyTo,
  }, (err: Error | null, res: any) => err || !res?.success ? reject(new Error(res?.error || "Encrypted message was not sent.")) : resolve()));
};

const socketService = {
  setRtcConfiguration,
  getRtcConfiguration,
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
