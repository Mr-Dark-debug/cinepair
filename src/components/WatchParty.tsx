import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, Plus, Trash2, Film, Link2, Check } from "lucide-react";
import { useRoomStore } from "../store/useRoomStore";
import { useSocket } from "../hooks/useSocket";

interface WatchSource {
  provider: string;
  label?: string;
  video_id?: string;
  url?: string;
  title?: string;
  embed_base_url?: string;
}

const DRIFT_THRESHOLD = 1.5; // seconds

const SIGNALING_URL = () =>
  (import.meta.env.VITE_SIGNALING_URL || "https://cinepair-signaling.onrender.com").replace(/\/$/, "");

export const WatchParty: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const store = useRoomStore();
  const socketService = useSocket();
  const [catalog, setCatalog] = useState<any[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [videoIdInput, setVideoIdInput] = useState("");
  const [inSync, setInSync] = useState(true);

  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const suppressSyncRef = useRef(false);
  const lastEmitRef = useRef(0);

  const source: WatchSource | null = store.watchSource;
  const provider = source?.provider || "youtube";

  // Load source catalog
  useEffect(() => {
    fetch(`${SIGNALING_URL()}/sources`)
      .then((r) => r.json())
      .then((d) => setCatalog(d.sources || []))
      .catch(() => {});
  }, []);

  // Ask for current playback state when entering
  useEffect(() => {
    socketService.requestSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Emit a sync update (throttled)
  const emitSync = useCallback(
    (playing: boolean, position?: number) => {
      const now = Date.now();
      if (now - lastEmitRef.current < 300) return;
      lastEmitRef.current = now;

      let pos: number;
      if (position !== undefined) {
        pos = position;
      } else if (provider === "youtube" && ytPlayerRef.current?.getCurrentTime) {
        pos = ytPlayerRef.current.getCurrentTime() || 0;
      } else if (videoRef.current) {
        pos = videoRef.current.currentTime || 0;
      } else {
        pos = 0;
      }
      const rate =
        provider === "youtube"
          ? ytPlayerRef.current?.getPlaybackRate?.() || 1
          : videoRef.current?.playbackRate || 1;
      socketService.syncUpdate(pos, playing, rate);
    },
    [provider, socketService]
  );

  // Load YouTube IFrame API and create/update the player
  const loadYouTube = useCallback(
    (videoId: string) => {
      const w = window as any;
      const create = () => {
        if (ytPlayerRef.current) {
          ytPlayerRef.current.loadVideoById(videoId);
          return;
        }
        ytPlayerRef.current = new w.YT.Player("cinepair-yt-player", {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: { autoplay: 0, controls: 1, rel: 0 },
          events: {
            onReady: () => {
              ytReadyRef.current = true;
            },
            onStateChange: (e: any) => {
              if (suppressSyncRef.current) return;
              emitSync(e.data === 1);
            },
          },
        });
      };

      if (w.YT && w.YT.Player) {
        create();
      } else {
        if (!document.getElementById("cinepair-yt-api")) {
          const tag = document.createElement("script");
          tag.id = "cinepair-yt-api";
          tag.src = "https://www.youtube.com/iframe_api";
          document.head.appendChild(tag);
        }
        w.onYouTubeIframeAPIReady = () => {
          ytReadyRef.current = true;
          create();
        };
        setTimeout(() => {
          if (w.YT && w.YT.Player && !ytPlayerRef.current) create();
        }, 2000);
      }
    },
    [emitSync]
  );

  // React to a newly selected source
  useEffect(() => {
    if (!source) return;
    if (source.provider === "youtube" && source.video_id) {
      loadYouTube(source.video_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.provider, source?.video_id, source?.url]);

  // Apply incoming sync_state (skip our own updates)
  useEffect(() => {
    const st = store.syncState;
    if (!st) return;
    if (st.updated_by === store.socketId) return;

    if (provider === "youtube") {
      if (ytPlayerRef.current && ytReadyRef.current) {
        const local = ytPlayerRef.current.getCurrentTime?.() || 0;
        if (Math.abs(local - st.position) > DRIFT_THRESHOLD) {
          suppressSyncRef.current = true;
          ytPlayerRef.current.seekTo(st.position, true);
          setTimeout(() => {
            suppressSyncRef.current = false;
          }, 600);
        }
        if (st.playing) ytPlayerRef.current.playVideo?.();
        else ytPlayerRef.current.pauseVideo?.();
        setInSync(false);
        setTimeout(() => setInSync(true), 1500);
      }
    } else if (videoRef.current) {
      const local = videoRef.current.currentTime || 0;
      if (Math.abs(local - st.position) > DRIFT_THRESHOLD) {
        videoRef.current.currentTime = st.position;
      }
      if (st.playing) videoRef.current.play().catch(() => {});
      else videoRef.current.pause();
      setInSync(false);
      setTimeout(() => setInSync(true), 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.syncState]);

  const chooseSource = (s: WatchSource) => {
    socketService.setWatchSource(s);
    // If it is a DRM app (no in-app player), open the service in a new tab
    // and guide the host to screen-share — this keeps Netflix/Prime/Hotstar
    // watchable together with zero lag confusion.
    const catalogEntry = catalog.find((c) => c.provider === (s as any).provider);
    if (catalogEntry && catalogEntry.can_sync === false && !(s as any).video_id && !(s as any).url) {
      const tpl = catalogEntry.watch_url_template;
      if (tpl && !tpl.includes("{id}")) {
        try { window.open(tpl, "_blank", "noopener"); } catch { /* noop */ }
        store.addToast(`Opened ${catalogEntry.label}. Now press Screen-Share with tab audio ON!`);
      }
    }
    setUrlInput("");
    setVideoIdInput("");
  };

  const queueCurrent = () => {
    if (!source) return;
    socketService.addToQueue(source);
    store.addToast("Added to Up Next queue.");
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = urlInput.trim();
    if (!u) return;
    const ytMatch = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
    const vimeoMatch = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    const dmMatch = u.match(/dailymotion\.com\/(?:video|embed\/video)\/([\w]+)/);
    if (ytMatch) {
      chooseSource({ provider: "youtube", video_id: ytMatch[1], title: u });
    } else if (vimeoMatch) {
      chooseSource({ provider: "vimeo", video_id: vimeoMatch[1], title: u });
    } else if (dmMatch) {
      chooseSource({ provider: "dailymotion", video_id: dmMatch[1], title: u });
    } else {
      chooseSource({ provider: "direct", url: u, title: u });
    }
  };

  const handleVideoIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = videoIdInput.trim();
    if (!id) return;
    chooseSource({ provider: "youtube", video_id: id, title: id });
  };

  const renderPlayer = () => {
    if (!source) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-3 p-8">
          <Film className="w-10 h-10 text-ink/40" />
          <p className="text-sm text-ink/70 font-bold">Pick something to watch together</p>
          <p className="text-xs text-ink/50 max-w-md">In-sync: YouTube, Vimeo, Dailymotion, direct MP4. DRM apps (Netflix, Prime, Hotstar…) open in a new tab — then Screen-Share with tab audio ON.</p>
          {DRM_APPS.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 pt-2 max-w-md">
              {DRM_APPS.map((d) => (
                <button
                  key={d.provider}
                  onClick={() => chooseSource({ provider: d.provider } as any)}
                  className="px-3 py-1.5 rounded-full bg-ink text-canvas text-[10px] font-bold cursor-pointer hover:opacity-90"
                  title={d.hint}
                >
                  Open {d.label} ↗
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (isDrmSource) {
      const entry = catalog.find((c) => c.provider === provider);
      return (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-3 p-8 bg-zinc-950 text-white">
          <Film className="w-10 h-10 opacity-60" />
          <p className="text-sm font-black">{entry?.label || provider} — screen-share mode</p>
          <p className="text-xs opacity-70 max-w-md">{entry?.hint || "Open the app, pick your show, then Screen-Share the tab with audio ON."}</p>
          <div className="flex gap-2">
            {entry?.watch_url_template && (
              <button
                onClick={() => window.open(entry.watch_url_template.replace("{id}", (source as any).video_id || ""), "_blank", "noopener")}
                className="px-4 py-2 rounded-full bg-white text-black text-[11px] font-black cursor-pointer"
              >
                Open {entry.label} ↗
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-white/30 text-[11px] font-bold cursor-pointer"
            >
              Back to room → Share Screen
            </button>
          </div>
        </div>
      );
    }
    if (provider === "youtube") {
      return <div id="cinepair-yt-player" className="w-full h-full" />;
    }
    if (provider === "direct") {
      return (
        <video
          ref={videoRef}
          src={source.url}
          controls
          playsInline
          disablePictureInPicture={false}
          className="w-full h-full"
          onPlay={() => emitSync(true)}
          onPause={() => emitSync(false)}
          onSeeked={() => emitSync(!(videoRef.current?.paused ?? true))}
          onRateChange={() => emitSync(!(videoRef.current?.paused ?? true))}
        />
      );
    }
    // vimeo / dailymotion embeds
    const base = source.embed_base_url || catalog.find((c) => c.provider === provider)?.embed_base_url || "";
    const src = base && (source.video_id || source.url) ? `${base}${source.video_id || source.url}` : source.url;
    return src ? (
      <iframe src={src} className="w-full h-full" allowFullScreen title={source.title || "watch"} />
    ) : (
      <div className="flex items-center justify-center h-full text-ink/50 text-sm font-bold">
        Unsupported source
      </div>
    );
  };

  const requestPip = async () => {
    // 1. Direct <video> PiP (real OS-level picture-in-picture).
    if (videoRef.current && typeof (videoRef.current as any).requestPictureInPicture === "function") {
      try {
        if ((document as any).pictureInPictureElement) {
          await (document as any).exitPictureInPicture();
        } else {
          await (videoRef.current as any).requestPictureInPicture();
        }
        return;
      } catch (e) {
        console.error("PiP failed:", e);
      }
    }
    // 2. YouTube iframe has its own miniplayer — point users there.
    if (provider === "youtube") {
      store.addToast("YouTube PiP: hover the player → right-click twice → Picture in picture.");
      return;
    }
    // 3. DRM screen-share flow also supports OS PiP via the Stage video.
    store.addToast("Tip: start Screen-Share, then use the Stage PiP button for floating video.");
  };

  const SYNCABLE = catalog.filter((c) => c.can_sync !== false);
  const DRM_APPS = catalog.filter((c) => c.can_sync === false && !["twitch"].includes(c.provider));
  const isDrmSource = !!catalog.find((c) => c.provider === provider && c.can_sync === false);

  return (
    <div className="fixed inset-0 z-[90] bg-surface-soft flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between h-12 px-4 bg-canvas border-b border-hairline shrink-0">
        <div className="flex items-center space-x-2">
          <Film className="w-4 h-4 text-ink" />
          <span className="text-xs font-black uppercase tracking-widest font-mono">Watch Party</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
              inSync ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"
            }`}
          >
            {inSync ? "In sync ✓" : "Re-syncing…"}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={requestPip}
            className="px-2.5 py-1 rounded-full border border-hairline text-[9px] font-bold text-ink hover:bg-surface-soft cursor-pointer"
            title="Picture-in-picture"
          >
            PiP
          </button>
          <button
            onClick={onClose}
            className="p-1.5 bg-canvas hover:bg-surface-soft border border-hairline text-zinc-500 hover:text-ink rounded-full transition-colors cursor-pointer"
            title="Close watch party"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Player + controls */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 min-h-0 bg-black">{renderPlayer()}</div>

          {/* Source picker */}
          <div className="flex items-center gap-2 px-4 py-3 bg-canvas border-t border-hairline overflow-x-auto shrink-0">
            {SYNCABLE.map((c) => (
              <button
                key={c.provider}
                onClick={() => chooseSource(c)}
                title={c.hint || c.label}
                className="px-3 py-1.5 rounded-full border border-hairline text-[10px] font-bold text-ink hover:bg-surface-soft cursor-pointer whitespace-nowrap shrink-0"
              >
                {c.label}
              </button>
            ))}
            <span className="text-[9px] font-black uppercase tracking-widest text-ink/40 shrink-0 pl-2">DRM →</span>
            {catalog.filter((c) => c.can_sync === false).map((c) => (
              <button
                key={c.provider}
                onClick={() => chooseSource(c)}
                title={c.hint || c.label}
                className="px-3 py-1.5 rounded-full bg-ink text-canvas text-[10px] font-bold cursor-pointer whitespace-nowrap shrink-0"
              >
                {c.label} ↗
              </button>
            ))}
            <form onSubmit={handleVideoIdSubmit} className="flex items-center gap-1 shrink-0">
              <input
                value={videoIdInput}
                onChange={(e) => setVideoIdInput(e.target.value)}
                placeholder="YouTube video ID"
                className="w-32 px-2 py-1.5 bg-canvas border border-hairline rounded text-[10px] font-bold focus:outline-none"
              />
              <button type="submit" className="p-1.5 rounded-full border border-hairline hover:bg-surface-soft cursor-pointer">
                <Check className="w-3.5 h-3.5 text-ink" />
              </button>
            </form>
            <form onSubmit={handleUrlSubmit} className="flex items-center gap-1 shrink-0">
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste URL…"
                className="w-40 px-2 py-1.5 bg-canvas border border-hairline rounded text-[10px] font-bold focus:outline-none"
              />
              <button type="submit" className="p-1.5 rounded-full border border-hairline hover:bg-surface-soft cursor-pointer">
                <Link2 className="w-3.5 h-3.5 text-ink" />
              </button>
            </form>
            {source && (
              <button
                onClick={queueCurrent}
                className="ml-auto px-3 py-1.5 rounded-full bg-ink text-canvas text-[10px] font-bold cursor-pointer shrink-0"
                title="Add current to queue"
              >
                <span className="flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Queue
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Queue sidebar */}
        <div className="w-64 border-l border-hairline bg-canvas overflow-y-auto shrink-0">
          <div className="px-4 py-3 border-b border-hairline text-[10px] font-black uppercase tracking-widest font-mono">
            Up Next
          </div>
          {store.queue.length === 0 ? (
            <p className="px-4 py-6 text-[11px] text-ink/50 font-bold text-center">Queue is empty</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {store.queue.map((q: WatchSource, i: number) => (
                <li key={`${q.provider}-${q.video_id || q.url}-${i}`} className="flex items-center justify-between px-4 py-2">
                  <span className="text-[11px] font-bold text-ink truncate">{q.title || q.video_id || q.url}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => chooseSource(q)}
                      className="p-1 hover:bg-surface-soft rounded cursor-pointer"
                      title="Play now"
                    >
                      <Film className="w-3.5 h-3.5 text-ink/70" />
                    </button>
                    <button
                      onClick={() => socketService.removeFromQueue(q)}
                      className="p-1 hover:bg-surface-soft rounded cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-ink/70" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
