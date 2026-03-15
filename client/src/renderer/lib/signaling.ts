/**
 * @fileoverview Socket.IO signaling client for CinePair.
 * Manages the WebSocket connection to the signaling server and provides
 * a typed API for all room management and WebRTC signaling operations.
 * @module lib/signaling
 */

import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../../../server/src/types';

/** Signaling server URL from environment */
const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001';

/**
 * Singleton signaling client manager.
 * Manages the Socket.IO connection lifecycle and provides typed event methods.
 *
 * @example
 * ```typescript
 * const client = SignalingClient.getInstance();
 * await client.connect();
 * const room = await client.createRoom({ nickname: 'Alice', requireApproval: true });
 * ```
 */
export class SignalingClient {
  /** Singleton instance */
  private static instance: SignalingClient | null = null;

  /** The underlying Socket.IO client socket */
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

  /** Whether the client is currently connected */
  private _isConnected: boolean = false;

  /** Private constructor for singleton pattern */
  private constructor() {}

  /**
   * Gets or creates the singleton SignalingClient instance.
   */
  static getInstance(): SignalingClient {
    if (!SignalingClient.instance) {
      SignalingClient.instance = new SignalingClient();
    }
    return SignalingClient.instance;
  }

  /** Whether the signaling client is connected */
  get isConnected(): boolean {
    return this._isConnected;
  }

  /** Gets the underlying socket ID */
  get socketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Connects to the signaling server.
   * @returns Promise that resolves when connected
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
      }) as Socket<ServerToClientEvents, ClientToServerEvents>;

      const connectTimeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 15000);

      this.socket.on('connect', () => {
        clearTimeout(connectTimeout);
        this._isConnected = true;
        console.log('[Signaling] Connected:', this.socket?.id);
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

  /**
   * Disconnects from the signaling server.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this._isConnected = false;
    }
  }

  /**
   * Gets the raw Socket.IO socket for event listening.
   * Components should prefer the typed methods below.
   */
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
  }): Promise<{ code: string; requireApproval: boolean; hasPassword: boolean }> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('room:create', payload, (response) => {
        if ('message' in response) {
          reject(new Error(response.message));
        } else {
          resolve(response);
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
    role: 'admin' | 'partner';
    users: Array<{ socketId: string; nickname: string; role: 'admin' | 'partner' }>;
    requireApproval: boolean;
    isScreenSharing: boolean;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('room:join', payload, (response) => {
        if ('message' in response) {
          // Check if it's an approval-required response
          if ('code' in response && response.code === 'APPROVAL_REQUIRED') {
            reject(new Error('APPROVAL_REQUIRED'));
          } else {
            reject(new Error(response.message));
          }
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Responds to a join request (admin only).
   */
  respondToJoinRequest(payload: {
    code: string;
    requestId: string;
    approved: boolean;
    reason?: string;
  }): void {
    this.socket?.emit('room:join-response', payload);
  }

  /**
   * Toggles the require-approval setting.
   */
  toggleApproval(code: string, requireApproval: boolean): void {
    this.socket?.emit('room:toggle-approval', { code, requireApproval });
  }

  /**
   * Leaves the current room.
   */
  leaveRoom(code: string): void {
    this.socket?.emit('room:leave', { code });
  }

  /**
   * Relays WebRTC signaling data to a specific peer.
   */
  relaySignaling(payload: {
    code: string;
    targetSocketId: string;
    data: RTCSessionDescriptionInit | RTCIceCandidateInit;
    type: 'offer' | 'answer' | 'ice-candidate';
    streamType?: 'webcam' | 'screen';
  }): void {
    this.socket?.emit('signaling:relay', {
      ...payload,
      data: payload.data as unknown as Record<string, unknown>,
    });
  }

  /**
   * Sends a chat message.
   */
  sendChatMessage(code: string, message: string): void {
    this.socket?.emit('chat:message', {
      code,
      message,
      timestamp: Date.now(),
    });
  }

  /**
   * Toggles screen sharing state.
   */
  toggleScreenShare(code: string, isSharing: boolean): void {
    this.socket?.emit('screen:toggle', { code, isSharing });
  }

  /**
   * Registers an event listener on the socket.
   * @returns Cleanup function to remove the listener
   */
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
