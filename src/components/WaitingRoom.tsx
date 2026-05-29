import React from "react";
import { Bell } from "lucide-react";
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
    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-[100] w-[90%] max-w-md select-none animate-bounce-short">
      <div className="flex items-center justify-between bg-block-cream border-2 border-ink p-4 rounded-md shadow-soft rotate-[-0.5deg]">
        <div className="flex items-center space-x-3 truncate">
          <div className="p-2 bg-block-lilac border border-ink rounded-full text-ink shrink-0">
            <Bell className="w-4 h-4 animate-ring" />
          </div>
          <div className="flex flex-col truncate">
            <span className="text-[9px] font-bold text-zinc-500 font-mono uppercase tracking-widest">Join Request</span>
            <span className="text-xs text-ink truncate font-bold mt-0.5">
              <strong>{currentGuest.nickname}</strong> wants to enter
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 pl-3 shrink-0">
          <button
            onClick={() => socketService.denyGuest(currentGuest.id)}
            className="px-3.5 py-1.5 bg-canvas border border-ink hover:bg-surface-soft rounded-full text-[10px] text-ink font-extrabold cursor-pointer transition-colors shadow-sm"
            title="Deny Access"
          >
            Deny
          </button>
          
          <button
            onClick={() => socketService.admitGuest(currentGuest.id)}
            className="px-3.5 py-1.5 bg-ink hover:bg-zinc-800 text-canvas rounded-full text-[10px] font-extrabold cursor-pointer transition-colors shadow-sm"
            title="Admit Participant"
          >
            Admit
          </button>
        </div>
      </div>
    </div>
  );
};
