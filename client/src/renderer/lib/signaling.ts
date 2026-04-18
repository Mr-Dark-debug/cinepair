/**
 * @fileoverview Socket.IO signaling client for CinePair.
 * Manages the WebSocket connection with JWT session token auth.
 * Uses userId (stable) instead of socketId for identity.
 * @module lib/signaling
 */

import { io, Socket } from 'socket.io-client';

/** Server event types */
interface ServerToClientEvents {
  'room:user-joined': (data: { userId: string; nickname: string; role: string }) => void;
  'room:user-left': (data: { userId: string; nickname: string }) => void;
  'room:user-disconnected': (data: { userId: string; nickname: string; reconnecting: boolean }) => void;
  'room:user-reconnected': (data: { userId: string; nickname: string }) => void;
  'room:join-request': (data: { id: string; userId: string; nickname: string; createdAt: number }) => void;
  'room:join-response': (data: { approved: boolean; reason?: string }) => void;
  'room:joined': (data: {
    code: string;
    userId: string;
    role: string;
    sessionToken: string;
    users: Array<{ userId: string; nickname: string; role: string }>;
    requireApproval: boolean;
    isScreenSharing: boolean;
  }) => void;
  'room:approval-changed': (data: { requireApproval: boolean }) => void;
  'room:closed': (data: { reason: string }) => void;
  'signaling:relay': (payload: {
    data: Record<string, unknown>;
    type: 'offer' | 'answer' | 'ice-candidate';
    streamType?: 'webcam' | 'screen';
    senderUserId: string;
  }) => void;
  'chat:message': (data: {
    id: string;
    senderId: string;
    senderNickname: string;
    message: string;
    timestamp: number;
    clientMessageId?: string;
  }) => void;
  'screen:toggle': (data: { isSharing: boolean; sharerUserId: string }) => void;
  'peer:start-negotiation': (data: { targetUserId: string; polite: boolean }) => void;
  'error': (error: { code: string; message: string }) => void;
}

interface ClientToServerEvents {
  'room:create': (payload: unknown, callback: (response: unknown) => void) => void;
  'room:join': (payload: unknown, callback: (response: unknown) => void) => void;
  'room:join-response': (payload: unknown) => void;
  'room:toggle-approval': (payload: unknown) => void;
  'room:leave': (payload: unknown) => void;
  'signaling:relay': (payload: unknown) => void;
  'chat:message': (payload: unknown) => void;
  'screen:toggle': (payload: unknown) => void;
  'peer:ready': (payload: unknown) => void;
}

/** Signaling server URL from environment */
const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001';

/**
 * Singleton signaling client manager with session token support.
 */
export class SignalingClient {
  private static instance: SignalingClient | null = null;
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private _isConnected = false;
  private _userId = '';
  private _sessionToken = '';

  private constructor() {}

  static getInstance(): SignalingClient {
    if (!SignalingClient.instance) {
      SignalingClient.instance = new SignalingClient();
    }
    return SignalingClient.instance;
  }

  get isConnected(): boolean { return this._isConnected; }
  get socketId(): string | undefined { return this.socket?.id; }
  get userId(): string { return this._userId; }
  get sessionToken(): string { return this._sessionToken; }

  setSessionInfo(userId: string, sessionToken: string): void {
    this._userId = userId;
    this._sessionToken = sessionToken;
  }

  /**
   * Connects to the signaling server with optional JWT auth.
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(SIGNALING_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        auth: this._sessionToken ? { sessionToken: this._sessionToken } : {},
      }) as Socket<ServerToClientEvents, ClientToServerEvents>;

      const connectTimeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 15000);

      this.socket.on('connect', () => {
        clearTimeout(connectTimeout);
        this._isConnected = true;
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        clearTimeout(connectTimeout);
        console.error('[Signaling] Connection error:', err.message);
        reject(err);
      });

      this.socket.on('disconnect', (reason) => {
        this._isConnected = false;
        console.warn('[Signaling] Disconnected:', reason);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this._isConnected = false;
    }
  }

  getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
    return this.socket;
  }

  /**
   * Creates a new room on the signaling server.
   */
  createRoom(payload: {
    nickname: string;
    password?: string;
    requireApproval: boolean;
  }): Promise<{
    code: string;
    userId: string;
    sessionToken: string;
    requireApproval: boolean;
    hasPassword: boolean;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.socket) { reject(new Error('Not connected')); return; }

      this.socket.emit('room:create', payload, (response: unknown) => {
        const res = response as Record<string, unknown>;
        if ('message' in res && typeof res.message === 'string') {
          reject(new Error(res.message));
        } else {
          const result = res as {
            code: string; userId: string; sessionToken: string;
            requireApproval: boolean; hasPassword: boolean;
          };
          this._userId = result.userId;
          this._sessionToken = result.sessionToken;
          resolve(result);
        }
      });
    });
  }

  /**
   * Joins an existing room.
   */
  joinRoom(payload: {
    code: string;
    password?: string;
    nickname: string;
  }): Promise<{
    code: string;
    userId: string;
    role: string;
    sessionToken: string;
    users: Array<{ userId: string; nickname: string; role: string }>;
    requireApproval: boolean;
    isScreenSharing: boolean;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.socket) { reject(new Error('Not connected')); return; }

      this.socket.emit('room:join', payload, (response: unknown) => {
        const res = response as Record<string, unknown>;
        if (res.code === 'APPROVAL_REQUIRED') {
          reject(new Error('APPROVAL_REQUIRED'));
        } else if ('message' in res && typeof res.message === 'string' && !('sessionToken' in res)) {
          reject(new Error(res.message));
        } else {
          const result = res as {
            code: string; userId: string; role: string; sessionToken: string;
            users: Array<{ userId: string; nickname: string; role: string }>;
            requireApproval: boolean; isScreenSharing: boolean;
          };
          this._userId = result.userId;
          this._sessionToken = result.sessionToken;
          resolve(result);
        }
      });
    });
  }

  respondToJoinRequest(payload: {
    code: string;
    requestId: string;
    approved: boolean;
    reason?: string;
  }): void {
    this.socket?.emit('room:join-response', payload);
  }

  toggleApproval(code: string, requireApproval: boolean): void {
    this.socket?.emit('room:toggle-approval', { code, requireApproval });
  }

  leaveRoom(code: string): void {
    this.socket?.emit('room:leave', { code });
  }

  relaySignaling(payload: {
    code: string;
    targetUserId: string;
    data: RTCSessionDescriptionInit | RTCIceCandidateInit;
    type: 'offer' | 'answer' | 'ice-candidate';
    streamType?: 'webcam' | 'screen';
  }): void {
    this.socket?.emit('signaling:relay', {
      ...payload,
      data: payload.data as unknown as Record<string, unknown>,
    });
  }

  sendChatMessage(code: string, message: string, clientMessageId?: string): void {
    this.socket?.emit('chat:message', {
      code,
      message,
      timestamp: Date.now(),
      clientMessageId,
    });
  }

  toggleScreenShare(code: string, isSharing: boolean): void {
    this.socket?.emit('screen:toggle', { code, isSharing });
  }

  emitPeerReady(code: string): void {
    this.socket?.emit('peer:ready', { code });
  }

  on<E extends keyof ServerToClientEvents>(
    event: E,
    handler: ServerToClientEvents[E]
  ): () => void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.socket?.on(event, handler as any);
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.socket?.off(event, handler as any);
    };
  }
}

/** Default singleton export */
export const signalingClient = SignalingClient.getInstance();
