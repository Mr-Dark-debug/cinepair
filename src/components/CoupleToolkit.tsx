import React, { useMemo, useState } from "react";
import { Heart, Brush, PictureInPicture2, X, Sparkles } from "lucide-react";
import { useRoomStore } from "../store/useRoomStore";
import { useSocket } from "../hooks/useSocket";
import { PixelAvatar, moodForEmoji } from "./PixelAvatar";

const QUESTIONS = [
  "What movie made you fall for each other?",
  "Which scene would you re-live together right now?",
  "Guilty pleasure you'd only ever watch with me?",
  "What's our next date-night genre?",
  "Which character reminds you of me?",
  "Rewatch our first movie together — or pick a new one?",
  "What snack are we making for tonight's watch?",
];

const QUICK_REACTIONS = ["❤️", "💘", "😂", "🔥", "👏", "😮"];

export const CoupleToolkit: React.FC<{
  onToggleDoodle: () => void;
  onPipStage: () => void;
  isDoodleOpen: boolean;
}> = ({ onToggleDoodle, onPipStage, isDoodleOpen }) => {
  const store = useRoomStore();
  const socketService = useSocket();
  const [open, setOpen] = useState(true);
  const [moodIdx, setMoodIdx] = useState(0);

  const question = useMemo(() => {
    const dayIndex = Math.floor(Date.now() / 86400000);
    return QUESTIONS[dayIndex % QUESTIONS.length];
  }, []);

  if (store.participants.length !== 2) return null;

  const partner = store.participants.find((p) => p.id !== store.socketId) || store.participants[0];
  const lastEmoji = [...store.reactions].slice(-1)[0]?.emoji;
  const mood = lastEmoji ? moodForEmoji(lastEmoji) : (["idle", "happy", "love"] as const)[moodIdx % 3];

  const nudge = () => {
    socketService.sendReaction("💘");
    setMoodIdx((i) => i + 1);
    store.addToast("Nudge sent 💘");
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 z-40 w-10 h-10 rounded-full bg-block-pink border-2 border-ink shadow-soft flex items-center justify-center cursor-pointer hover:scale-105"
        title="Open couple toolkit"
      >
        <Heart className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 left-4 z-40 w-72 bg-canvas border-2 border-ink rounded-2xl shadow-soft overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-3 py-2 bg-block-pink border-b-2 border-ink">
        <span className="text-[9px] font-black uppercase tracking-widest font-mono flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Couple mode
        </span>
        <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/50 rounded-full cursor-pointer"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-3">
          <PixelAvatar seed={(partner as any)?.avatar_seed || partner?.nickname || "love"} mood={mood as any} size={56} />
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 font-mono">Tonight's question</p>
            <p className="text-xs font-bold leading-snug">{question}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REACTIONS.map((e) => (
            <button
              key={e}
              onClick={() => socketService.sendReaction(e)}
              className="w-8 h-8 rounded-full border border-hairline hover:border-ink hover:scale-110 bg-surface-soft text-base cursor-pointer transition-transform"
              title={`React ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={nudge} className="flex flex-col items-center gap-1 py-2 rounded-xl border border-hairline hover:border-ink bg-surface-soft cursor-pointer text-[9px] font-black uppercase">
            <Heart className="w-4 h-4" /> Nudge
          </button>
          <button onClick={onToggleDoodle} className={`flex flex-col items-center gap-1 py-2 rounded-xl border cursor-pointer text-[9px] font-black uppercase ${isDoodleOpen ? "bg-block-lime border-ink" : "bg-surface-soft border-hairline hover:border-ink"}`}>
            <Brush className="w-4 h-4" /> Doodle
          </button>
          <button onClick={onPipStage} className="flex flex-col items-center gap-1 py-2 rounded-xl border border-hairline hover:border-ink bg-surface-soft cursor-pointer text-[9px] font-black uppercase">
            <PictureInPicture2 className="w-4 h-4" /> PiP
          </button>
        </div>
      </div>
    </div>
  );
};
