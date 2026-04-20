"""Tests for room settings and admin controls."""
import pytest
from app.services.room_service import RoomService
from app.schemas.room import RoomSettingsUpdate


class TestRoomSettings:
    def test_toggle_approval(self, room_service: RoomService):
        """Should toggle approval requirement."""
        create = room_service.create_room(nickname="Admin", require_approval=True)
        success = room_service.toggle_approval(create.room.code, create.user_id, False)
        assert success is True
        room = room_service.get_room(create.room.code)
        assert room.require_approval is False

    def test_toggle_approval_non_admin_fails(self, room_service: RoomService):
        """Non-admin should not be able to toggle."""
        create = room_service.create_room(nickname="Admin")
        success = room_service.toggle_approval(create.room.code, "fake-id", False)
        assert success is False

    def test_update_max_users(self, room_service: RoomService):
        """Should update max_users setting."""
        create = room_service.create_room(nickname="Admin", max_users=2)
        applied = room_service.update_room_settings(
            code=create.room.code,
            admin_user_id=create.user_id,
            settings=RoomSettingsUpdate(max_users=5),
        )
        assert applied is not None
        assert applied["max_users"] == 5
        room = room_service.get_room(create.room.code)
        assert room.max_users == 5

    def test_lock_room(self, room_service: RoomService):
        """Should lock the room."""
        create = room_service.create_room(nickname="Admin")
        applied = room_service.update_room_settings(
            code=create.room.code,
            admin_user_id=create.user_id,
            settings=RoomSettingsUpdate(is_locked=True),
        )
        assert applied["is_locked"] is True
        room = room_service.get_room(create.room.code)
        assert room.is_locked is True

    def test_disable_chat(self, room_service: RoomService):
        """Should disable chat."""
        create = room_service.create_room(nickname="Admin")
        applied = room_service.update_room_settings(
            code=create.room.code,
            admin_user_id=create.user_id,
            settings=RoomSettingsUpdate(chat_disabled=True),
        )
        assert applied["chat_disabled"] is True

    def test_disable_partner_screen_share(self, room_service: RoomService):
        """Should disable partner screen sharing."""
        create = room_service.create_room(nickname="Admin")
        applied = room_service.update_room_settings(
            code=create.room.code,
            admin_user_id=create.user_id,
            settings=RoomSettingsUpdate(partner_screen_share_disabled=True),
        )
        assert applied["partner_screen_share_disabled"] is True

    def test_non_admin_cannot_update_settings(self, room_service: RoomService):
        """Non-admin should not be able to update settings."""
        create = room_service.create_room(nickname="Admin")
        applied = room_service.update_room_settings(
            code=create.room.code,
            admin_user_id="fake-id",
            settings=RoomSettingsUpdate(is_locked=True),
        )
        assert applied is None
