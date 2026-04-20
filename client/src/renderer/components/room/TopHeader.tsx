import { Film, Lock, Shield, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';

interface TopHeaderProps {
  roomCode: string;
  isAdmin: boolean;
  isLocked: boolean;
  participantCount: number;
  connectionState: string;
  onOpenSettings?: () => void;
}

export function TopHeader({ 
  roomCode, 
  isAdmin, 
  isLocked, 
  participantCount, 
  connectionState
}: TopHeaderProps) {
  const [copied, setCopied] = useState(false);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-40 pointer-events-none">
      {/* Left side */}
      <div className="flex items-center gap-3 pointer-events-auto">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2 bg-surface/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-surface-hover shadow-md drag-region">
          <Film className="w-5 h-5 text-primary" />
          <span className="font-heading font-bold text-text-primary">
            Cine<span className="text-primary">Pair</span>
          </span>
        </div>

        {/* Room Code Badge */}
        <div 
          onClick={copyRoomCode}
          className="flex items-center gap-2 bg-surface/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-surface-hover shadow-md cursor-pointer hover:bg-surface transition-colors group"
          title="Click to copy room code"
        >
          <span className="font-mono text-sm tracking-widest font-medium text-text-primary">{roomCode}</span>
          {copied ? (
            <Check className="w-4 h-4 text-primary" />
          ) : (
            <Copy className="w-4 h-4 text-text-secondary group-hover:text-text-primary transition-colors" />
          )}
        </div>

        {/* Connection State */}
        <div className="flex items-center gap-2 bg-surface/80 backdrop-blur-md px-3 py-2 rounded-2xl border border-surface-hover shadow-md">
           <div
            className={`w-2 h-2 rounded-full ${
              connectionState === 'connected'
                ? 'bg-primary shadow-[0_0_8px_rgba(45,212,191,0.6)]'
                : connectionState === 'connecting'
                ? 'bg-warning animate-pulse'
                : 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.6)]'
            }`}
          />
          <span className="text-xs font-medium text-text-secondary capitalize">{connectionState}</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 pointer-events-auto">
        {isLocked && (
          <Badge variant="outline" className="bg-surface/80 backdrop-blur-md py-1.5 px-3">
            <Lock className="w-3.5 h-3.5 mr-1.5 text-warning" />
            Locked
          </Badge>
        )}
        
        {isAdmin && (
          <Badge variant="outline" className="bg-surface/80 backdrop-blur-md text-primary border-primary/30 py-1.5 px-3">
            <Shield className="w-3.5 h-3.5 mr-1.5" />
            Admin
          </Badge>
        )}

        <Badge variant="secondary" className="bg-surface/80 backdrop-blur-md py-1.5 px-3">
          <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
          {participantCount} {participantCount === 1 ? 'User' : 'Users'}
        </Badge>
      </div>
    </div>
  );
}
