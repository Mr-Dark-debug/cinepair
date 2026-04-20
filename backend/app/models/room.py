from dataclasses import dataclass, field
from typing import Optional

from app.models.enums import ConnectionState, JoinRequestStatus, RoomStatus, UserRole


@dataclass
class RoomUser:
    user_id: str
    session_id: str
    socket_id: str
    nickname: str
    role: UserRole
    joined_at: float
    connection_state: ConnectionState = ConnectionState.CONNECTED
    disconnected_at: Optional[float] = None


@dataclass
class JoinRequest:
    id: str
    user_id: str
    socket_id: str
    nickname: str
    status: JoinRequestStatus = JoinRequestStatus.PENDING
    created_at: float = 0.0


@dataclass
class StoredChatMessage:
    id: str
    sender_id: str
    sender_nickname: str
    message: str
    timestamp: float
    client_message_id: Optional[str] = None


@dataclass
class Room:
    code: str
    admin_user_id: str
    created_at: float
    last_activity: float
    # Security
    password_hash: Optional[str] = None
    # Settings (set at creation)
    require_approval: bool = True
    max_users: int = 2
    room_expiry_hours: float = 24.0
    # State
    status: RoomStatus = RoomStatus.WAITING
    users: list[RoomUser] = field(default_factory=list)
    pending_requests: list[JoinRequest] = field(default_factory=list)
    # Media state
    is_screen_sharing: bool = False
    screen_sharing_user_id: Optional[str] = None
    # Chat ring buffer (max 500)
    chat_messages: list[StoredChatMessage] = field(default_factory=list)
    # Live admin controls (new features)
    is_locked: bool = False
    chat_disabled: bool = False
    partner_screen_share_disabled: bool = False

    @property
    def has_password(self) -> bool:
        return self.password_hash is not None

    @property
    def connected_users(self) -> list[RoomUser]:
        return [u for u in self.users if u.connection_state == ConnectionState.CONNECTED]

    @property
    def is_full(self) -> bool:
        """Check if room is at or above max capacity (soft lock aware)."""
        return len(self.connected_users) >= self.max_users

    def find_user(self, user_id: str) -> Optional[RoomUser]:
        """Find a user by ID."""
        for user in self.users:
            if user.user_id == user_id:
                return user
        return None

    def find_user_by_socket(self, socket_id: str) -> Optional[RoomUser]:
        """Find a user by socket ID."""
        for user in self.users:
            if user.socket_id == socket_id:
                return user
        return None
