import React, { useState, useEffect } from "react";
import { 
  X, 
  User, 
  Video, 
  Mic, 
  RefreshCw, 
  Check, 
  Moon, 
  Sun, 
  AlertCircle,
  RotateCw
} from "lucide-react";
import { useRoomStore } from "../store/useRoomStore";
import { check } from "@tauri-apps/plugin-updater";
import logoDarkMode from "../assets/logo dark mode.png";
import logoLightMode from "../assets/logo light mode.png";

interface AppSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
}

export const AppSettings: React.FC<AppSettingsProps> = ({ 
  isOpen, 
  onClose,
  theme,
  setTheme
}) => {
  const store = useRoomStore();

  // Local state for temporary form edits
  const [nickname, setNickname] = useState(store.defaultNickname);
  const [cameraOn, setCameraOn] = useState(store.defaultCameraOn);
  const [micOn, setMicOn] = useState(store.defaultMicOn);
  const [autoCheck, setAutoCheck] = useState(store.autoCheckUpdates);
  const [activeTab, setActiveTab] = useState<"profile" | "media" | "updates">("profile");
  const [appVersion, setAppVersion] = useState("0.1.4");

  // Sync state when modal is opened
  useEffect(() => {
    if (isOpen) {
      setNickname(store.defaultNickname);
      setCameraOn(store.defaultCameraOn);
      setMicOn(store.defaultMicOn);
      setAutoCheck(store.autoCheckUpdates);
    }
  }, [isOpen, store]);

  useEffect(() => {
    const loadVersion = async () => {
      const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;
      if (!isTauri) return;

      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        setAppVersion(await getVersion());
      } catch (error) {
        console.warn("Unable to read native app version:", error);
      }
    };

    loadVersion();
  }, []);

  if (!isOpen) return null;

  // Handle saving non-updater settings
  const handleSaveSettings = () => {
    store.setDefaultNickname(nickname.trim());
    store.setDefaultCameraOn(cameraOn);
    store.setDefaultMicOn(micOn);
    store.setAutoCheckUpdates(autoCheck);
    store.addToast("Settings saved successfully.");
    onClose();
  };

  // Relaunch the application to apply the update
  const handleRelaunch = async () => {
    try {
      store.addToast("Relaunching CinePair...");
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (err) {
      console.error("Failed to relaunch application:", err);
      store.addToast("⚠️ Relaunch failed. Please restart the app manually.");
    }
  };

  // Run manually triggered update check
  const handleCheckForUpdates = async () => {
    const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;
    if (!isTauri) {
      store.addToast("Signaling: Updates are only available in the desktop app.");
      return;
    }

    try {
      store.setUpdaterStatus("checking");
      const update = await check();
      
      if (update && update.available) {
        store.setUpdaterInfo(update);
        store.setUpdaterStatus("available");
      } else {
        store.setUpdaterStatus("done");
        store.addToast("🎉 CinePair is up to date!");
      }
    } catch (err: any) {
      console.error("Manual update check failed:", err);
      store.setUpdaterStatus("error");
      store.setUpdaterError(err.message || "Could not reach update server.");
    }
  };

  // Run the download and install of the update
  const handleStartUpdate = async () => {
    if (!store.updaterInfo) return;

    const formatBytes = (bytes: number) => {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    try {
      store.setUpdaterStatus("downloading");
      store.setUpdaterProgress(0);

      let downloaded = 0;
      let contentLength = 0;

      await store.updaterInfo.downloadAndInstall((event: any) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength || 0;
            store.setUpdaterTotalSize(formatBytes(contentLength));
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            store.setUpdaterDownloadedSize(formatBytes(downloaded));
            if (contentLength > 0) {
              const progress = Math.round((downloaded / contentLength) * 100);
              store.setUpdaterProgress(progress);
            }
            break;
          case "Finished":
            // Set downloaded state to wait for user's explicit relaunch
            store.setUpdaterStatus("downloaded");
            break;
        }
      });
    } catch (err: any) {
      console.error("Update download failed:", err);
      store.setUpdaterStatus("error");
      store.setUpdaterError(err.message || "An error occurred during update.");
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex justify-center items-center p-4 animate-fade-in">
      {/* Dark overlay backdrop */}
      <div onClick={onClose} className="absolute inset-0 bg-black/65 backdrop-blur-sm" />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-canvas border-2 border-ink rounded-xl overflow-hidden shadow-soft flex flex-col h-[550px] text-ink animate-bounce-short">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4.5 border-b border-hairline bg-surface-soft">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-ink shrink-0" />
            <span className="text-xs font-black uppercase tracking-widest font-mono">App Preferences</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-surface-soft rounded-full text-ink cursor-pointer transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-hairline bg-surface-soft/50 text-xs font-bold font-mono">
          <button 
            onClick={() => setActiveTab("profile")}
            className={`flex-1 py-3 text-center border-r border-hairline transition-colors cursor-pointer ${
              activeTab === "profile" 
                ? "bg-canvas text-ink border-b-2 border-b-ink font-black" 
                : "text-zinc-500 hover:bg-surface-soft/85"
            }`}
          >
            👤 USER PROFILE
          </button>
          <button 
            onClick={() => setActiveTab("media")}
            className={`flex-1 py-3 text-center border-r border-hairline transition-colors cursor-pointer ${
              activeTab === "media" 
                ? "bg-canvas text-ink border-b-2 border-b-ink font-black" 
                : "text-zinc-500 hover:bg-surface-soft/85"
            }`}
          >
            📹 AUDIO & VIDEO
          </button>
          <button 
            onClick={() => setActiveTab("updates")}
            className={`flex-1 py-3 text-center transition-colors cursor-pointer ${
              activeTab === "updates" 
                ? "bg-canvas text-ink border-b-2 border-b-ink font-black" 
                : "text-zinc-500 hover:bg-surface-soft/85"
            }`}
          >
            🚀 SYSTEM UPDATES
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          {activeTab === "profile" && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex flex-col space-y-2">
                <label className="text-xs font-bold text-zinc-500 font-mono uppercase tracking-wider">
                  Default Screen Nickname
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Enter your default nickname..."
                    maxLength={15}
                    className="w-full pl-11 pr-4 py-3 bg-canvas border border-hairline rounded-xl text-xs font-bold text-ink outline-none focus:border-ink transition-colors"
                  />
                </div>
                <p className="text-[10px] text-zinc-550 leading-relaxed font-semibold">
                  This nickname will be prefilled automatically whenever you create or join a Cinema Room.
                </p>
              </div>

              {/* Theme Settings block */}
              <div className="flex items-center justify-between bg-block-lime border border-ink p-4 rounded-xl rotate-[0.5deg]">
                <div className="flex flex-col space-y-0.5 max-w-[70%]">
                  <span className="text-xs font-extrabold text-ink">Dark Mode Aesthetics</span>
                  <span className="text-[10px] text-zinc-700 leading-normal font-bold">
                    Toggle high contrast dark theme mode for late-night watch parties.
                  </span>
                </div>
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-full border border-ink bg-canvas hover:bg-surface-soft text-ink text-[10px] font-black transition-all shadow-sm cursor-pointer hover:scale-[1.02]"
                >
                  {theme === "dark" ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                      <span>Light Mode</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-zinc-700 fill-zinc-700 shrink-0" />
                      <span>Dark Mode</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === "media" && (
            <div className="space-y-5 animate-fade-in">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest pl-1 font-mono">
                Meeting Room Setup Preferences
              </span>

              {/* Default Camera Toggle */}
              <div className="flex items-center justify-between border border-hairline p-4 rounded-xl hover:bg-surface-soft/40 transition-colors">
                <div className="flex items-center space-x-3.5">
                  <div className={`p-2 rounded-full border border-hairline shrink-0 ${cameraOn ? "bg-block-lime text-ink" : "bg-surface-soft text-zinc-400"}`}>
                    <Video className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black">Join with Camera On</span>
                    <span className="text-[9px] text-zinc-550 font-bold mt-0.5">Automatically activate video feed on room entry.</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={cameraOn}
                  onChange={(e) => setCameraOn(e.target.checked)}
                  className="w-4 h-4 border-hairline rounded cursor-pointer accent-ink"
                />
              </div>

              {/* Default Mic Toggle */}
              <div className="flex items-center justify-between border border-hairline p-4 rounded-xl hover:bg-surface-soft/40 transition-colors">
                <div className="flex items-center space-x-3.5">
                  <div className={`p-2 rounded-full border border-hairline shrink-0 ${micOn ? "bg-block-lime text-ink" : "bg-surface-soft text-zinc-400"}`}>
                    <Mic className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black">Join with Mic Unmuted</span>
                    <span className="text-[9px] text-zinc-550 font-bold mt-0.5">Keep audio microphone enabled automatically on entrance.</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={micOn}
                  onChange={(e) => setMicOn(e.target.checked)}
                  className="w-4 h-4 border-hairline rounded cursor-pointer accent-ink"
                />
              </div>
            </div>
          )}

          {activeTab === "updates" && (
            <div className="space-y-4 animate-fade-in flex flex-col h-full min-h-0">
              <div className="flex items-center justify-between bg-surface-soft border border-hairline p-3.5 rounded-xl shrink-0">
                <div className="flex items-center space-x-3">
                  <img 
                    src={theme === "dark" ? logoDarkMode : logoLightMode} 
                    alt="CinePair Logo" 
                    className="h-5 w-auto shrink-0" 
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-black">CinePair Engine</span>
                    <span className="text-[9px] text-zinc-500 font-mono font-bold">App Version: v{appVersion}</span>
                  </div>
                </div>
                
                {store.updaterStatus === "idle" || store.updaterStatus === "done" ? (
                  <button
                    onClick={handleCheckForUpdates}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-ink hover:bg-zinc-800 text-canvas rounded-full text-[10px] font-black transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 shrink-0" />
                    <span>Check Now</span>
                  </button>
                ) : null}
              </div>

              {/* Status Display Area */}
              <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-3">
                {/* Checking Status */}
                {store.updaterStatus === "checking" && (
                  <div className="flex justify-center items-center py-6 space-x-2 text-xs font-bold text-zinc-500 font-mono">
                    <div className="w-3.5 h-3.5 border-2 border-zinc-300 border-t-ink rounded-full animate-spin" />
                    <span>Contacting update servers...</span>
                  </div>
                )}

                {/* Available for Download Status */}
                {store.updaterStatus === "available" && store.updaterInfo && (
                  <div className="bg-block-cream border border-ink p-4.5 rounded-xl space-y-4 animate-fade-in">
                    <div className="flex items-start space-x-2.5">
                      <img 
                        src={theme === "dark" ? logoDarkMode : logoLightMode} 
                        alt="CinePair Logo" 
                        className="h-5 w-auto shrink-0 mt-0.5" 
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-black">Upgrade Available to v{store.updaterInfo.version}</span>
                        <span className="text-[9px] text-zinc-550 font-bold mt-0.5">P2P streaming optimizations and enhancements are ready.</span>
                      </div>
                    </div>

                    {store.updaterInfo.body && (
                      <div className="flex flex-col gap-1 pl-1">
                        <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Changelog</span>
                        <div className="w-full max-h-24 bg-canvas border border-hairline rounded-lg p-2.5 overflow-y-auto text-[10px] leading-relaxed text-zinc-700 font-mono whitespace-pre-wrap">
                          {store.updaterInfo.body}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleStartUpdate}
                      className="w-full py-2.5 bg-ink hover:bg-zinc-800 text-canvas rounded-full text-[10px] font-black shadow-sm transition-colors duration-200 cursor-pointer flex justify-center items-center gap-1.5"
                    >
                      Download & Install Update
                    </button>
                  </div>
                )}

                {/* Downloading Status */}
                {store.updaterStatus === "downloading" && (
                  <div className="bg-surface-soft border border-hairline p-4 rounded-xl space-y-3.5 animate-fade-in shadow-inner">
                    <div className="flex justify-between items-center text-[9px] font-bold font-mono uppercase tracking-wider text-zinc-500">
                      <span>Downloading patch package...</span>
                      <span className="text-accent-magenta font-black">{store.updaterProgress}%</span>
                    </div>
                    {/* Progress Track */}
                    <div className="w-full h-2 bg-canvas border border-hairline rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent-magenta transition-all duration-200 animate-pulse"
                        style={{ width: `${store.updaterProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[8px] font-bold text-zinc-400 font-mono">
                      <span>{store.updaterDownloadedSize} of {store.updaterTotalSize}</span>
                      <span>Preparing installer files...</span>
                    </div>
                  </div>
                )}

                {/* Downloaded successfully -> Waiting for restart! */}
                {store.updaterStatus === "downloaded" && (
                  <div className="bg-block-lime border-2 border-ink p-4.5 rounded-xl space-y-3.5 rotate-[-0.5deg] animate-fade-in shadow-soft">
                    <div className="flex items-start space-x-2.5">
                      <Check className="w-5 h-5 text-ink shrink-0 mt-0.5 bg-canvas border border-ink rounded-full p-0.5" />
                      <div className="flex flex-col">
                        <span className="text-xs font-black">System Patch Installed!</span>
                        <span className="text-[9px] text-zinc-700 leading-normal font-bold mt-0.5">
                          The update has been downloaded and staged successfully. Restart now to apply!
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleRelaunch}
                      className="w-full py-2.5 bg-ink hover:bg-zinc-800 text-canvas rounded-full text-[10px] font-black shadow-sm transition-colors duration-200 cursor-pointer flex justify-center items-center gap-1.5"
                    >
                      <RotateCw className="w-3.5 h-3.5 shrink-0" />
                      Relaunch & Apply Update
                    </button>
                  </div>
                )}

                {/* Error Status */}
                {store.updaterStatus === "error" && (
                  <div className="flex items-start space-x-2.5 bg-block-pink border border-ink p-4 rounded-xl text-xs text-ink leading-relaxed font-bold animate-fade-in shadow-sm">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                    <div className="flex flex-col gap-1">
                      <span>Update Failed</span>
                      <p className="text-[9px] text-rose-800 leading-normal font-semibold font-mono">{store.updaterError}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Automatic update check toggle */}
              <div className="flex items-center justify-between border-t border-hairline pt-3.5 shrink-0">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Auto Check on Launch</span>
                <input
                  type="checkbox"
                  checked={autoCheck}
                  onChange={(e) => setAutoCheck(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-ink"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-hairline bg-surface-soft">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-canvas hover:bg-surface-soft border border-hairline text-ink rounded-full text-[10px] font-extrabold transition-colors duration-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveSettings}
            className="px-5 py-2.5 bg-ink hover:bg-zinc-800 text-canvas border border-ink rounded-full text-[10px] font-black transition-colors duration-200 cursor-pointer shadow-sm"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
