"""Reject malformed Socket.IO payloads before handlers access their fields."""
from functools import wraps


def valid_payload(handler):
    @wraps(handler)
    async def checked(sid, data):
        if not isinstance(data, dict):
            return {"success": False, "error": "Expected an event object."}
        lengths = {"room_code": 16, "nickname": 40, "password": 128,
                   "avatar_seed": 80, "avatar_palette": 40, "target_id": 100,
                   "target_sid": 100, "action": 30, "reply_to": 100,
                   "emoji": 32, "message_id": 100, "text": 4000}
        for key, limit in lengths.items():
            if key not in data:
                continue
            value = data[key]
            if value is None and key in {"password", "avatar_seed", "avatar_palette", "reply_to"}:
                continue
            if not isinstance(value, str) or len(value) > limit:
                return {"success": False, "error": f"Invalid {key}."}
        for key in ("camera_on", "mic_on", "screen_share_on", "require_approval", "playing", "encrypted"):
            if key in data and data[key] is not None and not isinstance(data[key], bool):
                return {"success": False, "error": f"Invalid {key}."}
        return await handler(sid, data)
    return checked
