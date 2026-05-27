import React, { useState } from "react";
import { X, ShieldAlert, Key, Users, Eye, EyeOff } from "lucide-react";
import { useRoomStore } from "../store/useRoomStore";
import { useSocket } from "../hooks/useSocket";

interface RoomSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoomSettings: React.FC<RoomSettingsProps> = ({ isOpen, onClose }) => {
  const store = useRoomStore();
  const socketService = useSocket();
  // Local settings state initialized from store values
  const [maxParticipants, setMaxParticipants] = useState(store.participants.length || 10);
  const [requireApproval, setRequireApproval] = useState(false); // we will bind from settings if available
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Sync state when opening
  React.useEffect(() => {
    if (isOpen) {
      // Find current room config or estimate from store
      setMaxParticipants(10); // default
      setRequireApproval(false);
      setPassword("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    socketService.updateSettings({
      maxParticipants,
      requireApproval,
      password: password.trim() ? password.trim() : null
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex justify-center items-center p-4 select-none">
      {/* Dark overlay backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      {/* Modal Container Card */}
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-premium animate-fade-in">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-zinc-800">
          <div className="flex items-center space-x-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <span className="text-sm font-bold text-zinc-100">Room Configurations</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveSettings} className="p-6 space-y-5">
          
          {/* Max Participants Slider */}
          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs font-semibold text-zinc-400">
              <span className="flex items-center">
                <Users className="w-4 h-4 mr-2 text-zinc-500" />
                Max Room Capacity
              </span>
              <span className="bg-zinc-800 text-zinc-100 px-2 py-0.5 rounded text-[10px]">{maxParticipants} Users</span>
            </label>
            <input
              type="range"
              min="2"
              max="30"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
              className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
            <div className="flex justify-between text-[9px] text-zinc-600">
              <span>2 Users (Couple Mode)</span>
              <span>30 Users</span>
            </div>
          </div>

          {/* Require Approval Toggle */}
          <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
            <div className="flex flex-col space-y-0.5 max-w-[80%]">
              <span className="text-xs font-bold text-zinc-200">Require Approval (Lobby)</span>
              <span className="text-[10px] text-zinc-500 leading-normal">
                If active, people trying to join must wait in a lobby until you admit them.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={requireApproval}
                onChange={(e) => setRequireApproval(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500 peer-checked:after:bg-white" />
            </label>
          </div>

          {/* Optional Room Password */}
          <div className="space-y-2">
            <label className="flex items-center text-xs font-semibold text-zinc-400">
              <Key className="w-4 h-4 mr-2 text-zinc-500" />
              Room Access Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank for no password protection..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-10 py-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex space-x-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded-xl text-xs font-semibold border border-zinc-750 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-semibold shadow-premium transition-colors duration-200"
            >
              Apply Changes
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
