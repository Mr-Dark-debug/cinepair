/**
 * @fileoverview Admin controls dropdown for screen sharing source selection.
 * Provides options for entire screen, specific window, and system audio toggle.
 * @module components/AdminControls
 */

import { Monitor, AppWindow, Volume2 } from 'lucide-react';
import { useEffect, useRef } from 'react';

/** Props for AdminControls */
interface AdminControlsProps {
  /** Called when a source type is selected */
  onSelectSource: (type: 'screen' | 'window' | 'tab') => void;
  /** Called when the dropdown should close */
  onClose: () => void;
}

/**
 * Floating dropdown for screen share source selection.
 * Shows options for entire screen, specific window, and browser tab.
 */
export default function AdminControls({
  onSelectSource,
  onClose,
}: AdminControlsProps): JSX.Element {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  /** Screen share source options (no 'tab' — Electron desktopCapturer doesn't support tabs) */
  const options = [
    {
      type: 'screen' as const,
      icon: Monitor,
      label: 'Entire Screen',
      description: 'Share your full desktop',
    },
    {
      type: 'window' as const,
      icon: AppWindow,
      label: 'Application Window',
      description: 'Share a specific app (VLC, browser, etc.)',
    },
  ];

  return (
    <div
      ref={dropdownRef}
      className="absolute bottom-full left-0 mb-2 w-72 glass-card p-2 animate-slide-up z-50"
    >
      {/* Source options */}
      {options.map((option) => (
        <button
          key={option.type}
          onClick={() => onSelectSource(option.type)}
          className="w-full flex items-center gap-3 p-3 rounded-btn
                     hover:bg-white/5 transition-colors text-left group"
        >
          <div className="p-2 rounded-btn bg-accent-purple/10 text-accent-purple group-hover:bg-accent-purple/20 transition-colors">
            <option.icon size={18} />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">{option.label}</p>
            <p className="text-xs text-text-secondary">{option.description}</p>
          </div>
        </button>
      ))}

      {/* System Audio indicator */}
      <div className="border-t border-border-subtle mt-2 pt-2 px-3 pb-1">
        <div className="flex items-center gap-2 text-xs text-accent-teal">
          <Volume2 size={14} />
          <span>System audio will be captured automatically</span>
        </div>
      </div>
    </div>
  );
}
