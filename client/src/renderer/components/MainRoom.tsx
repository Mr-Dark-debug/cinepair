/**
 * @fileoverview Main co-watching room component for CinePair.
 * The heart of the app: shared screen area, webcam previews, chat sidebar,
 * and bottom control bar with screen sharing, audio, and room management.
 * @module components/MainRoom
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Volume2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRoomStore } from '../stores/roomStore';
import { useMediaSlice } from '../stores/mediaSlice';
import { useChatSlice } from '../stores/chatSlice';
import { useUIStore } from '../stores/useUIStore';
import { useAppStore } from '../stores/useAppStore';
import { signalingClient } from '../lib/signaling';
import { PeerHandler } from '../lib/peerConnection';
import { ChatSidebar } from './chat/ChatSidebar';
import { ControlDock } from './room/ControlDock';
import { TopHeader } from './room/TopHeader';
import { VideoTile } from './room/VideoTile';
import { RoomSettingsModal } from './room/RoomSettingsModal';

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

  const avatarColor = useAppStore((s) => s.avatarColor);
  const isChatVisible = useUIStore((s) => s.isChatOpen);
  const toggleChat = useUIStore((s) => s.toggleChat);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);

  // Refs for media elements
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);

  // State
  const [peerHandler, setPeerHandler] = useState<PeerHandler | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
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
    <div className="h-full w-full flex overflow-hidden bg-background">
      {/* ─── Main Content Area ────────────────────────────── */}
      <div className="flex-1 flex flex-col relative transition-all duration-300">
        
        {/* Top Header Overlay */}
        <TopHeader 
          roomCode={roomCode || ''} 
          isAdmin={isAdmin} 
          isLocked={false} // Connect to actual store if available
          participantCount={users.length} 
          connectionState={connectionState}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {/* Video Stage Area */}
        <div className="flex-1 p-4 pt-20 pb-28 flex items-center justify-center relative">
          {/* Main Stage (Screen Share or Active Speaker) */}
          {(isScreenSharing || remoteScreenStream) ? (
             <div className="w-full h-full max-w-7xl mx-auto rounded-2xl overflow-hidden bg-surface border border-surface-hover shadow-2xl relative">
                <video
                  ref={screenShareRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
                {isScreenSharing && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-background/80 px-3 py-1.5 rounded-full text-xs text-primary border border-primary/20 backdrop-blur-sm">
                    <Volume2 size={14} className="animate-pulse" />
                    System Audio Active
                  </div>
                )}
             </div>
          ) : (
            <div className="w-full h-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
              <VideoTile
                isLocal={true}
                nickname={nickname}
                videoRef={localVideoRef}
                isCameraOn={isCameraOn}
                isMicOn={isMicOn}
                avatarColor={avatarColor}
                isAdmin={isAdmin}
              />
              {remoteUser && (
                <VideoTile
                  user={remoteUser}
                  nickname={remoteUser.nickname}
                  videoRef={remoteVideoRef}
                  isCameraOn={true} // In real implementation, get from signaling/presence
                  isMicOn={true} 
                  avatarColor="#6366F1" // Placeholder color
                  isAdmin={remoteUser.role === 'admin'}
                />
              )}
            </div>
          )}

          {/* Screen Share controls floating */}
          {showScreenPicker && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
               <div className="bg-surface p-6 rounded-2xl shadow-xl border border-surface-hover max-w-sm w-full">
                  <h3 className="text-lg font-semibold mb-4 text-text-primary">Share Screen</h3>
                  <p className="text-text-secondary text-sm mb-6">Choose what to share with the room.</p>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setShowScreenPicker(false)} className="px-4 py-2 rounded-btn text-text-secondary hover:bg-surface-hover transition-colors">Cancel</button>
                    <button onClick={() => void startScreenShare()} className="px-4 py-2 rounded-btn bg-primary text-background hover:bg-primary-hover font-medium transition-colors">Start Sharing</button>
                  </div>
               </div>
            </div>
          )}

          {/* PiP Local Video (If screen sharing is active) */}
          {(isScreenSharing || remoteScreenStream) && (
            <div className="absolute bottom-28 right-4 w-48 aspect-video z-30 shadow-2xl rounded-2xl overflow-hidden ring-2 ring-surface-hover">
               <VideoTile
                isLocal={true}
                nickname={nickname}
                videoRef={localVideoRef}
                isCameraOn={isCameraOn}
                isMicOn={isMicOn}
                avatarColor={avatarColor}
              />
            </div>
          )}
        </div>

        {/* ─── Control Dock ───────────────────────────── */}
        <ControlDock
          isMicOn={isMicOn}
          isCameraOn={isCameraOn}
          isScreenSharing={isScreenSharing}
          isAdmin={isAdmin}
          isChatVisible={isChatVisible}
          onToggleMic={toggleMic}
          onToggleCamera={toggleCamera}
          onToggleScreenShare={isScreenSharing ? stopScreenShare : () => setShowScreenPicker(true)}
          onToggleFullscreen={() => void toggleFullscreen()}
          onToggleChat={toggleChat}
          onLeaveRoom={handleLeaveRoom}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      {/* ─── Right Sidebar ──────────────────────────────── */}
      <ChatSidebar 
        isVisible={isChatVisible}
        onSendMessage={sendMessage}
      />

      <RoomSettingsModal />
    </div>
  );
}
