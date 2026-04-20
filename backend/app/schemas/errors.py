from pydantic import BaseModel


class ErrorDetail(BaseModel):
    """Error detail structure."""
    code: str
    message: str


class ErrorResponse(BaseModel):
    """Standard error response for HTTP endpoints."""
    error: ErrorDetail


class SocketErrorResponse(BaseModel):
    """Error payload emitted via Socket.IO."""
    code: str
    message: str


# Common error codes
class ErrorCodes:
    ROOM_NOT_FOUND = "ROOM_NOT_FOUND"
    ROOM_CLOSED = "ROOM_CLOSED"
    ROOM_FULL = "ROOM_FULL"
    ROOM_LOCKED = "ROOM_LOCKED"
    WRONG_PASSWORD = "WRONG_PASSWORD"
    PASSWORD_REQUIRED = "PASSWORD_REQUIRED"
    ALREADY_IN_ROOM = "ALREADY_IN_ROOM"
    REQUEST_PENDING = "REQUEST_PENDING"
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    VALIDATION_FAILED = "VALIDATION_FAILED"
    RATE_LIMIT = "RATE_LIMIT"
    CHAT_DISABLED = "CHAT_DISABLED"
    SCREEN_SHARE_DISABLED = "SCREEN_SHARE_DISABLED"
    INTERNAL_ERROR = "INTERNAL_ERROR"
