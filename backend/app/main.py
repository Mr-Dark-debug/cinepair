import logging
import os
import time
import uuid
from time import perf_counter
from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import socketio

from .managers import RoomManager
from .schemas import RoomSettings

# 1. Initialize FastAPI Application
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("cinepair.signaling")

app = FastAPI(title="CinePair Signaling API", version="1.0.0")

def _build_allowed_origins() -> list[str]:
    origins = {
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "tauri://localhost",
        "http://tauri.localhost",
        "https://tauri.localhost",
    }
    extra_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")
    if extra_origins:
        origins.update(origin.strip() for origin in extra_origins.split(",") if origin.strip())
    return sorted(origins)


allowed_origins = _build_allowed_origins()

# Add CORS Middleware for standard HTTP clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"https://.*\.onrender\.com",
)

# 3. Initialize Socket.IO server with AsyncIO support and CORS
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    ping_timeout=60,
    ping_interval=25
)

# 4. Wrap with ASGI application
socket_app = socketio.ASGIApp(sio, app)

# 5. Initialize Room Manager
room_manager = RoomManager()


def _room_metrics() -> dict[str, int]:
    return room_manager.get_public_metrics()


def _log_room_event(event: str, sid: Optional[str] = None, room_code: Optional[str] = None, **extra):
    metrics = _room_metrics()
    details = [
        f"event={event}",
        f"sid={sid or '-'}",
        f"room={room_code or '-'}",
        f"active_rooms={metrics['active_rooms']}",
        f"active_participants={metrics['active_participants']}",
        f"waiting_guests={metrics['waiting_guests']}",
    ]
    details.extend(f"{key}={value}" for key, value in extra.items() if value is not None)
    logger.info(" | ".join(details))


@app.middleware("http")
async def log_http_requests(request: Request, call_next):
    started_at = perf_counter()
    response = await call_next(request)
    duration_ms = (perf_counter() - started_at) * 1000
    logger.info(
        "event=http_request | method=%s | path=%s | status=%s | duration_ms=%.2f",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response

# --- HTTP Endpoints ---

@app.api_route("/", methods=["GET", "HEAD"])
def read_root():
    return {"name": "CinePair Signaling Service", "status": "operational", **_room_metrics()}


@app.get("/stats")
def read_stats():
    return _room_metrics()

@app.get("/rooms/{room_code}")
def check_room_exists(room_code: str):
    room = room_manager.get_room_state(room_code.upper())
    if not room:
        raise HTTPException(status_code=404, detail="Room not found.")
    return {
        "exists": True,
        "require_approval": room.settings.require_approval,
        "has_password": room.settings.password is not None
    }

# --- Socket.IO Event Handlers ---

@sio.event
async def connect(sid, environ):
    origin = environ.get("HTTP_ORIGIN") if environ else None
    _log_room_event("socket_connected", sid=sid, origin=origin)

@sio.event
async def disconnect(sid):
    _log_room_event("socket_disconnected", sid=sid)
    room_code, room_state, was_admin_removed = room_manager.remove_participant(sid)
    if room_code:
        if room_state:
            # Broadcast the updated state and who left
            await sio.emit("user_left", {"left_sid": sid, "room": room_state.model_dump()}, room=room_code)
            _log_room_event("participant_removed", sid=sid, room_code=room_code, admin_reassigned=was_admin_removed)
        else:
            _log_room_event("room_destroyed", sid=sid, room_code=room_code)

# 1. Create Room Event
@sio.on("create_room")
async def on_create_room(sid, data):
    """
    Data payload keys:
        nickname (str) - required
        password (str) - optional
        max_participants (int) - optional
        require_approval (bool) - optional
    """
    nickname = data.get("nickname")
    if not nickname or not nickname.strip():
        return {"success": False, "error": "Nickname is required."}

    password = data.get("password")
    max_p = data.get("max_participants", 10)
    req_app = data.get("require_approval", False)

    try:
        room_state = room_manager.create_room(
            admin_sid=sid,
            nickname=nickname.strip(),
            password=password if password else None,
            max_participants=int(max_p),
            require_approval=bool(req_app)
        )
        # Add admin to Socket.IO broadcast room
        await sio.enter_room(sid, room_state.code)
        _log_room_event("room_created", sid=sid, room_code=room_state.code, nickname=nickname)
        return {"success": True, "room": room_state.model_dump()}
    except Exception as e:
        logger.exception("event=create_room_failed | sid=%s", sid)
        return {"success": False, "error": f"Failed to create room: {str(e)}"}

# 2. Join Room Event
@sio.on("join_room")
async def on_join_room(sid, data):
    """
    Data payload keys:
        room_code (str) - required
        nickname (str) - required
        password (str) - optional
    """
    room_code = data.get("room_code", "").upper().strip()
    nickname = data.get("nickname", "").strip()
    password = data.get("password")

    if not room_code or not nickname:
        return {"success": False, "error": "Room code and nickname are required."}

    # Verify if user is already in a room
    if sid in room_manager.sid_to_room:
        room_manager.remove_participant(sid)

    success, status, room_state = room_manager.join_room(
        room_code=room_code,
        sid=sid,
        nickname=nickname,
        password=password
    )

    if not success:
        return {"success": False, "error": status}

    if status == "waiting":
        # Notify the admin that a user is in the lobby
        admin_id = room_state.admin_id
        await sio.emit("lobby_request", {"sid": sid, "nickname": nickname}, to=admin_id)
        _log_room_event("join_waiting", sid=sid, room_code=room_code, nickname=nickname)
        return {"success": True, "status": "waiting"}
    
    # Standard Instant Join Success
    await sio.enter_room(sid, room_code)
    
    # Broadcast to other room members
    await sio.emit(
        "user_joined", 
        {"joined_participant": {"id": sid, "nickname": nickname}, "room": room_state.model_dump()},
        room=room_code,
        skip_sid=sid
    )
    
    _log_room_event("room_joined", sid=sid, room_code=room_code, nickname=nickname)
    return {"success": True, "status": "joined", "room": room_state.model_dump()}

# 3. Admin Waiting Room Actions (Admit / Deny)
@sio.on("waiting_room_action")
async def on_waiting_room_action(sid, data):
    """
    Data payload keys:
        room_code (str) - required
        target_sid (str) - required
        action (str) - "admit" or "deny"
    """
    room_code = data.get("room_code", "").upper()
    target_sid = data.get("target_sid")
    action = data.get("action") # "admit" or "deny"

    room = room_manager.rooms.get(room_code)
    if not room or room["admin_id"] != sid:
        return {"success": False, "error": "Unauthorized action."}

    if action == "admit":
        success, room_state = room_manager.admit_participant(room_code, target_sid)
        if success and room_state:
            # Let the guest join the socket room channel
            await sio.enter_room(target_sid, room_code)
            
            # Retrieve participant details
            p_details = next((p for p in room_state.participants if p.id == target_sid), None)
            
            # Notify the guest they are admitted
            await sio.emit("admit_result", {"success": True, "status": "joined", "room": room_state.model_dump()}, to=target_sid)
            
            # Notify the rest of the room
            await sio.emit(
                "user_joined",
                {"joined_participant": p_details.model_dump() if p_details else {}, "room": room_state.model_dump()},
                room=room_code,
                skip_sid=target_sid
            )
            _log_room_event("waiting_participant_admitted", sid=target_sid, room_code=room_code)
            return {"success": True, "room": room_state.model_dump()}
            
    elif action == "deny":
        success, room_state = room_manager.deny_participant(room_code, target_sid)
        if success:
            # Notify the guest they were denied
            await sio.emit("admit_result", {"success": False, "error": "Access request denied by host."}, to=target_sid)
            # Update the admin's view of the waiting list
            _log_room_event("waiting_participant_denied", sid=target_sid, room_code=room_code)
            return {"success": True, "room": room_state.model_dump() if room_state else None}

    return {"success": False, "error": "Action failed."}

# 4. WebRTC Signaling relay event
@sio.on("signal")
async def on_signal(sid, data):
    """
    Data payload keys:
        room_code (str) - required
        target_id (str) - required
        signal (any) - WebRTC offer, answer, or ICE candidates
    """
    room_code = data.get("room_code", "").upper()
    target_id = data.get("target_id")
    signal_data = data.get("signal")

    # Confirm sender and receiver are in the same room
    if (room_manager.sid_to_room.get(sid) == room_code and 
        room_manager.sid_to_room.get(target_id) == room_code):
        # Relay signaling data with sender_id attached
        await sio.emit("signal", {"sender_id": sid, "signal": signal_data}, to=target_id)

# 5. Media Control Status updates (Cam / Mic / Screenshare)
@sio.on("update_media")
async def on_update_media(sid, data):
    """
    Data payload keys:
        room_code (str)
        camera_on (bool) - optional
        mic_on (bool) - optional
        screen_share_on (bool) - optional
    """
    room_code = data.get("room_code", "").upper()
    camera_on = data.get("camera_on")
    mic_on = data.get("mic_on")
    screen_share_on = data.get("screen_share_on")

    room_state = room_manager.update_participant_media(
        room_code=room_code,
        sid=sid,
        camera_on=camera_on,
        mic_on=mic_on,
        screen_share_on=screen_share_on
    )

    if room_state:
        # Broadcast status update room wide
        await sio.emit("media_updated", {
            "participant_id": sid,
            "camera_on": camera_on,
            "mic_on": mic_on,
            "screen_share_on": screen_share_on,
            "room": room_state.model_dump()
        }, room=room_code)
        _log_room_event("media_updated", sid=sid, room_code=room_code, camera_on=camera_on, mic_on=mic_on, screen_share_on=screen_share_on)
        return {"success": True}
    return {"success": False, "error": "Failed to update media status."}

# 6. Chat Message relays (supports replies)
@sio.on("chat_message")
async def on_chat_message(sid, data):
    """
    Data payload keys:
        room_code (str)
        text (str)
        reply_to (str) - optional (message_id representing threading)
    """
    room_code = data.get("room_code", "").upper()
    text = data.get("text", "").strip()
    reply_to = data.get("reply_to")

    room = room_manager.rooms.get(room_code)
    if not room or sid not in room["participants"]:
        return {"success": False, "error": "Not a participant in this room."}

    sender = room["participants"][sid]
    
    msg_id = str(uuid.uuid4())
    message = {
        "id": msg_id,
        "sender_id": sid,
        "sender_nickname": sender.nickname,
        "text": text,
        "timestamp": time.time(),
        "reply_to": reply_to
    }

    # Broadcast message to room channel
    await sio.emit("chat_message", message, room=room_code)
    _log_room_event("chat_message_sent", sid=sid, room_code=room_code, reply_to=reply_to is not None)
    return {"success": True, "message_id": msg_id}

# 7. Screenshot Share relay
@sio.on("share_screenshot")
async def on_share_screenshot(sid, data):
    """
    Data payload keys:
        room_code (str)
        image_data (str) - base64 string
    """
    room_code = data.get("room_code", "").upper()
    image_data = data.get("image_data")

    room = room_manager.rooms.get(room_code)
    if not room or sid not in room["participants"]:
        return {"success": False, "error": "Unauthorized action."}

    sender = room["participants"][sid]
    msg_id = str(uuid.uuid4())
    message = {
        "id": msg_id,
        "sender_id": sid,
        "sender_nickname": sender.nickname,
        "text": "[Shared Screenshot]",
        "image_data": image_data, # base64 attachment
        "timestamp": time.time(),
        "reply_to": None
    }
    
    await sio.emit("chat_message", message, room=room_code)
    _log_room_event("screenshot_shared", sid=sid, room_code=room_code)
    return {"success": True, "message_id": msg_id}

# 8. Floating Emojis Reaction relay
@sio.on("send_reaction")
async def on_send_reaction(sid, data):
    """
    Data payload keys:
        room_code (str)
        emoji (str)
    """
    room_code = data.get("room_code", "").upper()
    emoji = data.get("emoji")

    if room_manager.sid_to_room.get(sid) == room_code:
        await sio.emit("emoji_reaction", {"sender_id": sid, "emoji": emoji}, room=room_code)
        _log_room_event("emoji_reaction_sent", sid=sid, room_code=room_code, emoji=emoji)
        return {"success": True}
    return {"success": False}

# 8.5 Message Reaction relay (Slack/Discord style reactions)
@sio.on("message_reaction")
async def on_message_reaction(sid, data):
    """
    Data payload keys:
        room_code (str)
        message_id (str)
        emoji (str)
    """
    room_code = data.get("room_code", "").upper()
    message_id = data.get("message_id")
    emoji = data.get("emoji")

    room = room_manager.rooms.get(room_code)
    if not room or sid not in room["participants"]:
        return {"success": False, "error": "Not in room."}

    sender = room["participants"][sid]
    
    await sio.emit("message_reaction", {
        "message_id": message_id,
        "sender_id": sid,
        "sender_nickname": sender.nickname,
        "emoji": emoji
    }, room=room_code)
    _log_room_event("message_reaction_sent", sid=sid, room_code=room_code, emoji=emoji)
    return {"success": True}


# 9. Admin Configuration Settings Updates
@sio.on("update_settings")
async def on_update_settings(sid, data):
    """
    Data payload keys:
        room_code (str)
        max_participants (int)
        require_approval (bool)
        password (str/None)
    """
    room_code = data.get("room_code", "").upper()
    max_p = data.get("max_participants")
    req_app = data.get("require_approval")
    password = data.get("password", "NO_CHANGE") # Uses default sentinal to distinguish Null vs Unchanged

    room = room_manager.rooms.get(room_code)
    if not room or room["admin_id"] != sid:
        return {"success": False, "error": "Only admins can update room settings."}

    # Perform updates
    room_state = room_manager.update_room_settings(
        room_code=room_code,
        max_participants=int(max_p) if max_p is not None else None,
        require_approval=bool(req_app) if req_app is not None else None,
        password=password
    )

    if room_state:
        # Broadcast settings change room wide
        await sio.emit("settings_updated", {"room": room_state.model_dump()}, room=room_code)
        _log_room_event(
            "settings_updated",
            sid=sid,
            room_code=room_code,
            max_participants=max_p,
            require_approval=req_app,
            password_changed=password != "NO_CHANGE",
        )
        return {"success": True, "room": room_state.model_dump()}
    
    return {"success": False, "error": "Failed to update settings."}

# 10. Admin Actions (Kick / Mute / Transfer)
@sio.on("admin_action")
async def on_admin_action(sid, data):
    """
    Data payload keys:
        room_code (str)
        target_id (str)
        action (str) - 'kick', 'mute', or 'make_admin'
    """
    room_code = data.get("room_code", "").upper()
    target_id = data.get("target_id")
    action = data.get("action")

    room = room_manager.rooms.get(room_code)
    if not room or room["admin_id"] != sid:
        return {"success": False, "error": "Only admins can perform moderation actions."}

    if target_id not in room["participants"]:
        return {"success": False, "error": "Target user is not in the room."}

    if action == "kick":
        _, room_state, _ = room_manager.remove_participant(target_id)
        # Notify the kicked user
        await sio.emit("kicked", {}, to=target_id)
        # Disconnect their socket connection
        await sio.disconnect(target_id)
        
        if room_state:
            # Broadcast user left to the room
            await sio.emit("user_left", {"left_sid": target_id, "room": room_state.model_dump()}, room=room_code)
        _log_room_event("participant_kicked", sid=target_id, room_code=room_code, by_admin=sid)
        return {"success": True}

    elif action == "mute":
        # Broadcast target force-mute. The client listens to force_mute and shuts off local mic
        await sio.emit("force_mute", {}, to=target_id)
        _log_room_event("participant_muted", sid=target_id, room_code=room_code, by_admin=sid)
        return {"success": True}

    elif action == "make_admin":
        room_state = room_manager.transfer_admin(room_code, sid, target_id)
        if room_state:
            await sio.emit("admin_transferred", {"new_admin_id": target_id, "room": room_state.model_dump()}, room=room_code)
            _log_room_event("admin_transferred", sid=target_id, room_code=room_code, previous_admin=sid)
            return {"success": True}

    return {"success": False, "error": "Invalid action."}
