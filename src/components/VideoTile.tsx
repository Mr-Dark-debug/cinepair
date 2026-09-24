import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, MoreVertical } from "lucide-react";
import { Participant, useRoomStore } from "../store/useRoomStore";
import { useSocket } from "../hooks/useSocket";
import { PixelAvatar, moodForEmoji } from "./PixelAvatar";

interface VideoTileProps {
  participant: Participant;
  stream: MediaStream | null;
  isLocal: boolean;
  isPinned: boolean;
  onPin: () => void;
  flat?: boolean;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  stream,
  isLocal,
  isPinned,
  onPin,
  flat = false
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const store = useRoomStore();
  const socketService = useSocket();
  const reaction = store.reactions.filter((item) => item.senderId === participant.id).slice(-1)[0];
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // 1. Setup Video stream - robustly handle srcObject assignment
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    
    if (stream) {
      // Only re-assign if the srcObject actually changed
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.volume = isLocal ? 0 : store.peerAudioVolumes[participant.id]?.mic ?? 1;
    } else {
      videoEl.srcObject = null;
    }

    return () => {
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [stream, isLocal, participant.id, store.peerAudioVolumes]);

  // 2. Setup Real-time Web Audio API Analyser for Active Speaker Detection
  useEffect(() => {
    if (!stream || !participant.mic_on) {
      setIsSpeaking(false);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      setIsSpeaking(false);
      return;
    }

    let audioContext: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let processor: ScriptProcessorNode | null = null;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioCtx();
      source = audioContext.createMediaStreamSource(stream);
      
      // Analyze mic volume level
      processor = audioContext.createScriptProcessor(2048, 1, 1);
      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        try {
          if (!e.inputBuffer || e.inputBuffer.numberOfChannels === 0) return;
          const inputData = e.inputBuffer.getChannelData(0);
          if (!inputData) return;
          
          let sum = 0.0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          // Speaking threshold: RMS > 0.015
          setIsSpeaking(rms > 0.015);
        } catch (audioProcessErr) {
          // Silently handle any audio buffer read exceptions
        }
      };
    } catch (err) {
      console.warn("Failed to initialize active speaker analyzer:", err);
    }

    return () => {
      if (processor) processor.disconnect();
      if (source) source.disconnect();
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close();
      }
    };
  }, [stream, participant.mic_on]);

  // Close menu on click outside
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClose = () => setIsMenuOpen(false);
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, [isMenuOpen]);

  const isVideoOn = participant.camera_on;
  const isMicOn = participant.mic_on;

  return (
    <div
      className={`video-tile relative w-full h-full flex flex-col justify-center items-center select-none cursor-pointer group transition-all duration-200 ${
        flat 
          ? "video-tile-flat bg-transparent border-0 shadow-none overflow-visible"
          : `bg-canvas border rounded-xl ${
              isPinned
                ? "border-primary border-2"
                : "border-hairline hover:border-primary"
            } ${
              isSpeaking
                ? "ring-2 ring-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                : ""
            }`
      }`}
    >
      <button type="button" className="video-tile-pin absolute inset-0 z-10 rounded-xl" onClick={onPin} aria-label={`${participant.nickname || "Guest"}${isLocal ? ", you" : ""}. ${isPinned ? "Unpin from stage" : "Pin to stage"}`} />
      {/* 1. Video Element - Always rendered to preserve ref, hidden via CSS when camera off */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover transform scale-x-[-1] rounded-md absolute inset-0 z-[1] ${
          isVideoOn && stream ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        }`}
      />
      {/* Avatar Placeholder when video is disabled */}
      {(!isVideoOn || !stream) && (
        <div className="video-tile-placeholder">
          <PixelAvatar seed={participant.avatar_seed || participant.nickname || "CinePair"} palette={participant.avatar_palette} mood={reaction ? moodForEmoji(reaction.emoji) : "idle"} size={flat ? 56 : 108} />
          {!flat && <p>{store.participants.length === 1 ? "Your room is ready. Invite someone in." : "Camera is off"}</p>}
        </div>
      )}

      {/* 2. Audio status overlay badge */}
      <div className="video-tile-mic absolute top-3 right-3 bg-canvas border border-hairline rounded-lg flex items-center justify-center z-20">
        {isMicOn ? (
          <Mic className="w-4 h-4 text-ink" />
        ) : (
          <MicOff className="w-4 h-4 text-rose-500" />
        )}
      </div>

      {/* 3. 3-Dot Options Action Button & Dropdown Menu */}
      <div className="absolute top-2 left-2 z-30 pointer-events-auto">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen(!isMenuOpen);
          }}
          className="video-tile-menu-button rounded-lg bg-canvas border border-hairline text-ink hover:bg-surface-soft cursor-pointer transition-colors"
          title="Participant Options"
        >
          <MoreVertical className="w-4 h-4 shrink-0" />
        </button>
        {isMenuOpen && (
          <div className="video-tile-menu absolute left-0 mt-1 w-36 bg-canvas border border-hairline rounded-xl shadow-lg z-50 text-left py-1 font-semibold">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPin();
                setIsMenuOpen(false);
              }}
              className="w-full text-left px-2.5 py-1.5 hover:bg-surface-soft text-ink"
            >
              {isPinned ? "Unpin Stage" : "Pin Stage"}
            </button>
            {store.isAdmin && !isLocal && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    socketService.muteUser(participant.id);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-surface-soft text-ink border-t border-hairline"
                >
                  Force Mute
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    socketService.kickUser(participant.id);
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-block-pink text-rose-600 border-t border-hairline"
                >
                  Kick User
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 4. Participant Info badge (overlay at bottom) */}
      <div className="video-tile-name absolute bottom-3 left-3 bg-canvas border border-hairline rounded-lg text-ink max-w-[90%] truncate z-20">
        {participant.nickname || "Guest"} {isLocal && <span>(You)</span>}
      </div>

      {/* Hover action indicator */}
      {!flat && (
        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center items-center rounded-md pointer-events-none z-10">
          <span className="video-tile-hover-hint bg-canvas border border-hairline text-ink rounded-lg shadow-sm">
            {isPinned ? "Unpin" : "Pin to stage"}
          </span>
        </div>
      )}
    </div>
  );
};
