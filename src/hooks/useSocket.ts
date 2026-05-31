import { io, Socket } from "socket.io-client";

import { useRoomStore } from "../store/useRoomStore";

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

const getSignalingUrl = () => {
  return import.meta.env.VITE_SIGNALING_URL || "https://cinepair-signaling.onrender.com";
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
      },
      (res: any) => {
        if (res?.success) {
          const store = getStore();
          store.setNickname(nickname);
          store.setRoomCode(res.room.code);
          store.setRoomState(res.room);
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
      },
      (res: any) => {
        if (res?.success) {
          const store = getStore();
          store.setNickname(nickname);
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
  shareScreenshot,
  sendReaction,
  updateSettings,
  sendSignal,
  sendMessageReaction,
};

export const useSocket = () => socketService;
