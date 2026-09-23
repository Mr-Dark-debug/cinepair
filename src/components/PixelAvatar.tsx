import React, { useEffect, useRef } from "react";

// Deterministic pixel-art avatar drawn on a canvas. Seeded by a string hash so
// every peer renders the same avatar for a given seed.

const PALETTES: string[][] = [
  ["#FF6F61", "#1C1C1C", "#F5E8D8"], // coral face on dark, cream features
  ["#B0D19A", "#141416", "#F5E8D8"], // sage
  ["#EC646C", "#1C1C1C", "#F5E8D8"], // rose
  ["#DAA520", "#141416", "#F5E8D8"], // gold
  ["#6FA8DC", "#1C1C1C", "#F5E8D8"], // blue
];
export const AVATAR_PALETTES = ["coral", "sage", "rose", "gold", "blue"];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PixelAvatarProps {
  seed?: string | null;
  palette?: string | null;
  size?: number;
  animated?: boolean;
  mood?: "idle" | "happy" | "love" | "hype" | "sleepy";
  className?: string;
}

export type AvatarMood = PixelAvatarProps["mood"];

// Map chat reactions -> avatar mood so avatars "perform" emoji.
export const moodForEmoji = (emoji: string): AvatarMood => {
  if (["❤️", "💘", "💕", "😍", "🥰"].includes(emoji)) return "love";
  if (["🔥", "🎉", "🥳", "⚡", "💃", "🕺"].includes(emoji)) return "hype";
  if (["😂", "🤣", "😄", "😊", "👏"].includes(emoji)) return "happy";
  if (["😴", "💤", "🌙"].includes(emoji)) return "sleepy";
  return "happy";
};

export const PixelAvatar: React.FC<PixelAvatarProps> = ({
  seed,
  palette,
  size = 96,
  animated = true,
  mood = "idle",
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = seed || "default";
    const h = hashString(s);
    const rng = mulberry32(h);
    const paletteIndex = AVATAR_PALETTES.indexOf(palette || "");
    const pal = PALETTES[paletteIndex >= 0 ? paletteIndex : Math.floor(rng() * PALETTES.length)];

    const grid = 8;
    const cell = size / grid;
    canvas.width = size;
    canvas.height = size;
    ctx.imageSmoothingEnabled = false;

    // Background
    ctx.fillStyle = pal[1];
    ctx.fillRect(0, 0, size, size);

    // Head (with a couple of rng quirks for variety)
    ctx.fillStyle = pal[0];
    ctx.fillRect(1 * cell, 1 * cell, 6 * cell, 5 * cell);
    if (rng() > 0.5) {
      ctx.fillRect(2 * cell, 1 * cell, 4 * cell, 1 * cell); // hair-ish top
    }

    // Eyes
    ctx.fillStyle = pal[2];
    ctx.fillRect(2 * cell, 3 * cell, cell, cell);
    ctx.fillRect(5 * cell, 3 * cell, cell, cell);

    // Mouth — mood-driven
    if (mood === "love" || mood === "happy") {
      ctx.fillRect(3 * cell, 5 * cell, 2 * cell, cell);
      ctx.fillRect(2 * cell, 4 * cell, cell, cell); // smile corners
      ctx.fillRect(5 * cell, 4 * cell, cell, cell);
    } else if (mood === "hype") {
      ctx.fillRect(3 * cell, 5 * cell, 2 * cell, cell);
      ctx.fillRect(3 * cell, 4 * cell, 2 * cell, cell); // open cheer
    } else if (mood === "sleepy") {
      ctx.fillRect(3 * cell, 5 * cell, 2 * cell, cell / 2);
    } else {
      ctx.fillRect(3 * cell, 5 * cell, 2 * cell, cell);
    }

    // Love blush / hearts
    if (mood === "love" || rng() > 0.4) {
      ctx.fillStyle = mood === "love" ? "#EC646C" : pal[2];
      ctx.fillRect(1 * cell, 4 * cell, cell, cell);
      ctx.fillRect(6 * cell, 4 * cell, cell, cell);
    }
  }, [seed, palette, size, mood]);

  const moodClass =
    mood === "hype" ? "pixel-avatar-hype" :
    mood === "love" ? "pixel-avatar-love" :
    mood === "happy" ? "pixel-avatar-happy" :
    mood === "sleepy" ? "pixel-avatar-sleepy" : "";

  return (
    <canvas
      role="img"
      aria-label={`Pixel avatar, ${mood} mood`}
      ref={canvasRef}
      className={`pixel-avatar ${animated ? "pixel-avatar-bob" : ""} ${moodClass} ${className}`}
      style={{ width: size, height: size }}
    />
  );
};
