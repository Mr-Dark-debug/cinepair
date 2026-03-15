/**
 * @fileoverview Room Lobby screen for CinePair (admin view).
 * Shows room code, waiting status, pending join requests, and admin controls.
 * @module components/RoomLobby
 */

import { useCallback } from 'react';
import {
  Copy,
  Check,
  Shield,
  ShieldCheck,
  X,
  CheckCircle,
  XCircle,
  Film,
  Popcorn,
} from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useRoomStore } from '../stores/roomStore';
import { signalingClient } from '../lib/signaling';

/**
 * Room Lobby — admin waits here for partner to join.
 * Displays room info, admin controls, and handles join request approval.
 */
export default function RoomLobby(): JSX.Element {
  const roomCode = useRoomStore((s) => s.roomCode);
  const password = useRoomStore((s) => s.password);
  const requireApproval = useRoomStore((s) => s.requireApproval);
  const pendingRequests = useRoomStore((s) => s.pendingRequests);
  const setRequireApproval = useRoomStore((s) => s.setRequireApproval);
  const removeJoinRequest = useRoomStore((s) => s.removeJoinRequest);
  const resetRoom = useRoomStore((s) => s.resetRoom);

  const [codeCopied, setCodeCopied] = useState(false);
  const [passCopied, setPassCopied] = useState(false);

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
      toast.success(`${type === 'code' ? 'Code' : 'Password'} copied!`);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  /**
   * Toggles the require-approval setting via signaling.
   */
  const handleToggleApproval = useCallback(() => {
    if (!roomCode) return;
    const newValue = !requireApproval;
    signalingClient.toggleApproval(roomCode, newValue);
    setRequireApproval(newValue);
  }, [roomCode, requireApproval, setRequireApproval]);

  /**
   * Handles admin response to a join request.
   */
  const handleJoinResponse = useCallback(
    (requestId: string, approved: boolean, reason?: string) => {
      if (!roomCode) return;
      signalingClient.respondToJoinRequest({
        code: roomCode,
        requestId,
        approved,
        reason,
      });
      removeJoinRequest(requestId);
      toast.success(approved ? 'Request approved!' : 'Request denied');
    },
    [roomCode, removeJoinRequest]
  );

  /**
   * Closes the room and returns to home.
   */
  const handleCloseRoom = useCallback(() => {
    if (roomCode) {
      signalingClient.leaveRoom(roomCode);
    }
    resetRoom();
    toast.info('Room closed');
  }, [roomCode, resetRoom]);

  return (
    <div className="h-full flex items-center justify-center relative">
      {/* Background orbs */}
      <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-accent-purple/5 rounded-full blur-[100px] animate-pulse-slow" />

      <div className="glass-card p-8 w-full max-w-lg animate-fade-in no-drag z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Film size={20} className="text-accent-purple" />
              <h2 className="text-2xl font-bold font-heading">Room Lobby</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-accent-purple/20 text-accent-purple px-2 py-0.5 rounded-full font-semibold">
                ADMIN
              </span>
              <span className="text-sm text-text-secondary">You are the admin</span>
            </div>
          </div>
        </div>

        {/* Room Code */}
        <div className="mb-6">
          <label className="text-sm text-text-secondary mb-2 block">Room Code</label>
          <div className="flex items-center gap-3">
            <div className="room-code flex-1">{roomCode}</div>
            <button
              onClick={() => roomCode && void copyToClipboard(roomCode, 'code')}
              className="btn-ghost p-3 border border-border-subtle rounded-btn shrink-0"
              title="Copy code"
            >
              {codeCopied ? <Check size={18} className="text-accent-teal" /> : <Copy size={18} />}
            </button>
          </div>
        </div>

        {/* Password display */}
        {password && (
          <div className="mb-6">
            <label className="text-sm text-text-secondary mb-2 block">Password</label>
            <div className="flex items-center gap-3">
              <div className="input-field font-mono flex-1">{password}</div>
              <button
                onClick={() => void copyToClipboard(password, 'pass')}
                className="btn-ghost p-3 border border-border-subtle rounded-btn shrink-0"
                title="Copy password"
              >
                {passCopied ? <Check size={18} className="text-accent-teal" /> : <Copy size={18} />}
              </button>
            </div>
          </div>
        )}

        {/* Require Approval Toggle */}
        <div className="flex items-center justify-between p-4 bg-void/50 rounded-card border border-border-subtle mb-6">
          <label className="flex items-center gap-2 text-sm font-medium">
            {requireApproval ? (
              <ShieldCheck size={18} className="text-accent-teal" />
            ) : (
              <Shield size={18} className="text-text-secondary" />
            )}
            Require Join Approval
          </label>
          <button
            onClick={handleToggleApproval}
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

        {/* Waiting animation */}
        <div className="text-center py-8 mb-6">
          <div className="inline-flex p-4 rounded-full bg-panel border border-border-subtle mb-4">
            <Popcorn size={48} className="text-accent-purple animate-float" />
          </div>
          <h3 className="text-lg font-semibold mb-1">
            Waiting for partner<span className="loading-dots"></span>
          </h3>
          <p className="text-sm text-text-secondary">
            Share the room code above so they can join
          </p>
        </div>

        {/* Pending Join Requests */}
        {pendingRequests.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
              <div className="w-2 h-2 bg-accent-purple rounded-full animate-pulse" />
              Pending Requests ({pendingRequests.length})
            </h3>
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 bg-void/50 rounded-card border border-accent-purple/20 animate-slide-up"
                >
                  <div>
                    <p className="font-medium">{request.nickname}</p>
                    <p className="text-xs text-text-secondary">
                      Wants to join your room
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleJoinResponse(request.id, true)}
                      className="p-2 rounded-btn bg-accent-teal/20 text-accent-teal hover:bg-accent-teal/30 transition-colors"
                      title="Accept"
                    >
                      <CheckCircle size={20} />
                    </button>
                    <button
                      onClick={() => handleJoinResponse(request.id, false, 'Not now')}
                      className="p-2 rounded-btn bg-danger/20 text-danger hover:bg-danger/30 transition-colors"
                      title="Deny"
                    >
                      <XCircle size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Close Room button */}
        <button
          onClick={handleCloseRoom}
          className="w-full flex items-center justify-center gap-2 py-3 text-danger/80 hover:text-danger hover:bg-danger/5 rounded-btn transition-colors"
        >
          <X size={18} />
          Close Room
        </button>
      </div>
    </div>
  );
}
