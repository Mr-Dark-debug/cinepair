# Debugging Guide

This guide helps developers diagnose and fix issues in the CinePair backend.

## Terminal Logs

CinePair uses **structlog** for structured JSON logging. In development, logs are pretty-printed for readability.

### Log Levels
- `DEBUG`: Detailed signaling events, relay envelopes, and internal state changes.
- `INFO`: Room creation, joins, leaves, and background task summaries.
- `ERROR`: Validation failures, service errors, and socket exceptions.

### Key Log Events to Watch
| Event | Meaning |
|-------|---------|
| `room_created` | A new room was successfully added to memory. |
| `user_disconnected` | A socket dropped; check if `grace_seconds` is active. |
| `signal_relayed` | A WebRTC packet was passed through. If missing, signaling is broken. |
| `background_cleanup` | The periodic task deleted inactive rooms. |

## Common Backend Errors

### `ROOM_NOT_FOUND`
- **Cause**: The room expired, the admin left, or the server restarted.
- **Fix**: Create a new room. If it happens too fast, check `ROOM_EXPIRY_HOURS`.

### `WRONG_PASSWORD` / `PASSWORD_REQUIRED`
- **Cause**: Incorrect entry or state mismatch.
- **Fix**: Verify the `hasPassword` flag in the room metadata.

### `VALIDATION_FAILED`
- **Cause**: Frontend sent an incorrectly formatted payload.
- **Fix**: Check the `msg` field in the log for Pydantic validation errors. Usually a missing field or wrong type.

## WebSocket Failures

### Connection Rejected
- **Cause**: CORS origin mismatch.
- **Fix**: Check `CORS_ORIGINS` in `.env`. Ensure it includes `http://localhost:5173` and `app://cinepair`.

### Signaling Relay Fails
- **Cause**: Target user is no longer connected or has a different `socket_id`.
- **Fix**: CinePair relays by `userId` to handle reconnection. If the target is `RECONNECTING`, signaling will fail until they return.

## Room Lifecycle Bugs

### Users "Stuck" in Room
- **Cause**: Reconnection purge task failed or grace period is too long.
- **Fix**: Check the `purge_reconnections` logs. Manual fix: Admin leaves the room to force closure.

### Split Brain (Multiple Admins)
- **Cause**: Logic error in role assignment.
- **Check**: Verify that `UserRole.ADMIN` is only assigned to the `admin_user_id` stored in the `Room` object.

## Inspecting State (Dev Only)

You can check the current backend state by hitting the health endpoint:
```bash
curl http://localhost:3001/health
```
This shows the number of active/waiting rooms without exposing sensitive data.
