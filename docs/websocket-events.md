# WebSocket Events

CinePair uses **Socket.IO** for real-time signaling, presence, and chat.

## Connection & Auth
Clients must provide a `sessionToken` in the `auth` object during connection if they have already created or joined a room via REST.

```javascript
const socket = io(URL, {
  auth: { sessionToken: "..." }
});
```

---

## Client -> Server Events

### `room:create`
Alternative to REST room creation.
- **Payload**: `{ nickname, password, requireApproval }`
- **Response**: `{ code, userId, sessionToken, ... }` or `{ error }`

### `room:join`
Alternative to REST join.
- **Payload**: `{ code, nickname, password }`
- **Response**: Full room state or `{ code: "APPROVAL_REQUIRED" }`

### `room:join-response`
**Admin Only**. Responds to a pending join request.
- **Payload**: `{ code, requestId, approved, reason }`

### `room:settings-update`
**Admin Only**. Updates live room controls.
- **Payload**: `{ code, settings: { max_users, is_locked, chat_disabled, ... } }`

### `room:leave`
Leaves the current room. If admin leaves, the room is closed.
- **Payload**: `{ code }`

### `peer:ready`
Signals that the client is ready for WebRTC negotiation.
- **Payload**: `{ code }`

### `signaling:relay`
Relays WebRTC signals (SDP/ICE) to a specific peer.
- **Payload**: `{ code, targetUserId, data, type, streamType }`
- **Note**: `type` must be `offer`, `answer`, or `ice-candidate`.

### `chat:message`
Sends a chat message (fallback for DataChannel).
- **Payload**: `{ code, message, timestamp, clientMessageId }`

### `screen:toggle`
Broadcasts screen sharing state.
- **Payload**: `{ code, isSharing }`

---

## Server -> Client Events

### `room:join-request`
**Admin Only**. Notifies admin of a new joiner waiting for approval.
- **Payload**: `{ id, userId, nickname, createdAt }`

### `room:joined`
Sent to a joiner after admin approval.
- **Payload**: Full room data including `sessionToken`.

### `room:user-joined`
Notifies members that a new peer has joined.
- **Payload**: `{ userId, nickname, role }`

### `room:user-disconnected`
Notifies that a peer lost connection (entering grace period).
- **Payload**: `{ userId, nickname, reconnecting: true }`

### `room:user-reconnected`
Notifies that a peer has returned.
- **Payload**: `{ userId, nickname }`

### `room:user-left`
Notifies that a peer has explicitly left the room.
- **Payload**: `{ userId, nickname }`

### `room:closed`
Notifies that the room has been closed (e.g., admin left).
- **Payload**: `{ reason }`

### `peer:start-negotiation`
Triggers the WebRTC "Perfect Negotiation" flow.
- **Payload**: `{ targetUserId, polite }`
- **Note**: `polite` is `true` for partner, `false` for admin.

### `signaling:relay`
Incoming WebRTC signal from a peer.
- **Payload**: `{ senderUserId, data, type, streamType }`

### `room:settings-update`
Broadcast when admin changes live room controls.
- **Payload**: `{ settings }`

### `chat:message`
Incoming chat message from a peer.
- **Payload**: `{ id, senderId, senderNickname, message, timestamp, clientMessageId }`

### `screen:toggle`
Broadcast when a member starts/stops screen sharing.
- **Payload**: `{ isSharing, sharerUserId }`

### `error`
Standard error notification.
- **Payload**: `{ code, message }`
