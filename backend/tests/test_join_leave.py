"""Tests for joining and leaving rooms."""
import pytest
from app.services.room_service import RoomService
from app.models.enums import RoomStatus, UserRole, ConnectionState
from app.schemas.errors import ErrorCodes


class TestJoinRoom:
    def test_join_room_without_password(self, room_service: RoomService):
        """Should allow direct join when no approval required and no password."""
        create = room_service.create_room(nickname="Admin", require_approval=False)
        result = room_service.validate_join(
            code=create.room.code,
            password=None,
            user_id=None,
            nickname="Partner",
        )
        assert result.action == "join"

    def test_join_room_with_correct_password(self, room_service: RoomService):
        """Should allow join with correct password."""
        create = room_service.create_room(nickname="Admin", password="mypass", require_approval=False)
        result = room_service.validate_join(
            code=create.room.code,
            password="mypass",
            user_id=None,
            nickname="Partner",
        )
        assert result.action == "join"

    def test_join_room_with_wrong_password(self, room_service: RoomService):
        """Should reject join with wrong password."""
        create = room_service.create_room(nickname="Admin", password="mypass", require_approval=False)
        result = room_service.validate_join(
            code=create.room.code,
            password="wrongpass",
            user_id=None,
            nickname="Partner",
        )
        assert result.action == "error"
        assert result.error_code == ErrorCodes.WRONG_PASSWORD

    def test_join_room_missing_required_password(self, room_service: RoomService):
        """Should require password when room has one."""
        create = room_service.create_room(nickname="Admin", password="mypass", require_approval=False)
        result = room_service.validate_join(
            code=create.room.code,
            password=None,
            user_id=None,
            nickname="Partner",
        )
        assert result.action == "error"
        assert result.error_code == ErrorCodes.PASSWORD_REQUIRED

    def test_join_nonexistent_room(self, room_service: RoomService):
        """Should return error for non-existent room."""
        result = room_service.validate_join(
            code="NOTEXIST",
            password=None,
            user_id=None,
            nickname="Partner",
        )
        assert result.action == "error"
        assert result.error_code == ErrorCodes.ROOM_NOT_FOUND

    def test_join_full_room(self, room_service: RoomService):
        """Should reject when room is full."""
        create = room_service.create_room(nickname="Admin", require_approval=False, max_users=2)
        # Add a partner
        room_service.add_user_to_room(
            code=create.room.code,
            user_id="partner1",
            session_id="sess1",
            socket_id="sock1",
            nickname="Partner1",
        )
        # Try to join again
        result = room_service.validate_join(
            code=create.room.code,
            password=None,
            user_id=None,
            nickname="Partner2",
        )
        assert result.action == "error"
        assert result.error_code == ErrorCodes.ROOM_FULL

    def test_join_locked_room(self, room_service: RoomService):
        """Should reject when room is locked."""
        create = room_service.create_room(nickname="Admin", require_approval=False)
        # Lock the room
        from app.schemas.room import RoomSettingsUpdate
        room_service.update_room_settings(
            code=create.room.code,
            admin_user_id=create.user_id,
            settings=RoomSettingsUpdate(is_locked=True),
        )
        result = room_service.validate_join(
            code=create.room.code,
            password=None,
            user_id=None,
            nickname="Partner",
        )
        assert result.action == "error"
        assert result.error_code == ErrorCodes.ROOM_LOCKED

    def test_join_requires_approval(self, room_service: RoomService):
        """Should return 'request' action when approval required."""
        create = room_service.create_room(nickname="Admin", require_approval=True)
        result = room_service.validate_join(
            code=create.room.code,
            password=None,
            user_id=None,
            nickname="Partner",
        )
        assert result.action == "request"


class TestLeaveRoom:
    def test_admin_leave_closes_room(self, room_service: RoomService):
        """Admin leaving should close and delete the room."""
        create = room_service.create_room(nickname="Admin")
        result = room_service.remove_user(create.user_id)
        assert result is not None
        assert result.room_closed is True
        # Room should be deleted
        assert room_service.get_room(create.room.code) is None

    def test_partner_leave_keeps_room(self, room_service: RoomService):
        """Partner leaving should keep room open."""
        create = room_service.create_room(nickname="Admin", require_approval=False)
        room_service.add_user_to_room(
            code=create.room.code,
            user_id="partner1",
            session_id="sess1",
            socket_id="sock1",
            nickname="Partner",
        )
        result = room_service.remove_user("partner1")
        assert result is not None
        assert result.room_closed is False
        # Room should still exist
        room = room_service.get_room(create.room.code)
        assert room is not None
        assert room.status == RoomStatus.WAITING
