import jwt
import time
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from dataclasses import dataclass
from typing import Optional

from app.core.config import settings

ph = PasswordHasher()


@dataclass
class TokenPayload:
    user_id: str
    session_id: str
    room_code: str
    role: str  # 'admin' | 'partner'
    nickname: str


def hash_password(password: str) -> str:
    """Hash a password using Argon2id."""
    return ph.hash(password)


def verify_password(hash: str, password: str) -> bool:
    """Verify a password against its hash."""
    try:
        return ph.verify(hash, password)
    except VerifyMismatchError:
        return False


def sign_session_token(payload: TokenPayload) -> str:
    """Create a JWT session token."""
    now = time.time()
    token_data = {
        "userId": payload.user_id,
        "sessionId": payload.session_id,
        "roomCode": payload.room_code,
        "role": payload.role,
        "nickname": payload.nickname,
        "iat": int(now),
        "exp": int(now + settings.JWT_EXPIRES_HOURS * 3600),
        "iss": "cinepair",
    }
    return jwt.encode(token_data, settings.JWT_SECRET, algorithm="HS256")


def verify_session_token(token: str) -> Optional[TokenPayload]:
    """Verify and decode a JWT session token. Returns None if invalid."""
    try:
        data = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            issuer="cinepair",
        )
        return TokenPayload(
            user_id=data["userId"],
            session_id=data["sessionId"],
            room_code=data["roomCode"],
            role=data["role"],
            nickname=data["nickname"],
        )
    except (jwt.InvalidTokenError, KeyError):
        return None
