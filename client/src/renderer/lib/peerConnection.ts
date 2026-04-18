/**
 * @fileoverview OOP WebRTC PeerConnection handler for CinePair.
 * Manages dual peer connections (webcam + screen share), ICE negotiation,
 * DataChannel for chat, and adaptive bitrate control.
 * @module lib/peerConnection
 */

import { signalingClient } from './signaling';

/** ICE server configuration */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: import.meta.env.VITE_STUN_URL || 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

// Add TURN server if configured
if (import.meta.env.VITE_TURN_URL) {
  ICE_SERVERS.push({
    urls: import.meta.env.VITE_TURN_URL,
    username: import.meta.env.VITE_TURN_USERNAME || '',
    credential: import.meta.env.VITE_TURN_CREDENTIAL || '',
  });
}

/** Event callbacks for peer connection status changes */
export interface PeerEventHandlers {
  /** Called when a remote webcam stream is received */
  onRemoteWebcamStream: (stream: MediaStream) => void;
  /** Called when a remote screen share stream is received */
  onRemoteScreenStream: (stream: MediaStream) => void;
  /** Called when a remote stream is removed */
  onRemoteStreamRemoved: (type: 'webcam' | 'screen') => void;
  /** Called when a DataChannel message is received */
  onDataChannelMessage: (message: string) => void;
  /** Called when the connection state changes */
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  /** Called when the DataChannel is ready */
  onDataChannelReady: () => void;
}

/**
 * Manages WebRTC peer connections for CinePair.
 * Supports dual streams (webcam + screen share) and a DataChannel for chat.
 *
 * @example
 * ```typescript
 * const peer = new PeerHandler('room-code', 'remote-socket-id', true, handlers);
 * await peer.createOffer('webcam');
 * peer.addLocalStream(webcamStream, 'webcam');
 * ```
 */
export class PeerHandler {
  /** Room code for signaling */
  private readonly roomCode: string;

  /** ID of the remote peer */
  private readonly remoteUserId: string;

  /** Whether this peer is the initiator (admin) */
  private readonly isInitiator: boolean;

  /** Event callbacks */
  private readonly handlers: PeerEventHandlers;

  /** Main peer connection for webcam streams */
  private webcamPC: RTCPeerConnection | null = null;

  /** Secondary peer connection for screen sharing */
  private screenPC: RTCPeerConnection | null = null;

  /** DataChannel for chat messages */
  private dataChannel: RTCDataChannel | null = null;

  /** Whether the DataChannel is open and ready */
  private _isDataChannelReady: boolean = false;

  /** Signaling event cleanup functions */
  private cleanupFunctions: Array<() => void> = [];

  /**
   * Creates a new PeerHandler.
   *
   * @param roomCode - The room code for signaling relay
   * @param remoteUserId - ID of the remote peer
   * @param isInitiator - Whether this peer creates offers (typically admin)
   * @param handlers - Event callbacks for stream and state changes
   */
  constructor(
    roomCode: string,
    remoteUserId: string,
    isInitiator: boolean,
    handlers: PeerEventHandlers
  ) {
    this.roomCode = roomCode;
    this.remoteUserId = remoteUserId;
    this.isInitiator = isInitiator;
    this.handlers = handlers;

    // Initialize peer connections
    this.initWebcamPC();
    this.setupSignalingListeners();
  }

  /** Whether the DataChannel is open */
  get isDataChannelReady(): boolean {
    return this._isDataChannelReady;
  }

  // ─────────────────────────────────────────────────────────
  // Peer Connection Initialization
  // ─────────────────────────────────────────────────────────

  /**
   * Initializes the webcam peer connection with ICE handling and DataChannel.
   */
  private initWebcamPC(): void {
    this.webcamPC = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // ICE candidate handling
    this.webcamPC.onicecandidate = (event) => {
      if (event.candidate) {
        signalingClient.relaySignaling({
          code: this.roomCode,
          targetUserId: this.remoteUserId,
          data: event.candidate.toJSON(),
          type: 'ice-candidate',
          streamType: 'webcam',
        });
      }
    };

    // Remote track handling
    this.webcamPC.ontrack = (event) => {
      console.log('[PeerHandler] Webcam remote track received:', event.track.kind);
      if (event.streams[0]) {
        this.handlers.onRemoteWebcamStream(event.streams[0]);
      }
    };

    // Connection state monitoring
    this.webcamPC.onconnectionstatechange = () => {
      const state = this.webcamPC?.connectionState || 'closed';
      console.log('[PeerHandler] Webcam connection state:', state);
      this.handlers.onConnectionStateChange(state);
    };

    // DataChannel setup
    if (this.isInitiator) {
      // Initiator creates the DataChannel
      this.dataChannel = this.webcamPC.createDataChannel('cinepair-chat', {
        ordered: true,
      });
      this.setupDataChannel(this.dataChannel);
    } else {
      // Receiver listens for incoming DataChannel
      this.webcamPC.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannel(this.dataChannel);
      };
    }
  }

  /**
   * Initializes the screen share peer connection.
   * Created on-demand when screen sharing starts.
   */
  private initScreenPC(): void {
    if (this.screenPC) return;

    this.screenPC = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.screenPC.onicecandidate = (event) => {
      if (event.candidate) {
        signalingClient.relaySignaling({
          code: this.roomCode,
          targetUserId: this.remoteUserId,
          data: event.candidate.toJSON(),
          type: 'ice-candidate',
          streamType: 'screen',
        });
      }
    };

    this.screenPC.ontrack = (event) => {
      console.log('[PeerHandler] Screen remote track received:', event.track.kind);
      if (event.streams[0]) {
        this.handlers.onRemoteScreenStream(event.streams[0]);
      }
    };

    this.screenPC.onconnectionstatechange = () => {
      console.log('[PeerHandler] Screen connection state:', this.screenPC?.connectionState);
    };
  }

  /**
   * Sets up DataChannel event handlers.
   */
  private setupDataChannel(channel: RTCDataChannel): void {
    channel.onopen = () => {
      this._isDataChannelReady = true;
      console.log('[PeerHandler] DataChannel opened');
      this.handlers.onDataChannelReady();
    };

    channel.onclose = () => {
      this._isDataChannelReady = false;
      console.log('[PeerHandler] DataChannel closed');
    };

    channel.onmessage = (event) => {
      this.handlers.onDataChannelMessage(event.data as string);
    };

    channel.onerror = (event) => {
      console.error('[PeerHandler] DataChannel error:', event);
    };
  }

  // ─────────────────────────────────────────────────────────
  // Signaling Listeners
  // ─────────────────────────────────────────────────────────

  /**
   * Sets up listeners for incoming signaling messages from the remote peer.
   */
  private setupSignalingListeners(): void {
    const cleanup = signalingClient.on('signaling:relay', (payload) => {
      if (payload.senderUserId !== this.remoteUserId) return;

      void this.handleSignalingMessage(
        payload.type,
        payload.data,
        payload.streamType || 'webcam'
      );
    });

    this.cleanupFunctions.push(cleanup);
  }

  /**
   * Processes an incoming signaling message (offer/answer/ICE candidate).
   */
  private async handleSignalingMessage(
    type: 'offer' | 'answer' | 'ice-candidate',
    data: RTCSessionDescriptionInit | RTCIceCandidateInit,
    streamType: 'webcam' | 'screen'
  ): Promise<void> {
    const pc = streamType === 'screen' ? this.getOrCreateScreenPC() : this.webcamPC;
    if (!pc) return;

    try {
      if (type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        signalingClient.relaySignaling({
          code: this.roomCode,
          targetUserId: this.remoteUserId,
          data: answer,
          type: 'answer',
          streamType,
        });
      } else if (type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data as RTCSessionDescriptionInit));
      } else if (type === 'ice-candidate') {
        await pc.addIceCandidate(new RTCIceCandidate(data as RTCIceCandidateInit));
      }
    } catch (err) {
      console.error(`[PeerHandler] Error handling ${type} for ${streamType}:`, err);
    }
  }

  /**
   * Gets or creates the screen share peer connection.
   */
  private getOrCreateScreenPC(): RTCPeerConnection {
    if (!this.screenPC) {
      this.initScreenPC();
    }
    return this.screenPC!;
  }

  // ─────────────────────────────────────────────────────────
  // Stream Management
  // ─────────────────────────────────────────────────────────

  /**
   * Adds a local media stream to the appropriate peer connection.
   *
   * @param stream - The MediaStream to add
   * @param type - Whether this is a webcam or screen stream
   */
  addLocalStream(stream: MediaStream, type: 'webcam' | 'screen'): void {
    const pc = type === 'screen' ? this.getOrCreateScreenPC() : this.webcamPC;
    if (!pc) return;

    // Remove existing senders first
    const existingSenders = pc.getSenders();
    for (const sender of existingSenders) {
      pc.removeTrack(sender);
    }

    // Add new tracks
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }

    console.log(`[PeerHandler] Added local ${type} stream with ${stream.getTracks().length} tracks`);
  }

  /**
   * Removes a local stream from the peer connection.
   */
  removeLocalStream(type: 'webcam' | 'screen'): void {
    const pc = type === 'screen' ? this.screenPC : this.webcamPC;
    if (!pc) return;

    const senders = pc.getSenders();
    for (const sender of senders) {
      pc.removeTrack(sender);
    }

    // If screen share, close the connection
    if (type === 'screen' && this.screenPC) {
      this.screenPC.close();
      this.screenPC = null;
    }

    this.handlers.onRemoteStreamRemoved(type);
  }

  // ─────────────────────────────────────────────────────────
  // Offer/Answer Creation
  // ─────────────────────────────────────────────────────────

  /**
   * Creates and sends an SDP offer to the remote peer.
   *
   * @param streamType - The type of stream this offer is for
   */
  async createOffer(streamType: 'webcam' | 'screen' = 'webcam'): Promise<void> {
    const pc = streamType === 'screen' ? this.getOrCreateScreenPC() : this.webcamPC;
    if (!pc) return;

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await pc.setLocalDescription(offer);

      signalingClient.relaySignaling({
        code: this.roomCode,
        targetUserId: this.remoteUserId,
        data: offer,
        type: 'offer',
        streamType,
      });

      console.log(`[PeerHandler] Sent ${streamType} offer`);
    } catch (err) {
      console.error(`[PeerHandler] Failed to create ${streamType} offer:`, err);
    }
  }

  // ─────────────────────────────────────────────────────────
  // DataChannel Messaging
  // ─────────────────────────────────────────────────────────

  /**
   * Sends a message through the DataChannel.
   * Falls back to signaling server if DataChannel is not available.
   *
   * @param message - The message string to send
   * @returns Whether the message was sent via DataChannel
   */
  sendMessage(message: string): boolean {
    if (this.dataChannel && this._isDataChannelReady) {
      this.dataChannel.send(message);
      return true;
    }

    // Fallback to signaling server
    signalingClient.sendChatMessage(this.roomCode, message);
    return false;
  }

  // ─────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────

  /**
   * Closes all peer connections and cleans up resources.
   */
  destroy(): void {
    // Clean up signaling listeners
    for (const cleanup of this.cleanupFunctions) {
      cleanup();
    }
    this.cleanupFunctions = [];

    // Close DataChannel
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    // Close webcam peer connection
    if (this.webcamPC) {
      this.webcamPC.close();
      this.webcamPC = null;
    }

    // Close screen share peer connection
    if (this.screenPC) {
      this.screenPC.close();
      this.screenPC = null;
    }

    this._isDataChannelReady = false;
    console.log('[PeerHandler] Destroyed');
  }
}
