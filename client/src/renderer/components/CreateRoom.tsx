/**
 * @fileoverview Create Room screen/modal for CinePair.
 * Allows the admin to create a new room with optional password and approval settings.
 * @module components/CreateRoom
 */

import { useState, useCallback } from 'react';
import {
  ArrowLeft,
  Copy,
  Check,
  Lock,
  Unlock,
  Shield,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRoomStore } from '../stores/roomStore';
import { signalingClient } from '../lib/signaling';

/** Cute random nicknames for the room creator */
const NICKNAMES = [
  'Starlight', 'Moonbeam', 'Sunshine', 'Lovebird', 'Sweetpea',
  'Darling', 'Honeybee', 'Cupcake', 'Buttercup', 'Dreamboat',
  'Sparkle', 'Pumpkin', 'Angel', 'Stardust', 'Blossom',
];

/**
 * Create Room screen — generates a new room with settings.
 */
export default function CreateRoom(): JSX.Element {
  const setScreen = useRoomStore((s) => s.setScreen);
  const setRoomInfo = useRoomStore((s) => s.setRoomInfo);
  const setNickname = useRoomStore((s) => s.setNickname);
  const setRoomStatus = useRoomStore((s) => s.setRoomStatus);
  const addUser = useRoomStore((s) => s.addUser);

  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [requireApproval, setRequireApproval] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [passCopied, setPassCopied] = useState(false);

  /**
   * Handles room creation via the signaling client.
   */
  const handleCreate = useCallback(async () => {
    try {
      setIsCreating(true);

      // Generate a random cute nickname for the admin
      const nickname = NICKNAMES[Math.floor(Math.random() * NICKNAMES.length)];

      // Ensure connected
      if (!signalingClient.isConnected) {
        await signalingClient.connect();
      }

      // Create the room
      const result = await signalingClient.createRoom({
        nickname,
        password: usePassword ? password : undefined,
        requireApproval,
      });

      // Update store
      setRoomInfo({
        code: result.code,
        password: usePassword ? password : undefined,
        requireApproval: result.requireApproval,
        isAdmin: true,
      });
      setNickname(nickname);
      setRoomStatus('waiting');
      setCreatedCode(result.code);

      // Add self to users
      addUser({
        socketId: signalingClient.socketId || '',
        nickname,
        role: 'admin',
      });

      toast.success(`Room created! Share code ${result.code}`);
    } catch (err) {
      console.error('Failed to create room:', err);
      toast.error('Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }, [password, usePassword, requireApproval, setRoomInfo, setNickname, setRoomStatus, addUser]);

  /**
   * Copies text to clipboard with visual feedback.
   */
  const copyToClipboard = useCallback(async (text: string, type: 'code' | 'pass') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'code') {
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
      } else {
        setPassCopied(true);
        setTimeout(() => setPassCopied(false), 2000);
      }
      toast.success(`${type === 'code' ? 'Room code' : 'Password'} copied!`);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  /**
   * Navigates to the lobby after room creation.
   */
  const goToLobby = useCallback(() => {
    setScreen('lobby');
  }, [setScreen]);

  return (
    <div className="h-full flex items-center justify-center relative">
      {/* Background orbs */}
      <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-accent-purple/5 rounded-full blur-[100px]" />

      <div className="glass-card p-8 w-full max-w-md animate-scale-in no-drag z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => createdCode ? goToLobby() : setScreen('home')}
            className="btn-ghost p-2 -ml-2"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold font-heading">
            {createdCode ? 'Room Created!' : 'Create New Room'}
          </h2>
        </div>

        {!createdCode ? (
          /* ─── Creation Form ─────────────────────────── */
          <div className="space-y-6">
            {/* Password toggle + field */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                  {usePassword ? <Lock size={16} /> : <Unlock size={16} />}
                  Room Password
                </label>
                <button
                  onClick={() => setUsePassword(!usePassword)}
                  className={`
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
                    ${usePassword ? 'bg-accent-purple' : 'bg-border-subtle'}
                  `}
                >
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200
                      ${usePassword ? 'translate-x-6' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>
              {usePassword && (
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter a room password"
                  className="input-field animate-slide-down"
                />
              )}
            </div>

            {/* Require approval toggle */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                {requireApproval ? <ShieldCheck size={16} className="text-accent-teal" /> : <Shield size={16} />}
                Require Join Approval
              </label>
              <button
                onClick={() => setRequireApproval(!requireApproval)}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
                  ${requireApproval ? 'bg-accent-teal' : 'bg-border-subtle'}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200
                    ${requireApproval ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            {/* Create button */}
            <button
              onClick={() => void handleCreate()}
              disabled={isCreating || (usePassword && !password.trim())}
              className="btn-purple w-full text-lg py-4 flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Create & Share
                </>
              )}
            </button>
          </div>
        ) : (
          /* ─── Created Room Info ─────────────────────── */
          <div className="space-y-6 animate-slide-up">
            {/* Room code display */}
            <div>
              <label className="text-sm text-text-secondary mb-2 block">Room Code</label>
              <div className="flex items-center gap-3">
                <div className="room-code flex-1">{createdCode}</div>
                <button
                  onClick={() => void copyToClipboard(createdCode, 'code')}
                  className="btn-ghost p-3 border border-border-subtle rounded-btn"
                  title="Copy code"
                >
                  {codeCopied ? <Check size={18} className="text-accent-teal" /> : <Copy size={18} />}
                </button>
              </div>
            </div>

            {/* Password display (if set) */}
            {usePassword && password && (
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Password</label>
                <div className="flex items-center gap-3">
                  <div className="input-field font-mono">{password}</div>
                  <button
                    onClick={() => void copyToClipboard(password, 'pass')}
                    className="btn-ghost p-3 border border-border-subtle rounded-btn"
                    title="Copy password"
                  >
                    {passCopied ? <Check size={18} className="text-accent-teal" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
            )}

            {/* Info text */}
            <div className="bg-accent-purple/5 border border-accent-purple/10 rounded-card p-4">
              <p className="text-sm text-text-secondary">
                💜 Share this code with your partner so they can join your room.
                {requireApproval && " You'll be asked to approve their join request."}
              </p>
            </div>

            {/* Go to lobby */}
            <button
              onClick={goToLobby}
              className="btn-teal w-full text-lg py-4"
            >
              Go to Room Lobby →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
