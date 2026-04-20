from pydantic import BaseModel, Field
from typing import Optional


class ChatMessagePayload(BaseModel):
    """Socket.IO chat:message payload from client."""
    code: str = Field(min_length=8, max_length=8)
    message: str = Field(min_length=1, max_length=2048)
    timestamp: float = Field(gt=0)
    clientMessageId: Optional[str] = Field(None, max_length=64)


class ChatMessageBroadcast(BaseModel):
    """Server -> Client chat message broadcast."""
    id: str
    senderId: str
    senderNickname: str
    message: str
    timestamp: float
    clientMessageId: Optional[str] = None


class ScreenTogglePayload(BaseModel):
    """Socket.IO screen:toggle payload from client."""
    code: str = Field(min_length=8, max_length=8)
    isSharing: bool


class ScreenToggleBroadcast(BaseModel):
    """Server -> Client screen toggle broadcast."""
    isSharing: bool
    sharerUserId: str
