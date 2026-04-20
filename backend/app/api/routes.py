"""FastAPI HTTP API routes."""
import time
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
import structlog

from app.api.dependencies import get_room_service, get_ice_service, get_token_service
from app.services.room_service import RoomService
from app.services.ice_service import IceServerService
from app.services.token_service import TokenService
from app.schemas.room import (
    RoomCreatePayload,
    RoomJoinPayload,
    ApprovalPayload,
)
from app.schemas.errors import ErrorCodes
from app.core.security import verify_session_token
from app.utils.helpers import generate_user_id, generate_session_id

logger = structlog.get_logger(__name__)

router = APIRouter()

_start_time = time.time()


@router.get("/health")
async def health_check(
    room_service: RoomService = Depends(get_room_service),
):
    """Health check endpoint with room statistics."""
    stats = room_service.get_stats()
    return {
        "status": "ok",
        "uptime": round(time.time() - _start_time),
        "rooms": stats,
        "timestamp": int(time.time() * 1000),
    }


@router.get("/ready")
async def ready_check():
    """Readiness check endpoint."""
    return {
        "status": "ready",
        "dependencies": {
            "memory_store": "ok",
        },
    }


@router.get("/api/ice-servers")
async def get_ice_servers(
    ice_service: IceServerService = Depends(get_ice_service),
):
    """Get STUN/TURN server configuration with ephemeral credentials."""
    return ice_service.get_ice_servers()


@router.post("/api/rooms", status_code=201)
async def create_room(
    payload: RoomCreatePayload,
    room_service: RoomService = Depends(get_room_service),
):
    """Create a new room."""
    result = room_service.create_room(
        nickname=payload.nickname,
        password=payload.password,
        require_approval=payload.require_approval,
        max_users=payload.max_users,
        room_expiry_hours=payload.room_expiry_hours,
    )

    return {
        "roomCode": result.room.code,
        "userId": result.user_id,
        "role": "admin",
        "sessionToken": result.token,
        "requireApproval": result.room.require_approval,
        "hasPassword": result.room.has_password,
    }


@router.post("/api/rooms/{room_code}/join")
async def join_room(
    room_code: str,
    payload: RoomJoinPayload,
    room_service: RoomService = Depends(get_room_service),
    token_service: TokenService = Depends(get_token_service),
):
    """Join a room. Returns 200 (joined), 202 (approval pending), or error."""
    user_id = generate_user_id()
    session_id = generate_session_id()

    result = room_service.validate_join(
        code=room_code,
        password=payload.password,
        user_id=None,  # New user, no existing ID
        nickname=payload.nickname,
    )

    if result.action == "error":
        status_map = {
            ErrorCodes.ROOM_NOT_FOUND: 404,
            ErrorCodes.ROOM_CLOSED: 410,
            ErrorCodes.ROOM_FULL: 409,
            ErrorCodes.ROOM_LOCKED: 409,
            ErrorCodes.WRONG_PASSWORD: 403,
            ErrorCodes.PASSWORD_REQUIRED: 403,
            ErrorCodes.ALREADY_IN_ROOM: 409,
            ErrorCodes.REQUEST_PENDING: 409,
        }
        status = status_map.get(result.error_code, 400)
        return JSONResponse(
            status_code=status,
            content={"error": {"code": result.error_code, "message": result.error_message}},
        )

    if result.action == "request":
        # Approval required - create a pending request
        # Note: For HTTP-based joins, we create the request but the user
        # needs to connect via Socket.IO to receive the response
        return JSONResponse(
            status_code=202,
            content={
                "status": "APPROVAL_REQUIRED",
                "message": "Your join request has been sent to the room admin",
                "userId": user_id,
            },
        )

    if result.action == "join":
        # Direct join
        user = room_service.add_user_to_room(
            code=room_code,
            user_id=user_id,
            session_id=session_id,
            socket_id="",  # Will be set on socket connect
            nickname=payload.nickname,
        )

        if not user:
            raise HTTPException(status_code=500, detail="Failed to add user to room")

        room = room_service.get_room(room_code)

        # Generate token
        token = token_service.create_token(
            user_id=user_id,
            session_id=session_id,
            room_code=room_code,
            role="partner",
            nickname=payload.nickname,
        )

        users_list = [
            {"userId": u.user_id, "nickname": u.nickname, "role": u.role.value}
            for u in room.users
            if u.connection_state.value == "connected"
        ]

        return {
            "code": room.code,
            "userId": user_id,
            "role": "partner",
            "sessionToken": token,
            "users": users_list,
            "requireApproval": room.require_approval,
            "isScreenSharing": room.is_screen_sharing,
        }

    raise HTTPException(status_code=500, detail="Unexpected join result")


@router.get("/api/rooms/{room_code}")
async def get_room_info(
    room_code: str,
    room_service: RoomService = Depends(get_room_service),
):
    """Get public room information."""
    room = room_service.get_room(room_code)
    if not room:
        return JSONResponse(
            status_code=404,
            content={"error": {"code": ErrorCodes.ROOM_NOT_FOUND, "message": "Room not found"}},
        )

    return {
        "code": room.code,
        "hasPassword": room.has_password,
        "requireApproval": room.require_approval,
        "userCount": len(room.connected_users),
        "maxUsers": room.max_users,
        "status": room.status.value,
        "isLocked": room.is_locked,
    }


@router.post("/api/rooms/{room_code}/approve")
async def approve_join_request(
    room_code: str,
    payload: ApprovalPayload,
    request: Request,
    room_service: RoomService = Depends(get_room_service),
):
    """Approve or deny a join request (admin only)."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={"error": {"code": ErrorCodes.UNAUTHORIZED, "message": "Missing authorization"}},
        )

    token_payload = verify_session_token(auth_header[7:])
    if not token_payload:
        return JSONResponse(
            status_code=401,
            content={"error": {"code": ErrorCodes.UNAUTHORIZED, "message": "Invalid token"}},
        )

    result = room_service.process_join_response(
        code=room_code,
        request_id=payload.request_id,
        approved=payload.approved,
        admin_user_id=token_payload.user_id,
        reason=payload.reason,
    )

    if not result.success:
        return JSONResponse(
            status_code=403,
            content={"error": {"code": ErrorCodes.FORBIDDEN, "message": result.error_message}},
        )

    return {"status": "ok", "approved": payload.approved}


@router.post("/api/rooms/{room_code}/leave")
async def leave_room(
    room_code: str,
    request: Request,
    room_service: RoomService = Depends(get_room_service),
):
    """Leave a room (authenticated user)."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={"error": {"code": ErrorCodes.UNAUTHORIZED, "message": "Missing authorization"}},
        )

    token_payload = verify_session_token(auth_header[7:])
    if not token_payload:
        return JSONResponse(
            status_code=401,
            content={"error": {"code": ErrorCodes.UNAUTHORIZED, "message": "Invalid token"}},
        )

    result = room_service.remove_user(token_payload.user_id)
    if not result:
        return JSONResponse(
            status_code=404,
            content={"error": {"code": ErrorCodes.ROOM_NOT_FOUND, "message": "User not in any room"}},
        )

    return {"status": "ok", "roomClosed": result.room_closed}


@router.get("/metrics")
async def metrics(
    request: Request,
    room_service: RoomService = Depends(get_room_service),
):
    """Prometheus metrics endpoint."""
    from app.core.config import settings

    if not settings.ENABLE_METRICS:
        return JSONResponse(status_code=404, content={"message": "Metrics disabled"})

    if settings.METRICS_TOKEN:
        auth_header = request.headers.get("Authorization", "")
        if auth_header != f"Bearer {settings.METRICS_TOKEN}":
            return JSONResponse(status_code=401, content={"message": "Unauthorized"})

    stats = room_service.get_stats()

    # Memory usage - platform-safe with fallbacks
    mem_mb = 0.0
    try:
        import resource
        mem_info = resource.getrusage(resource.RUSAGE_SELF)
        mem_mb = mem_info.ru_maxrss / 1024  # Convert KB to MB on Linux
    except (ImportError, Exception):
        try:
            import psutil
            process = psutil.Process()
            mem_mb = process.memory_info().rss / (1024 * 1024)
        except (ImportError, Exception):
            pass  # mem_mb stays 0

    lines = [
        "# HELP cinepair_rooms_total Total number of rooms",
        "# TYPE cinepair_rooms_total gauge",
        f"cinepair_rooms_total {stats['totalRooms']}",
        "# HELP cinepair_rooms_active Number of active rooms",
        "# TYPE cinepair_rooms_active gauge",
        f"cinepair_rooms_active {stats['activeRooms']}",
        "# HELP cinepair_rooms_waiting Number of waiting rooms",
        "# TYPE cinepair_rooms_waiting gauge",
        f"cinepair_rooms_waiting {stats['waitingRooms']}",
        "# HELP cinepair_memory_mb Memory usage in MB",
        "# TYPE cinepair_memory_mb gauge",
        f"cinepair_memory_mb {mem_mb:.1f}",
    ]

    return Response(content="\n".join(lines) + "\n", media_type="text/plain")
