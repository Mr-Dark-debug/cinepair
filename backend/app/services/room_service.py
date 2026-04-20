import time
from dataclasses import dataclass
from typing import Optional

import structlog

from app.core.config import Settings
from app.core.security import hash_password, verify_password
from app.models.enums import (
    ConnectionState,
    JoinRequestStatus,
    RoomStatus,
    UserRole,
)
from app.models.room import JoinRequest, Room, RoomUser, StoredChatMessage
from app.schemas.errors import ErrorCodes
from app.schemas.room import RoomSettingsUpdate
from app.services.token_service import TokenService
from app.state.memory_store import MemoryRoomStore
from app.utils.helpers import (
    generate_message_id,
    generate_request_id,
    generate_room_code,
    generate_session_id,
    generate_user_id,
)

logger = structlog.get_logger(__name__)

MAX_CHAT_MESSAGES = 500
MAX_CODE_GENERATION_ATTEMPTS = 10


@dataclass
class CreateRoomResult:
    room: Room
    user_id: str
    session_id: str
    token: str


@dataclass
class ValidateJoinResult:
    action: str  # 'join' | 'request' | 'reconnect' | 'error'
    room: Optional[Room] = None
    user: Optional[RoomUser] = None
    request: Optional[JoinRequest] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class RemoveUserResult:
    room_closed: bool
    room: Optional[Room] = None
    removed_user: Optional[RoomUser] = None


@dataclass
class JoinResponseResult:
    success: bool
    request: Optional[JoinRequest] = None
    room: Optional[Room] = None
    user: Optional[RoomUser] = None
    token: Optional[str] = None
    error_message: Optional[str] = None


class RoomService:
    """Core room lifecycle management service."""

    def __init__(
        self,
        store: MemoryRoomStore,
        settings: Settings,
        token_service: TokenService,
    ) -> None:
        self._store = store
        self._settings = settings
        self._token_service = token_service

    # --- Room Creation ---

    def create_room(
        self,
        nickname: str,
        password: Optional[str] = None,
        require_approval: bool = True,
        max_users: int = 2,
        room_expiry_hours: float = 24.0,
    ) -> CreateRoomResult:
        """Create a new room and add the admin user."""
        code = self._generate_unique_code()

        password_hash = hash_password(password) if password else None

        user_id = generate_user_id()
        session_id = generate_session_id()
        now = time.time()

        admin_user = RoomUser(
            user_id=user_id,
            session_id=session_id,
            socket_id="",  # Will be set when socket connects
            nickname=nickname,
            role=UserRole.ADMIN,
            joined_at=now,
            connection_state=ConnectionState.CONNECTED,
        )

        room = Room(
            code=code,
            admin_user_id=user_id,
            created_at=now,
            last_activity=now,
            password_hash=password_hash,
            require_approval=require_approval,
            max_users=max_users,
            room_expiry_hours=room_expiry_hours,
            status=RoomStatus.WAITING,
            users=[admin_user],
        )

        self._store.create_room(room)

        token = self._token_service.create_token(
            user_id=user_id,
            session_id=session_id,
            room_code=code,
            role=UserRole.ADMIN,
            nickname=nickname,
        )

        logger.info(
            "room_created",
            room_code=code,
            admin_user_id=user_id,
            has_password=password is not None,
            require_approval=require_approval,
        )

        return CreateRoomResult(
            room=room, user_id=user_id, session_id=session_id, token=token
        )

    # --- Join Validation ---

    def validate_join(
        self,
        code: str,
        password: Optional[str],
        user_id: Optional[str],
        nickname: str,
    ) -> ValidateJoinResult:
        """Validate a join attempt and determine the action to take."""
        room = self._store.get_room(code)

        if not room:
            return ValidateJoinResult(
                action="error",
                error_code=ErrorCodes.ROOM_NOT_FOUND,
                error_message="Room not found",
            )

        if room.status == RoomStatus.CLOSED:
            return ValidateJoinResult(
                action="error",
                error_code=ErrorCodes.ROOM_CLOSED,
                error_message="Room has been closed",
            )

        # Check if user is reconnecting
        if user_id:
            existing_user = room.find_user(user_id)
            if existing_user:
                if existing_user.connection_state == ConnectionState.RECONNECTING:
                    return ValidateJoinResult(
                        action="reconnect", room=room, user=existing_user
                    )
                elif existing_user.connection_state == ConnectionState.CONNECTED:
                    return ValidateJoinResult(
                        action="error",
                        error_code=ErrorCodes.ALREADY_IN_ROOM,
                        error_message="Already in this room",
                    )

        # Check if room is locked
        if room.is_locked:
            return ValidateJoinResult(
                action="error",
                error_code=ErrorCodes.ROOM_LOCKED,
                error_message="Room is locked",
            )

        # Check if room is full (soft lock aware)
        if room.is_full:
            return ValidateJoinResult(
                action="error",
                error_code=ErrorCodes.ROOM_FULL,
                error_message=f"Room is full (max {room.max_users} users)",
            )

        # Password check
        if room.password_hash:
            if not password:
                return ValidateJoinResult(
                    action="error",
                    error_code=ErrorCodes.PASSWORD_REQUIRED,
                    error_message="Password required",
                )
            if not verify_password(room.password_hash, password):
                return ValidateJoinResult(
                    action="error",
                    error_code=ErrorCodes.WRONG_PASSWORD,
                    error_message="Wrong password",
                )

        # Check if there's already a pending request from this nickname/user
        for req in room.pending_requests:
            if req.nickname == nickname and req.status == JoinRequestStatus.PENDING:
                return ValidateJoinResult(
                    action="error",
                    error_code=ErrorCodes.REQUEST_PENDING,
                    error_message="Join request already pending",
                )

        # Approval required?
        if room.require_approval:
            return ValidateJoinResult(action="request", room=room)

        # Direct join allowed
        return ValidateJoinResult(action="join", room=room)

    # --- Add User to Room ---

    def add_user_to_room(
        self,
        code: str,
        user_id: str,
        session_id: str,
        socket_id: str,
        nickname: str,
    ) -> Optional[RoomUser]:
        """Add a user to a room as a partner."""
        room = self._store.get_room(code)
        if not room:
            return None

        user = RoomUser(
            user_id=user_id,
            session_id=session_id,
            socket_id=socket_id,
            nickname=nickname,
            role=UserRole.PARTNER,
            joined_at=time.time(),
            connection_state=ConnectionState.CONNECTED,
        )

        room.users.append(user)
        room.status = (
            RoomStatus.ACTIVE if len(room.connected_users) >= 2 else RoomStatus.WAITING
        )
        room.last_activity = time.time()
        self._store.update_room(code, room)

        logger.info(
            "user_joined",
            room_code=code,
            user_id=user_id,
            nickname=nickname,
            role="partner",
        )

        return user

    # --- Create Join Request ---

    def create_join_request(
        self,
        code: str,
        user_id: str,
        socket_id: str,
        nickname: str,
    ) -> Optional[JoinRequest]:
        """Create a pending join request."""
        room = self._store.get_room(code)
        if not room:
            return None

        request = JoinRequest(
            id=generate_request_id(),
            user_id=user_id,
            socket_id=socket_id,
            nickname=nickname,
            status=JoinRequestStatus.PENDING,
            created_at=time.time(),
        )

        room.pending_requests.append(request)
        room.last_activity = time.time()
        self._store.update_room(code, room)

        logger.info(
            "join_request_created",
            room_code=code,
            request_id=request.id,
            user_id=user_id,
            nickname=nickname,
        )

        return request

    # --- Process Join Response (admin approve/deny) ---

    def process_join_response(
        self,
        code: str,
        request_id: str,
        approved: bool,
        admin_user_id: str,
        reason: Optional[str] = None,
    ) -> JoinResponseResult:
        """Process admin's response to a join request."""
        room = self._store.get_room(code)
        if not room:
            return JoinResponseResult(success=False, error_message="Room not found")

        # Verify admin
        if room.admin_user_id != admin_user_id:
            return JoinResponseResult(success=False, error_message="Not authorized")

        # Find the request
        request = None
        for req in room.pending_requests:
            if req.id == request_id:
                request = req
                break

        if not request:
            return JoinResponseResult(success=False, error_message="Request not found")

        if request.status != JoinRequestStatus.PENDING:
            return JoinResponseResult(
                success=False, error_message="Request already processed"
            )

        if approved:
            # Check room capacity again
            if room.is_full:
                return JoinResponseResult(
                    success=False, error_message="Room is now full"
                )

            request.status = JoinRequestStatus.APPROVED

            # Add user to room
            session_id = generate_session_id()
            user = RoomUser(
                user_id=request.user_id,
                session_id=session_id,
                socket_id=request.socket_id,
                nickname=request.nickname,
                role=UserRole.PARTNER,
                joined_at=time.time(),
                connection_state=ConnectionState.CONNECTED,
            )
            room.users.append(user)
            room.status = (
                RoomStatus.ACTIVE
                if len(room.connected_users) >= 2
                else RoomStatus.WAITING
            )
            room.last_activity = time.time()
            self._store.update_room(code, room)

            # Generate token for approved user
            token = self._token_service.create_token(
                user_id=request.user_id,
                session_id=session_id,
                room_code=code,
                role=UserRole.PARTNER,
                nickname=request.nickname,
            )

            logger.info(
                "join_approved",
                room_code=code,
                request_id=request_id,
                user_id=request.user_id,
            )
            return JoinResponseResult(
                success=True, request=request, room=room, user=user, token=token
            )
        else:
            request.status = JoinRequestStatus.DENIED
            room.last_activity = time.time()
            self._store.update_room(code, room)

            logger.info(
                "join_denied",
                room_code=code,
                request_id=request_id,
                user_id=request.user_id,
                reason=reason,
            )
            return JoinResponseResult(success=True, request=request, room=room)

    # --- Remove User ---

    def remove_user(self, user_id: str) -> Optional[RemoveUserResult]:
        """Remove a user from their room. If admin, closes room."""
        result = self._store.find_user_room(user_id)
        if not result:
            return None

        room, user = result
        room.users = [u for u in room.users if u.user_id != user_id]

        room_closed = user.role == UserRole.ADMIN

        if room_closed:
            room.status = RoomStatus.CLOSED
            self._store.delete_room(room.code)
            logger.info("room_closed", room_code=room.code, reason="admin_left")
        else:
            # Update room status
            if len(room.connected_users) == 0:
                self._store.delete_room(room.code)
                logger.info("room_deleted", room_code=room.code, reason="empty")
            else:
                room.status = RoomStatus.WAITING
                room.last_activity = time.time()
                self._store.update_room(room.code, room)
            logger.info(
                "user_left",
                room_code=room.code,
                user_id=user_id,
                nickname=user.nickname,
            )

        return RemoveUserResult(
            room_closed=room_closed, room=room, removed_user=user
        )

    # --- Disconnect / Reconnect ---

    def mark_user_disconnected(
        self, user_id: str
    ) -> Optional[tuple[Room, RoomUser]]:
        """Mark a user as disconnected (entering grace period)."""
        result = self._store.find_user_room(user_id)
        if not result:
            return None

        room, user = result
        user.connection_state = ConnectionState.RECONNECTING
        user.disconnected_at = time.time()
        room.last_activity = time.time()
        self._store.update_room(room.code, room)

        logger.info(
            "user_disconnected",
            room_code=room.code,
            user_id=user_id,
            nickname=user.nickname,
            grace_seconds=self._settings.RECONNECT_GRACE_SECONDS,
        )

        return (room, user)

    def mark_user_reconnected(
        self, user_id: str, new_socket_id: str
    ) -> Optional[tuple[Room, RoomUser]]:
        """Mark a disconnected user as reconnected."""
        result = self._store.find_user_room(user_id)
        if not result:
            return None

        room, user = result
        downtime = time.time() - (user.disconnected_at or time.time())
        user.connection_state = ConnectionState.CONNECTED
        user.disconnected_at = None
        user.socket_id = new_socket_id
        room.last_activity = time.time()
        self._store.update_room(room.code, room)

        logger.info(
            "user_reconnected",
            room_code=room.code,
            user_id=user_id,
            nickname=user.nickname,
            downtime_seconds=round(downtime, 1),
        )

        return (room, user)

    # --- Settings ---

    def toggle_approval(
        self, code: str, admin_user_id: str, require_approval: bool
    ) -> bool:
        """Toggle the require_approval setting. Returns success."""
        room = self._store.get_room(code)
        if not room or room.admin_user_id != admin_user_id:
            return False

        room.require_approval = require_approval
        room.last_activity = time.time()
        self._store.update_room(code, room)

        logger.info(
            "approval_toggled", room_code=code, require_approval=require_approval
        )
        return True

    def update_room_settings(
        self, code: str, admin_user_id: str, settings: RoomSettingsUpdate
    ) -> Optional[dict]:
        """Update live room settings. Returns the applied changes or None if unauthorized."""
        room = self._store.get_room(code)
        if not room or room.admin_user_id != admin_user_id:
            return None

        applied: dict = {}

        if settings.max_users is not None:
            room.max_users = settings.max_users
            applied["max_users"] = settings.max_users

        if settings.is_locked is not None:
            room.is_locked = settings.is_locked
            applied["is_locked"] = settings.is_locked

        if settings.chat_disabled is not None:
            room.chat_disabled = settings.chat_disabled
            applied["chat_disabled"] = settings.chat_disabled

        if settings.partner_screen_share_disabled is not None:
            room.partner_screen_share_disabled = settings.partner_screen_share_disabled
            applied["partner_screen_share_disabled"] = (
                settings.partner_screen_share_disabled
            )

        if settings.require_approval is not None:
            room.require_approval = settings.require_approval
            applied["require_approval"] = settings.require_approval

        room.last_activity = time.time()
        self._store.update_room(code, room)

        logger.info("settings_updated", room_code=code, changes=applied)
        return applied

    # --- Chat ---

    def add_chat_message(
        self,
        code: str,
        sender_id: str,
        sender_nickname: str,
        message: str,
        timestamp: float,
        client_message_id: Optional[str] = None,
    ) -> Optional[tuple[StoredChatMessage, bool]]:
        """Add a chat message. Returns (message, is_duplicate) or None if room not found."""
        room = self._store.get_room(code)
        if not room:
            return None

        # Deduplication check
        if client_message_id:
            for existing in room.chat_messages:
                if existing.client_message_id == client_message_id:
                    return (existing, True)  # Duplicate

        msg = StoredChatMessage(
            id=generate_message_id(),
            sender_id=sender_id,
            sender_nickname=sender_nickname,
            message=message,
            timestamp=timestamp,
            client_message_id=client_message_id,
        )

        room.chat_messages.append(msg)
        # Ring buffer: keep only last 500
        if len(room.chat_messages) > MAX_CHAT_MESSAGES:
            room.chat_messages = room.chat_messages[-MAX_CHAT_MESSAGES:]

        room.last_activity = time.time()
        self._store.update_room(code, room)

        return (msg, False)

    # --- Screen Share ---

    def toggle_screen_share(
        self, code: str, user_id: str, is_sharing: bool
    ) -> bool:
        """Toggle screen sharing state. Returns success."""
        room = self._store.get_room(code)
        if not room:
            return False

        user = room.find_user(user_id)
        if not user:
            return False

        room.is_screen_sharing = is_sharing
        room.screen_sharing_user_id = user_id if is_sharing else None
        room.last_activity = time.time()
        self._store.update_room(code, room)

        return True

    # --- Cleanup ---

    def cleanup_expired_rooms(self) -> int:
        """Remove rooms that have exceeded their expiry time. Returns count of deleted rooms."""
        now = time.time()
        deleted = 0

        for room in list(self._store.get_all_rooms()):
            expiry_seconds = room.room_expiry_hours * 3600
            if now - room.last_activity > expiry_seconds:
                if not room.connected_users:
                    self._store.delete_room(room.code)
                    deleted += 1
                    logger.info(
                        "room_expired",
                        room_code=room.code,
                        inactive_hours=round(
                            (now - room.last_activity) / 3600, 1
                        ),
                    )

        if deleted > 0:
            logger.info("cleanup_completed", rooms_deleted=deleted)
        return deleted

    def purge_expired_reconnections(self) -> list[str]:
        """Remove users whose reconnect grace period has expired. Returns list of purged user IDs."""
        now = time.time()
        grace_seconds = self._settings.RECONNECT_GRACE_SECONDS
        purged_user_ids: list[str] = []

        for room in list(self._store.get_all_rooms()):
            for user in list(room.users):
                if (
                    user.connection_state == ConnectionState.RECONNECTING
                    and user.disconnected_at is not None
                    and (now - user.disconnected_at) > grace_seconds
                ):
                    purged_user_ids.append(user.user_id)
                    self.remove_user(user.user_id)
                    logger.info(
                        "reconnection_expired",
                        room_code=room.code,
                        user_id=user.user_id,
                        nickname=user.nickname,
                    )

        return purged_user_ids

    # --- Clear Pending Requests ---

    def clear_pending_requests(
        self, code: str, admin_user_id: str
    ) -> list[JoinRequest]:
        """Clear all pending requests for a room (admin only). Returns cleared requests."""
        room = self._store.get_room(code)
        if not room or room.admin_user_id != admin_user_id:
            return []

        cleared = [
            r
            for r in room.pending_requests
            if r.status == JoinRequestStatus.PENDING
        ]
        for req in cleared:
            req.status = JoinRequestStatus.DENIED

        room.last_activity = time.time()
        self._store.update_room(code, room)

        logger.info(
            "pending_requests_cleared", room_code=code, count=len(cleared)
        )
        return cleared

    # --- Helpers ---

    def update_user_socket(self, user_id: str, socket_id: str) -> None:
        """Update a user's socket ID (after initial connection or reconnection)."""
        result = self._store.find_user_room(user_id)
        if result:
            room, user = result
            user.socket_id = socket_id
            self._store.update_room(room.code, room)

    def get_room(self, code: str) -> Optional[Room]:
        """Get room by code."""
        return self._store.get_room(code)

    def get_stats(self) -> dict:
        """Get room store stats."""
        return self._store.get_stats()

    def _generate_unique_code(self) -> str:
        """Generate a unique room code, retrying on collision."""
        for _ in range(MAX_CODE_GENERATION_ATTEMPTS):
            code = generate_room_code()
            if not self._store.room_exists(code):
                return code
        raise RuntimeError(
            "Failed to generate unique room code after max attempts"
        )
