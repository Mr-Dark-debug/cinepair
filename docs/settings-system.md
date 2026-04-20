# Settings System

CinePair uses a three-tier settings model to balance global configuration, room setup, and live session control.

## 1. App-Level Settings (Server Environment)
These are global constraints set via environment variables on the backend.

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_USERS_PER_ROOM` | 2 | The absolute hard limit for any room. |
| `ROOM_EXPIRY_HOURS` | 24 | How long a room stays alive without activity. |
| `RECONNECT_GRACE_SECONDS` | 90 | How long a disconnected user is kept before removal. |
| `JWT_EXPIRES_HOURS` | 24 | How long a session token is valid. |

## 2. Room Creation Settings
These are chosen by the Admin when clicking "Create Room".

| Setting | Type | Description |
|---------|------|-------------|
| `nickname` | string | Admin's display name. |
| `password` | string | (Optional) Password required to join. |
| `require_approval` | boolean | (Optional) Admin must approve join requests. |

## 3. Live Room Controls (Admin Controls)
Mid-session, the Admin can change these settings via the "Admin Controls" panel. These are broadcast to all participants via the `room:settings-update` event.

| Setting | Description |
|---------|-------------|
| **Lock Room** | Prevents any new join attempts, even with a password. |
| **Max Users** | Adjusts the room capacity (up to the global `MAX_USERS_PER_ROOM`). |
| **Disable Chat** | Prevents non-admin users from sending chat messages. |
| **Disable Partner Screen Share** | Prevents non-admin users from toggling screen share. |
| **Require Approval** | Toggles the approval requirement for future joiners. |

## Data Flow for Settings Updates

1. **Admin** toggles a switch in the UI.
2. **Frontend** sends `room:settings-update` Socket.IO event.
3. **Backend** validates that the sender is the room admin.
4. **Backend** updates the room state in memory.
5. **Backend** broadcasts the `room:settings-update` event to **all** users in the room.
6. **Participants** update their local store and UI state (e.g., graying out the chat box).

## Propagation & Storage

- **Persistence**: Settings are stored in the ephemeral `Room` object in memory.
- **Reloading**: If a user re-joins or re-connects, they receive the current room settings in the initial `room:joined` payload.
