import logging
import os
import time
import uuid
from time import perf_counter
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
import socketio

from .managers import RoomManager
from .security import RateLimiter
from .auth import (
    register_user,
    login_user,
    create_token,
    get_user_by_token,
    create_pair_code,
    confirm_pair,
)

# 1. Initialize FastAPI Application
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("cinepair.signaling")

app = FastAPI(title="CinePair Signaling API", version="1.1.0")

# --- Pre-built watch sources catalog (revamp) ---
# can_sync=True  -> plays inside CinePair with frame-accurate sync.
# can_sync=False -> DRM / login-walled apps: we deep-link + guide screen-share
#                   so couples can still watch together seamlessly.
WATCH_SOURCES = [
    {"provider": "youtube", "label": "YouTube", "icon": "youtube", "can_sync": True,
     "embed_base_url": "https://www.youtube.com/embed/",
     "watch_url_template": "https://www.youtube.com/watch?v={id}",
     "hint": "Paste any YouTube link — plays in-sync."},
    {"provider": "vimeo", "label": "Vimeo", "icon": "vimeo", "can_sync": True,
     "embed_base_url": "https://player.vimeo.com/video/",
     "watch_url_template": "https://vimeo.com/{id}",
     "hint": "Paste a Vimeo ID or URL."},
    {"provider": "dailymotion", "label": "Dailymotion", "icon": "dailymotion", "can_sync": True,
     "embed_base_url": "https://www.dailymotion.com/embed/video/",
     "watch_url_template": "https://www.dailymotion.com/video/{id}",
     "hint": "Paste a Dailymotion ID or URL."},
    {"provider": "twitch", "label": "Twitch", "icon": "twitch", "can_sync": False,
     "embed_base_url": "https://player.twitch.tv/",
     "watch_url_template": "https://www.twitch.tv/{id}",
     "hint": "Open the stream, then Screen-Share the tab."},
    {"provider": "direct", "label": "Direct URL (MP4/HLS)", "icon": "link", "can_sync": True,
     "embed_base_url": None,
     "watch_url_template": None,
     "hint": "Any direct .mp4 / .m3u8 link plays in-sync with PiP."},
    # Famous DRM apps — guided screen-share flow (countdown + audio checklist).
    {"provider": "netflix", "label": "Netflix", "icon": "netflix", "can_sync": False,
     "embed_base_url": None, "watch_url_template": "https://www.netflix.com/browse",
     "hint": "Open Netflix, pick your show, then Screen-Share with tab audio ON."},
    {"provider": "prime", "label": "Prime Video", "icon": "prime", "can_sync": False,
     "embed_base_url": None, "watch_url_template": "https://www.primevideo.com/",
     "hint": "Open Prime Video, then Screen-Share the tab with audio."},
    {"provider": "hotstar", "label": "JioHotstar", "icon": "hotstar", "can_sync": False,
     "embed_base_url": None, "watch_url_template": "https://www.jiohotstar.com/",
     "hint": "Open JioHotstar, then Screen-Share the tab with audio."},
    {"provider": "disney", "label": "Disney+", "icon": "disney", "can_sync": False,
     "embed_base_url": None, "watch_url_template": "https://www.disneyplus.com/",
     "hint": "Open Disney+, then Screen-Share the tab with audio."},
    {"provider": "hulu", "label": "Hulu", "icon": "hulu", "can_sync": False,
     "embed_base_url": None, "watch_url_template": "https://www.hulu.com/",
     "hint": "Open Hulu, then Screen-Share the tab with audio."},
    {"provider": "max", "label": "Max", "icon": "max", "can_sync": False,
     "embed_base_url": None, "watch_url_template": "https://www.max.com/",
     "hint": "Open Max, then Screen-Share the tab with audio."},
]

# --- In-memory rate limiters (revamp) ---
chat_limiter = RateLimiter(limit=10, window_seconds=10)
reaction_limiter = RateLimiter(limit=10, window_seconds=10)

MAX_CHAT_LEN = 4000
MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024  # 5 MB


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


def _bearer_token(authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


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


@app.get("/healthz")
def read_healthz():
    return {"status": "ok"}


@app.get("/stats")
def read_stats():
    return _room_metrics()


@app.get("/sources")
def read_sources():
    return {"sources": WATCH_SOURCES}


@app.get("/rooms/{room_code}")
def check_room_exists(room_code: str):
    room = room_manager.get_room_state(room_code.upper())
    if not room:
        raise HTTPException(status_code=404, detail="Room not found.")
    return {
        "exists": True,
        "require_approval": room.settings.require_approval,
        "has_password": room.settings.has_password
    }


# --- Auth endpoints (revamp; guest mode unaffected) ---

@app.post("/auth/register")
def auth_register(payload: dict):
    nickname = (payload.get("nickname") or "").strip()
    password = payload.get("password") or ""
    if not nickname:
        raise HTTPException(status_code=400, detail="Nickname is required.")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")
    try:
        user = register_user(nickname, password)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    token = create_token(user["id"])
    return {"token": token, "user": user}


@app.post("/auth/login")
def auth_login(payload: dict):
    nickname = (payload.get("nickname") or "").strip()
    password = payload.get("password") or ""
    try:
        user = login_user(nickname, password)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    token = create_token(user["id"])
    return {"token": token, "user": user}


@app.get("/auth/me")
def auth_me(authorization: Optional[str] = Header(None)):
    token = _bearer_token(authorization)
    user = get_user_by_token(token) if token else None
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return {"user": user}


@app.post("/auth/pair")
def auth_pair(authorization: Optional[str] = Header(None)):
    token = _bearer_token(authorization)
    user = get_user_by_token(token) if token else None
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    code = create_pair_code(user["id"])
    return {"pair_code": code}


@app.post("/auth/pair/confirm")
def auth_pair_confirm(payload: dict, authorization: Optional[str] = Header(None)):
    token = _bearer_token(authorization)
    user = get_user_by_token(token) if token else None
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    code = (payload.get("pair_code") or "").strip()
    partner = confirm_pair(user["id"], code)
    if not partner:
        raise HTTPException(status_code=400, detail="Invalid or expired pair code.")
    return {"partner": partner}


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
            await sio.emit("user_left", {"left_sid": sid, "room": room_state.model_dump()}, room=room_code)
            _log_room_event("participant_removed", sid=sid, room_code=room_code, admin_reassigned=was_admin_removed)
        else:
            _log_room_event("room_destroyed", sid=sid, room_code=room_code)


# 1. Create Room Event
@sio.on("create_room")
async def on_create_room(sid, data):
    nickname = data.get("nickname")
    if not nickname or not nickname.strip():
        return {"success": False, "error": "Nickname is required."}

    password = data.get("password")
    max_p = data.get("max_participants", 10)
    req_app = data.get("require_approval", False)
    avatar_seed = data.get("avatar_seed")
    avatar_palette = data.get("avatar_palette")

    try:
        room_state = room_manager.create_room(
            admin_sid=sid,
            nickname=nickname.strip(),
            password=password if password else None,
            max_participants=int(max_p),
            require_approval=bool(req_app),
            avatar_seed=avatar_seed,
            avatar_palette=avatar_palette,
        )
        await sio.enter_room(sid, room_state.code)
        _log_room_event("room_created", sid=sid, room_code=room_state.code, nickname=nickname)
        return {"success": True, "room": room_state.model_dump()}
    except Exception as e:
        logger.exception("event=create_room_failed | sid=%s", sid)
        return {"success": False, "error": f"Failed to create room: {str(e)}"}


# 2. Join Room Event
@sio.on("join_room")
async def on_join_room(sid, data):
    room_code = data.get("room_code", "").upper().strip()
    nickname = data.get("nickname", "").strip()
    password = data.get("password")
    avatar_seed = data.get("avatar_seed")
    avatar_palette = data.get("avatar_palette")

    if not room_code or not nickname:
        return {"success": False, "error": "Room code and nickname are required."}

    # Verify if user is already in a room
    if sid in room_manager.sid_to_room:
        room_manager.remove_participant(sid)

    success, status, room_state = room_manager.join_room(
        room_code=room_code,
        sid=sid,
        nickname=nickname,
        password=password,
        avatar_seed=avatar_seed,
        avatar_palette=avatar_palette,
    )

    if not success:
        return {"success": False, "error": status}

    if status == "waiting":
        admin_id = room_state.admin_id
        await sio.emit("lobby_request", {"sid": sid, "nickname": nickname}, to=admin_id)
        _log_room_event("join_waiting", sid=sid, room_code=room_code, nickname=nickname)
        return {"success": True, "status": "waiting"}

    await sio.enter_room(sid, room_code)

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
    room_code = data.get("room_code", "").upper()
    target_sid = data.get("target_sid")
    action = data.get("action")

    room = room_manager.rooms.get(room_code)
    if not room or room["admin_id"] != sid:
        return {"success": False, "error": "Unauthorized action."}

    if action == "admit":
        success, room_state = room_manager.admit_participant(room_code, target_sid)
        if success and room_state:
            await sio.enter_room(target_sid, room_code)
            p_details = next((p for p in room_state.participants if p.id == target_sid), None)
            await sio.emit("admit_result", {"success": True, "status": "joined", "room": room_state.model_dump()}, to=target_sid)
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
            await sio.emit("admit_result", {"success": False, "error": "Access request denied by host."}, to=target_sid)
            _log_room_event("waiting_participant_denied", sid=target_sid, room_code=room_code)
            return {"success": True, "room": room_state.model_dump() if room_state else None}

    return {"success": False, "error": "Action failed."}


# 4. WebRTC Signaling relay event
@sio.on("signal")
async def on_signal(sid, data):
    room_code = data.get("room_code", "").upper()
    target_id = data.get("target_id")
    signal_data = data.get("signal")

    if (room_manager.sid_to_room.get(sid) == room_code and
        room_manager.sid_to_room.get(target_id) == room_code):
        await sio.emit("signal", {"sender_id": sid, "signal": signal_data}, to=target_id)


# 5. Media Control Status updates (Cam / Mic / Screenshare)
@sio.on("update_media")
async def on_update_media(sid, data):
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


# 6. Chat Message relays (supports replies + end-to-end encrypted payloads)
@sio.on("chat_message")
async def on_chat_message(sid, data):
    room_code = data.get("room_code", "").upper()

    room = room_manager.rooms.get(room_code)
    if not room or sid not in room["participants"]:
        return {"success": False, "error": "Not a participant in this room."}

    if not chat_limiter.allow(sid):
        return {"success": False, "error": "Rate limited."}

    sender = room["participants"][sid]
    msg_id = str(uuid.uuid4())
    reply_to = data.get("reply_to")
    encrypted = bool(data.get("encrypted"))

    if encrypted:
        iv = data.get("iv")
        ciphertext = data.get("ciphertext")
        if not iv or not ciphertext:
            return {"success": False, "error": "Encrypted messages require iv and ciphertext."}
        message = {
            "id": msg_id,
            "sender_id": sid,
            "sender_nickname": sender.nickname,
            "encrypted": True,
            "iv": iv,
            "ciphertext": ciphertext,
            "timestamp": time.time(),
            "reply_to": reply_to,
        }
    else:
        text = (data.get("text") or "").strip()
        if not text:
            return {"success": False, "error": "Message text is required."}
        if len(text) > MAX_CHAT_LEN:
            return {"success": False, "error": "Message too long."}
        message = {
            "id": msg_id,
            "sender_id": sid,
            "sender_nickname": sender.nickname,
            "text": text,
            "timestamp": time.time(),
            "reply_to": reply_to,
        }

    await sio.emit("chat_message", message, room=room_code)
    _log_room_event("chat_message_sent", sid=sid, room_code=room_code, encrypted=encrypted, reply_to=reply_to is not None)
    return {"success": True, "message_id": msg_id}


# 7. Screenshot Share relay
@sio.on("share_screenshot")
async def on_share_screenshot(sid, data):
    room_code = data.get("room_code", "").upper()
    image_data = data.get("image_data")

    room = room_manager.rooms.get(room_code)
    if not room or sid not in room["participants"]:
        return {"success": False, "error": "Unauthorized action."}

    if image_data and len(image_data) > MAX_SCREENSHOT_BYTES:
        return {"success": False, "error": "Screenshot too large (max 5 MB)."}

    sender = room["participants"][sid]
    msg_id = str(uuid.uuid4())
    message = {
        "id": msg_id,
        "sender_id": sid,
        "sender_nickname": sender.nickname,
        "text": "[Shared Screenshot]",
        "image_data": image_data,
        "timestamp": time.time(),
        "reply_to": None
    }

    await sio.emit("chat_message", message, room=room_code)
    _log_room_event("screenshot_shared", sid=sid, room_code=room_code)
    return {"success": True, "message_id": msg_id}


# 8. Floating Emojis Reaction relay
@sio.on("send_reaction")
async def on_send_reaction(sid, data):
    if not reaction_limiter.allow(sid):
        return {"success": False, "error": "Rate limited."}

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
    if not reaction_limiter.allow(sid):
        return {"success": False, "error": "Rate limited."}

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
    room_code = data.get("room_code", "").upper()
    max_p = data.get("max_participants")
    req_app = data.get("require_approval")
    password = data.get("password", "NO_CHANGE")

    room = room_manager.rooms.get(room_code)
    if not room or room["admin_id"] != sid:
        return {"success": False, "error": "Only admins can update room settings."}

    room_state = room_manager.update_room_settings(
        room_code=room_code,
        max_participants=int(max_p) if max_p is not None else None,
        require_approval=bool(req_app) if req_app is not None else None,
        password=password if password is not None else None,
    )

    if room_state:
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
        await sio.emit("kicked", {}, to=target_id)
        await sio.disconnect(target_id)

        if room_state:
            await sio.emit("user_left", {"left_sid": target_id, "room": room_state.model_dump()}, room=room_code)
        _log_room_event("participant_kicked", sid=target_id, room_code=room_code, by_admin=sid)
        return {"success": True}

    elif action == "mute":
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


# 11. Watch source selection (revamp)
@sio.on("set_watch_source")
async def on_set_watch_source(sid, data):
    room_code = data.get("room_code", "").upper()
    source = data.get("source") or {}

    room = room_manager.rooms.get(room_code)
    if not room or sid not in room["participants"]:
        return {"success": False, "error": "Not a participant in this room."}

    room_state = room_manager.set_watch_source(room_code, source)
    if room_state:
        await sio.emit("watch_source_set", {"source": source, "room": room_state.model_dump()}, room=room_code)
        _log_room_event("watch_source_set", sid=sid, room_code=room_code, provider=source.get("provider"))
        return {"success": True, "room": room_state.model_dump()}
    return {"success": False, "error": "Failed to set watch source."}


# 12. Playback sync update (revamp)
@sio.on("sync_update")
async def on_sync_update(sid, data):
    room_code = data.get("room_code", "").upper()

    room = room_manager.rooms.get(room_code)
    if not room or sid not in room["participants"]:
        return {"success": False, "error": "Not a participant in this room."}

    position = float(data.get("position", 0))
    playing = bool(data.get("playing", False))
    rate = float(data.get("rate", 1))
    sync_state = room_manager.update_sync_state(room_code, position, playing, rate, sid)
    if sync_state:
        await sio.emit("sync_state", sync_state, room=room_code)
        _log_room_event("sync_update", sid=sid, room_code=room_code, position=position, playing=playing)
        return {"success": True, "sync_state": sync_state}
    return {"success": False, "error": "Failed to update sync state."}


# 13. Request current sync state (revamp)
@sio.on("request_sync")
async def on_request_sync(sid, data):
    room_code = data.get("room_code", "").upper()
    sync_state = room_manager.get_sync_state(room_code)
    if sync_state:
        await sio.emit("sync_state", sync_state, to=sid)
        return {"success": True, "sync_state": sync_state}
    return {"success": False, "error": "No active playback state."}


# 14. Watch queue management (revamp)
@sio.on("add_to_queue")
async def on_add_to_queue(sid, data):
    room_code = data.get("room_code", "").upper()
    source = data.get("source") or {}

    room = room_manager.rooms.get(room_code)
    if not room or sid not in room["participants"]:
        return {"success": False, "error": "Not a participant in this room."}

    room_state = room_manager.add_to_queue(room_code, source)
    if room_state:
        await sio.emit("queue_updated", {"queue": room_state.queue, "room": room_state.model_dump()}, room=room_code)
        return {"success": True, "room": room_state.model_dump()}
    return {"success": False, "error": "Failed to update queue."}


@sio.on("remove_from_queue")
async def on_remove_from_queue(sid, data):
    room_code = data.get("room_code", "").upper()
    source = data.get("source") or {}

    room = room_manager.rooms.get(room_code)
    if not room or sid not in room["participants"]:
        return {"success": False, "error": "Not a participant in this room."}

    room_state = room_manager.remove_from_queue(room_code, source)
    if room_state:
        await sio.emit("queue_updated", {"queue": room_state.queue, "room": room_state.model_dump()}, room=room_code)
        return {"success": True, "room": room_state.model_dump()}
    return {"success": False, "error": "Failed to update queue."}
