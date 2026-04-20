# Rooms and Signaling

This document explains the technical flow of room management and WebRTC signaling in CinePair.

## Room Creation & Security

1. **Room Codes**: 8-character uppercase alphanumeric strings (e.g., `G7K2B9W1`).
2. **Passwords**: Hashed using **Argon2id**. The backend never stores plaintext passwords.
3. **Approval**: If `require_approval` is enabled, the admin must manually approve each participant. This creates a "Lobby" experience for the joiner.
4. **Session Tokens**: All room participants are issued a room-scoped JWT. This token is required for all sensitive Socket.IO events and REST calls.

## Join Flow (with Approval)

1. **Joiner** sends `room:join` event.
2. **Backend** validates password and capacity. If approval is needed, it creates a `JoinRequest` and responds with `APPROVAL_REQUIRED`.
3. **Joiner** enters a waiting state in the UI.
4. **Admin** receives `room:join-request`.
5. **Admin** clicks "Approve". This sends `room:join-response` to the server.
6. **Backend** promotes the joiner to a `RoomUser`, generates their JWT, and sends `room:joined` to the joiner.
7. **Existing Members** receive `room:user-joined`.

## WebRTC Signaling Flow

CinePair uses the **Perfect Negotiation** pattern to establish P2P connections.

1. **Peer Readiness**: Both peers connect and emit `peer:ready`.
2. **Negotiation Trigger**: The server waits for at least two peers to be ready, then emits `peer:start-negotiation`.
3. **Roles**:
   - **Admin** is assigned `polite: false` (Impolite/Offerer).
   - **Partner** is assigned `polite: true` (Polite/Answerer).
4. **Offer/Answer**:
   - Admin creates an offer and sends it via `signaling:relay`.
   - Backend forwards the offer to the Partner.
   - Partner receives the offer, creates an answer, and relays it back.
5. **ICE Candidates**: Both peers generate ICE candidates and relay them through the server until a connection is established.

## Disconnect & Reconnection

The backend implements a **90-second grace period** for dropped connections.

1. **Socket Disconnect**: If a user's socket drops, they are marked as `RECONNECTING`.
2. **Grace Period**: The backend keeps the user in the room for 90 seconds (configurable via `RECONNECT_GRACE_SECONDS`).
3. **Reconnection**: If the user reconnects within the window using the same `userId` and `sessionToken`, they are restored to `CONNECTED` status.
4. **Expiration**: If the window expires, the user is removed, and remaining members are notified via `room:user-left`.

## Room Cleanup

- **Empty Rooms**: If all users leave or disconnect and the grace period expires, the room is deleted.
- **Inactivity**: Rooms are automatically purged after 24 hours of inactivity (last event/message) by a background task.
- **Admin Departure**: If the admin explicitly leaves, the room is closed immediately.
