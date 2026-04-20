from pydantic import BaseModel, Field
from typing import Optional


class RoomCreatePayload(BaseModel):
    """Payload for creating a new room (via HTTP or Socket.IO)."""
    nickname: str = Field(min_length=1, max_length=32, description="Display name of the admin")
    password: Optional[str] = Field(None, max_length=128, description="Optional room password")
    require_approval: bool = Field(default=True, description="Whether joining requires admin approval")
    max_users: int = Field(default=2, ge=2, le=10, description="Maximum users allowed in room")
    room_expiry_hours: float = Field(default=24.0, ge=1.0, le=168.0, description="Hours before room expires")


class RoomCreateResponse(BaseModel):
    """Response after room creation."""
    code: str
    userId: str
    role: str = "admin"
    sessionToken: str
    requireApproval: bool
    hasPassword: bool


class RoomJoinPayload(BaseModel):
    """Payload for joining a room."""
    nickname: str = Field(min_length=1, max_length=32)
    password: Optional[str] = None


class RoomJoinResponse(BaseModel):
    """Response after successful room join."""
    code: str
    userId: str
    role: str
    sessionToken: str
    users: list[dict]  # [{userId, nickname, role}]
    requireApproval: bool
    isScreenSharing: bool


class RoomInfoResponse(BaseModel):
    """Public room information."""
    code: str
    hasPassword: bool
    requireApproval: bool
    userCount: int
    maxUsers: int
    status: str
    isLocked: bool


class RoomSettingsUpdate(BaseModel):
    """Live admin controls - broadcast to participants."""
    max_users: Optional[int] = Field(None, ge=2, le=10)
    is_locked: Optional[bool] = None
    chat_disabled: Optional[bool] = None
    partner_screen_share_disabled: Optional[bool] = None
    require_approval: Optional[bool] = None


class ApprovalPayload(BaseModel):
    """Payload for approving/denying a join request."""
    code: str = Field(min_length=8, max_length=8)
    request_id: str
    approved: bool
    reason: Optional[str] = Field(None, max_length=256)


class SocketRoomCreatePayload(BaseModel):
    """Socket.IO room:create payload (matches frontend)."""
    nickname: str = Field(min_length=1, max_length=32)
    password: Optional[str] = Field(None, max_length=128)
    requireApproval: bool = True


class SocketRoomJoinPayload(BaseModel):
    """Socket.IO room:join payload (matches frontend)."""
    code: str = Field(min_length=8, max_length=8)
    nickname: str = Field(min_length=1, max_length=32)
    password: Optional[str] = None


class SocketJoinResponsePayload(BaseModel):
    """Socket.IO room:join-response payload from admin."""
    code: str = Field(min_length=8, max_length=8)
    requestId: str
    approved: bool
    reason: Optional[str] = Field(None, max_length=256)


class SocketToggleApprovalPayload(BaseModel):
    """Socket.IO room:toggle-approval payload."""
    code: str = Field(min_length=8, max_length=8)
    requireApproval: bool


class SocketLeavePayload(BaseModel):
    """Socket.IO room:leave payload."""
    code: str = Field(min_length=8, max_length=8)


class SocketPeerReadyPayload(BaseModel):
    """Socket.IO peer:ready payload."""
    code: str = Field(min_length=8, max_length=8)


class SocketSettingsUpdatePayload(BaseModel):
    """Socket.IO room:settings-update payload from admin."""
    code: str = Field(min_length=8, max_length=8)
    settings: RoomSettingsUpdate
