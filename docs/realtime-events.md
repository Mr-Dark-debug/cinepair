# CinePair Realtime Events

CinePair uses Socket.IO for anonymous, room-scoped signaling and room presence.
Payloads are validated server-side with Zod before room state changes or relays are accepted.

## Client To Server

| Event                  | Purpose                                    | Notes                                                     |
| ---------------------- | ------------------------------------------ | --------------------------------------------------------- |
| `room:create`          | Create an ephemeral room                   | Callback returns room code and flags.                     |
| `room:join`            | Join a room or request approval            | Callback returns joined room data or `APPROVAL_REQUIRED`. |
| `room:join-response`   | Admin approves or denies a pending request | Admin-only by socket membership.                          |
| `room:toggle-approval` | Admin toggles join approval                | Broadcasts `room:approval-changed`.                       |
| `room:leave`           | Leave the current room                     | Admin leave closes the room in the current v1 model.      |
| `signaling:relay`      | Relay SDP or ICE to a peer socket          | Sender must already be a room member.                     |
| `chat:message`         | Send a plain text chat fallback message    | Max 2048 characters.                                      |
| `screen:toggle`        | Broadcast screen-share state               | Admin-only in the current v1 model.                       |

## Server To Client

| Event                   | Purpose                             | Notes                                                    |
| ----------------------- | ----------------------------------- | -------------------------------------------------------- |
| `room:created`          | Reserved room-created notification  | Typed but not emitted by current server handlers.        |
| `room:joined`           | Full room state after approved join | Includes users and current screen-share flag.            |
| `room:user-joined`      | Peer joined notification            | Emitted to existing room members.                        |
| `room:user-left`        | Peer left notification              | Emitted to remaining room members.                       |
| `room:join-request`     | Pending join request for admin      | Contains request ID, socket ID, nickname, and timestamp. |
| `room:join-response`    | Approval decision for joiner        | May include denial reason.                               |
| `room:approval-changed` | Approval setting changed            | Broadcast to the whole room.                             |
| `room:closed`           | Room closed                         | Current server closes when admin leaves.                 |
| `signaling:relay`       | Relayed SDP or ICE                  | Includes sender socket ID and optional stream type.      |
| `chat:message`          | Plain text fallback chat message    | DataChannel remains the preferred chat path.             |
| `screen:toggle`         | Screen-share state changed          | Includes sharing state and sharer socket ID.             |
| `error`                 | Structured server error             | `{ code, message }` today; request IDs are planned.      |

## Current Constraints

- Rooms are stored in process memory and are lost on server restart or free-host sleep.
- Identity is still `socket.id`; reconnect-safe `clientId` and `sessionToken` are planned next.
- WebRTC media does not pass through the app server. TURN, when configured later, relays encrypted WebRTC media only.
