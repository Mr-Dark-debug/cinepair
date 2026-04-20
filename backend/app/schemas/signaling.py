from pydantic import BaseModel, Field
from typing import Any, Optional


class SignalingRelayPayload(BaseModel):
    """Socket.IO signaling:relay payload."""
    code: str = Field(min_length=8, max_length=8, description="Room code")
    targetUserId: str = Field(min_length=1, description="Target user ID")
    data: dict[str, Any] = Field(description="SDP or ICE candidate data")
    type: str = Field(pattern=r"^(offer|answer|ice-candidate)$", description="Signal type")
    streamType: Optional[str] = Field(None, pattern=r"^(webcam|screen)$", description="Stream type")


class SignalingRelayBroadcast(BaseModel):
    """Server -> Client signaling relay broadcast."""
    data: dict[str, Any]
    type: str
    streamType: Optional[str] = None
    senderUserId: str


class PeerStartNegotiation(BaseModel):
    """Server -> Client peer negotiation start."""
    targetUserId: str
    polite: bool
