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
  const [sourceError, setSourceError] = useState("");

  const ytPlayerRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
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
      .catch(() => setSourceError("Could not load watch services. Check the room connection."));
  }, []);

  // Ask for current playback state when entering
  useEffect(() => {
    socketService.requestSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Emit a sync update (throttled)
  const emitSync = useCallback(
    (playing: boolean, position?: number) => {
      if (suppressSyncRef.current) return;
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
        const container = ytContainerRef.current;
        if (!container) return;
        if (ytPlayerRef.current) {
          ytPlayerRef.current.cueVideoById(videoId);
          return;
        }
        const mount = document.createElement("div");
        container.replaceChildren(mount);
        ytPlayerRef.current = new w.YT.Player(mount, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: { autoplay: 0, controls: 1, rel: 0 },
          events: {
            onReady: () => {
              ytReadyRef.current = true;
              socketService.requestSync();
            },
            onStateChange: (e: any) => {
              if (suppressSyncRef.current) return;
              if (e.data === 1 || e.data === 2 || e.data === 0) emitSync(e.data === 1);
            },
            onError: () => setSourceError("This YouTube video cannot play here. Try a public video that allows embedding."),
            onAutoplayBlocked: () => setSourceError("Press Play once to allow synchronized playback in your browser."),
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
          create();
        };
        setTimeout(() => {
          if (w.YT && w.YT.Player && !ytPlayerRef.current) create();
        }, 2000);
      }
    },
    [emitSync, socketService]
  );

  // React to a newly selected source
  useEffect(() => {
    if (!source) return;
    if (source.provider === "youtube" && source.video_id) {
      loadYouTube(source.video_id);
    } else if (ytPlayerRef.current) {
      ytPlayerRef.current.destroy?.();
      ytPlayerRef.current = null;
      ytReadyRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.provider, source?.video_id, source?.url]);

  useEffect(() => () => {
    ytPlayerRef.current?.destroy?.();
    ytPlayerRef.current = null;
    ytReadyRef.current = false;
  }, []);

  useEffect(() => {
    if (provider !== "youtube") return;
    const timer = window.setInterval(() => {
      const player = ytPlayerRef.current;
      if (player?.getPlayerState?.() === 1 && !suppressSyncRef.current) emitSync(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [provider, emitSync]);

  // Apply incoming sync_state (skip our own updates)
  useEffect(() => {
    const st = store.syncState;
    if (!st) return;
    if (st.updated_by === store.socketId) return;

    // Remote playback events must not be broadcast back as local user actions.
    suppressSyncRef.current = true;
    const release = window.setTimeout(() => { suppressSyncRef.current = false; }, 700);

    if (provider === "youtube") {
      if (ytPlayerRef.current && ytReadyRef.current) {
        const local = ytPlayerRef.current.getCurrentTime?.() || 0;
        const target = st.position + (st.playing ? Math.max(0, Date.now() / 1000 - st.updated_at) * st.rate : 0);
        if (Math.abs(local - target) > DRIFT_THRESHOLD) {
          ytPlayerRef.current.seekTo(target, true);
        }
        ytPlayerRef.current.setPlaybackRate?.(st.rate);
        if (st.playing) ytPlayerRef.current.playVideo?.();
        else ytPlayerRef.current.pauseVideo?.();
        setInSync(false);
        setTimeout(() => setInSync(true), 1500);
      }
    } else if (videoRef.current) {
      const local = videoRef.current.currentTime || 0;
      const target = st.position + (st.playing ? Math.max(0, Date.now() / 1000 - st.updated_at) * st.rate : 0);
      if (Math.abs(local - target) > DRIFT_THRESHOLD) {
        videoRef.current.currentTime = target;
      }
      videoRef.current.playbackRate = st.rate;
      if (st.playing) videoRef.current.play().catch(() => setSourceError("Press Play once to allow synchronized playback in your browser."));
      else videoRef.current.pause();
      setInSync(false);
      setTimeout(() => setInSync(true), 1500);
    }
    return () => { window.clearTimeout(release); suppressSyncRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.syncState]);

  const chooseSource = async (s: WatchSource) => {
    setSourceError("");
    const result = await socketService.setWatchSource(s);
    if (!result.success) {
      setSourceError(result.error || "Could not select this source.");
      return;
    }
    setUrlInput("");
    setVideoIdInput("");
  };

  const queueCurrent = async () => {
    if (!source) return;
    const result = await socketService.addToQueue(source);
    if (result.success) store.addToast("Added to Up Next queue.");
    else setSourceError(result.error || "Could not update queue.");
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = urlInput.trim();
    if (!u) return;
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "https:") throw new Error("Use an HTTPS link.");
      const host = parsed.hostname.toLowerCase();
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
        const id = host === "youtu.be" ? parts[0] : parsed.searchParams.get("v") || (parts[0] === "shorts" || parts[0] === "embed" ? parts[1] : "");
        if (!id || !/^[\w-]{11}$/.test(id)) throw new Error("This YouTube link has no valid video ID.");
        void chooseSource({ provider: "youtube", video_id: id, title: u });
      } else if (host === "vimeo.com" || host === "www.vimeo.com") {
        const id = parts[parts.length - 1];
        if (!id || !/^\d+$/.test(id)) throw new Error("This Vimeo link has no valid video ID.");
        void chooseSource({ provider: "vimeo", video_id: id, title: u });
      } else if (host === "dailymotion.com" || host === "www.dailymotion.com") {
        const id = parts[parts.length - 1];
        if (!id || !/^[A-Za-z0-9]+$/.test(id)) throw new Error("This Dailymotion link has no valid video ID.");
        void chooseSource({ provider: "dailymotion", video_id: id, title: u });
      } else if (/\.(mp4|webm|ogg)$/i.test(parsed.pathname)) {
        void chooseSource({ provider: "direct", url: u, title: u });
      } else {
        throw new Error("Use a YouTube, Vimeo, Dailymotion, or direct video link.");
      }
    } catch (error) {
      setSourceError(error instanceof Error ? error.message : "Invalid watch link.");
    }
  };

  const handleVideoIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = videoIdInput.trim();
    if (!/^[\w-]{11}$/.test(id)) return setSourceError("Enter an 11-character YouTube video ID.");
    void chooseSource({ provider: "youtube", video_id: id, title: id });
  };

  const renderPlayer = () => {
    if (!source) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-3 p-8">
          <Film className="w-10 h-10 text-ink/40" />
          <p className="text-sm text-ink/70 font-bold">Pick something to watch together</p>
          <p className="text-xs text-ink/50 max-w-md">Sync a public YouTube video or direct HTTPS video file. Other services open separately; protected playback may block screen capture.</p>
          {DRM_APPS.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 pt-2 max-w-md">
              {DRM_APPS.map((d) => (
                <button
                  key={d.provider}
                  onClick={() => void chooseSource({ provider: d.provider, title: d.label })}
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
    if (isExternalSource) {
      const entry = catalog.find((c) => c.provider === provider);
      return (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-3 p-8 bg-zinc-950 text-white">
          <Film className="w-10 h-10 opacity-60" />
          <p className="text-sm font-black">{entry?.label || provider} — external service</p>
          <p className="text-xs opacity-70 max-w-md">{entry?.hint || "Open the service separately."} Each person may need access. Screen capture and audio depend on your browser and this service's protection.</p>
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
              Back to room
            </button>
          </div>
        </div>
      );
    }
    if (provider === "youtube") {
      return <div ref={ytContainerRef} className="w-full h-full" />;
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
          onPlay={() => { setSourceError(""); emitSync(true); }}
          onPause={() => emitSync(false)}
          onSeeked={() => emitSync(!(videoRef.current?.paused ?? true))}
          onRateChange={() => emitSync(!(videoRef.current?.paused ?? true))}
          onLoadedMetadata={() => socketService.requestSync()}
          onError={() => setSourceError("This video could not load. Check its HTTPS URL, format, and access permissions.")}
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
  const DRM_APPS = catalog.filter((c) => c.can_sync === false && !["twitch", "vimeo", "dailymotion"].includes(c.provider));
  const isExternalSource = !!catalog.find((c) => c.provider === provider && c.can_sync === false);

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
            {sourceError ? "Playback issue" : isExternalSource ? "Launch mode" : source ? (inSync ? "Sync active" : "Applying sync…") : "Choose a source"}
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
          {sourceError && <p role="alert" className="px-4 py-2 bg-rose-500/10 text-rose-600 text-xs font-bold">{sourceError}</p>}

          {/* Source picker */}
          <div className="px-4 py-3 bg-canvas border-t border-hairline shrink-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <form onSubmit={handleUrlSubmit} className="flex items-center gap-1 flex-1 min-w-[180px]">
                <input id="cinepair-watch-url-input" aria-label="Watch link" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="Paste YouTube or direct video link…" className="w-full min-w-0 px-3 py-2 bg-canvas border border-hairline rounded text-[11px] font-bold focus:outline-none focus:border-ink" />
                <button type="submit" aria-label="Use watch link" className="p-2 rounded-full border border-hairline hover:bg-surface-soft cursor-pointer"><Link2 className="w-3.5 h-3.5 text-ink" /></button>
              </form>
              <form onSubmit={handleVideoIdSubmit} className="flex items-center gap-1">
                <input id="cinepair-video-id-input" aria-label="YouTube video ID" value={videoIdInput} onChange={(e) => setVideoIdInput(e.target.value)} placeholder="YouTube ID" className="w-28 px-3 py-2 bg-canvas border border-hairline rounded text-[11px] font-bold focus:outline-none focus:border-ink" />
                <button type="submit" aria-label="Use YouTube ID" className="p-2 rounded-full border border-hairline hover:bg-surface-soft cursor-pointer"><Check className="w-3.5 h-3.5 text-ink" /></button>
              </form>
              {source && <button onClick={queueCurrent} className="px-3 py-2 rounded-full bg-ink text-canvas text-[10px] font-bold cursor-pointer" title="Add current to queue"><span className="flex items-center gap-1"><Plus className="w-3 h-3" /> Queue</span></button>}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {SYNCABLE.map((c) => <button key={c.provider} onClick={() => document.getElementById(c.provider === "youtube" ? "cinepair-video-id-input" : "cinepair-watch-url-input")?.focus()} title={c.hint || c.label} className="px-3 py-1.5 rounded-full border border-hairline text-[10px] font-bold text-ink hover:bg-surface-soft cursor-pointer whitespace-nowrap shrink-0">{c.label}</button>)}
              <span className="text-[9px] font-black uppercase tracking-widest text-ink/40 shrink-0 pl-2">External →</span>
              {catalog.filter((c) => c.can_sync === false).map((c) => <button key={c.provider} onClick={() => c.provider === "vimeo" || c.provider === "dailymotion" ? document.getElementById("cinepair-watch-url-input")?.focus() : void chooseSource({ provider: c.provider, title: c.label })} title={c.hint || c.label} className="px-3 py-1.5 rounded-full bg-ink text-canvas text-[10px] font-bold cursor-pointer whitespace-nowrap shrink-0">{c.label} ↗</button>)}
            </div>
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
                      onClick={async () => {
                        const result = await socketService.removeFromQueue(q);
                        if (!result.success) setSourceError(result.error || "Could not remove video.");
                      }}
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
