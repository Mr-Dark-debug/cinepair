"""Tests for room creation."""
import pytest
from app.services.room_service import RoomService
from app.models.enums import RoomStatus, UserRole


class TestRoomCreation:
    def test_create_room_returns_valid_code(self, room_service: RoomService):
        """Room code should be 8 uppercase alphanumeric characters."""
        result = room_service.create_room(nickname="Admin")
        assert len(result.room.code) == 8
        assert result.room.code.isalnum()
        assert result.room.code.isupper()

    def test_create_room_returns_user_id(self, room_service: RoomService):
        """Should return a valid user ID."""
        result = room_service.create_room(nickname="Admin")
        assert result.user_id is not None
        assert len(result.user_id) > 0

    def test_create_room_returns_token(self, room_service: RoomService):
        """Should return a valid JWT session token."""
        result = room_service.create_room(nickname="Admin")
        assert result.token is not None
        # Verify the token is decodable
        from app.core.security import verify_session_token
        payload = verify_session_token(result.token)
        assert payload is not None
        assert payload.user_id == result.user_id
        assert payload.room_code == result.room.code
        assert payload.role == "admin"

    def test_create_room_with_password(self, room_service: RoomService):
        """Room with password should have password_hash set."""
        result = room_service.create_room(nickname="Admin", password="secret123")
        assert result.room.password_hash is not None
        assert result.room.has_password is True

    def test_create_room_without_password(self, room_service: RoomService):
        """Room without password should have no hash."""
        result = room_service.create_room(nickname="Admin")
        assert result.room.password_hash is None
        assert result.room.has_password is False

    def test_create_room_default_settings(self, room_service: RoomService):
        """Should use default settings."""
        result = room_service.create_room(nickname="Admin")
        assert result.room.require_approval is True
        assert result.room.max_users == 2
        assert result.room.status == RoomStatus.WAITING
        assert result.room.is_locked is False
        assert result.room.chat_disabled is False

    def test_create_room_custom_settings(self, room_service: RoomService):
        """Should accept custom settings."""
        result = room_service.create_room(
            nickname="Admin",
            require_approval=False,
            max_users=5,
            room_expiry_hours=48.0,
        )
        assert result.room.require_approval is False
        assert result.room.max_users == 5
        assert result.room.room_expiry_hours == 48.0

    def test_create_room_admin_is_first_user(self, room_service: RoomService):
        """Admin should be the first (and only) user after creation."""
        result = room_service.create_room(nickname="TestAdmin")
        assert len(result.room.users) == 1
        assert result.room.users[0].role == UserRole.ADMIN
        assert result.room.users[0].nickname == "TestAdmin"
        assert result.room.admin_user_id == result.user_id

    def test_unique_room_codes(self, room_service: RoomService):
        """Multiple rooms should have different codes."""
        codes = set()
        for i in range(20):
            result = room_service.create_room(nickname=f"Admin{i}")
            codes.add(result.room.code)
        assert len(codes) == 20
