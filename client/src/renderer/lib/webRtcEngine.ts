/**
 * @fileoverview WebRTC Engine — manages peer connections with perfect negotiation,
 * ICE candidate queueing, ICE restart, and multi-peer support.
 * UI components never touch RTCPeerConnection directly.
 * @module lib/webRtcEngine
 */

import { signalingClient } from './signaling';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001';

/** Per-peer session state */
export interface PeerSession {
  userId: string;
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  iceCandidateQueue: RTCIceCandidateInit[];
  dataChannel: RTCDataChannel | null;
  isDataChannelReady: boolean;
}

/** Engine event callbacks */
export interface WebRtcEngineEvents {
  onRemoteStream: (userId: string, stream: MediaStream, type: 'webcam' | 'screen') => void;
  onRemoteStreamRemoved: (userId: string, type: 'webcam' | 'screen') => void;
  onDataChannelMessage: (userId: string, message: string) => void;
  onConnectionStateChange: (userId: string, state: RTCPeerConnectionState) => void;
  onDataChannelReady: (userId: string) => void;
}

/**
 * WebRTC Engine — abstracts all peer connection logic from UI.
 * Supports multi-peer via Map<userId, PeerSession>.
 * Implements Perfect Negotiation pattern.
 */
export class WebRtcEngine {
  private readonly roomCode: string;
  private readonly events: WebRtcEngineEvents;
  private readonly peers = new Map<string, PeerSession>();
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private cleanupFunctions: Array<() => void> = [];

  constructor(roomCode: string, events: WebRtcEngineEvents) {
    this.roomCode = roomCode;
    this.events = events;
    this.setupSignalingListeners();
  }

  // ─── ICE Server Fetch ─────────────────────────────────

  /**
   * Fetches ephemeral ICE servers from the backend.
   * Must be called after joining a room.
   */
  async fetchIceServers(): Promise<void> {
    try {
      const res = await fetch(`${SIGNALING_URL}/api/ice-servers`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
      };
      if (data.iceServers?.length) {
        this.iceServers = data.iceServers as RTCIceServer[];
      }
    } catch (err) {
      console.warn('[WebRtcEngine] Failed to fetch ICE servers, using defaults:', err);
    }
  }

  // ─── Peer Management ──────────────────────────────────

  /**
   * Creates a peer connection for a remote user.
   * Uses Perfect Negotiation pattern.
   */
  createPeer(targetUserId: string, polite: boolean): PeerSession {
    // Clean up existing peer if any
    if (this.peers.has(targetUserId)) {
      this.destroyPeer(targetUserId);
    }

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const session: PeerSession = {
      userId: targetUserId,
      pc,
      polite,
      makingOffer: false,
      ignoreOffer: false,
      iceCandidateQueue: [],
      dataChannel: null,
      isDataChannelReady: false,
    };

    // ─── ICE Candidate Handling ───────────────────────
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signalingClient.relaySignaling({
          code: this.roomCode,
          targetUserId,
          data: event.candidate.toJSON(),
          type: 'ice-candidate',
          streamType: 'webcam',
        });
      }
    };

    // ─── Remote Track Handling ────────────────────────
    pc.ontrack = (event) => {
      if (event.streams[0]) {
        // Determine type based on stream id or track label
        const isScreen = event.track.label.toLowerCase().includes('screen') ||
                         event.streams[0].id.includes('screen');
        this.events.onRemoteStream(
          targetUserId,
          event.streams[0],
          isScreen ? 'screen' : 'webcam'
        );
      }
    };

    // ─── Connection State Monitoring ──────────────────
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      this.events.onConnectionStateChange(targetUserId, state);

      // ICE restart on failure
      if (state === 'failed') {
        console.warn('[WebRtcEngine] Connection failed, attempting ICE restart');
        pc.restartIce();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        console.warn('[WebRtcEngine] ICE connection failed, restarting');
        pc.restartIce();
      }
    };

    // ─── Perfect Negotiation: negotiationneeded ───────
    pc.onnegotiationneeded = async () => {
      try {
        session.makingOffer = true;
        await pc.setLocalDescription();

        if (pc.localDescription) {
          signalingClient.relaySignaling({
            code: this.roomCode,
            targetUserId,
            data: pc.localDescription,
            type: pc.localDescription.type === 'offer' ? 'offer' : 'answer',
            streamType: 'webcam',
          });
        }
      } catch (err) {
        console.error('[WebRtcEngine] Negotiation error:', err);
      } finally {
        session.makingOffer = false;
      }
    };

    // ─── DataChannel Setup ───────────────────────────
    if (!polite) {
      // Impolite peer creates DataChannel
      const dc = pc.createDataChannel('cinepair-chat', { ordered: true });
      this.setupDataChannel(session, dc);
    } else {
      pc.ondatachannel = (event) => {
        this.setupDataChannel(session, event.channel);
      };
    }

    // ─── Add Local Tracks ────────────────────────────
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    this.peers.set(targetUserId, session);
    return session;
  }

  private setupDataChannel(session: PeerSession, channel: RTCDataChannel): void {
    session.dataChannel = channel;

    channel.onopen = () => {
      session.isDataChannelReady = true;
      this.events.onDataChannelReady(session.userId);
    };

    channel.onclose = () => {
      session.isDataChannelReady = false;
    };

    channel.onmessage = (event) => {
      this.events.onDataChannelMessage(session.userId, event.data as string);
    };

    channel.onerror = (event) => {
      console.error('[WebRtcEngine] DataChannel error:', event);
    };
  }

  destroyPeer(userId: string): void {
    const session = this.peers.get(userId);
    if (!session) return;

    if (session.dataChannel) {
      session.dataChannel.close();
    }
    session.pc.close();
    this.peers.delete(userId);
  }

  // ─── Signaling Handlers ───────────────────────────────

  private setupSignalingListeners(): void {
    // Handle signaling relay messages
    const cleanupRelay = signalingClient.on('signaling:relay', (payload) => {
      void this.handleSignalingMessage(payload);
    });

    // Handle peer:start-negotiation from server
    const cleanupNegotiation = signalingClient.on('peer:start-negotiation', (data) => {
      const peer = this.createPeer(data.targetUserId, data.polite);
      console.log(`[WebRtcEngine] Starting negotiation with ${data.targetUserId}, polite=${data.polite}`);

      // Trigger negotiation by adding transceiver if impolite
      if (!data.polite) {
        peer.pc.addTransceiver('audio', { direction: 'sendrecv' });
        peer.pc.addTransceiver('video', { direction: 'sendrecv' });
      }
    });

    this.cleanupFunctions.push(cleanupRelay, cleanupNegotiation);
  }

  /**
   * Handles incoming signaling messages using Perfect Negotiation.
   */
  private async handleSignalingMessage(payload: {
    data: Record<string, unknown>;
    type: 'offer' | 'answer' | 'ice-candidate';
    streamType?: 'webcam' | 'screen';
    senderUserId: string;
  }): Promise<void> {
    const session = this.peers.get(payload.senderUserId);
    if (!session) return;

    const { pc, polite } = session;

    try {
      if (payload.type === 'offer' || payload.type === 'answer') {
        const description = payload.data as unknown as RTCSessionDescriptionInit;

        // Perfect Negotiation: collision detection
        const offerCollision =
          payload.type === 'offer' &&
          (session.makingOffer || pc.signalingState !== 'stable');

        session.ignoreOffer = !polite && offerCollision;
        if (session.ignoreOffer) return;

        await pc.setRemoteDescription(new RTCSessionDescription(description));

        // Flush queued ICE candidates
        while (session.iceCandidateQueue.length > 0) {
          const candidate = session.iceCandidateQueue.shift()!;
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }

        if (payload.type === 'offer') {
          await pc.setLocalDescription();
          if (pc.localDescription) {
            signalingClient.relaySignaling({
              code: this.roomCode,
              targetUserId: payload.senderUserId,
              data: pc.localDescription,
              type: 'answer',
              streamType: payload.streamType,
            });
          }
        }
      } else if (payload.type === 'ice-candidate') {
        const candidate = payload.data as unknown as RTCIceCandidateInit;

        // Queue if remote description not yet set
        if (!pc.remoteDescription) {
          session.iceCandidateQueue.push(candidate);
        } else {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            if (!session.ignoreOffer) throw err;
          }
        }
      }
    } catch (err) {
      console.error(`[WebRtcEngine] Error handling ${payload.type}:`, err);
    }
  }

  // ─── Stream Management ────────────────────────────────

  setLocalStream(stream: MediaStream): void {
    this.localStream = stream;

    // Add tracks to all existing peers
    for (const session of this.peers.values()) {
      // Remove existing senders
      for (const sender of session.pc.getSenders()) {
        session.pc.removeTrack(sender);
      }
      // Add new tracks
      for (const track of stream.getTracks()) {
        session.pc.addTrack(track, stream);
      }
    }
  }

  /**
   * Adds a screen share stream to all peers on the same PeerConnection.
   * Keeps screen video and system audio on the same PC.
   * Caps bitrate and framerate for screen sharing.
   */
  async addScreenStream(stream: MediaStream): Promise<void> {
    this.screenStream = stream;

    for (const session of this.peers.values()) {
      for (const track of stream.getTracks()) {
        const sender = session.pc.addTrack(track, stream);

        // Cap bitrate for screen video
        if (track.kind === 'video') {
          try {
            const params = sender.getParameters();
            if (!params.encodings) params.encodings = [{}];
            params.encodings[0].maxBitrate = 2_500_000; // 2.5 Mbps
            params.encodings[0].maxFramerate = 24;
            await sender.setParameters(params);
          } catch (err) {
            console.warn('[WebRtcEngine] Failed to set bitrate cap:', err);
          }
        }
      }
    }
  }

  removeScreenStream(): void {
    if (!this.screenStream) return;

    // Stop all screen tracks
    for (const track of this.screenStream.getTracks()) {
      track.stop();
    }

    // Remove screen senders from peers
    for (const session of this.peers.values()) {
      const senders = session.pc.getSenders();
      for (const sender of senders) {
        if (sender.track && this.screenStream.getTracks().includes(sender.track)) {
          session.pc.removeTrack(sender);
        }
      }
    }

    this.screenStream = null;
  }

  // ─── DataChannel Messaging ────────────────────────────

  sendMessage(message: string): boolean {
    let sent = false;
    for (const session of this.peers.values()) {
      if (session.dataChannel && session.isDataChannelReady) {
        session.dataChannel.send(message);
        sent = true;
      }
    }
    return sent;
  }

  // ─── Diagnostics ──────────────────────────────────────

  async getStats(userId: string): Promise<RTCStatsReport | null> {
    const session = this.peers.get(userId);
    if (!session) return null;
    return session.pc.getStats();
  }

  getPeerState(userId: string): RTCPeerConnectionState | null {
    return this.peers.get(userId)?.pc.connectionState || null;
  }

  getConnectedPeerIds(): string[] {
    return [...this.peers.keys()];
  }

  // ─── Cleanup ──────────────────────────────────────────

  destroy(): void {
    for (const cleanup of this.cleanupFunctions) {
      cleanup();
    }
    this.cleanupFunctions = [];

    for (const [userId] of this.peers) {
      this.destroyPeer(userId);
    }

    if (this.screenStream) {
      for (const track of this.screenStream.getTracks()) {
        track.stop();
      }
      this.screenStream = null;
    }

    console.log('[WebRtcEngine] Destroyed');
  }
}
