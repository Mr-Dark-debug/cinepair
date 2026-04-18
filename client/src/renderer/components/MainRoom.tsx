/**
 * @fileoverview Main co-watching room component for CinePair.
 * The heart of the app: shared screen area, webcam previews, chat sidebar,
 * and bottom control bar with screen sharing, audio, and room management.
 * @module components/MainRoom
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Film,
  Monitor,
  MonitorOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Maximize,
  LogOut,
  MessageSquare,
  Volume2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRoomStore } from '../stores/roomStore';
import { useMediaSlice } from '../stores/mediaSlice';
import { useChatSlice } from '../stores/chatSlice';
import { signalingClient } from '../lib/signaling';
import { PeerHandler } from '../lib/peerConnection';
import Chat from './Chat';
import AdminControls from './AdminControls';

/**
 * Main Room — the co-watching experience.
 * Manages peer connections, local/remote streams, and the full UI layout.
 */
export default function MainRoom(): JSX.Element {
  const roomCode = useRoomStore((s) => s.roomCode);
  const isAdmin = useRoomStore((s) => s.isAdmin);
  const nickname = useRoomStore((s) => s.nickname);
  const users = useRoomStore((s) => s.users);
  const isCameraOn = useMediaSlice((s) => s.isCameraOn);
  const isMicOn = useMediaSlice((s) => s.isMicOn);
  const isScreenSharing = useMediaSlice((s) => s.isScreenSharing);
  const setScreenSharing = useMediaSlice((s) => s.setScreenSharing);
  const toggleCamera = useMediaSlice((s) => s.toggleCamera);
  const toggleMic = useMediaSlice((s) => s.toggleMic);
  const resetRoom = useRoomStore((s) => s.resetRoom);
  const addMessage = useChatSlice((s) => s.addMessage);

  // Refs for media elements
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);

  // State
  const [peerHandler, setPeerHandler] = useState<PeerHandler | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [showChat, setShowChat] = useState(true);
  const [connectionState, setConnectionState] = useState<string>('connecting');
  const [showScreenPicker, setShowScreenPicker] = useState(false);

  // Find the remote user
  const remoteUser = users.find(
    (u) => u.userId !== signalingClient.userId
  );

  // ─────────────────────────────────────────────────────────
  // Initialize local media & peer connection
  // ─────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    let stream: MediaStream | null = null;
    let peer: PeerHandler | null = null;

    const init = async () => {
      try {
        // Get local webcam stream
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        setLocalStream(stream);

        // Display local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Create peer connection if we have a remote user
        if (remoteUser && roomCode) {
          peer = new PeerHandler(roomCode, remoteUser.userId, isAdmin, {
            onRemoteWebcamStream: (remoteStream) => {
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
              }
            },
            onRemoteScreenStream: (screenStream) => {
              setRemoteScreenStream(screenStream);
              if (screenShareRef.current) {
                screenShareRef.current.srcObject = screenStream;
              }
            },
            onRemoteStreamRemoved: (type) => {
              if (type === 'screen') {
                setRemoteScreenStream(null);
                if (screenShareRef.current) {
                  screenShareRef.current.srcObject = null;
                }
              }
            },
            onDataChannelMessage: (msg) => {
              try {
                const data = JSON.parse(msg) as { type: string; nickname: string; message: string; timestamp: number };
                if (data.type === 'chat') {
                  addMessage({
                    id: `${data.timestamp}-dc`,
                    senderId: remoteUser.userId,
                    senderNickname: data.nickname,
                    message: data.message,
                    timestamp: data.timestamp,
                    isSelf: false,
                  });
                }
              } catch {
                // Not JSON, ignore
              }
            },
            onConnectionStateChange: (state) => {
              setConnectionState(state);
            },
            onDataChannelReady: () => {
              console.log('[MainRoom] DataChannel ready for chat');
            },
          });

          // Add local stream to peer connection
          peer.addLocalStream(stream, 'webcam');

          // If we're the initiator (admin), create the offer
          if (isAdmin) {
            await peer.createOffer('webcam');
          }

          setPeerHandler(peer);
        }
      } catch (err) {
        console.error('[MainRoom] Failed to initialize:', err);
        toast.error('Failed to access camera/microphone. Check permissions.');
      }
    };

    void init();

    return () => {
      mounted = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (peer) {
        peer.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteUser?.userId]);

  // ─────────────────────────────────────────────────────────
  // Camera/Mic Toggle
  // ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => {
        t.enabled = isCameraOn;
      });
    }
  }, [isCameraOn, localStream]);

  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = isMicOn;
      });
    }
  }, [isMicOn, localStream]);

  // ─────────────────────────────────────────────────────────
  // Screen Sharing
  // ─────────────────────────────────────────────────────────

  const startScreenShare = useCallback(async () => {
    if (!roomCode || !peerHandler) return;

    try {
      // Use getDisplayMedia which triggers Electron's setDisplayMediaRequestHandler
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true, // Request system audio
      });

      // Add screen stream to peer connection
      peerHandler.addLocalStream(screenStream, 'screen');
      await peerHandler.createOffer('screen');

      // Display locally in the main area
      if (screenShareRef.current) {
        screenShareRef.current.srcObject = screenStream;
      }

      setScreenSharing(true);
      signalingClient.toggleScreenShare(roomCode, true);

      // Handle when user stops sharing via the browser's built-in stop button
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      toast.success('Screen sharing started – system audio included 🖥️');
      setShowScreenPicker(false);
    } catch (err) {
      console.error('[MainRoom] Screen share error:', err);
      toast.error('Failed to start screen sharing');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, peerHandler, setScreenSharing]);

  const stopScreenShare = useCallback(() => {
    if (!roomCode || !peerHandler) return;

    peerHandler.removeLocalStream('screen');
    setScreenSharing(false);
    signalingClient.toggleScreenShare(roomCode, false);

    if (screenShareRef.current) {
      screenShareRef.current.srcObject = null;
    }

    toast.info('Screen sharing stopped');
  }, [roomCode, peerHandler, setScreenSharing]);

  // ─────────────────────────────────────────────────────────
  // Leave Room
  // ─────────────────────────────────────────────────────────

  const handleLeaveRoom = useCallback(() => {
    if (roomCode) {
      signalingClient.leaveRoom(roomCode);
    }
    if (peerHandler) {
      peerHandler.destroy();
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    resetRoom();
    toast.info('Left the room');
  }, [roomCode, peerHandler, localStream, resetRoom]);

  // ─────────────────────────────────────────────────────────
  // Fullscreen
  // ─────────────────────────────────────────────────────────

  const toggleFullscreen = useCallback(async () => {
    try {
      if (window.cinepair) {
        await window.cinepair.toggleFullscreen();
      } else {
        // Fallback for browser dev
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        } else {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  // ─────────────────────────────────────────────────────────
  // Send Chat Message (via peer handler)
  // ─────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (message: string) => {
      if (!roomCode) return;

      const timestamp = Date.now();

      // Try DataChannel first, fall back to signaling
      if (peerHandler) {
        peerHandler.sendMessage(
          JSON.stringify({
            type: 'chat',
            nickname,
            message,
            timestamp,
          })
        );
      } else {
        signalingClient.sendChatMessage(roomCode, message);
      }

      // Add to local messages
      addMessage({
        id: `${timestamp}-self`,
        senderId: signalingClient.userId || '',
        senderNickname: nickname,
        message,
        timestamp,
        isSelf: true,
      });
    },
    [roomCode, peerHandler, nickname, addMessage]
  );

  return (
    <div className="h-full flex flex-col bg-void">
      {/* ─── Top Bar ─────────────────────────────────────── */}
      <div className="drag-region flex items-center justify-between px-6 py-3 border-b border-border-subtle bg-panel/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 no-drag">
          <Film size={20} className="text-accent-purple" />
          <span className="font-heading font-bold">
            Cine<span className="text-accent-purple">Pair</span>
          </span>
          <span className="text-xs bg-void px-2 py-0.5 rounded font-mono text-text-secondary">
            {roomCode}
          </span>
          {isAdmin && (
            <span className="text-xs bg-accent-purple/20 text-accent-purple px-2 py-0.5 rounded-full font-semibold">
              ADMIN
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 no-drag">
          {/* Connection status */}
          <div className="flex items-center gap-1.5 text-xs text-text-secondary mr-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connectionState === 'connected'
                  ? 'bg-accent-teal'
                  : connectionState === 'connecting'
                  ? 'bg-warning animate-pulse'
                  : 'bg-danger'
              }`}
            />
            {connectionState === 'connected' ? 'Connected' : connectionState}
          </div>

          {/* Toggle chat */}
          <button
            onClick={() => setShowChat(!showChat)}
            className={`btn-ghost p-2 ${showChat ? 'text-accent-purple' : ''}`}
            title="Toggle chat"
          >
            <MessageSquare size={18} />
          </button>
        </div>
      </div>

      {/* ─── Main Content Area ────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Main video area */}
        <div className="flex-1 flex flex-col p-4 gap-4">
          {/* Shared Screen / Main View */}
          <div className="flex-1 video-container relative bg-void/80">
            {isScreenSharing || remoteScreenStream ? (
              <video
                ref={screenShareRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-text-secondary/40">
                <Monitor size={64} className="mb-4" />
                <p className="text-lg font-medium">
                  {isAdmin
                    ? 'Click "Share Screen" to start sharing'
                    : 'Waiting for screen share...'}
                </p>
                <p className="text-sm mt-2">
                  Share a movie, YouTube, or any window
                </p>
              </div>
            )}

            {/* System audio indicator */}
            {isScreenSharing && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-void/80 px-3 py-1.5 rounded-full text-xs text-accent-teal border border-accent-teal/20">
                <Volume2 size={14} className="animate-pulse" />
                System Audio Active
              </div>
            )}
          </div>

          {/* Webcam previews */}
          <div className="flex gap-4 h-32">
            {/* Local webcam */}
            <div className="video-container w-44 relative group">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${!isCameraOn ? 'hidden' : ''}`}
              />
              {!isCameraOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-panel">
                  <VideoOff size={24} className="text-text-secondary" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 text-xs bg-void/80 px-2 py-0.5 rounded">
                {nickname} (You)
              </div>
            </div>

            {/* Remote webcam */}
            <div className="video-container w-44 relative">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {!remoteUser && (
                <div className="absolute inset-0 flex items-center justify-center bg-panel">
                  <p className="text-xs text-text-secondary">Waiting...</p>
                </div>
              )}
              {remoteUser && (
                <div className="absolute bottom-2 left-2 text-xs bg-void/80 px-2 py-0.5 rounded">
                  {remoteUser.nickname}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Chat Sidebar */}
        {showChat && (
          <div className="w-80 border-l border-border-subtle flex flex-col animate-slide-left">
            <Chat onSendMessage={sendMessage} />
          </div>
        )}
      </div>

      {/* ─── Bottom Control Bar ───────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-border-subtle bg-panel/50 backdrop-blur-sm no-drag">
        {/* Left: Media controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleCamera}
            className={`p-3 rounded-full transition-all duration-200 ${
              isCameraOn
                ? 'bg-white/10 hover:bg-white/15 text-text-primary'
                : 'bg-danger/20 text-danger hover:bg-danger/30'
            }`}
            title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
          >
            {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          <button
            onClick={toggleMic}
            className={`p-3 rounded-full transition-all duration-200 ${
              isMicOn
                ? 'bg-white/10 hover:bg-white/15 text-text-primary'
                : 'bg-danger/20 text-danger hover:bg-danger/30'
            }`}
            title={isMicOn ? 'Mute mic' : 'Unmute mic'}
          >
            {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
        </div>

        {/* Center: Screen share controls (admin only) */}
        <div className="flex items-center gap-3">
          {isAdmin && (
            <>
              {isScreenSharing ? (
                <button
                  onClick={stopScreenShare}
                  className="btn-danger flex items-center gap-2 py-2"
                >
                  <MonitorOff size={18} />
                  Stop Sharing
                </button>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setShowScreenPicker(!showScreenPicker)}
                    className="btn-purple flex items-center gap-2 py-2"
                  >
                    <Monitor size={18} />
                    Share Screen
                  </button>

                  {/* Screen Share Dropdown */}
                  {showScreenPicker && (
                    <AdminControls
                      onSelectSource={() => void startScreenShare()}
                      onClose={() => setShowScreenPicker(false)}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Room controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => void toggleFullscreen()}
            className="p-3 rounded-full bg-white/10 hover:bg-white/15 transition-all duration-200"
            title="Toggle fullscreen"
          >
            <Maximize size={20} />
          </button>

          <button
            onClick={handleLeaveRoom}
            className="p-3 rounded-full bg-danger/20 text-danger hover:bg-danger/30 transition-all duration-200"
            title="Leave room"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
