from typing import Optional
from pydantic import BaseModel, Field

class RoomSettings(BaseModel):
    max_participants: int = Field(default=10, ge=2, le=50)
    require_approval: bool = Field(default=False)
    password: Optional[str] = Field(default=None)

class Participant(BaseModel):
    id: str
    nickname: str
    is_admin: bool = False
    camera_on: bool = False
    mic_on: bool = False
    screen_share_on: bool = False

class WaitingParticipant(BaseModel):
    id: str
    nickname: str

class RoomState(BaseModel):
    code: str
    admin_id: str
    settings: RoomSettings
    participants: list[Participant]
    waiting_list: list[WaitingParticipant]

class ChatMessage(BaseModel):
    id: str
    sender_id: str
    sender_nickname: str
    text: str
    timestamp: float
    reply_to: Optional[str] = None
