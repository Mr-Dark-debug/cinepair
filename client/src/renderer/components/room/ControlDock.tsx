import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, Maximize, LogOut, MessageSquare, Settings } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { Button } from '@/components/ui/Button';

interface ControlDockProps {
  isMicOn: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  isAdmin: boolean;
  isChatVisible: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleFullscreen: () => void;
  onToggleChat: () => void;
  onLeaveRoom: () => void;
  onOpenSettings?: () => void;
}

export function ControlDock({
  isMicOn,
  isCameraOn,
  isScreenSharing,
  isAdmin,
  isChatVisible,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onToggleFullscreen,
  onToggleChat,
  onLeaveRoom,
  onOpenSettings
}: ControlDockProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 rounded-full bg-surface/80 backdrop-blur-xl border border-surface-hover shadow-2xl z-40">
        
        {/* AV Controls */}
        <div className="flex items-center gap-1 px-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isMicOn ? 'ghost' : 'destructive'}
                size="icon"
                onClick={onToggleMic}
                className={`rounded-full w-12 h-12 transition-all hover:scale-105 ${!isMicOn ? 'shadow-[0_0_15px_rgba(239,68,68,0.4)]' : ''}`}
              >
                {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isMicOn ? 'Turn off microphone' : 'Turn on microphone'}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isCameraOn ? 'ghost' : 'destructive'}
                size="icon"
                onClick={onToggleCamera}
                className={`rounded-full w-12 h-12 transition-all hover:scale-105 ${!isCameraOn ? 'shadow-[0_0_15px_rgba(239,68,68,0.4)]' : ''}`}
              >
                {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isCameraOn ? 'Turn off camera' : 'Turn on camera'}</TooltipContent>
          </Tooltip>
        </div>

        <div className="w-px h-8 bg-surface-hover mx-1"></div>

        {/* Presentation & UI Controls */}
        <div className="flex items-center gap-1 px-2">
          {isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isScreenSharing ? 'default' : 'ghost'}
                  size="icon"
                  onClick={onToggleScreenShare}
                  className={`rounded-full w-12 h-12 transition-all hover:scale-105 ${isScreenSharing ? 'bg-primary hover:bg-primary-hover shadow-[0_0_15px_rgba(45,212,191,0.4)]' : ''}`}
                >
                  {isScreenSharing ? <MonitorOff className="w-5 h-5 text-background" /> : <Monitor className="w-5 h-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isScreenSharing ? 'Stop sharing screen' : 'Share screen'}</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isChatVisible ? 'secondary' : 'ghost'}
                size="icon"
                onClick={onToggleChat}
                className="rounded-full w-12 h-12 transition-all hover:scale-105 relative"
              >
                <MessageSquare className={`w-5 h-5 ${isChatVisible ? 'text-primary' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Chat</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleFullscreen}
                className="rounded-full w-12 h-12 transition-all hover:scale-105"
              >
                <Maximize className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fullscreen</TooltipContent>
          </Tooltip>
          
          {onOpenSettings && (
             <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenSettings}
                  className="rounded-full w-12 h-12 transition-all hover:scale-105"
                >
                  <Settings className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Room Settings</TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="w-px h-8 bg-surface-hover mx-1"></div>

        {/* Destructive Action */}
        <div className="px-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                onClick={onLeaveRoom}
                className="rounded-full px-6 h-12 font-semibold shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:scale-105 transition-all"
              >
                <LogOut className="w-5 h-5 mr-2" />
                Leave
              </Button>
            </TooltipTrigger>
            <TooltipContent>Leave the room</TooltipContent>
          </Tooltip>
        </div>

      </div>
    </TooltipProvider>
  );
}
