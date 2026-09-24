import React, { useState } from "react";
import { X, ShieldAlert, Key, Users, Eye, EyeOff } from "lucide-react";
import { useRoomStore } from "../store/useRoomStore";
import { useSocket } from "../hooks/useSocket";
import { useDialog } from "../hooks/useDialog";

interface RoomSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoomSettings: React.FC<RoomSettingsProps> = ({ isOpen, onClose }) => {
  const store = useRoomStore();
  const dialogRef = useDialog(isOpen, onClose);
  const socketService = useSocket();

  // Local settings state initialized from store values
  const [maxParticipants, setMaxParticipants] = useState(store.settings?.max_participants || 10);
  const [requireApproval, setRequireApproval] = useState(false);
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Sync state when opening
  React.useEffect(() => {
    if (isOpen) {
      setMaxParticipants(store.settings?.max_participants || 10);
      setRequireApproval(store.settings?.require_approval || false);
      setPassword("");
      setClearPassword(false);
      setError("");
    }
  }, [isOpen, store.settings]);

  if (!isOpen) return null;

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await socketService.updateSettings({
      maxParticipants,
      requireApproval,
      ...(clearPassword ? { password: null } : password.trim() ? { password: password.trim() } : {})
    });
    if (result.success) onClose();
    else setError(result.error || "Could not save room settings.");
  };

  return (
    <div className="fixed inset-0 z-[120] flex justify-center items-center p-4 select-none animate-fade-in">
      {/* Dark overlay backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal Container Card */}
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Room settings" className="settings-dialog relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-canvas border border-hairline rounded-2xl shadow-soft">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-hairline room-settings-header">
          <div className="flex items-center space-x-2.5">
            <ShieldAlert className="w-5 h-5 text-ink shrink-0" />
            <span className="text-xs font-extrabold text-ink uppercase tracking-widest font-mono">Room Settings</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close room settings"
            className="p-1 hover:bg-surface-soft border border-ink rounded-full text-ink cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveSettings} className="p-6 space-y-5">
          
          {/* Max Participants Slider */}
          <div className="space-y-2">
            <label htmlFor="room-max-participants" className="flex items-center justify-between text-xs font-bold text-zinc-500 font-mono uppercase tracking-wider">
              <span className="flex items-center">
                <Users className="w-4 h-4 mr-2 text-zinc-400" />
                Max Capacity
              </span>
              <span className="bg-ink text-canvas border border-ink px-2.5 py-0.5 rounded-full text-[9px] font-extrabold">{maxParticipants} Users</span>
            </label>
            <input
              id="room-max-participants"
              type="range"
              min="2"
              max="30"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
              className="w-full h-1 bg-hairline rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[9px] text-zinc-500 font-bold font-mono">
              <span>2 USERS</span>
              <span>30 USERS</span>
            </div>
          </div>

          {/* Require approval */}
          <div className="flex items-center justify-between bg-block-lime border-2 border-ink p-4 rounded-md rotate-[0.5deg]">
            <div className="flex flex-col space-y-0.5 max-w-[80%]">
              <span className="text-xs font-extrabold text-ink">Require Approval</span>
              <span className="text-[10px] text-zinc-700 leading-normal font-bold">
                Waitlist guests in lobby until host admits them.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                aria-label="Require host approval for guests"
                checked={requireApproval}
                onChange={(e) => setRequireApproval(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4.5 bg-canvas border border-ink rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-zinc-800 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-ink peer-checked:after:bg-canvas" />
            </label>
          </div>

          {/* Optional Room Password */}
          <div className="space-y-1.5">
            <label htmlFor="room-access-password" className="flex items-center text-xs font-bold text-zinc-500 font-mono uppercase tracking-wider pl-1">
              <Key className="w-4 h-4 mr-2 text-zinc-400" />
              Room Access Password
            </label>
            <div className="relative">
              <input
                id="room-access-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={store.settings?.has_password ? "Leave blank to keep password" : "Optional room passcode (8+ characters)"}
                className="w-full bg-canvas border border-ink focus:border-2 focus:border-ink rounded pl-4 pr-10 py-3 text-xs text-ink placeholder-zinc-400 focus:outline-none transition-all font-medium"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide room passcode" : "Show room passcode"}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-zinc-500 hover:text-ink cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-zinc-500">A passcode encrypts new chat messages on participants' devices. Change it while alone in the room.</p>
            {store.settings?.has_password && <label className="flex items-center gap-2 text-[11px] font-bold"><input type="checkbox" checked={clearPassword} onChange={(e) => setClearPassword(e.target.checked)} /> Remove room passcode</label>}
          </div>

          {error && <p role="alert" className="text-xs font-bold text-rose-500">{error}</p>}

          {/* Actions */}
          <div className="flex space-x-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-canvas hover:bg-surface-soft border border-ink text-ink rounded-full text-xs font-extrabold cursor-pointer transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-ink hover:bg-zinc-800 text-canvas rounded-full text-xs font-extrabold cursor-pointer transition-colors shadow-sm"
            >
              Apply Changes
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
