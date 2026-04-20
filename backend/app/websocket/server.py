"""Socket.IO server creation and authentication middleware."""
import socketio
import structlog
from app.core.config import Settings
from app.core.security import verify_session_token, TokenPayload

logger = structlog.get_logger(__name__)


def create_sio_server(settings: Settings) -> socketio.AsyncServer:
    """Create and configure the Socket.IO async server."""
    sio = socketio.AsyncServer(
        async_mode="asgi",
        cors_allowed_origins=settings.cors_origins_list,
        ping_timeout=30,
        ping_interval=15,
        max_http_buffer_size=1_000_000,  # 1MB
        logger=False,  # We use structlog instead
        engineio_logger=False,
    )
    return sio


async def authenticate_socket(sio: socketio.AsyncServer, sid: str, environ: dict, auth: dict | None) -> bool:
    """
    Authenticate a socket connection.
    Called from the connect event handler.

    Returns True if connection should be accepted, False to reject.
    Sets session data on the socket.
    """
    token_payload: TokenPayload | None = None

    if auth and isinstance(auth, dict):
        session_token = auth.get("sessionToken")
        if session_token:
            token_payload = verify_session_token(session_token)

    if token_payload:
        # Authenticated connection - store user data in session
        await sio.save_session(sid, {
            "user_id": token_payload.user_id,
            "session_id": token_payload.session_id,
            "room_code": token_payload.room_code,
            "role": token_payload.role,
            "nickname": token_payload.nickname,
            "authenticated": True,
        })
        logger.info("socket_authenticated", sid=sid, user_id=token_payload.user_id, room_code=token_payload.room_code)
    else:
        # Unauthenticated connection - allowed but with empty session
        await sio.save_session(sid, {
            "user_id": None,
            "session_id": None,
            "room_code": None,
            "role": None,
            "nickname": None,
            "authenticated": False,
        })
        logger.debug("socket_unauthenticated", sid=sid)

    # Always accept connection (auth is checked per-event for room operations)
    return True


async def get_socket_session(sio: socketio.AsyncServer, sid: str) -> dict:
    """Get the session data for a socket."""
    return await sio.get_session(sid)
