import { useEffect, useRef, useCallback } from "react";
import { useRoomStore } from "../store/useRoomStore";
import { useSocket } from "./useSocket";

interface PeerNegotiationState {
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
}

const iceConfiguration: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" }
  ]
};

const setTrackContentHint = (track: MediaStreamTrack | undefined, hint: string) => {
  if (!track || !("contentHint" in track)) return;
  try {
    track.contentHint = hint;
  } catch (error) {
    console.warn(`Unable to set ${track.kind} content hint:`, error);
  }
};

const configureSender = async (
  sender: RTCRtpSender,
  profile: "camera_video" | "mic_audio" | "screen_video" | "screen_audio",
) => {
  try {
    const params = sender.getParameters();
    params.encodings ??= [{}];

    if (profile === "screen_video") {
      params.degradationPreference = "maintain-framerate";
      params.encodings[0].maxBitrate = 4_000_000;
      params.encodings[0].maxFramerate = 30;
    } else if (profile === "camera_video") {
      params.degradationPreference = "balanced";
      params.encodings[0].maxBitrate = 1_200_000;
      params.encodings[0].maxFramerate = 24;
    } else if (profile === "screen_audio") {
      params.encodings[0].maxBitrate = 192_000;
    } else {
      params.encodings[0].maxBitrate = 96_000;
    }

    await sender.setParameters(params);
  } catch (error) {
    console.warn(`Unable to tune ${profile} sender parameters:`, error);
  }
};

export const useWebRTC = () => {
  const store = useRoomStore();
  const socketService = useSocket();

  // Peer Connection references: peerId -> RTCPeerConnection
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});
  // Track Sender references: peerId -> Record<trackKindOrId, RTCRtpSender>
  const sendersRef = useRef<Record<string, Record<string, RTCRtpSender>>>({});
  // Negotiation states: peerId -> PeerNegotiationState
  const negStatesRef = useRef<Record<string, PeerNegotiationState>>({});

  const socket = socketService.getSocket();
  const socketId = socket?.id;

  // Helper: Retrieve negotiation state for a specific peer, initializing if absent
  const getNegState = useCallback((peerId: string): PeerNegotiationState => {
    if (!negStatesRef.current[peerId]) {
      negStatesRef.current[peerId] = {
        makingOffer: false,
        ignoreOffer: false,
        isSettingRemoteAnswerPending: false
      };
    }
    return negStatesRef.current[peerId];
  }, []);

  // API: Initialize RTCPeerConnection for a remote peer
  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    // Return existing if already established
    if (pcsRef.current[peerId]) {
      return pcsRef.current[peerId];
    }

    console.log(`Establishing RTCPeerConnection for Peer: ${peerId}`);
    const pc = new RTCPeerConnection(iceConfiguration);
    pcsRef.current[peerId] = pc;
    sendersRef.current[peerId] = {};


    const nState = getNegState(peerId);

    // 1. ICE Candidate Gatherer
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socketService.sendSignal(peerId, { candidate });
      }
    };

    // 2. Negotiation trigger (Perfect Negotiation pattern)
    pc.onnegotiationneeded = async () => {
      try {
        nState.makingOffer = true;
        await pc.setLocalDescription();
        socketService.sendSignal(peerId, { description: pc.localDescription });
      } catch (err) {
        console.error(`Negotiation needed error for peer ${peerId}:`, err);
      } finally {
        nState.makingOffer = false;
      }
    };

    // 3. ICE Connection State changes
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE state for ${peerId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "closed") {
        closePeerConnection(peerId);
      }
    };

    // 4. Remote track listener
    pc.ontrack = (event) => {
      console.log(`Received track from ${peerId}: kind=${event.track.kind}`);
      
      // Obtain existing stream or instantiate new — read from store at call time
      const currentState = useRoomStore.getState();
      const participant = currentState.participants.find((p) => p.id === peerId);
      const existingMain = currentState.peerStreams[peerId];
      const existingScreen = currentState.peerScreenStreams[peerId];
      const trackLabel = event.track.label.toLowerCase();
      const looksLikeScreenLabel =
        trackLabel.includes("screen") ||
        trackLabel.includes("display") ||
        trackLabel.includes("window") ||
        trackLabel.includes("tab");
      const shouldUseScreenStream = !!participant?.screen_share_on && (
        looksLikeScreenLabel ||
        !!existingScreen ||
        (event.track.kind === "video" && !!existingMain?.getVideoTracks().length) ||
        (event.track.kind === "audio" && !!existingMain?.getAudioTracks().length)
      );

      let remoteStream = shouldUseScreenStream ? existingScreen : existingMain;
      if (!remoteStream) {
        remoteStream = new MediaStream();
      }

      if (!remoteStream.getTracks().some((track) => track.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }

      if (shouldUseScreenStream) {
        currentState.addPeerScreenStream(peerId, remoteStream);
      } else {
        currentState.addPeerStream(peerId, remoteStream);
      }

      // Force track state refresh on disconnect/cleanup
      event.track.onended = () => {
        console.log(`Track ${event.track.kind} from ${peerId} ended`);
      };
    };

    // 5. Append current local tracks immediately — read from store at call time
    const initState = useRoomStore.getState();
    if (initState.localStream) {
      initState.localStream.getTracks().forEach((track) => {
        setTrackContentHint(track, track.kind === "audio" ? "speech" : "motion");
        const sender = pc.addTrack(track, initState.localStream!);
        sendersRef.current[peerId][track.kind] = sender;
        void configureSender(sender, track.kind === "audio" ? "mic_audio" : "camera_video");
      });
    }

    // 6. Append screen share track if actively sharing
    if (initState.localScreenStream) {
      const screenVideoTrack = initState.localScreenStream.getVideoTracks()[0];
      if (screenVideoTrack) {
        setTrackContentHint(screenVideoTrack, "motion");
        const sender = pc.addTrack(screenVideoTrack, initState.localScreenStream!);
        sendersRef.current[peerId]["screen_video"] = sender;
        void configureSender(sender, "screen_video");
      }
      
      const screenAudioTrack = initState.localScreenStream.getAudioTracks()[0];
      if (screenAudioTrack) {
        setTrackContentHint(screenAudioTrack, "music");
        const sender = pc.addTrack(screenAudioTrack, initState.localScreenStream!);
        sendersRef.current[peerId]["screen_audio"] = sender;
        void configureSender(sender, "screen_audio");
      }
    }

    return pc;
  }, [socketId, socketService, getNegState]);

  // Clean up and close connection for a specific peer
  const closePeerConnection = useCallback((peerId: string) => {
    const pc = pcsRef.current[peerId];
    if (pc) {
      console.log(`Closing connection for peer: ${peerId}`);
      pc.close();
      delete pcsRef.current[peerId];
    }
    delete sendersRef.current[peerId];
    delete negStatesRef.current[peerId];
    useRoomStore.getState().removePeerStream(peerId);
  }, []);

  // Cleanup all connections
  const closeAllConnections = useCallback(() => {
    Object.keys(pcsRef.current).forEach((peerId) => {
      closePeerConnection(peerId);
    });
  }, [closePeerConnection]);

  // Handler for incoming signaling relays (offer / answer / ice candidate)
  const handleInboundSignal = useCallback(async (senderId: string, signal: any) => {
    const pc = createPeerConnection(senderId);
    const nState = getNegState(senderId);
    const currentSid = socketService.getSocket()?.id;
    const polite = currentSid ? currentSid < senderId : true;

    try {
      if (signal.description) {
        const offerCollision =
          signal.description.type === "offer" &&
          (nState.makingOffer || pc.signalingState !== "stable");

        nState.ignoreOffer = !polite && offerCollision;
        if (nState.ignoreOffer) {
          console.warn(`Signaling collision: Impolite peer ignoring offer from ${senderId}`);
          return;
        }

        if (offerCollision) {
          // Polite rolls back to accept incoming offer
          await pc.setLocalDescription({ type: "rollback" });
        }

        await pc.setRemoteDescription(signal.description);

        if (signal.description.type === "offer") {
          await pc.setLocalDescription();
          socketService.sendSignal(senderId, { description: pc.localDescription });
        }
      } else if (signal.candidate) {
        try {
          await pc.addIceCandidate(signal.candidate);
        } catch (err) {
          if (!nState.ignoreOffer) {
            throw err;
          }
        }
      }
    } catch (error) {
      console.error(`Error handling signaling payload from ${senderId}:`, error);
    }
  }, [createPeerConnection, getNegState, socketId, socketService]);

  // Stable refs for callbacks — used in the main useEffect to avoid re-registration
  const createPcRef = useRef<(peerId: string) => RTCPeerConnection>(createPeerConnection);
  const closePcRef = useRef<(peerId: string) => void>(closePeerConnection);
  const handleSignalRef = useRef<(senderId: string, signal: any) => Promise<void>>(handleInboundSignal);
  const closeAllRef = useRef<() => void>(closeAllConnections);

  useEffect(() => { createPcRef.current = createPeerConnection; }, [createPeerConnection]);
  useEffect(() => { closePcRef.current = closePeerConnection; }, [closePeerConnection]);
  useEffect(() => { handleSignalRef.current = handleInboundSignal; }, [handleInboundSignal]);
  useEffect(() => { closeAllRef.current = closeAllConnections; }, [closeAllConnections]);

  // Dynamic media replacement logic (handles toggling camera/microphone)
  // When tracks enable/disable, we either replace or add tracks in the mesh
  useEffect(() => {
    if (!store.localStream) return;

    const currentLocalStream = useRoomStore.getState().localStream;
    if (!currentLocalStream) return;

    const audioTrack = currentLocalStream.getAudioTracks()[0];
    const videoTrack = currentLocalStream.getVideoTracks()[0];

    Object.keys(pcsRef.current).forEach((peerId) => {
      const pc = pcsRef.current[peerId];
      const senders = sendersRef.current[peerId];

      if (!pc || !senders) return;

      // Swap or add Audio track
      if (audioTrack) {
        setTrackContentHint(audioTrack, "speech");
        const sender = senders["audio"];
        if (sender) {
          // Ultra high quality dynamic replacement without renegotiation
          sender.replaceTrack(audioTrack);
          void configureSender(sender, "mic_audio");
        } else {
          const newSender = pc.addTrack(audioTrack, currentLocalStream!);
          senders["audio"] = newSender;
          void configureSender(newSender, "mic_audio");
        }
      }

      // Swap or add Video track
      if (videoTrack) {
        setTrackContentHint(videoTrack, "motion");
        const sender = senders["video"];
        if (sender) {
          sender.replaceTrack(videoTrack);
          void configureSender(sender, "camera_video");
        } else {
          const newSender = pc.addTrack(videoTrack, currentLocalStream!);
          senders["video"] = newSender;
          void configureSender(newSender, "camera_video");
        }
      }
    });
  }, [store.localStream, store.cameraEnabled, store.micEnabled]);

  // Dynamic screen share track replacement
  useEffect(() => {
    Object.keys(pcsRef.current).forEach((peerId) => {
      const pc = pcsRef.current[peerId];
      const senders = sendersRef.current[peerId];

      if (!pc || !senders) return;

      const screenVideoTrack = store.localScreenStream?.getVideoTracks()[0];
      const screenAudioTrack = store.localScreenStream?.getAudioTracks()[0];

      // Handle Screen Video
      if (screenVideoTrack) {
        setTrackContentHint(screenVideoTrack, "motion");
        const sender = senders["screen_video"];
        if (sender) {
          sender.replaceTrack(screenVideoTrack);
          void configureSender(sender, "screen_video");
        } else {
          const newSender = pc.addTrack(screenVideoTrack, store.localScreenStream!);
          senders["screen_video"] = newSender;
          void configureSender(newSender, "screen_video");
        }
      } else {
        const sender = senders["screen_video"];
        if (sender) {
          try {
            pc.removeTrack(sender);
          } catch (e) {}
          delete senders["screen_video"];
        }
      }

      // Handle Screen Audio
      if (screenAudioTrack) {
        setTrackContentHint(screenAudioTrack, "music");
        const sender = senders["screen_audio"];
        if (sender) {
          sender.replaceTrack(screenAudioTrack);
          void configureSender(sender, "screen_audio");
        } else {
          const newSender = pc.addTrack(screenAudioTrack, store.localScreenStream!);
          senders["screen_audio"] = newSender;
          void configureSender(newSender, "screen_audio");
        }
      } else {
        const sender = senders["screen_audio"];
        if (sender) {
          try {
            pc.removeTrack(sender);
          } catch (e) {}
          delete senders["screen_audio"];
        }
      }
    });
  }, [store.localScreenStream, store.screenShareEnabled]);

  // Hook up event triggers when room state changes
  useEffect(() => {
    if (!socket || !store.roomCode) return;

    // 1. Participant joined -> Setup peer connection
    const handleUserJoined = (data: { joined_participant: { id: string; nickname: string }; room: any }) => {
      const newPeerId = data.joined_participant.id;
      if (newPeerId && newPeerId !== socket.id) {
        console.log(`Peer joined: ${newPeerId}. Initializing WebRTC handshake.`);
        createPcRef.current(newPeerId);
      }
      useRoomStore.getState().setRoomState(data.room);
      
      // Toast notification
      useRoomStore.getState().addMessage({
        id: Math.random().toString(),
        sender_id: "system",
        sender_nickname: "System",
        text: `⚡ ${data.joined_participant.nickname} joined the room.`,
        timestamp: Date.now() / 1000
      });
    };

    // 2. Participant left -> Tear down peer connection
    const handleUserLeft = (data: { left_sid: string; room: any }) => {
      const peerId = data.left_sid;
      console.log(`Peer left: ${peerId}. Destroying WebRTC connection.`);
      closePcRef.current(peerId);
      const s = useRoomStore.getState();
      s.setRoomState(data.room);

      const oldParticipant = s.participants.find(p => p.id === peerId);
      if (oldParticipant) {
        s.addMessage({
          id: Math.random().toString(),
          sender_id: "system",
          sender_nickname: "System",
          text: `👋 ${oldParticipant.nickname} left the room.`,
          timestamp: Date.now() / 1000
        });
      }
    };

    // 3. Signaling relayer
    const handleSignalEvent = (data: { sender_id: string; signal: any }) => {
      handleSignalRef.current(data.sender_id, data.signal);
    };

    // 4. Chat relays
    const handleChatMessage = (msg: any) => {
      useRoomStore.getState().addMessage({
        id: msg.id,
        sender_id: msg.sender_id,
        sender_nickname: msg.sender_nickname,
        text: msg.text,
        timestamp: msg.timestamp,
        reply_to: msg.reply_to,
        image_data: msg.image_data
      });
    };

    // 5. Reactions pop
    const handleReaction = (data: { sender_id: string; emoji: string }) => {
      useRoomStore.getState().addReaction({ senderId: data.sender_id, emoji: data.emoji });
    };

    // 5.5 Message Reactions toggle
    const handleMessageReaction = (data: {
      message_id: string;
      sender_id: string;
      sender_nickname: string;
      emoji: string;
    }) => {
      useRoomStore.getState().toggleMessageReaction(
        data.message_id,
        data.emoji,
        data.sender_id,
        data.sender_nickname
      );
    };

    // 6. Settings updates
    const handleSettingsUpdated = (data: { room: any }) => {
      const s = useRoomStore.getState();
      s.setRoomState(data.room);
      s.addMessage({
        id: Math.random().toString(),
        sender_id: "system",
        sender_nickname: "System",
        text: `⚙️ Room settings updated by host.`,
        timestamp: Date.now() / 1000
      });
    };

    // 6.5 Media status updates
    const handleMediaUpdated = (data: { participant_id: string; room: any }) => {
      useRoomStore.getState().setRoomState(data.room);
    };

    // 7. Force-mute (Client specific remote mute trigger)
    const handleForceMute = () => {
      console.log("Admin forced a mute. Disabling microphone.");
      const s = useRoomStore.getState();
      if (s.localStream) {
        const micTrack = s.localStream.getAudioTracks()[0];
        if (micTrack) {
          micTrack.enabled = false;
        }
      }
      s.setMicEnabled(false);
      socketService.updateMedia({ micOn: false });
      
      s.addMessage({
        id: Math.random().toString(),
        sender_id: "system",
        sender_nickname: "System",
        text: `🔒 Your microphone was remotely muted by the admin.`,
        timestamp: Date.now() / 1000
      });
    };

    // 8. Kicked from room
    const handleKicked = () => {
      alert("You have been kicked from this room by the host.");
      socketService.leaveRoom();
    };

    // 9. Admin transfered
    const handleAdminTransferred = (data: { new_admin_id: string; room: any }) => {
      const s = useRoomStore.getState();
      s.setRoomState(data.room);
      const newAdmin = data.room.participants.find((p: any) => p.id === data.new_admin_id);
      
      s.addMessage({
        id: Math.random().toString(),
        sender_id: "system",
        sender_nickname: "System",
        text: `👑 ${newAdmin?.nickname || "Someone"} is now the admin.`,
        timestamp: Date.now() / 1000
      });
    };

    // 10. Lobby request (waiting participant wants to join)
    const handleLobbyRequest = (data: { sid: string; nickname: string }) => {
      console.log(`Lobby request from ${data.nickname} (${data.sid})`);
      const s = useRoomStore.getState();
      s.addWaitingParticipant({ id: data.sid, nickname: data.nickname });
      s.addToast(`🔔 ${data.nickname} is requesting to join the room.`);
    };

    // Register active listeners
    socket.on("user_joined", handleUserJoined);
    socket.on("user_left", handleUserLeft);
    socket.on("signal", handleSignalEvent);
    socket.on("chat_message", handleChatMessage);
    socket.on("emoji_reaction", handleReaction);
    socket.on("message_reaction", handleMessageReaction);
    socket.on("settings_updated", handleSettingsUpdated);
    socket.on("media_updated", handleMediaUpdated);
    socket.on("force_mute", handleForceMute);
    socket.on("kicked", handleKicked);
    socket.on("admin_transferred", handleAdminTransferred);
    socket.on("lobby_request", handleLobbyRequest);

    // Initial peer setup for existing participants on joining
    useRoomStore.getState().participants.forEach((p) => {
      if (p.id !== socket?.id) {
        console.log(`Setting up initial connection for existing peer: ${p.id}`);
        createPcRef.current(p.id);
      }
    });

    // Cleanup listeners
    return () => {
      socket.off("user_joined", handleUserJoined);
      socket.off("user_left", handleUserLeft);
      socket.off("signal", handleSignalEvent);
      socket.off("chat_message", handleChatMessage);
      socket.off("emoji_reaction", handleReaction);
      socket.off("message_reaction", handleMessageReaction);
      socket.off("settings_updated", handleSettingsUpdated);
      socket.off("media_updated", handleMediaUpdated);
      socket.off("force_mute", handleForceMute);
      socket.off("kicked", handleKicked);
      socket.off("admin_transferred", handleAdminTransferred);
      socket.off("lobby_request", handleLobbyRequest);
      closeAllRef.current();
    };
  }, [socket, store.roomCode, socketService]);

  return {
    peerConnections: pcsRef.current,
    closeAllConnections
  };
};
