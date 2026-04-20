import { RoomUser } from '@/stores/roomSlice';
import { MicOff, Crown } from 'lucide-react';

interface VideoTileProps {
  user?: RoomUser; // If undefined, it's the local user or an empty placeholder
  nickname: string;
  isLocal?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  isCameraOn?: boolean;
  isMicOn?: boolean;
  avatarColor?: string;
  isAdmin?: boolean;
}

export function VideoTile({
  nickname,
  isLocal,
  videoRef,
  isCameraOn = true,
  isMicOn = true,
  avatarColor = '#2DD4BF', // Default to primary color
  isAdmin = false,
}: VideoTileProps) {
  
  // Extract initial for avatar fallback
  const initial = nickname.charAt(0).toUpperCase() || '?';

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-surface border border-surface-hover shadow-lg group">
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover transition-opacity duration-300 ${isCameraOn ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Avatar Fallback (when camera is off) */}
      {!isCameraOn && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
           <div 
            className="w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center text-4xl sm:text-5xl font-bold text-background shadow-inner"
            style={{ backgroundColor: avatarColor }}
           >
             {initial}
           </div>
        </div>
      )}

      {/* Status Indicators Overlay */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 z-10 transition-opacity">
        <div className="bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-surface-hover shadow-md max-w-[200px]">
          <span className="text-sm font-medium text-text-primary truncate">{nickname} {isLocal && '(You)'}</span>
          
          <div className="flex items-center gap-1.5 ml-1">
            {isAdmin && <Crown className="w-3.5 h-3.5 text-warning" />}
            {!isMicOn && <MicOff className="w-3.5 h-3.5 text-destructive" />}
          </div>
        </div>
      </div>
    </div>
  );
}
