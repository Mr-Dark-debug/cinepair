/**
 * @fileoverview Home screen component for CinePair.
 * Features the app logo, tagline, and Create/Join Room buttons.
 * @module components/Home
 */

import { Film, Plus, LogIn, Settings } from 'lucide-react';
import { useRoomStore } from '../stores/roomStore';

/**
 * Home screen — the landing page of CinePair.
 * Displays centered branding with Create Room and Join Room action buttons.
 */
export default function Home(): JSX.Element {
  const setScreen = useRoomStore((s) => s.setScreen);

  return (
    <div className="h-full flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-purple/5 rounded-full blur-[120px] animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-teal/5 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '1.5s' }} />

      {/* Settings gear */}
      <button
        className="no-drag absolute top-12 right-6 text-text-secondary hover:text-text-primary transition-colors p-2 rounded-full hover:bg-white/5"
        title="Settings"
      >
        <Settings size={20} />
      </button>

      {/* Main content */}
      <div className="text-center animate-fade-in z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-accent-purple/10 border border-accent-purple/20">
            <Film className="text-accent-purple" size={40} />
          </div>
        </div>

        {/* App name */}
        <h1 className="text-5xl font-extrabold font-heading text-text-primary mb-3 tracking-tight">
          Cine<span className="text-accent-purple">Pair</span>
        </h1>

        {/* Tagline */}
        <p className="text-xl text-text-secondary mb-12 font-light">
          Watch together, anywhere
        </p>

        {/* Action buttons */}
        <div className="flex gap-6 mb-8">
          <button
            onClick={() => setScreen('create-room')}
            className="btn-purple text-lg px-10 py-4 flex items-center gap-3 no-drag group"
          >
            <Plus size={22} className="transition-transform group-hover:rotate-90 duration-300" />
            Create Room
          </button>

          <button
            onClick={() => setScreen('join-room')}
            className="btn-teal text-lg px-10 py-4 flex items-center gap-3 no-drag group"
          >
            <LogIn size={22} className="transition-transform group-hover:translate-x-1 duration-300" />
            Join Room
          </button>
        </div>

        {/* Privacy message */}
        <p className="text-sm text-text-secondary/60 mb-2">
          No sign-up • Private • Just for two
        </p>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-sm text-text-secondary/40">
        Made for movie nights ❤️
      </div>
    </div>
  );
}
