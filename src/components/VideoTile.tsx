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
  }, [stream, participant.camera_on]);

  const initials = participant.nickname
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const isVideoOn = participant.camera_on;
  const isMicOn = participant.mic_on;
  const bgClass = getColorForName(participant.nickname);

  return (
    <div
      onClick={onPin}
      className={`relative flex flex-col justify-center items-center bg-canvas border overflow-hidden cursor-pointer group transition-all duration-200 ${
        isPinned
          ? "border-primary border-2 scale-98"
          : "border-hairline hover:border-primary"
      } w-full aspect-video md:aspect-[4/3] max-w-[280px] min-w-[200px] select-none rounded-md`}
    >
      {/* 1. Video Element */}
      {isVideoOn && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover transform scale-x-[-1] rounded-md"
        />
      ) : (
        /* Avatar Placeholder when video is disabled: Solid Flat Figma Pastel block */
        <div className={`flex justify-center items-center ${bgClass} text-ink font-bold w-14 h-14 rounded-full border border-ink group-hover:scale-105 transition-transform duration-200`}>
          <span className="text-sm font-extrabold tracking-wider">{initials || "CP"}</span>
        </div>
      )}

      {/* 2. Audio status overlay badge - figmaMono style */}
      <div className="absolute top-2 right-2 bg-canvas border border-ink px-1.5 py-0.5 rounded flex items-center justify-center">
        {isMicOn ? (
          <Mic className="w-2.5 h-2.5 text-zinc-900" />
        ) : (
          <MicOff className="w-2.5 h-2.5 text-rose-500" />
        )}
      </div>

      {/* 3. Speaking animated overlay border */}
      {isMicOn && (
        <div className="absolute inset-0 border-2 border-emerald-500 pointer-events-none rounded-md" />
      )}

      {/* 4. Participant Info badge (overlay at bottom) - figmaMono all caps styling */}
      <div className="absolute bottom-2 left-2 bg-canvas border border-ink px-2 py-0.5 rounded text-[8px] font-bold text-ink max-w-[80%] truncate font-mono uppercase tracking-widest shadow-sm">
        {participant.nickname} {isLocal && <span className="text-[7px] text-zinc-500 font-normal">(YOU)</span>}
      </div>

      {/* Hover action indicator */}
      <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center items-center rounded-md pointer-events-none">
        <span className="bg-canvas border border-ink text-ink text-[8px] font-bold font-mono tracking-widest uppercase px-2 py-0.5 rounded shadow-sm">
          {isPinned ? "UNPIN" : "PIN TO STAGE"}
        </span>
      </div>
    </div>
  );
};
