import React, { useState, useEffect } from "react";
import { 
  Tv, 
  Plus, 
  LogIn, 
  ArrowRight, 
  Copy, 
  Check, 
  MessageSquare,
  Camera,
  AlertCircle
} from "lucide-react";

import { useRoomStore } from "./store/useRoomStore";
import { useSocket } from "./hooks/useSocket";
import { useWebRTC } from "./hooks/useWebRTC";
import { useAudioMixer } from "./hooks/useAudioMixer";

// Import Components
import { VideoTile } from "./components/VideoTile";
import { Stage } from "./components/Stage";
import { ChatSidebar } from "./components/ChatSidebar";
import { WaitingRoom } from "./components/WaitingRoom";
import { RoomSettings } from "./components/RoomSettings";
import { EmojiReactionOverlay } from "./components/EmojiReactionOverlay";

function App() {
  const store = useRoomStore();
  const socketService = useSocket();
  
  // Initialize P2P mesh network listeners
  useWebRTC();
  const audioMixer = useAudioMixer();

  // Setup form states
  const [setupMode, setSetupMode] = useState<"join" | "create">("create");
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [password, setPassword] = useState("");
  
  // Admin setup defaults
  const [maxParticipants] = useState(10);
  const [requireApproval, setRequireApproval] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [setupError, setSetupError] = useState("");

  const currentSocketId = store.participants.find((p) => p.nickname === store.nickname)?.id;

  // Initialize Socket connection
  useEffect(() => {
    socketService.connectSocket();
    
    // Register waiting list admit callback
    const socket = socketService.getSocket();
    if (socket) {
      socket.on("admit_result", (res: any) => {
        if (res.success) {
          store.setWaiting(false);
          store.setRoomCode(res.room.code);
          store.setRoomState(res.room);
          startLocalMedia();
        } else {
          setSetupError(res.error || "Denied by host.");
          store.resetStore();
        }
      });
    }

    return () => {
      if (socket) {
        socket.off("admit_result");
      }
    };
  }, [socketService]);

  // Capture local AV camera and mic
  const startLocalMedia = async (): Promise<MediaStream | null> => {
    try {
      console.log("Requesting camera and microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      
      store.setLocalStream(stream);
      store.setCameraEnabled(true);
      store.setMicEnabled(true);
      
      // Update media status on the signaling server
      socketService.updateMedia({ cameraOn: true, micOn: true });
      return stream;
    } catch (err) {
      console.error("Failed to capture local media tracks:", err);
      // Fallback: request audio only if camera is absent/blocked
      try {
        const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true }
        });
        store.setLocalStream(audioOnlyStream);
        store.setMicEnabled(true);
        socketService.updateMedia({ cameraOn: false, micOn: true });
        return audioOnlyStream;
      } catch (audioErr) {
        console.error("Failed to capture local mic:", audioErr);
        setSetupError("Hardware access denied. Please enable camera/microphone permissions in Settings.");
        return null;
      }
    }
  };

  // Toggle Camera
  const handleToggleCam = () => {
    const videoTrack = store.localStream?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      store.setCameraEnabled(videoTrack.enabled);
      socketService.updateMedia({ cameraOn: videoTrack.enabled });
    } else if (!store.cameraEnabled) {
      // Re-initialize tracks if they were stopped previously
      startLocalMedia();
    }
  };

  // Toggle Microphone
  const handleToggleMic = () => {
    const audioTrack = store.localStream?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      store.setMicEnabled(audioTrack.enabled);
      socketService.updateMedia({ micOn: audioTrack.enabled });
    }
  };

  // Capture and mix screen sharing with audio
  const handleToggleScreenShare = async () => {
    if (store.screenShareEnabled) {
      // Turn off
      stopScreenSharing();
    } else {
      // Turn on
      try {
        console.log("Requesting screen capture stream...");
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true // Crucial: requests system/tab audio
        });

        // Set screen state
        store.setLocalScreenStream(screenStream);
        store.setScreenShareEnabled(true);
        socketService.updateMedia({ screenShareOn: true });

        // Auto mix system audio and mic if shared
        const screenAudioTrack = screenStream.getAudioTracks()[0];
        if (screenAudioTrack && store.localStream) {
          console.log("System audio track detected. Initializing Web Audio mixer...");
          const mixedTrack = audioMixer.mixStreams(store.localStream, screenStream);
          if (mixedTrack) {
            store.setScreenAudioEnabled(true);
            // Replace local audio track in active peer connections with the mixed track
            // Handled automatically in useWebRTC effect hooks
          }
        }

        // Listener: if user clicks "Stop Sharing" on standard browser native banner
        screenStream.getVideoTracks()[0].onended = () => {
          stopScreenSharing();
        };

      } catch (err) {
        console.error("Failed to capture screen share:", err);
      }
    }
  };

  const stopScreenSharing = () => {
    if (store.localScreenStream) {
      store.localScreenStream.getTracks().forEach(track => track.stop());
    }
    store.setLocalScreenStream(null);
    store.setScreenShareEnabled(false);
    store.setScreenAudioEnabled(false);
    socketService.updateMedia({ screenShareOn: false });
    audioMixer.stopMixing();
  };

  // Screenshot Capture from Stage Video element
  const handleCaptureScreenshot = () => {
    const videoElement = document.querySelector("video");
    if (!videoElement) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoElement.videoWidth || 1280;
      canvas.height = videoElement.videoHeight || 720;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Draw the current frame of the video track on canvas
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const base64Data = canvas.toDataURL("image/png");
        
        // Share in chat room
        socketService.shareScreenshot(base64Data);
        
        store.addMessage({
          id: Math.random().toString(),
          sender_id: "system",
          sender_nickname: "System",
          text: "📸 You shared a screenshot of the Stage view.",
          timestamp: Date.now() / 1000
        });
      }
    } catch (err) {
      console.error("Failed to capture screenshot from canvas:", err);
    }
  };

  // Setup Form Actions
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError("");

    if (!nickname.trim()) {
      setSetupError("Nickname is required.");
      return;
    }

    const res = await socketService.createRoom(
      nickname.trim(),
      password.trim() || undefined,
      maxParticipants,
      requireApproval
    );

    if (res.success) {
      await startLocalMedia();
    } else {
      setSetupError(res.error || "Failed to create room.");
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError("");

    if (!nickname.trim() || !roomCode.trim()) {
      setSetupError("Nickname and Room Code are required.");
      return;
    }

    const res = await socketService.joinRoom(
      roomCode.toUpperCase().trim(),
      nickname.trim(),
      password.trim() || undefined
    );

    if (res.success) {
      if (res.status === "joined") {
        await startLocalMedia();
      }
      // If status is 'waiting', it triggers waitlist overlay. Connected socket stays open.
    } else {
      setSetupError(res.error || "Failed to join room.");
    }
  };

  const handleCopyInvite = () => {
    if (store.roomCode) {
      navigator.clipboard.writeText(store.roomCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // Route Views
  const isInRoom = store.roomCode !== null;
  const isLobbyWaiting = store.isWaiting;

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      
      {/* Dynamic Floating Emojis */}
      <EmojiReactionOverlay />
      
      {/* Admins Join Requests Notifications Banner */}
      <WaitingRoom />

      {/* Admin Settings Modal */}
      <RoomSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {!isInRoom && !isLobbyWaiting ? (
        /* ==================== 1. SETUP / HOME VIEW ==================== */
        <div className="flex-1 flex justify-center items-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-zinc-950">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-premium select-none">
            
            {/* Title / Logo */}
            <div className="flex items-center justify-center space-x-3 mb-8">
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20 text-rose-500">
                <Tv className="w-7 h-7" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-zinc-100">CinePair</span>
                <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">Co-Watch Cinema App</span>
              </div>
            </div>

            {/* View tab toggler */}
            <div className="flex bg-zinc-950 border border-zinc-800 p-1.5 rounded-2xl mb-6">
              <button
                onClick={() => { setSetupMode("create"); setSetupError(""); }}
                className={`flex-1 flex justify-center items-center py-2.5 rounded-xl text-xs font-semibold uppercase transition-all duration-200 ${
                  setupMode === "create"
                    ? "bg-zinc-900 border border-zinc-800 text-zinc-100 shadow-inner"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Room
              </button>
              <button
                onClick={() => { setSetupMode("join"); setSetupError(""); }}
                className={`flex-1 flex justify-center items-center py-2.5 rounded-xl text-xs font-semibold uppercase transition-all duration-200 ${
                  setupMode === "join"
                    ? "bg-zinc-900 border border-zinc-800 text-zinc-100 shadow-inner"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <LogIn className="w-4 h-4 mr-2" />
                Join Room
              </button>
            </div>

            {/* Error Message banner */}
            {setupError && (
              <div className="flex items-center space-x-2.5 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-2xl text-xs text-red-400 mb-6 animate-fade-in">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <p className="font-medium leading-normal">{setupError}</p>
              </div>
            )}

            {/* Setup Forms */}
            {setupMode === "create" ? (
              /* CREATE ROOM FORM */
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Enter nickname..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">Access Password (Optional)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Set passcode for security..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition-colors"
                  />
                </div>

                {/* Create Room Advanced Options toggles */}
                <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col space-y-0.5 max-w-[80%]">
                      <span className="text-xs font-bold text-zinc-300">Approval Lobby</span>
                      <span className="text-[10px] text-zinc-600 leading-normal">Require admin accept to join</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={requireApproval}
                        onChange={(e) => setRequireApproval(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4.5 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-rose-500 peer-checked:after:bg-white" />
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full flex justify-center items-center py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl text-xs font-semibold shadow-premium transition-colors duration-200 mt-2"
                >
                  Launch Co-Watch Room
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </form>
            ) : (
              /* JOIN ROOM FORM */
              <form onSubmit={handleJoinRoom} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">Room Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="Enter 6-character room code..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition-colors uppercase tracking-wider"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Enter nickname..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">Passcode (If required)</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter room passcode..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3.5 text-xs text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex justify-center items-center py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl text-xs font-semibold shadow-premium transition-colors duration-200 mt-2"
                >
                  Join Watch Party
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </form>
            )}
          </div>
        </div>
      ) : isLobbyWaiting ? (
        /* ==================== 2. LOBBY WAITING SCREEN ==================== */
        <div className="flex-1 flex flex-col justify-center items-center bg-zinc-950 select-none space-y-6">
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-full text-rose-500 animate-pulse">
            <LogIn className="w-8 h-8" />
          </div>
          <div className="flex flex-col space-y-1.5 text-center">
            <span className="text-sm font-bold text-zinc-200">Awaiting Admission...</span>
            <p className="text-xs text-zinc-600 max-w-[280px]">Your request has been sent to the room host. Please wait until they admit you.</p>
          </div>
          <button
            onClick={() => {
              socketService.leaveRoom();
            }}
            className="px-6 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel Request
          </button>
        </div>
      ) : (
        /* ==================== 3. ACTIVE WATCH ROOM ==================== */
        <div className="flex-1 flex h-full overflow-hidden">
          
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col p-4 md:p-6 space-y-4 md:space-y-6 min-w-0 h-full overflow-hidden">
            
            {/* Top Info Bar */}
            <div className="flex justify-between items-center bg-zinc-900/40 border border-zinc-900/60 p-4 rounded-3xl shrink-0 select-none">
              <div className="flex items-center space-x-3.5">
                <div className="p-2.5 bg-rose-500/15 border border-rose-500/25 rounded-2xl text-rose-500">
                  <Tv className="w-5 h-5 animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-zinc-200">CinePair Theatre</span>
                  <span className="text-[10px] text-zinc-500 font-medium flex items-center">
                    Room Code: <strong className="ml-1 text-zinc-300 font-semibold">{store.roomCode}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                {/* Screenshot capture trigger */}
                <button
                  onClick={handleCaptureScreenshot}
                  className="flex items-center space-x-2 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-semibold text-zinc-300 rounded-xl transition-all"
                  title="Capture Pinned View Frame"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Screengrab</span>
                </button>

                {/* Invite link copying trigger */}
                <button
                  onClick={handleCopyInvite}
                  className="flex items-center space-x-2 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-semibold text-zinc-300 rounded-xl transition-all"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{isCopied ? "Copied" : "Copy Code"}</span>
                </button>

                {/* Sidebar Chat toggler */}
                <button
                  onClick={() => store.toggleChat()}
                  className={`p-2.5 rounded-xl border transition-all ${
                    store.isChatOpen
                      ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                      : "bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <MessageSquare className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/* Central Stage */}
            <div className="flex-1 min-h-0">
              {/* Find pinned participant */}
              {(() => {
                const pinnedP = store.participants.find(p => p.id === store.pinnedId) || null;
                const pinnedStream = store.pinnedId 
                  ? store.pinnedId === currentSocketId 
                    ? store.localScreenStream || store.localStream
                    : store.peerStreams[store.pinnedId] || null
                  : null;
                const isPinnedLocal = store.pinnedId === currentSocketId;

                return (
                  <Stage
                    pinnedParticipant={pinnedP}
                    stream={pinnedStream}
                    isLocal={isPinnedLocal}
                    onToggleCam={handleToggleCam}
                    onToggleMic={handleToggleMic}
                    onToggleScreenShare={handleToggleScreenShare}
                    onLeaveRoom={socketService.leaveRoom}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                  />
                );
              })()}
            </div>

            {/* Bottom Participant strip */}
            <div className="flex items-center space-x-4 overflow-x-auto py-2 shrink-0 select-none">
              {store.participants.map((p) => {
                const isLocal = p.id === currentSocketId;
                const stream = isLocal 
                  ? store.localStream 
                  : store.peerStreams[p.id] || null;
                const isPinned = store.pinnedId === p.id;

                return (
                  <VideoTile
                    key={p.id}
                    participant={p}
                    stream={stream}
                    isLocal={isLocal}
                    isPinned={isPinned}
                    onPin={() => store.setPinnedId(isPinned ? null : p.id)}
                  />
                );
              })}
            </div>

          </div>

          {/* Right Collapsible Chat Sidebar */}
          <ChatSidebar />

        </div>
      )}
    </div>
  );
}

export default App;
