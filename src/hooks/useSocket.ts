import { useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useRoomStore } from "../store/useRoomStore";


// Singleton socket instance reference
let socketInstance: Socket | null = null;

export const useSocket = () => {
  const store = useRoomStore();
  const socketRef = useRef<Socket | null>(null);

  // Initialize Socket connection
  const connectSocket = useCallback((url?: string): Socket => {
    if (socketInstance) {
      socketRef.current = socketInstance;
      return socketInstance;
    }

    const defaultUrl = import.meta.env.VITE_SIGNALING_URL || "https://cinepair-signaling.onrender.com";
    const finalUrl = url || defaultUrl;

    const socket = io(finalUrl, {
      transports: ["websocket"],
      autoConnect: true,
      reconnectionAttempts: 5,
    });

    socketInstance = socket;
    socketRef.current = socket;

    // Attach base connectivity listeners
    socket.on("connect", () => {
      console.log("Connected to signaling server with SID:", socket.id);
    });

    socket.on("connect_error", (error) => {
      console.error("Signaling connection error:", error);
      store.addToast("⚠️ Signaling server is waking up. Please hold on...");
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from signaling server.");
    });

    return socket;
  }, []);

  const getSocket = useCallback((): Socket | null => {
    return socketRef.current || socketInstance;
  }, []);

  // API Methods
  const createRoom = useCallback((
    nickname: string,
    password?: string,
    maxParticipants: number = 10,
    requireApproval: boolean = false
  ): Promise<any> => {
    return new Promise((resolve) => {
      const socket = getSocket() || connectSocket();
      socket.emit("create_room", {
        nickname,
        password,
        max_participants: maxParticipants,
        require_approval: requireApproval
      }, (res: any) => {
        if (res && res.success) {
          store.setNickname(nickname);
          store.setRoomCode(res.room.code);
          store.setRoomState(res.room);
        }
        resolve(res);
      });
    });
  }, [connectSocket, getSocket, store]);

  const joinRoom = useCallback((
    roomCode: string,
    nickname: string,
    password?: string
  ): Promise<any> => {
    return new Promise((resolve) => {
      const socket = getSocket() || connectSocket();
      socket.emit("join_room", {
        room_code: roomCode,
        nickname,
        password
      }, (res: any) => {
        if (res && res.success) {
          store.setNickname(nickname);
          if (res.status === "joined") {
            store.setRoomCode(res.room.code);
            store.setRoomState(res.room);
          } else if (res.status === "waiting") {
            store.setWaiting(true);
          }
        }
        resolve(res);
      });
    });
  }, [connectSocket, getSocket, store]);

  const leaveRoom = useCallback(() => {
    const socket = getSocket();
    if (socket) {
      socket.disconnect();
    }
    socketInstance = null;
    socketRef.current = null;
    store.resetStore();
  }, [getSocket, store]);

  // Admin moderation actions
  const admitGuest = useCallback((guestSid: string) => {
    const socket = getSocket();
    if (socket && store.roomCode) {
      socket.emit("waiting_room_action", {
        room_code: store.roomCode,
        target_sid: guestSid,
        action: "admit"
      }, (res: any) => {
        if (res && res.success && res.room) {
          store.setRoomState(res.room);
        }
      });
    }
  }, [getSocket, store.roomCode, store.setRoomState]);

  const denyGuest = useCallback((guestSid: string) => {
    const socket = getSocket();
    if (socket && store.roomCode) {
      socket.emit("waiting_room_action", {
        room_code: store.roomCode,
        target_sid: guestSid,
        action: "deny"
      }, (res: any) => {
        if (res && res.success && res.room) {
          store.setRoomState(res.room);
        }
      });
    }
  }, [getSocket, store.roomCode, store.setRoomState]);

  const kickUser = useCallback((targetSid: string) => {
    const socket = getSocket();
    if (socket && store.roomCode) {
      socket.emit("admin_action", {
        room_code: store.roomCode,
        target_id: targetSid,
        action: "kick"
      });
    }
  }, [getSocket, store.roomCode]);

  const muteUser = useCallback((targetSid: string) => {
    const socket = getSocket();
    if (socket && store.roomCode) {
      socket.emit("admin_action", {
        room_code: store.roomCode,
        target_id: targetSid,
        action: "mute"
      });
    }
  }, [getSocket, store.roomCode]);

  const transferAdmin = useCallback((targetSid: string) => {
    const socket = getSocket();
    if (socket && store.roomCode) {
      socket.emit("admin_action", {
        room_code: store.roomCode,
        target_id: targetSid,
        action: "make_admin"
      });
    }
  }, [getSocket, store.roomCode]);

  // Media toggles update
  const updateMedia = useCallback((mediaStates: {
    cameraOn?: boolean;
    micOn?: boolean;
    screenShareOn?: boolean;
  }) => {
    const socket = getSocket();
    if (socket && store.roomCode) {
      socket.emit("update_media", {
        room_code: store.roomCode,
        camera_on: mediaStates.cameraOn,
        mic_on: mediaStates.micOn,
        screen_share_on: mediaStates.screenShareOn
      });
    }
  }, [getSocket, store.roomCode]);

  // Communication events
  const sendChatMessage = useCallback((text: string, replyTo?: string | null) => {
    const socket = getSocket();
    if (socket && store.roomCode) {
      // Optimistic local insert: show message immediately for the sender
      const localMsgId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      store.addMessage({
        id: localMsgId,
        sender_id: socket.id || '',
        sender_nickname: store.nickname || 'You',
        text,
        timestamp: Date.now() / 1000,
        reply_to: replyTo
      });

      socket.emit("chat_message", {
        room_code: store.roomCode,
        text,
        reply_to: replyTo
      });
    }
  }, [getSocket, store.roomCode, store.nickname]);

  const shareScreenshot = useCallback((base64Image: string) => {
    const socket = getSocket();
    if (socket && store.roomCode) {
      socket.emit("share_screenshot", {
        room_code: store.roomCode,
        image_data: base64Image
      });
    }
  }, [getSocket, store.roomCode]);

  const sendReaction = useCallback((emoji: string) => {
    const socket = getSocket();
    if (socket && store.roomCode) {
      socket.emit("send_reaction", {
        room_code: store.roomCode,
        emoji
      });
    }
  }, [getSocket, store.roomCode]);

  const updateSettings = useCallback((settings: {
    maxParticipants?: number;
    requireApproval?: boolean;
    password?: string | null;
  }) => {
    const socket = getSocket();
    if (socket && store.roomCode) {
      socket.emit("update_settings", {
        room_code: store.roomCode,
        max_participants: settings.maxParticipants,
        require_approval: settings.requireApproval,
        password: settings.password === undefined ? "NO_CHANGE" : settings.password
      });
    }
  }, [getSocket, store.roomCode]);

  // WebRTC Signaling emitter
  const sendSignal = useCallback((targetSid: string, signal: any) => {
    const socket = getSocket();
    if (socket && store.roomCode) {
      socket.emit("signal", {
        room_code: store.roomCode,
        target_id: targetSid,
        signal
      });
    }
  }, [getSocket, store.roomCode]);

  const sendMessageReaction = useCallback((messageId: string, emoji: string) => {
    const socket = getSocket();
    if (socket && store.roomCode) {
      socket.emit("message_reaction", {
        room_code: store.roomCode,
        message_id: messageId,
        emoji
      });
    }
  }, [getSocket, store.roomCode]);

  return {
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
    sendMessageReaction
  };
};
