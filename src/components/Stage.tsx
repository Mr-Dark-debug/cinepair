import React, { useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Settings, Power } from "lucide-react";
import { Participant, useRoomStore } from "../store/useRoomStore";

interface StageProps {
  pinnedParticipant: Participant | null;
  stream: MediaStream | null;
  isLocal: boolean;
  onToggleCam: () => void;
  onToggleMic: () => void;
  onToggleScreenShare: () => void;
  onLeaveRoom: () => void;
  onOpenSettings: () => void;
}

export const Stage: React.FC<StageProps> = ({
  pinnedParticipant,
  stream,
  isLocal,
  onToggleCam,
  onToggleMic,
  onToggleScreenShare,
  onLeaveRoom,
  onOpenSettings
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const store = useRoomStore();

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initials = pinnedParticipant
    ? pinnedParticipant.nickname.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()
    : "VS";

  return (
    <div className="relative flex-1 flex flex-col justify-center items-center bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden group shadow-premium select-none h-full min-h-[400px]">
      
      {/* 1. Video Stream Player */}
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // Avoid local echo
          className={`w-full h-full object-contain ${
            isLocal && !store.screenShareEnabled ? "transform scale-x-[-1]" : ""
          }`}
        />
      ) : (
        /* Large Profile Placeholder when Video/Screenshare is absent */
        <div className="flex flex-col justify-center items-center space-y-4">
          <div className="flex justify-center items-center bg-zinc-900 text-zinc-100 font-bold w-28 h-28 rounded-full border-4 border-zinc-800 shadow-premium">
            <span className="text-3xl tracking-widest">{initials}</span>
          </div>
          <span className="text-zinc-400 text-sm font-medium">
            {pinnedParticipant
              ? `${pinnedParticipant.nickname}'s video is paused`
              : "Select a participant below to pin their camera or watch shared movie"}
          </span>
        </div>
      )}

      {/* 2. Top-Left Floating Info Tag */}
      <div className="absolute top-6 left-6 flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs font-semibold text-zinc-200">
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
        <span className="w-2 h-2 rounded-full bg-rose-500 absolute left-3 top-3.5" />
        <span className="uppercase tracking-wider">
          {pinnedParticipant 
            ? pinnedParticipant.screen_share_on 
              ? `LIVE SCREEN: ${pinnedParticipant.nickname}`
              : `LIVE CAM: ${pinnedParticipant.nickname}`
            : "LOBBY STAGE"}
        </span>
      </div>

      {/* 3. Top-Right Recording / Live banner */}
      <div className="absolute top-6 right-6 flex items-center space-x-2 bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 text-xs text-zinc-300 font-medium select-none">
        <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse inline-block mr-1" />
        <span>Watch Party in Progress...</span>
      </div>

      {/* 4. Subtitle / CC Transcription Overlay (replica of Reference Image bottom overlay) */}
      <div className="absolute bottom-28 left-6 right-6 flex items-center bg-black/50 backdrop-blur-lg px-6 py-4 rounded-2xl border border-white/15">
        <div className="flex items-center space-x-4 w-full">
          <div className="flex flex-col space-y-1">
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold">Subtitles / Transcripts</span>
            <p className="text-sm font-medium text-zinc-100">
              {pinnedParticipant
                ? `Viewing ${pinnedParticipant.nickname}'s stream. Merged audio active.`
                : "Awaiting audio activity..."}
            </p>
          </div>
        </div>
      </div>

      {/* 5. Central Overlay Floating Controller Panel (replica of Reference Image pill) */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center bg-black/60 backdrop-blur-xl px-5 py-3 rounded-full border border-white/10 space-x-4 shadow-premium scale-95 md:scale-100 hover:scale-105 transition-transform duration-300">
        <button
          onClick={onToggleMic}
          className={`p-3 rounded-full border transition-all duration-200 ${
            store.micEnabled
              ? "bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700"
              : "bg-rose-500/25 border-rose-500/40 text-rose-400 hover:bg-rose-500/40"
          }`}
        >
          {store.micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        <button
          onClick={onToggleCam}
          className={`p-3 rounded-full border transition-all duration-200 ${
            store.cameraEnabled
              ? "bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700"
              : "bg-rose-500/25 border-rose-500/40 text-rose-400 hover:bg-rose-500/40"
          }`}
        >
          {store.cameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        <button
          onClick={onToggleScreenShare}
          className={`p-3 rounded-full border transition-all duration-200 ${
            store.screenShareEnabled
              ? "bg-rose-500 text-zinc-100 hover:bg-rose-600 border-rose-600"
              : "bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700"
          }`}
        >
          <Monitor className="w-5 h-5" />
        </button>

        <div className="w-[1px] h-6 bg-zinc-800" />

        <button
          onClick={onLeaveRoom}
          className="p-3 bg-red-600/80 hover:bg-red-700 rounded-full border border-red-700/50 text-white transition-colors duration-200"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      {/* 6. Power / Settings Overlay Panel (Bottom Right of Video Tile in Reference) */}
      <div className="absolute bottom-6 right-6 flex items-center space-x-2">
        <button
          onClick={onOpenSettings}
          className="p-3 bg-black/60 backdrop-blur-md border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white rounded-full transition-all duration-200 shadow-premium"
        >
          <Settings className="w-4.5 h-4.5" />
        </button>
        <button
          onClick={onLeaveRoom}
          className="p-3 bg-black/60 backdrop-blur-md border border-white/10 hover:border-red-500/30 text-zinc-300 hover:text-red-400 rounded-full transition-all duration-200 shadow-premium"
        >
          <Power className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  );
};
