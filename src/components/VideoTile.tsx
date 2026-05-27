import React, { useEffect, useRef } from "react";
import { Mic, MicOff } from "lucide-react";
import { Participant } from "../store/useRoomStore";

interface VideoTileProps {
  participant: Participant;
  stream: MediaStream | null;
  isLocal: boolean;
  isPinned: boolean;
  onPin: () => void;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  stream,
  isLocal,
  isPinned,
  onPin
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Generate an elegant geometric avatar from nickname
  const initials = participant.nickname
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const isVideoOn = participant.camera_on;
  const isMicOn = participant.mic_on;

  return (
    <div
      onClick={onPin}
      className={`relative flex flex-col justify-center items-center bg-zinc-900 border rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 ${
        isPinned ? "border-rose-500 shadow-premium" : "border-zinc-800 hover:border-zinc-700"
      } w-full aspect-video md:aspect-[4/3] max-w-[280px] min-w-[200px] select-none`}
    >
      {/* 1. Video Element */}
      {isVideoOn && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // Always mute local video tile to prevent feedback
          className="w-full h-full object-cover rounded-2xl transform scale-x-[-1]"
        />
      ) : (
        /* Avatar Placeholder when video is disabled */
        <div className="flex justify-center items-center bg-zinc-800 text-zinc-100 font-semibold w-16 h-16 rounded-full border-2 border-zinc-700 shadow-inner group-hover:scale-105 transition-transform duration-300">
          <span className="text-xl tracking-wider">{initials || "VS"}</span>
        </div>
      )}

      {/* 2. Audio status overlay badge */}
      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 flex items-center space-x-1">
        {isMicOn ? (
          <Mic className="w-3.5 h-3.5 text-zinc-300" />
        ) : (
          <MicOff className="w-3.5 h-3.5 text-rose-400" />
        )}
      </div>

      {/* 3. Speaking animated overlay border */}
      {isMicOn && (
        <div className="absolute inset-0 border-2 border-green-500/40 rounded-2xl pointer-events-none animate-pulse" />
      )}

      {/* 4. Participant Info badge (overlay at bottom) */}
      <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-xs font-medium text-zinc-100 max-w-[80%] truncate">
        {participant.nickname} {isLocal && <span className="text-[10px] text-zinc-400 font-normal">(You)</span>}
      </div>

      {/* Hover action indicator */}
      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center items-center rounded-2xl pointer-events-none">
        <span className="bg-black/80 text-white text-[10px] px-2 py-1 rounded-md border border-white/10">
          {isPinned ? "Unpin Stream" : "Pin to Stage"}
        </span>
      </div>
    </div>
  );
};
