/**
 * @fileoverview Real screen/window source picker using Electron desktopCapturer.
 * Shows actual thumbnails. No "Browser Tab" option (Electron doesn't support tabs).
 * @module components/ScreenSourcePicker
 */

import { useEffect, useState, useRef } from 'react';
import { Monitor, AppWindow, X } from 'lucide-react';

interface ScreenSource {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  appIconDataUrl: string | null;
  displayId: string;
}

interface ScreenSourcePickerProps {
  onSelect: (sourceId: string) => void;
  onCancel: () => void;
}

/**
 * Real screen/window picker using Electron's desktopCapturer.
 * Displays actual thumbnails for screens and windows.
 */
export default function ScreenSourcePicker({
  onSelect,
  onCancel,
}: ScreenSourcePickerProps): JSX.Element {
  const [sources, setSources] = useState<ScreenSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'screen' | 'window'>('all');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSources = async () => {
      try {
        if (window.cinepair?.getScreenSources) {
          const result = await window.cinepair.getScreenSources();
          setSources(result);
        }
      } catch (err) {
        console.error('[ScreenSourcePicker] Failed to get sources:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchSources();

    // Also listen for pushed sources from setDisplayMediaRequestHandler
    let cleanup: (() => void) | undefined;
    if (window.cinepair?.onScreenSources) {
      cleanup = window.cinepair.onScreenSources((pushed: ScreenSource[]) => {
        setSources(pushed);
        setLoading(false);
      });
    }

    return () => { cleanup?.(); };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  const screens = sources.filter((s) => s.id.startsWith('screen:'));
  const windows = sources.filter((s) => s.id.startsWith('window:'));

  const filteredSources =
    filter === 'screen' ? screens : filter === 'window' ? windows : sources;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        ref={modalRef}
        className="bg-panel border border-border-subtle rounded-card w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col animate-scale-in shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h2 className="text-lg font-bold font-heading">Choose what to share</h2>
          <button
            onClick={onCancel}
            className="p-2 rounded-full hover:bg-white/5 transition-colors text-text-secondary"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 px-6 py-3 border-b border-border-subtle">
          {[
            { key: 'all', label: 'All', count: sources.length },
            { key: 'screen', label: 'Screens', icon: Monitor, count: screens.length },
            { key: 'window', label: 'Windows', icon: AppWindow, count: windows.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as typeof filter)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-accent-purple/20 text-accent-purple'
                  : 'text-text-secondary hover:bg-white/5'
              }`}
            >
              {tab.icon && <tab.icon size={14} />}
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Source Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
            </div>
          ) : filteredSources.length === 0 ? (
            <div className="text-center py-16 text-text-secondary">
              <p>No sources available</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {filteredSources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => onSelect(source.id)}
                  className="group flex flex-col rounded-card border border-border-subtle hover:border-accent-purple/50 overflow-hidden transition-all hover:shadow-lg hover:shadow-accent-purple/10"
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-void relative overflow-hidden">
                    <img
                      src={source.thumbnailDataUrl}
                      alt={source.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-accent-purple/0 group-hover:bg-accent-purple/10 transition-colors" />
                  </div>
                  {/* Label */}
                  <div className="p-3 flex items-center gap-2">
                    {source.appIconDataUrl && (
                      <img
                        src={source.appIconDataUrl}
                        alt=""
                        className="w-4 h-4 rounded"
                      />
                    )}
                    <span className="text-xs text-text-secondary truncate group-hover:text-text-primary transition-colors">
                      {source.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="px-6 py-3 border-t border-border-subtle text-xs text-text-secondary/60 flex items-center gap-2">
          <Monitor size={12} />
          System audio will be captured automatically when sharing a screen
        </div>
      </div>
    </div>
  );
}
