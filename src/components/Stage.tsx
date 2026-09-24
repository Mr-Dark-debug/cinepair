import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Eye, EyeOff, MessageSquare, Send, Volume2, PictureInPicture2, Brush } from "lucide-react";
import { Participant, useRoomStore } from "../store/useRoomStore";
import { FloatingOverlay } from "./FloatingOverlay";
import { DoodleOverlay } from "./DoodleOverlay";
import { PixelAvatar } from "./PixelAvatar";
import { useSocket } from "../hooks/useSocket";

interface StageProps {
  pinnedParticipant: Participant | null;
  stream: MediaStream | null;
  isLocal: boolean;
  onToggleCam: () => void;
  onToggleMic: () => void;
  onToggleScreenShare: () => void;
  onLeaveRoom: () => void;
  isDoodleOpen?: boolean;
  onToggleDoodle?: () => void;
}

export const Stage: React.FC<StageProps> = ({
  pinnedParticipant,
  stream,
  isLocal,
  onToggleCam,
  onToggleMic,
  onToggleScreenShare,
  onLeaveRoom,
  isDoodleOpen = false,
  onToggleDoodle,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const store = useRoomStore();
  const socketService = useSocket();
  const currentSocketId = socketService.getSocket()?.id;

  const [stageBounds, setStageBounds] = useState<DOMRect | null>(null);
  const [compactText, setCompactText] = useState("");
  const [compactSending, setCompactSending] = useState(false);

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

    const volumes = pinnedParticipant ? store.peerAudioVolumes[pinnedParticipant.id] : null;
    const stageVolume = pinnedParticipant?.screen_share_on
      ? volumes?.screen ?? 1
      : volumes?.mic ?? 1;
    videoEl.volume = isLocal ? 0 : stageVolume;

    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [stream, isLocal, pinnedParticipant?.id, pinnedParticipant?.screen_share_on, store.peerAudioVolumes]);

  const handleCompactSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = compactText.trim();
    if (!message || compactSending) return;
    setCompactSending(true);
    try {
      await socketService.sendSecureChat(message, null);
      setCompactText((current) => current.trim() === message ? "" : current);
    } catch (error) {
      store.addToast(error instanceof Error ? error.message : "Message was not sent.");
    } finally {
      setCompactSending(false);
    }
  };

  const handleStagePip = async () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    try {
      if ((document as any).pictureInPictureElement) {
        await (document as any).exitPictureInPicture();
      } else if (typeof (videoEl as any).requestPictureInPicture === "function") {
        await (videoEl as any).requestPictureInPicture();
      } else {
        store.addToast("Picture-in-picture not supported in this window.");
      }
    } catch (err) {
      console.error("Stage PiP failed:", err);
      store.addToast("Could not enter picture-in-picture.");
    }
  };

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
        hasVideo ? "bg-zinc-950" : "stage-empty"
      }`}
    >
      {/* 1. Main Video/Movie Stream Player - Always rendered, hidden via CSS */}
      <video
        id="cinepair-stage-video"
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
        <div className="stage-placeholder select-none animate-fade-in">
          <PixelAvatar seed={pinnedParticipant?.avatar_seed || pinnedParticipant?.nickname || "CinePair"} palette={pinnedParticipant?.avatar_palette || store.defaultAvatarPalette} size={80} animated />
          <p className="eyebrow">THE ROOM IS YOURS</p>
          <h3>{pinnedParticipant?.nickname ? `${pinnedParticipant.nickname} is taking a break` : "Settle in together"}</h3>
          <p>{pinnedParticipant?.nickname ? "Their camera or shared screen is off for now." : "Pin a camera below, share your screen, or open Watch to play a video in sync."}</p>
        </div>
      )}

      {/* 2. Floating Draggable Camera Overlays Layer (Active Screen-Share watching mode only!) */}
      {isMovieWatchingMode && stageBounds && (
        <div className="absolute inset-0 pointer-events-none z-[55]">
          {store.participants.map((p) => {
            const isLocalP = p.id === currentSocketId;
            
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

      {isDoodleOpen && onToggleDoodle && <DoodleOverlay onClose={onToggleDoodle} />}

      {/* 4. Top-Right Screen-watching status banner */}
      {isMovieWatchingMode && <div className="stage-sharing-status"><span /> Screen sharing</div>}

      {!isLocal && pinnedParticipant && (
        <div className="absolute bottom-24 right-4 sm:right-6 w-64 bg-canvas/95 backdrop-blur-md border-2 border-ink rounded-2xl p-3 shadow-soft z-20 space-y-3">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest font-mono text-ink">
            <Volume2 className="w-3.5 h-3.5" />
            <span>Remote Audio Mix</span>
          </div>
          <label className="flex flex-col gap-1 text-[9px] font-bold text-zinc-600 uppercase tracking-wider font-mono">
            Voice {Math.round((store.peerAudioVolumes[pinnedParticipant.id]?.mic ?? 1) * 100)}%
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={store.peerAudioVolumes[pinnedParticipant.id]?.mic ?? 1}
              onChange={(e) => store.setPeerMicVolume(pinnedParticipant.id, Number(e.target.value))}
              className="w-full accent-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-[9px] font-bold text-zinc-600 uppercase tracking-wider font-mono">
            Screen {Math.round((store.peerAudioVolumes[pinnedParticipant.id]?.screen ?? 1) * 100)}%
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={store.peerAudioVolumes[pinnedParticipant.id]?.screen ?? 1}
              onChange={(e) => store.setPeerScreenVolume(pinnedParticipant.id, Number(e.target.value))}
              className="w-full accent-ink"
            />
          </label>
        </div>
      )}

      {store.isCompactChatOpen && !store.isChatOpen && (
        <form
          onSubmit={handleCompactSend}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 w-[min(92vw,460px)] bg-canvas border-2 border-ink rounded-2xl shadow-soft p-2.5 flex items-center gap-2 z-30"
        >
          <MessageSquare className="w-4 h-4 text-ink shrink-0 ml-1" />
          <input
            aria-label="Quick chat message"
            value={compactText}
            onChange={(e) => setCompactText(e.target.value)}
            placeholder="Quick chat while watching..."
            className="flex-1 bg-surface-soft border border-hairline rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-ink"
          />
          <button
            type="submit"
            disabled={compactSending || !compactText.trim()}
            className="p-2 bg-ink text-canvas rounded-xl hover:bg-zinc-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={compactSending ? "Sending message" : "Send compact chat message"}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* 6. Central Overlay Control Deck (monochrome pill outline tool panel) */}
      <div className="stage-controls absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center bg-canvas rounded-full border border-hairline shadow-soft z-20">
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

        {isMovieWatchingMode && !store.isChatOpen && (
          <button
            onClick={() => store.toggleCompactChat()}
            className={`p-3 rounded-full border border-ink cursor-pointer transition-all duration-200 ${
              store.isCompactChatOpen
                ? "bg-block-lime text-ink"
                : "bg-canvas text-ink hover:bg-surface-soft"
            }`}
            title={store.isCompactChatOpen ? "Hide Compact Chat" : "Show Compact Chat"}
          >
            <MessageSquare className="w-4.5 h-4.5" />
          </button>
        )}

        {hasVideo && (
          <button
            onClick={handleStagePip}
            className="p-3 rounded-full border border-ink bg-canvas text-ink hover:bg-surface-soft cursor-pointer transition-all duration-200"
            title="Floating picture-in-picture"
          >
            <PictureInPicture2 className="w-4.5 h-4.5" />
          </button>
        )}

        {onToggleDoodle && (
          <button
            onClick={onToggleDoodle}
            className={`p-3 rounded-full border border-ink cursor-pointer transition-all duration-200 ${
              isDoodleOpen ? "bg-block-lime text-ink" : "bg-canvas text-ink hover:bg-surface-soft"
            }`}
            title={isDoodleOpen ? "Close couple doodle" : "Doodle together"}
          >
            <Brush className="w-4.5 h-4.5" />
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
