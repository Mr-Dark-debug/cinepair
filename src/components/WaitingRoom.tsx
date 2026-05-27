import React from "react";
import { Check, X, Bell } from "lucide-react";
import { useRoomStore } from "../store/useRoomStore";
import { useSocket } from "../hooks/useSocket";

export const WaitingRoom: React.FC = () => {
  const store = useRoomStore();
  const socketService = useSocket();

  // Only display to room administrators and when there are people waiting
  if (!store.isAdmin || store.waitingList.length === 0) {
    return null;
  }

  // Display the first guest in the waiting list queue
  const currentGuest = store.waitingList[0];

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[100] w-[90%] max-w-lg select-none">
      <div className="flex items-center justify-between bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 px-5 py-3 rounded-full shadow-premium animate-bounce-short">
        <div className="flex items-center space-x-3 truncate">
          <div className="p-2 bg-rose-500/10 rounded-full border border-rose-500/20 text-rose-400">
            <Bell className="w-4 h-4 animate-ring" />
          </div>
          <span className="text-xs text-zinc-100 truncate">
            <strong>{currentGuest.nickname}</strong> wants to join the meeting
          </span>
        </div>

        <div className="flex items-center space-x-2 pl-3">
          <button
            onClick={() => socketService.denyGuest(currentGuest.id)}
            className="p-2 bg-zinc-800 hover:bg-rose-500/20 border border-zinc-700 hover:border-rose-500/30 text-zinc-400 hover:text-rose-400 rounded-full transition-colors duration-200"
            title="Deny Access"
          >
            <X className="w-4.5 h-4.5" />
          </button>
          
          <button
            onClick={() => socketService.admitGuest(currentGuest.id)}
            className="p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full transition-colors duration-200 shadow-premium"
            title="Admit Participant"
          >
            <Check className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
