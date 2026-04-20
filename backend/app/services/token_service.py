from app.core.security import TokenPayload, sign_session_token, verify_session_token


class TokenService:
    """Service for managing session tokens."""

    def create_token(
        self,
        user_id: str,
        session_id: str,
        room_code: str,
        role: str,
        nickname: str,
    ) -> str:
        """Create a new session token."""
        payload = TokenPayload(
            user_id=user_id,
            session_id=session_id,
            room_code=room_code,
            role=role,
            nickname=nickname,
        )
        return sign_session_token(payload)

    def verify_token(self, token: str) -> TokenPayload | None:
        """Verify and decode a session token."""
        return verify_session_token(token)
