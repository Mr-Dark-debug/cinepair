import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Eye, EyeOff } from "lucide-react";
import { Participant, useRoomStore } from "../store/useRoomStore";
import { FloatingOverlay } from "./FloatingOverlay";

const pastelColors = [
  "bg-block-lime",
  "bg-block-lilac",
  "bg-block-cream",
  "bg-block-pink",
  "bg-block-mint",
  "bg-block-coral"
];

const getColorForName = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % pastelColors.length;
  return pastelColors[index];
};

interface StageProps {
  pinnedParticipant: Participant | null;
  stream: MediaStream | null;
  isLocal: boolean;
  onToggleCam: () => void;
  onToggleMic: () => void;
  onToggleScreenShare: () => void;
  onLeaveRoom: () => void;
}

export const Stage: React.FC<StageProps> = ({
  pinnedParticipant,
  stream,
  isLocal,
  onToggleCam,
  onToggleMic,
  onToggleScreenShare,
  onLeaveRoom
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const store = useRoomStore();

  const [stageBounds, setStageBounds] = useState<DOMRect | null>(null);

  // Retrieve Stage bounds dynamically
  const updateBounds = () => {
    if (stageRef.current) {
      setStageBounds(stageRef.current.getBoundingClientRect());
    }
  };

  useEffect(() => {
    updateBounds();
    window.addEventListener("resize", updateBounds);
    // Observe state changes as well to ensure render ticks update bounds
    const timer = setTimeout(updateBounds, 300);

    return () => {
      window.removeEventListener("resize", updateBounds);
      clearTimeout(timer);
    };
  }, [store.isChatOpen, store.participants.length]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
    } else {
      videoEl.srcObject = null;
    }

    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [stream]);

  const initials = pinnedParticipant
    ? pinnedParticipant.nickname.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()
    : "CP";

  // Check if anyone in the room is currently screen sharing (movie watching mode)
  const isMovieWatchingMode = store.participants.some((p) => p.screen_share_on) || store.screenShareEnabled;

  const hasVideo = !!(
    stream &&
    stream.getVideoTracks().length > 0 &&
    stream.getVideoTracks().some(track => track.readyState === 'live')
  );

  return (
    <div 
      ref={stageRef}
      className={`relative w-full h-full flex flex-col justify-center items-center overflow-hidden group transition-all duration-300 ${
        hasVideo ? "bg-zinc-950" : "bg-dot-grid"
      }`}
    >
      {/* 1. Main Video/Movie Stream Player - Always rendered, hidden via CSS */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-contain ${
          isLocal && !store.screenShareEnabled ? "transform scale-x-[-1]" : ""
        } ${
          hasVideo ? "opacity-100 visible" : "opacity-0 invisible absolute inset-0 pointer-events-none"
        }`}
      />
      {!hasVideo && (
        /* Large Placeholder when stream is absent - Premium Figma-style sticky-note card */
        <div className="flex flex-col justify-center items-center bg-block-cream border-2 border-primary rounded-lg p-8 max-w-sm text-center shadow-soft transform rotate-[-0.8deg] hover:rotate-0 hover:scale-[1.01] transition-all duration-300 select-none animate-fade-in">
          <div className={`flex justify-center items-center ${getColorForName(pinnedParticipant ? pinnedParticipant.nickname : "CinePair")} text-ink font-bold w-16 h-16 rounded-full border border-ink mb-4 shadow-sm`}>
            <span className="text-xl font-extrabold tracking-wider">{initials}</span>
          </div>
          <div className="space-y-2.5">
            <span className="text-[9px] text-zinc-500 font-bold font-mono uppercase tracking-widest block">STAGE LOBBY</span>
            <h3 className="text-base font-extrabold tracking-tight text-ink">
              {pinnedParticipant ? `${pinnedParticipant.nickname}'s Stage` : "CinePair Cinema"}
            </h3>
            <p className="text-[11px] text-zinc-600 font-medium leading-relaxed">
              {pinnedParticipant
                ? "This stream is currently paused or has no active video feed. Wait for them to resume!"
                : "Select a participant below to pin their camera, or click the Screen Share icon to stream a movie together!"}
            </p>
          </div>
        </div>
      )}

      {/* 2. Floating Draggable Camera Overlays Layer (Active Screen-Share watching mode only!) */}
      {isMovieWatchingMode && stageBounds && (
        <div className="absolute inset-0 pointer-events-none z-[75]">
          {store.participants.map((p) => {
            const isLocalP = p.nickname === store.nickname;
            
            // Check self view filter
            if (isLocalP && store.isSelfViewHidden) return null;
            
            // Render remote/local active streams
            const pStream = isLocalP 
              ? store.localStream 
              : store.peerStreams[p.id] || null;

            // Universal Profile Overlays: We render for everyone regardless of p.camera_on!
            // If camera_on is false, FloatingOverlay will display their custom initials profile badge!

            return (
              <div key={p.id} className="pointer-events-auto">
                <FloatingOverlay
                  participant={p}
                  stream={pStream}
                  isLocal={isLocalP}
                  stageBounds={stageBounds}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Top-Right Screen-watching status banner */}
      <div className="absolute top-3 right-3 sm:top-6 sm:right-6 flex items-center space-x-2 bg-canvas/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-hairline text-[9px] text-zinc-550 font-bold font-mono tracking-widest shadow-sm select-none hidden xs:flex z-20">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block mr-1" />
        <span>WATCH PARTY ON</span>
      </div>

      {/* 6. Central Overlay Control Deck (monochrome pill outline tool panel) */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center bg-canvas px-3 py-2.5 sm:px-5 sm:py-3 rounded-full border-2 border-ink space-x-2 sm:space-x-4 shadow-soft scale-75 sm:scale-90 md:scale-100 hover:scale-[1.02] transition-all duration-200 z-20">
        <button
          onClick={onToggleMic}
          className={`p-3 rounded-full border border-ink cursor-pointer transition-all duration-200 ${
            store.micEnabled
              ? "bg-canvas text-ink hover:bg-surface-soft"
              : "bg-block-pink text-ink hover:bg-red-200"
          }`}
          title={store.micEnabled ? "Mute Mic (M)" : "Unmute Mic (M)"}
        >
          {store.micEnabled ? <Mic className="w-4.5 h-4.5" /> : <MicOff className="w-4.5 h-4.5" />}
        </button>

        <button
          onClick={onToggleCam}
          className={`p-3 rounded-full border border-ink cursor-pointer transition-all duration-200 ${
            store.cameraEnabled
              ? "bg-canvas text-ink hover:bg-surface-soft"
              : "bg-block-pink text-ink hover:bg-red-200"
          }`}
          title={store.cameraEnabled ? "Stop Camera (V)" : "Start Camera (V)"}
        >
          {store.cameraEnabled ? <Video className="w-4.5 h-4.5" /> : <VideoOff className="w-4.5 h-4.5" />}
        </button>

        <button
          onClick={onToggleScreenShare}
          className={`p-3 rounded-full border border-ink cursor-pointer transition-all duration-200 ${
            store.screenShareEnabled
              ? "bg-ink text-canvas hover:bg-zinc-800"
              : "bg-canvas text-ink hover:bg-surface-soft"
          }`}
          title={store.screenShareEnabled ? "Stop Movie Share" : "Share Screen/Movie"}
        >
          <Monitor className="w-4.5 h-4.5" />
        </button>

        {/* Self View toggle inside control pill */}
        {isMovieWatchingMode && (
          <button
            onClick={() => store.toggleSelfView()}
            className={`p-3 rounded-full border border-ink cursor-pointer transition-all duration-200 ${
              !store.isSelfViewHidden
                ? "bg-canvas text-ink hover:bg-surface-soft"
                : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
            }`}
            title={!store.isSelfViewHidden ? "Hide My Floating View" : "Show My Floating View"}
          >
            {!store.isSelfViewHidden ? <Eye className="w-4.5 h-4.5" /> : <EyeOff className="w-4.5 h-4.5" />}
          </button>
        )}

        <div className="w-[1px] h-5 bg-ink" />

        <button
          onClick={onLeaveRoom}
          className="p-3 bg-rose-500 hover:bg-rose-600 rounded-full border border-ink text-white cursor-pointer transition-colors duration-200"
          title="Exit Watch Party"
        >
          <PhoneOff className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  );
};
