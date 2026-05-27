import React, { useEffect } from "react";
import { useRoomStore } from "../store/useRoomStore";

export const EmojiReactionOverlay: React.FC = () => {
  const store = useRoomStore();

  useEffect(() => {
    if (store.reactions.length === 0) return;

    // Set a cleanup timeout for each active reaction bubble
    const latestReaction = store.reactions[store.reactions.length - 1];
    const timer = setTimeout(() => {
      store.removeReaction(latestReaction.id);
    }, 3000); // 3 seconds matching the CSS floatUp animation

    return () => clearTimeout(timer);
  }, [store.reactions.length, store.reactions, store.removeReaction]);

  return (
    <div className="absolute inset-0 pointer-events-none z-[80] overflow-hidden select-none">
      {store.reactions.map((r, index) => {
        // Calculate a pseudo-randomized horizontal left offset to spread reactions
        // based on the reaction ID hash
        const hash = r.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const leftPercent = 15 + (hash % 60); // Spread across 15% to 75% screen width
        const horizontalShift = (hash % 10) - 5; // Slight drift offset

        return (
          <div
            key={r.id}
            className="reaction-bubble"
            style={{
              left: `${leftPercent}%`,
              animationDelay: `${index * 0.15}s`,
              transform: `translateX(${horizontalShift}px)`
            }}
          >
            {r.emoji}
          </div>
        );
      })}
    </div>
  );
};
