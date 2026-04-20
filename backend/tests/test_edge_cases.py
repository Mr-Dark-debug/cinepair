"""Tests for edge cases and concurrent scenarios."""
import pytest
import asyncio
from unittest.mock import patch
from app.services.room_service import RoomService
from app.schemas.errors import ErrorCodes

class TestEdgeCases:
    @pytest.mark.asyncio
    async def test_concurrent_room_creation(self, room_service: RoomService):
        """Test multiple rooms created concurrently."""
        def create_sync(i):
            return room_service.create_room(nickname=f"User{i}")

        loop = asyncio.get_running_loop()
        tasks = [loop.run_in_executor(None, create_sync, i) for i in range(10)]
        results = await asyncio.gather(*tasks)
        
        assert len(results) == 10
        codes = {r.room.code for r in results}
        assert len(codes) == 10  # All codes must be unique

    def test_code_generation_exhaustion(self, room_service: RoomService):
        """Should raise RuntimeError if unique code cannot be generated."""
        create = room_service.create_room(nickname="Admin")
        
        # Mock room_exists to always return True
        with patch.object(room_service._store, 'room_exists', return_value=True):
            with pytest.raises(RuntimeError, match="Failed to generate unique room code after max attempts"):
                room_service.create_room(nickname="AnotherAdmin")

    def test_invalid_inputs_add_chat_message(self, room_service: RoomService):
        """Adding a message to a non-existent room should return None."""
        result = room_service.add_chat_message(
            code="NONEXIST",
            sender_id="sender",
            sender_nickname="Sender",
            message="Hello",
            timestamp=0.0
        )
        assert result is None

    def test_invalid_inputs_toggle_approval(self, room_service: RoomService):
        """Toggling approval for non-existent room should return False."""
        success = room_service.toggle_approval("NONEXIST", "admin", False)
        assert success is False

    def test_boundary_zero_max_users(self, room_service: RoomService):
        """Test boundary condition where max_users is updated to 0 or 1 (invalid)."""
        create = room_service.create_room(nickname="Admin", max_users=2, require_approval=False)
        from app.schemas.room import RoomSettingsUpdate
        from pydantic import ValidationError
        
        # The system enforces a minimum of 2 max users at the schema level
        with pytest.raises(ValidationError):
            RoomSettingsUpdate(max_users=1)
        with pytest.raises(ValidationError):
            RoomSettingsUpdate(max_users=0)

    def test_race_condition_join_deleted_room(self, room_service: RoomService):
        """Test validation of join when room is deleted immediately before check."""
        create = room_service.create_room(nickname="Admin", require_approval=False)
        
        # Simulate room deletion
        room_service._store.delete_room(create.room.code)
        
        result = room_service.validate_join(
            code=create.room.code,
            password=None,
            user_id=None,
            nickname="Partner"
        )
        assert result.action == "error"
        assert result.error_code == ErrorCodes.ROOM_NOT_FOUND

    def test_reconnect_already_connected_user(self, room_service: RoomService):
        """Test attempting to reconnect a user who is already fully connected."""
        create = room_service.create_room(nickname="Admin", require_approval=False)
        
        # Validate join as the admin who is already connected
        result = room_service.validate_join(
            code=create.room.code,
            password=None,
            user_id=create.user_id,
            nickname="Admin"
        )
        
        assert result.action == "error"
        assert result.error_code == ErrorCodes.ALREADY_IN_ROOM