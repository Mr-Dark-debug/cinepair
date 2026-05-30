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
  AlertCircle,
  Settings,
  Sliders
} from "lucide-react";
import { check } from '@tauri-apps/plugin-updater';

import { useRoomStore } from "./store/useRoomStore";
import { useSocket } from "./hooks/useSocket";
import { useWebRTC } from "./hooks/useWebRTC";
import { useAudioMixer } from "./hooks/useAudioMixer";

// Import Components
import logoDarkMode from "./assets/logo dark mode.png";
import logoLightMode from "./assets/logo light mode.png";
import { VideoTile } from "./components/VideoTile";
import { Stage } from "./components/Stage";
import { ChatSidebar } from "./components/ChatSidebar";
import { WaitingRoom } from "./components/WaitingRoom";
import { RoomSettings } from "./components/RoomSettings";
import { AppSettings } from "./components/AppSettings";
import { EmojiReactionOverlay } from "./components/EmojiReactionOverlay";

function App() {
  const store = useRoomStore();
  const socketService = useSocket();
  
  // Initialize P2P mesh network listeners
  useWebRTC();
  const audioMixer = useAudioMixer();

  // App settings modal state
  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false);

  // Check for updates on startup if autoCheckUpdates is enabled
  useEffect(() => {
    if (!store.autoCheckUpdates) {
      store.setUpdaterStatus("idle");
      return;
    }

    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
    if (!isTauri) {
      store.setUpdaterStatus("done");
      return;
    }

    const checkForUpdates = async () => {
      try {
        store.setUpdaterStatus("checking");
        const update = await check();
        if (update && update.available) {
          store.setUpdaterInfo(update);
          store.setUpdaterStatus("available");
          setIsAppSettingsOpen(true);
        } else {
          store.setUpdaterStatus("done");
        }
      } catch (err) {
        console.error("Auto-updater check failed:", err);
        store.setUpdaterStatus("done");
      }
    };

    checkForUpdates();
  }, [store.autoCheckUpdates]);

  // Setup form states
  const [setupMode, setSetupMode] = useState<"choice" | "create" | "join">("choice");

  // Stateful Dark/Light Theme management synchronized with localStorage and document body
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    return saved === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.body.classList.add("dark-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
    }
  }, [theme]);

  // wizard step states for Create and Join flows
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [joinStep, setJoinStep] = useState<1 | 2>(1);

  // Reset wizard steps when setupMode changes
  useEffect(() => {
    setCreateStep(1);
    setJoinStep(1);
  }, [setupMode]);
  const [nickname, setNickname] = useState(store.defaultNickname);
  const [roomCode, setRoomCode] = useState("");
  const [password, setPassword] = useState("");

  // Sync nickname with defaultNickname from store
  useEffect(() => {
    setNickname(store.defaultNickname);
  }, [store.defaultNickname]);
  
  // Admin setup defaults
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [requireApproval, setRequireApproval] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [setupError, setSetupError] = useState("");

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
      
      const cameraPref = store.defaultCameraOn;
      const micPref = store.defaultMicOn;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = cameraPref;
      }
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = micPref;
      }

      store.setLocalStream(stream);
      store.setCameraEnabled(cameraPref);
      store.setMicEnabled(micPref);
      
      socketService.updateMedia({ cameraOn: cameraPref, micOn: micPref });
      return stream;
    } catch (err) {
      console.error("Failed to capture local media tracks:", err);
      // Fallback: request audio only if camera is blocked
      try {
        const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true }
        });
        
        const micPref = store.defaultMicOn;
        const audioTrack = audioOnlyStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = micPref;
        }

        store.setLocalStream(audioOnlyStream);
        store.setMicEnabled(micPref);
        socketService.updateMedia({ cameraOn: false, micOn: micPref });
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
      stopScreenSharing();
    } else {
      try {
        console.log("Requesting screen capture stream...");
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });

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
          }
        }

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
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const base64Data = canvas.toDataURL("image/png");
        
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
    } else {
      setSetupError(res.error || "Failed to join room.");
    }
  };

  const handleCopyInvite = () => {
    if (store.roomCode) {
      navigator.clipboard.writeText(store.roomCode);
      setIsCopied(true);
      store.addToast("Room Code copied to clipboard!");
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const currentSocketId = socketService.getSocket()?.id;
  const isInRoom = store.roomCode !== null;
  const isLobbyWaiting = store.isWaiting;
  const isMovieWatchingMode = store.participants.some((p) => p.screen_share_on) || store.screenShareEnabled;

  // Show welcome toast when entering room
  useEffect(() => {
    if (isInRoom) {
      store.addToast("Welcome to CinePair! Open the chat sidebar, share screens, or toggle overlays.");
    }
  }, [isInRoom]);

  // Auto-pin the screen-sharing participant when movie watching mode activates
  useEffect(() => {
    if (!isMovieWatchingMode) return;
    
    // If already pinned, don't override
    if (store.pinnedId !== null) return;
    
    // Find the participant who is screen sharing
    const screenSharer = store.participants.find((p) => p.screen_share_on);
    if (screenSharer) {
      store.setPinnedId(screenSharer.id);
    } else if (store.screenShareEnabled && currentSocketId) {
      // Local user is sharing
      store.setPinnedId(currentSocketId);
    }
  }, [isMovieWatchingMode, store.participants, store.screenShareEnabled]);

  // Bind global keyboard shortcuts for mic and camera toggling
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if user is typing in form inputs or textareas
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "m") {
        e.preventDefault();
        handleToggleMic();
        store.addToast(!store.micEnabled ? "🎤 Microphone Active" : "🔇 Microphone Muted");
      } else if (key === "v") {
        e.preventDefault();
        handleToggleCam();
        store.addToast(!store.cameraEnabled ? "📷 Camera Enabled" : "🚫 Camera Disabled");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [store.micEnabled, store.cameraEnabled, store.localStream]);

  return (
    <div className="h-screen w-screen flex flex-col bg-surface-soft text-ink font-sans overflow-hidden">
      
      {/* Toast Notifications Overlay */}
      <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col space-y-2 pointer-events-none select-none max-w-md w-full px-4">
        {store.toasts.map((t) => (
          <div
            key={t.id}
            className="px-4.5 py-3 bg-canvas border-2 border-ink text-ink font-black text-xs rounded-xl shadow-soft flex items-center justify-center space-x-2 animate-fade-in pointer-events-auto rotate-[0.5deg]"
          >
            <span>ℹ️</span>
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* Floating Reactions */}
      <EmojiReactionOverlay />
      
      {/* Admins Join Requests Notifications */}
      <WaitingRoom />

      {/* Admin Settings Modal */}
      <RoomSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {!isInRoom && !isLobbyWaiting ? (
        <div className="flex-1 bg-dot-grid flex flex-col min-h-0 w-full relative">
          
          {/* Unified Brand Header: Logo on Left, Theme Toggle on Right */}
          <header className="w-full absolute top-0 left-0 right-0 h-20 px-6 md:px-12 flex justify-between items-center select-none z-30 pointer-events-none">
            {/* Brand Logo (Left Top) */}
            <div className="flex flex-col items-start pointer-events-auto mt-4">
              <a href="#" className="flex items-center space-x-2 group">
                <img 
                  src={theme === "dark" ? logoDarkMode : logoLightMode} 
                  alt="CinePair Logo" 
                  className="h-8 w-auto shrink-0 transition-transform duration-200 group-hover:scale-[1.02]" 
                />
              </a>
              <span className="text-[7px] text-zinc-550 font-extrabold font-mono uppercase tracking-widest mt-0.5 block">
                Co-Watch Cinema Playground
              </span>
            </div>

            {/* Premium App Settings (Right Top) */}
            <div className="pointer-events-auto flex items-center space-x-3 mt-4">
              <button
                onClick={() => setIsAppSettingsOpen(true)}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-ink bg-canvas hover:bg-surface-soft text-ink text-[11px] font-extrabold transition-all shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                aria-label="App Settings"
              >
                <Settings className="w-3.5 h-3.5 text-ink shrink-0" />
                <span>Settings</span>
              </button>
            </div>
          </header>

          {/* Setup Cards View Container */}
          <div className="flex-1 flex flex-col justify-center items-center p-6 pt-24 md:p-12 md:pt-24 min-h-0 w-full overflow-y-auto">
            {setupMode === "choice" ? (
              /* CHOICE STEP */
              <div className="flex flex-col items-center w-full max-w-4xl mx-auto my-auto animate-fade-in">
                {/* Side-by-side selection cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                  {/* Create Watch Room Card */}
                  <div 
                    onClick={() => { setSetupMode("create"); setSetupError(""); }}
                    className="flex flex-col justify-between bg-block-lime border-2 border-primary rounded-lg p-8 shadow-soft rotate-[-0.8deg] hover:rotate-0 hover:scale-[1.02] cursor-pointer transition-all duration-300 group"
                  >
                    <div>
                      <div className="w-12 h-12 flex items-center justify-center bg-canvas border border-ink rounded-full text-ink mb-6 group-hover:scale-110 transition-transform duration-250 shadow-sm">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span className="text-[9px] text-zinc-500 font-bold font-mono uppercase tracking-widest block mb-1">HOST A PARTY</span>
                      <h3 className="text-2xl font-black tracking-tight text-ink mb-3">Create Room</h3>
                      <p className="text-xs text-zinc-750 font-bold leading-relaxed mb-6">
                        Set up a fresh watch room, choose a passcode, toggle the entry approval lobby, adjust player capacity, and stream movies in real-time with friends.
                      </p>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <span className="px-5 py-2.5 bg-ink text-canvas border border-ink hover:bg-zinc-800 text-[11px] font-black rounded-full font-sans uppercase tracking-wider flex items-center shadow-sm">
                        Start Room <ArrowRight className="w-4 h-4 ml-2" />
                      </span>
                    </div>
                  </div>

                  {/* Join Watch Room Card */}
                  <div 
                    onClick={() => { setSetupMode("join"); setSetupError(""); }}
                    className="flex flex-col justify-between bg-block-lilac border-2 border-primary rounded-lg p-8 shadow-soft rotate-[0.8deg] hover:rotate-0 hover:scale-[1.02] cursor-pointer transition-all duration-300 group"
                  >
                    <div>
                      <div className="w-12 h-12 flex items-center justify-center bg-canvas border border-ink rounded-full text-ink mb-6 group-hover:scale-110 transition-transform duration-250 shadow-sm">
                        <LogIn className="w-5 h-5" />
                      </div>
                      <span className="text-[9px] text-zinc-500 font-bold font-mono uppercase tracking-widest block mb-1">JOIN FRIENDS</span>
                      <h3 className="text-2xl font-black tracking-tight text-ink mb-3">Join Room</h3>
                      <p className="text-xs text-zinc-750 font-bold leading-relaxed mb-6">
                        Enter a 6-digit room code shared by your partner or friend, put in the optional room passcode, and immediately enter the synchronized co-watch room.
                      </p>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <span className="px-5 py-2.5 bg-canvas text-ink border border-ink hover:bg-surface-soft text-[11px] font-black rounded-full font-sans uppercase tracking-wider flex items-center shadow-sm">
                        Enter Room <ArrowRight className="w-4 h-4 ml-2" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : setupMode === "create" ? (
              /* CREATE STEP WIZARD */
              <div className="w-full max-w-lg bg-block-cream border-2 border-primary rounded-lg p-6 md:p-8 shadow-soft rotate-[-0.3deg] animate-fade-in relative my-auto">
                {/* Header Row with Inline Back Button & Step Indicators */}
                <div className="flex justify-between items-center mb-6 border-b border-ink/10 pb-4 select-none">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-2">
                      <Tv className="w-4 h-4 text-ink shrink-0" />
                      <span className="text-[10px] font-black text-ink uppercase tracking-widest font-mono">Create Watch Room</span>
                    </div>
                    {/* Minimal Progress Trace */}
                    <div className="flex items-center space-x-1 text-[8px] font-bold text-zinc-550 font-mono uppercase tracking-wider mt-0.5 animate-fade-in">
                      <span className={createStep === 1 ? "text-ink font-black underline decoration-2 underline-offset-4" : "opacity-50"}>1. Name</span>
                      <span className="opacity-30">/</span>
                      <span className={createStep === 2 ? "text-ink font-black underline decoration-2 underline-offset-4" : "opacity-50"}>2. Settings</span>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      if (createStep === 2) {
                        setCreateStep(1);
                      } else {
                        setSetupMode("choice");
                        setSetupError("");
                      }
                    }}
                    className="px-3 py-1 bg-canvas border border-ink hover:bg-surface-soft text-[9px] font-black text-ink rounded-full font-mono uppercase tracking-wider shadow-sm cursor-pointer transition-colors"
                  >
                    ← Back
                  </button>
                </div>

                {/* Error Message banner */}
                {setupError && (
                  <div className="flex items-center space-x-2.5 bg-block-pink border border-ink px-4 py-3 rounded-md text-xs text-ink mb-6 animate-fade-in font-bold">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0 text-rose-600" />
                    <p className="leading-normal">{setupError}</p>
                  </div>
                )}

                {createStep === 1 ? (
                  /* STEP 1: Nickname input */
                  <div className="space-y-5 animate-fade-in">
                    <div className="space-y-1">
                      <h3 className="text-xl font-black tracking-tight text-ink">What should we call you?</h3>
                      <p className="text-xs text-zinc-750 font-bold leading-normal">
                        Choose a display name that friends will see when they join the cinema playground.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest pl-1 font-mono">Your Display Nickname</label>
                      <input
                        type="text"
                        required
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="Enter nickname..."
                        className="w-full bg-canvas border border-ink rounded px-4 py-3 text-xs text-ink placeholder-zinc-450 focus:outline-none focus:border-2 focus:border-ink transition-all font-bold shadow-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && nickname.trim()) {
                            e.preventDefault();
                            setCreateStep(2);
                          }
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={!nickname.trim()}
                      onClick={() => setCreateStep(2)}
                      className="w-full flex justify-center items-center py-4 bg-ink hover:bg-zinc-800 text-canvas rounded-full text-xs font-black shadow-sm transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next: Customize Room
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </button>
                  </div>
                ) : (
                  /* STEP 2: Customize settings & submit */
                  <form onSubmit={handleCreateRoom} className="space-y-5 animate-fade-in">
                    <div className="space-y-1">
                      <h3 className="text-xl font-black tracking-tight text-ink">Customize your room</h3>
                      <p className="text-xs text-zinc-750 font-bold leading-normal">
                        Set a passcode, manage visitor slot capacity, and toggle the access approval queue.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest pl-1 font-mono">Access Passcode (Optional)</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Set secure room passcode..."
                        className="w-full bg-canvas border border-ink rounded px-4 py-3 text-xs text-ink placeholder-zinc-450 focus:outline-none focus:border-2 focus:border-ink transition-all font-bold shadow-sm"
                      />
                    </div>

                    {/* Room Capacity Slider */}
                    <div className="space-y-2 bg-canvas border border-ink p-4 rounded-md shadow-sm">
                      <label className="flex items-center justify-between text-[9px] font-bold text-zinc-550 font-mono uppercase tracking-widest">
                        <span>Room Capacity Limit</span>
                        <span className="bg-ink text-canvas border border-ink px-2 py-0.5 rounded text-[8px] font-bold">{maxParticipants} Users</span>
                      </label>
                      <input
                        type="range"
                        min="2"
                        max="30"
                        value={maxParticipants}
                        onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
                        className="w-full h-1 bg-hairline rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <div className="flex justify-between text-[8px] text-zinc-500 font-bold font-mono">
                        <span>2 USERS</span>
                        <span>30 USERS</span>
                      </div>
                    </div>

                    {/* Lobby Switcher - Lime Block */}
                    <div className="bg-block-lime border border-ink p-4 rounded-md rotate-[0.5deg] flex items-center justify-between shadow-sm">
                      <div className="flex flex-col space-y-0.5 max-w-[75%]">
                        <span className="text-xs font-black text-ink">Approval Lobby</span>
                        <span className="text-[9px] text-zinc-700 leading-normal font-bold">Require host permission to enter</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={requireApproval}
                          onChange={(e) => setRequireApproval(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4.5 bg-canvas border border-ink rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-zinc-800 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-ink peer-checked:after:bg-canvas" />
                      </label>
                    </div>

                    <button
                      type="submit"
                      className="w-full flex justify-center items-center py-4 bg-ink hover:bg-zinc-800 text-canvas rounded-full text-xs font-black shadow-sm transition-colors duration-200 cursor-pointer"
                    >
                      Launch Watch Party
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* JOIN STEP WIZARD */
              <div className="w-full max-w-md bg-block-pink border-2 border-primary rounded-lg p-6 md:p-8 shadow-soft rotate-[0.3deg] animate-fade-in relative my-auto">
                {/* Header Row with Inline Back Button & Step Indicators */}
                <div className="flex justify-between items-center mb-6 border-b border-ink/10 pb-4 select-none">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center space-x-2">
                      <LogIn className="w-4 h-4 text-ink shrink-0" />
                      <span className="text-[10px] font-black text-ink uppercase tracking-widest font-mono">Join Watch Room</span>
                    </div>
                    {/* Minimal Progress Trace */}
                    <div className="flex items-center space-x-1 text-[8px] font-bold text-zinc-550 font-mono uppercase tracking-wider mt-0.5 animate-fade-in">
                      <span className={joinStep === 1 ? "text-ink font-black underline decoration-2 underline-offset-4" : "opacity-50"}>1. Code</span>
                      <span className="opacity-30">/</span>
                      <span className={joinStep === 2 ? "text-ink font-black underline decoration-2 underline-offset-4" : "opacity-50"}>2. Details</span>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      if (joinStep === 2) {
                        setJoinStep(1);
                      } else {
                        setSetupMode("choice");
                        setSetupError("");
                      }
                    }}
                    className="px-3 py-1 bg-canvas border border-ink hover:bg-surface-soft text-[9px] font-black text-ink rounded-full font-mono uppercase tracking-wider shadow-sm cursor-pointer transition-colors"
                  >
                    ← Back
                  </button>
                </div>

                {/* Error Message banner */}
                {setupError && (
                  <div className="flex items-center space-x-2.5 bg-block-cream border border-ink px-4 py-3 rounded-md text-xs text-ink mb-6 animate-fade-in font-bold">
                    <AlertCircle className="w-4.5 h-4.5 shrink-0 text-rose-600" />
                    <p className="leading-normal">{setupError}</p>
                  </div>
                )}

                {joinStep === 1 ? (
                  /* STEP 1: Enter 6-digit room code */
                  <div className="space-y-5 animate-fade-in">
                    <div className="space-y-1">
                      <h3 className="text-xl font-black tracking-tight text-ink">Enter room code</h3>
                      <p className="text-xs text-zinc-750 font-bold leading-normal">
                        Type the 6-digit room code shared by your friend to join their Cinema Party.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest pl-1 font-mono">Room Code</label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        placeholder="ENTER 6-DIGIT CODE"
                        className="w-full bg-canvas border border-ink text-center rounded px-4 py-4 text-lg font-black text-ink uppercase tracking-widest placeholder-zinc-350 focus:outline-none focus:border-2 focus:border-ink transition-all shadow-sm font-bold"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && roomCode.trim().length === 6) {
                            e.preventDefault();
                            setJoinStep(2);
                          }
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={roomCode.trim().length !== 6}
                      onClick={() => setJoinStep(2)}
                      className="w-full flex justify-center items-center py-4 bg-ink hover:bg-zinc-800 text-canvas rounded-full text-xs font-black shadow-sm transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next: Choose nickname
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </button>
                  </div>
                ) : (
                  /* STEP 2: Name and optional passcode */
                  <form onSubmit={handleJoinRoom} className="space-y-4 animate-fade-in">
                    <div className="space-y-1">
                      <h3 className="text-xl font-black tracking-tight text-ink">Choose Display Name</h3>
                      <p className="text-xs text-zinc-750 font-bold leading-normal">
                        Enter your display nickname and the room passcode if required.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest pl-1 font-mono">Your Display Name</label>
                      <input
                        type="text"
                        required
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="Enter nickname..."
                        className="w-full bg-canvas border border-ink rounded px-4 py-3 text-xs text-ink placeholder-zinc-400 focus:outline-none focus:border-2 focus:border-ink transition-all font-bold shadow-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest pl-1 font-mono">Passcode (If required)</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter room passcode..."
                        className="w-full bg-canvas border border-ink rounded px-4 py-3 text-xs text-ink placeholder-zinc-400 focus:outline-none focus:border-2 focus:border-ink transition-all font-bold shadow-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!nickname.trim()}
                      className="w-full flex justify-center items-center py-4 bg-ink hover:bg-zinc-800 text-canvas rounded-full text-xs font-black shadow-sm transition-colors duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Join Watch Party
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      ) : isLobbyWaiting ? (
        /* ==================== 2. LOBBY WAITING SCREEN ==================== */
        <div className="flex-1 flex flex-col justify-center items-center bg-surface-soft select-none space-y-6">
          <div className="p-4 bg-block-pink border border-hairline rounded-full text-ink animate-pulse">
            <LogIn className="w-8 h-8" />
          </div>
          <div className="flex flex-col space-y-2 text-center max-w-sm">
            <span className="text-[10px] font-extrabold text-ink uppercase tracking-widest font-mono">Awaiting Admission...</span>
            <h2 className="text-xl font-extrabold text-ink leading-tight">Host is reviewing your join request</h2>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed px-4">Your details have been sent to the watch room owner. You'll be automatically admitted once they approve!</p>
          </div>
          <button
            onClick={() => {
              socketService.leaveRoom();
            }}
            className="px-6 py-3 bg-canvas border border-hairline hover:border-zinc-350 rounded-full text-xs text-ink font-bold shadow-premium cursor-pointer transition-colors"
          >
            Cancel Request
          </button>
        </div>      ) : (
        /* ==================== 3. ACTIVE WATCH ROOM ==================== */
        <div className="flex-1 flex h-full overflow-hidden">
                  
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-surface-soft">
            
            {/* Top Info Bar */}
            <div className="flex justify-between items-center h-14 bg-canvas border-b border-hairline px-6 shrink-0 select-none shadow-sm z-10">
              
              {/* Brand Logo and Name + Room Code */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 group">
                  <img 
                    src={theme === "dark" ? logoDarkMode : logoLightMode} 
                    alt="CinePair Logo" 
                    className="h-6 w-auto shrink-0" 
                  />
                </div>
                
                {/* Minimalist Room Code Badge */}
                <div className="flex items-center space-x-1.5 bg-surface-soft border border-hairline rounded-full px-2.5 py-1 text-[10px] font-mono font-bold">
                  <span className="text-zinc-550">ROOM:</span>
                  <span className="text-ink font-black">{store.roomCode}</span>
                </div>

                {/* Minimalist Participant Count Badge */}
                <div className="flex items-center space-x-1.5 bg-surface-soft border border-hairline rounded-full px-2.5 py-1 text-[10px] font-mono font-bold">
                  <span className="text-zinc-550">PEOPLE:</span>
                  <span className="text-ink font-black">{store.participants.length}</span>
                </div>

                {/* Premium Relaunch/Restart to Update Badge (Visible in meetings!) */}
                {store.updaterStatus === "downloaded" && (
                  <button
                    onClick={async () => {
                      const { relaunch } = await import("@tauri-apps/plugin-process");
                      await relaunch();
                    }}
                    className="flex items-center space-x-1.5 bg-block-lime hover:bg-lime-200 border-2 border-ink rounded-full px-3 py-1 text-[9px] font-mono font-black text-ink shadow-sm animate-pulse cursor-pointer shrink-0 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    title="An update has been installed! Click to relaunch and apply."
                  >
                    <span className="w-1.5 h-1.5 bg-ink rounded-full" />
                    <span>RELAUNCH TO UPDATE 🚀</span>
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                {/* Screengrab trigger */}
                <button
                  onClick={handleCaptureScreenshot}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-canvas hover:bg-surface-soft border border-hairline text-[9px] font-bold text-ink rounded-full transition-all uppercase tracking-wider font-mono cursor-pointer shadow-sm active:scale-[0.98]"
                  title="Capture Stage View Frame"
                >
                  <Camera className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Screengrab</span>
                </button>

                {/* Invite link copying trigger */}
                <button
                  onClick={handleCopyInvite}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-canvas hover:bg-surface-soft border border-hairline text-[9px] font-bold text-ink rounded-full transition-all uppercase tracking-wider font-mono cursor-pointer shadow-sm active:scale-[0.98]"
                  title="Copy Room Code"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-ink" />}
                  <span className="hidden sm:inline">{isCopied ? "Copied" : "Copy Code"}</span>
                </button>

                {/* Room settings slider icon (host only) */}
                {store.isAdmin && (
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2 bg-canvas hover:bg-surface-soft border border-hairline text-zinc-500 hover:text-ink rounded-full transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                    title="Room Configuration (Host Only)"
                  >
                    <Sliders className="w-4 h-4 shrink-0" />
                  </button>
                )}

                {/* App settings button */}
                <button
                  onClick={() => setIsAppSettingsOpen(true)}
                  className="p-2 bg-canvas hover:bg-surface-soft border border-hairline text-zinc-500 hover:text-ink rounded-full transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                  title="App Settings"
                >
                  <Settings className="w-4 h-4 shrink-0" />
                </button>

                {/* Sidebar Chat toggler with unread badge */}
                <button
                  onClick={() => store.toggleChat()}
                  className={`relative p-2 rounded-full border cursor-pointer transition-all shadow-sm ${
                    store.isChatOpen
                      ? "bg-primary border-primary text-on-primary hover:bg-zinc-900"
                      : "bg-canvas hover:bg-surface-soft border-hairline text-zinc-500 hover:text-ink"
                  }`}
                  title="Toggle Chat Sidebar"
                >
                  <MessageSquare className="w-4 h-4" />
                  {/* Unread message notification badge */}
                  {!store.isChatOpen && store.unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[8px] font-black min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-canvas shadow-sm animate-bounce">
                      {store.unreadCount > 99 ? '99+' : store.unreadCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Viewport content area */}
            <div className="flex-1 flex flex-col min-h-0 relative bg-surface-soft">
              
              {/* Google Meet Responsive Grid or Pinned Stage view */}
              {!isMovieWatchingMode && store.pinnedId === null ? (
                <div className="flex-1 min-h-0 overflow-y-auto bg-surface-soft flex items-center justify-center p-6">
                  <div className={`w-full max-w-6xl mx-auto h-full max-h-[80vh] ${
                    store.participants.length === 1
                      ? "flex items-center justify-center"
                      : store.participants.length === 2
                      ? "grid grid-cols-1 md:grid-cols-2 gap-6"
                      : store.participants.length === 3
                      ? "grid grid-cols-1 md:grid-cols-3 gap-6"
                      : store.participants.length === 4
                      ? "grid grid-cols-2 gap-6"
                      : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                  }`}>
                    {store.participants.map((p) => {
                      const isLocal = p.id === currentSocketId;
                      const stream = isLocal ? store.localStream : store.peerStreams[p.id] || null;
                      const isPinned = store.pinnedId === p.id;
                      
                      return (
                        <div 
                          key={p.id} 
                          className={`w-full h-full aspect-video ${
                            store.participants.length === 1 ? "max-w-2xl" : ""
                          }`}
                        >
                          <VideoTile
                            participant={p}
                            stream={stream}
                            isLocal={isLocal}
                            isPinned={isPinned}
                            onPin={() => store.setPinnedId(isPinned ? null : p.id)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  {/* Central Stage */}
                  <div className="flex-1 min-h-0 relative">
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
                        />
                      );
                    })()}
                  </div>

                  {/* Bottom Participant strip */}
                  {!isMovieWatchingMode && (
                    <div className="h-32 bg-transparent border-t border-hairline/35 flex items-center px-6 overflow-x-auto space-x-6 py-3 shrink-0 select-none z-10">
                      {store.participants.map((p) => {
                        const isLocal = p.id === currentSocketId;
                        const stream = isLocal 
                          ? store.localStream 
                          : store.peerStreams[p.id] || null;
                        const isPinned = store.pinnedId === p.id;

                        return (
                          <div key={p.id} className="w-24 h-24 shrink-0">
                            <VideoTile
                              participant={p}
                              stream={stream}
                              isLocal={isLocal}
                              isPinned={isPinned}
                              onPin={() => store.setPinnedId(isPinned ? null : p.id)}
                              flat={true}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

          </div>

          {/* Right Collapsible Chat Sidebar */}
          <ChatSidebar />

        </div>
      )}

      {/* 4. PREMIUM APP SETTINGS MODAL */}
      <AppSettings 
        isOpen={isAppSettingsOpen} 
        onClose={() => setIsAppSettingsOpen(false)} 
        theme={theme}
        setTheme={setTheme}
      />
    </div>
  );
}

export default App;

