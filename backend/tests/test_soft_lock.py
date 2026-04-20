"""Tests for soft lock functionality."""
import time
import pytest
from app.services.room_service import RoomService
from app.schemas.room import RoomSettingsUpdate
from app.models.enums import ConnectionState
from app.schemas.errors import ErrorCodes

class TestSoftLock:
    def test_capacity_enforcement_prevents_join(self, room_service: RoomService):
        """Should prevent new users from joining a full room."""
        create = room_service.create_room(nickname="Admin", max_users=2, require_approval=False)
        room_service.add_user_to_room(
            code=create.room.code,
            user_id="user2",
            session_id="sess2",
            socket_id="sock2",
            nickname="User2"
        )
        result = room_service.validate_join(
            code=create.room.code,
            password=None,
            user_id=None,
            nickname="User3"
        )
        assert result.action == "error"
        assert result.error_code == ErrorCodes.ROOM_FULL

    def test_reduce_max_users_mid_session_does_not_kick(self, room_service: RoomService):
        """Reducing max_users below current user count should not kick existing users."""
        create = room_service.create_room(nickname="Admin", max_users=4, require_approval=False)
        room_service.add_user_to_room(
            code=create.room.code,
            user_id="user2",
            session_id="sess2",
            socket_id="sock2",
            nickname="User2"
        )
        room_service.add_user_to_room(
            code=create.room.code,
            user_id="user3",
            session_id="sess3",
            socket_id="sock3",
            nickname="User3"
        )
        # Reduce max_users to 2
        room_service.update_room_settings(
            code=create.room.code,
            admin_user_id=create.user_id,
            settings=RoomSettingsUpdate(max_users=2)
        )
        room = room_service.get_room(create.room.code)
        assert room.max_users == 2
        assert len(room.users) == 3  # No one was kicked
        assert room.is_full is True
        
        # New users still cannot join
        result = room_service.validate_join(
            code=create.room.code,
            password=None,
            user_id=None,
            nickname="User4"
        )
        assert result.action == "error"
        assert result.error_code == ErrorCodes.ROOM_FULL

    def test_connection_state_management_disconnect(self, room_service: RoomService):
        """Disconnecting a user should update connection state."""
        create = room_service.create_room(nickname="Admin")
        room, user = room_service.mark_user_disconnected(create.user_id)
        
        assert user.connection_state == ConnectionState.RECONNECTING
        assert user.disconnected_at is not None

    def test_connection_state_management_reconnect(self, room_service: RoomService):
        """Reconnecting a user should restore connection state."""
        create = room_service.create_room(nickname="Admin")
        room_service.mark_user_disconnected(create.user_id)
        
        room, user = room_service.mark_user_reconnected(create.user_id, "new-socket-id")
        
        assert user.connection_state == ConnectionState.CONNECTED
        assert user.disconnected_at is None
        assert user.socket_id == "new-socket-id"

    def test_disconnected_user_can_validate_reconnect(self, room_service: RoomService):
        """Disconnected user should be able to validate join for reconnecting."""
        create = room_service.create_room(nickname="Admin")
        room_service.mark_user_disconnected(create.user_id)
        
        result = room_service.validate_join(
            code=create.room.code,
            password=None,
            user_id=create.user_id,
            nickname="Admin"
        )
        assert result.action == "reconnect"
        assert result.user is not None
        assert result.user.user_id == create.user_id