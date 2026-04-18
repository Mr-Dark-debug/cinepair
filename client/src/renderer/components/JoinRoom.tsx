/**
 * @fileoverview Join Room screen for CinePair.
 * Allows a user to enter a room code + optional password to join an existing room.
 * Handles all error states: wrong password, room full, not found, approval required.
 * @module components/JoinRoom
 */

import { useState, useCallback } from 'react';
import { ArrowLeft, LogIn, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useRoomStore } from '../stores/roomStore';
import { signalingClient } from '../lib/signaling';

/** Cute random nicknames for the joiner */
const NICKNAMES = [
  'Cutiepie', 'Snuggles', 'Lovebug', 'Peaches', 'Sunshine',
  'Sweetheart', 'Babycakes', 'Muffin', 'Pudding', 'Jellybean',
  'Teddy', 'Cookie', 'Cherry', 'Snowflake', 'Kitten',
];

/**
 * Join Room screen — enter a room code and optional password.
 */
export default function JoinRoom(): JSX.Element {
  const setScreen = useRoomStore((s) => s.setScreen);
  const setRoomInfo = useRoomStore((s) => s.setRoomInfo);
  const setNickname = useRoomStore((s) => s.setNickname);
  const setUsers = useRoomStore((s) => s.setUsers);
  const setRoomStatus = useRoomStore((s) => s.setRoomStatus);

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isWaitingApproval, setIsWaitingApproval] = useState(false);
  const [error, setError] = useState<{ message: string; type: 'error' | 'warning' } | null>(null);

  /**
   * Formats the room code input: uppercase, alphanumeric only, max 8 chars.
   */
  const handleCodeChange = useCallback((value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setCode(cleaned);
    setError(null);
  }, []);

  /**
   * Handles the join attempt, with error handling for all edge cases.
   */
  const handleJoin = useCallback(async () => {
    if (code.length !== 8) {
      setError({ message: 'Room code must be 8 characters', type: 'error' });
      return;
    }

    try {
      setIsJoining(true);
      setError(null);

      // Generate a random cute nickname
      const nickname = NICKNAMES[Math.floor(Math.random() * NICKNAMES.length)];

      // Ensure connected
      if (!signalingClient.isConnected) {
        await signalingClient.connect();
      }

      // Attempt to join
      const result = await signalingClient.joinRoom({
        code,
        password: password || undefined,
        nickname,
      });

      // Success! Update store and navigate
      setRoomInfo({
        code: result.code,
        requireApproval: result.requireApproval,
        isAdmin: false,
      });
      setNickname(nickname);
      setUsers(
        result.users.map((u) => ({
          userId: u.userId,
          nickname: u.nickname,
          role: u.role as 'admin' | 'partner',
        }))
      );
      setRoomStatus('active');
      setScreen('room');
      toast.success('Joined room successfully! 🎬');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      if (message === 'APPROVAL_REQUIRED') {
        // Waiting for admin approval
        setIsWaitingApproval(true);
        setIsJoining(false);

        // Listen for the join response
        const cleanup = signalingClient.on('room:join-response', (response) => {
          cleanup();
          if (response.approved) {
            setIsWaitingApproval(false);
            toast.success('Request approved! 🎉');
            // The room:joined event will be handled by App.tsx
          } else {
            setIsWaitingApproval(false);
            setError({
              message: response.reason || 'Join request was denied',
              type: 'error',
            });
            toast.error(response.reason || 'Join request denied');
          }
        });

        // Also listen for the full room joined data
        const cleanupJoined = signalingClient.on('room:joined', (data) => {
          cleanupJoined();
          setRoomInfo({
            code: data.code,
            requireApproval: data.requireApproval,
            isAdmin: false,
          });
          setUsers(
            data.users.map((u) => ({
              userId: u.userId,
              nickname: u.nickname,
              role: u.role as 'admin' | 'partner',
            }))
          );
          setRoomStatus('active');
          setScreen('room');
        });

        toast.info('Waiting for admin approval...');
        return;
      }

      // Handle specific error types
      switch (true) {
        case message.includes('Wrong password'):
          setError({ message: 'Wrong password – try again', type: 'error' });
          break;
        case message.includes('Room is full'):
          setError({ message: 'Room is full (max 2 users)', type: 'warning' });
          break;
        case message.includes('Room not found'):
          setError({ message: 'Room not found – check the code', type: 'error' });
          break;
        case message.includes('Room has been closed'):
          setError({ message: 'This room has been closed', type: 'error' });
          break;
        default:
          setError({ message: `Failed to join: ${message}`, type: 'error' });
      }
    } finally {
      setIsJoining(false);
    }
  }, [code, password, setRoomInfo, setNickname, setUsers, setRoomStatus, setScreen]);

  return (
    <div className="h-full flex items-center justify-center relative">
      {/* Background orb */}
      <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-accent-teal/5 rounded-full blur-[100px]" />

      <div className="glass-card p-8 w-full max-w-md animate-scale-in no-drag z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setScreen('home')}
            className="btn-ghost p-2 -ml-2"
            disabled={isWaitingApproval}
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold font-heading">Join a Room</h2>
        </div>

        {isWaitingApproval ? (
          /* ─── Waiting for Approval ─────────────────── */
          <div className="text-center py-12 animate-fade-in">
            <div className="inline-flex p-4 rounded-full bg-accent-purple/10 mb-6">
              <Clock size={40} className="text-accent-purple animate-pulse" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Waiting for approval</h3>
            <p className="text-text-secondary mb-8">
              The room admin will accept or deny your request<span className="loading-dots"></span>
            </p>
            <button
              onClick={() => {
                setIsWaitingApproval(false);
                setScreen('home');
              }}
              className="btn-ghost border border-border-subtle"
            >
              Cancel
            </button>
          </div>
        ) : (
          /* ─── Join Form ─────────────────────────────── */
          <div className="space-y-6">
            {/* Room code input */}
            <div>
              <label className="text-sm font-medium text-text-secondary mb-2 block">
                Room Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="ABC123XY"
                className="input-field text-center font-mono text-xl tracking-[0.2em] uppercase"
                maxLength={8}
                autoFocus
              />
            </div>

            {/* Password input */}
            <div>
              <label className="text-sm font-medium text-text-secondary mb-2 block">
                Password <span className="text-text-secondary/50">(if required)</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter room password"
                className="input-field"
              />
            </div>

            {/* Error display */}
            {error && (
              <div
                className={`
                  flex items-center gap-2 p-3 rounded-btn text-sm animate-slide-down
                  ${error.type === 'error'
                    ? 'bg-danger/10 text-danger border border-danger/20'
                    : 'bg-warning/10 text-warning border border-warning/20'}
                `}
              >
                <AlertCircle size={16} className="shrink-0" />
                {error.message}
              </div>
            )}

            {/* Join button */}
            <button
              onClick={() => void handleJoin()}
              disabled={isJoining || code.length !== 8}
              className="btn-teal w-full text-lg py-4 flex items-center justify-center gap-2"
            >
              {isJoining ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  Join Room
                </>
              )}
            </button>

            {/* Helper text */}
            <p className="text-center text-sm text-text-secondary/50">
              Need a code? Ask your partner 💜
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
