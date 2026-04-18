/**
 * @fileoverview Root App component for CinePair.
 * Handles screen routing between Home, Create Room, Join Room, Lobby, and Main Room.
 * Also manages Socket.IO event listeners for room-wide events.
 * @module App
 */

import { useEffect, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { useRoomStore } from './stores/roomStore';
import { useMediaSlice } from './stores/mediaSlice';
import { useChatSlice } from './stores/chatSlice';
import { signalingClient } from './lib/signaling';
import Home from './components/Home';
import CreateRoom from './components/CreateRoom';
import JoinRoom from './components/JoinRoom';
import RoomLobby from './components/RoomLobby';
import ConferenceRoomUI from './components/ConferenceRoomUI';

/**
 * Root application component.
 * Routes between screens based on store state and manages global socket events.
 */
export default function App(): JSX.Element {
  const currentScreen = useRoomStore((s) => s.currentScreen);
  const resetRoom = useRoomStore((s) => s.resetRoom);
  const addUser = useRoomStore((s) => s.addUser);
  const removeUser = useRoomStore((s) => s.removeUser);
  const addJoinRequest = useRoomStore((s) => s.addJoinRequest);
  const setRequireApproval = useRoomStore((s) => s.setRequireApproval);
  const setScreen = useRoomStore((s) => s.setScreen);
  const setRoomStatus = useRoomStore((s) => s.setRoomStatus);
  const setRemoteScreenSharing = useMediaSlice((s) => s.setRemoteScreenSharing);
  const addMessage = useChatSlice((s) => s.addMessage);
  const roomCode = useRoomStore((s) => s.roomCode);

  /**
   * Initializes Socket.IO connection and event listeners.
   */
  const setupSocketListeners = useCallback(() => {
    const socket = signalingClient.getSocket();
    if (!socket) return;

    // ─── User joined notification ───────────────────
    const cleanupUserJoined = signalingClient.on('room:user-joined', (data) => {
      addUser({
        userId: data.userId,
        nickname: data.nickname,
        role: data.role as 'admin' | 'partner',
      });
      toast.success(`${data.nickname} joined! 🎉`);
      setRoomStatus('active');
      setScreen('room');
    });

    // ─── User left notification ─────────────────────
    const cleanupUserLeft = signalingClient.on('room:user-left', (data) => {
      removeUser(data.userId);
      toast.info(`${data.nickname} left the room`);
      setRoomStatus('waiting');
    });

    // ─── Join request (admin only) ──────────────────
    const cleanupJoinRequest = signalingClient.on('room:join-request', (data) => {
      addJoinRequest({
        id: data.id,
        userId: data.userId,
        nickname: data.nickname,
        createdAt: data.createdAt,
      });
      toast.info(`Join request from ${data.nickname}`, {
        duration: 10000,
      });
    });

    // ─── Approval setting changed ───────────────────
    const cleanupApprovalChanged = signalingClient.on('room:approval-changed', (data) => {
      setRequireApproval(data.requireApproval);
      toast.info(
        data.requireApproval
          ? 'Join approval is now required'
          : 'Join approval is now disabled'
      );
    });

    // ─── Room closed ────────────────────────────────
    const cleanupRoomClosed = signalingClient.on('room:closed', (data) => {
      toast.error(data.reason || 'Room has been closed');
      resetRoom();
    });

    // ─── Screen share toggle ────────────────────────
    const cleanupScreenToggle = signalingClient.on('screen:toggle', (data) => {
      setRemoteScreenSharing(data.isSharing);
      toast.info(
        data.isSharing
          ? 'Screen sharing started 🖥️'
          : 'Screen sharing stopped'
      );
    });

    // ─── Chat messages (fallback from signaling server) ─
    const cleanupChat = signalingClient.on('chat:message', (data) => {
      addMessage({
        id: `${data.timestamp}-${data.senderId}`,
        senderId: data.senderId,
        senderNickname: data.senderNickname,
        message: data.message,
        timestamp: data.timestamp,
        isSelf: false,
      });
    });

    // Return cleanup function
    return () => {
      cleanupUserJoined();
      cleanupUserLeft();
      cleanupJoinRequest();
      cleanupApprovalChanged();
      cleanupRoomClosed();
      cleanupScreenToggle();
      cleanupChat();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // Connect to signaling server on mount
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const init = async () => {
      try {
        await signalingClient.connect();
        cleanup = setupSocketListeners();
      } catch (err) {
        console.error('Failed to connect to signaling server:', err);
        toast.error('Failed to connect to server. Please check your connection.');
      }
    };

    void init();

    return () => {
      cleanup?.();
    };
  }, [setupSocketListeners]);

  /**
   * Renders the current screen based on navigation state.
   */
  const renderScreen = (): JSX.Element => {
    switch (currentScreen) {
      case 'home':
        return <Home />;
      case 'create-room':
        return <CreateRoom />;
      case 'join-room':
        return <JoinRoom />;
      case 'lobby':
        return <RoomLobby />;
      case 'room':
        return <ConferenceRoomUI />;
      default:
        return <Home />;
    }
  };

  return (
    <div className="h-full w-full relative film-grain">
      {/* Drag region for macOS */}
      <div className="drag-region absolute top-0 left-0 right-0 h-8 z-50" />

      {/* Main content */}
      <div className="relative z-10 h-full">
        {renderScreen()}
      </div>

      {/* Toast notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1f1f1f',
            color: '#f1f5f9',
            border: '1px solid #3a3a3a',
            borderRadius: '8px',
          },
        }}
        richColors
      />
    </div>
  );
}
