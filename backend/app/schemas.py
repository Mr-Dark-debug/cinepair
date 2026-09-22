from typing import Optional
from pydantic import BaseModel, Field


class RoomSettings(BaseModel):
    max_participants: int = Field(default=10, ge=2, le=50)
    require_approval: bool = Field(default=False)
    # NOTE: the raw room password is never stored here or serialized out.
    # It lives (hashed) in the room manager's internal state only.
    has_password: bool = Field(default=False)


class Participant(BaseModel):
    id: str
    nickname: str
    is_admin: bool = False
    camera_on: bool = False
    mic_on: bool = False
    screen_share_on: bool = False
    avatar_seed: Optional[str] = None
    avatar_palette: Optional[str] = None


class WaitingParticipant(BaseModel):
    id: str
    nickname: str
    avatar_seed: Optional[str] = None
    avatar_palette: Optional[str] = None


class RoomState(BaseModel):
    code: str
    admin_id: str
    settings: RoomSettings
    participants: list[Participant]
    waiting_list: list[WaitingParticipant]
    # Watch-together playback state (added for the revamp).
    watch_source: Optional[dict] = None
    sync_state: Optional[dict] = None
    queue: list[dict] = Field(default_factory=list)


class ChatMessage(BaseModel):
    id: str
    sender_id: str
    sender_nickname: str
    text: str
    timestamp: float
    reply_to: Optional[str] = None
