import secrets
import uuid

# Room codes: 8 chars, uppercase letters (excluding confusing ones) + digits (excluding 0,1)
ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_room_code(length: int = 8) -> str:
    """Generate a random room code (8 uppercase alphanumeric characters)."""
    return "".join(secrets.choice(ROOM_CODE_CHARS) for _ in range(length))


def generate_user_id() -> str:
    """Generate a unique user ID."""
    return str(uuid.uuid4())


def generate_session_id() -> str:
    """Generate a unique session ID."""
    return str(uuid.uuid4())


def generate_message_id() -> str:
    """Generate a unique message ID."""
    return str(uuid.uuid4())


def generate_request_id() -> str:
    """Generate a unique join request ID."""
    return str(uuid.uuid4())
