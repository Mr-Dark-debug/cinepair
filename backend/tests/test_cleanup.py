"""Tests for cleanup functionality."""
import time
import pytest
from app.services.room_service import RoomService
from app.models.enums import ConnectionState
from app.core.config import settings

class TestCleanup:
    def test_cleanup_expired_rooms(self, room_service: RoomService):
        """Should remove rooms that have exceeded their expiry time and have no users."""
        create = room_service.create_room(nickname="Admin", room_expiry_hours=0.001) # Very short expiry
        room = room_service.get_room(create.room.code)
        
        # Room is active, shouldn't be deleted even if expired
        room.last_activity = time.time() - 3600  # 1 hour ago
        room_service._store.update_room(create.room.code, room)
        deleted_count = room_service.cleanup_expired_rooms()
        assert deleted_count == 0
        
        # Remove user so room has no connected users
        room.users = []
        room_service._store.update_room(create.room.code, room)
        deleted_count = room_service.cleanup_expired_rooms()
        assert deleted_count == 1
        
        assert room_service.get_room(create.room.code) is None

    def test_memory_store_cleanup_on_admin_leave(self, room_service: RoomService):
        """Memory store should be cleaned up when admin leaves."""
        create = room_service.create_room(nickname="Admin")
        room_service.remove_user(create.user_id)
        
        # The room should no longer exist in the store
        assert room_service.get_room(create.room.code) is None
        stats = room_service.get_stats()
        assert stats["totalRooms"] == 0

    def test_purge_expired_reconnections(self, room_service: RoomService):
        """Should purge users who exceeded reconnect grace period."""
        create = room_service.create_room(nickname="Admin", require_approval=False)
        partner = room_service.add_user_to_room(
            code=create.room.code,
            user_id="partner1",
            session_id="sess1",
            socket_id="sock1",
            nickname="Partner"
        )
        
        # Mark partner disconnected
        room_service.mark_user_disconnected("partner1")
        
        room = room_service.get_room(create.room.code)
        user = room.find_user("partner1")
        # Force expiration
        user.disconnected_at = time.time() - settings.RECONNECT_GRACE_SECONDS - 10
        room_service._store.update_room(create.room.code, room)
        
        purged = room_service.purge_expired_reconnections()
        assert "partner1" in purged
        
        # Partner should be removed from room
        room = room_service.get_room(create.room.code)
        assert room.find_user("partner1") is None

    def test_clear_pending_requests(self, room_service: RoomService):
        """Admin should be able to clear pending join requests."""
        create = room_service.create_room(nickname="Admin", require_approval=True)
        room_service.create_join_request(
            code=create.room.code,
            user_id="joiner1",
            socket_id="sock1",
            nickname="Joiner1"
        )
        
        room = room_service.get_room(create.room.code)
        assert len(room.pending_requests) == 1
        
        cleared = room_service.clear_pending_requests(create.room.code, create.user_id)
        assert len(cleared) == 1
        
        room = room_service.get_room(create.room.code)
        assert len([r for r in room.pending_requests if r.status == "pending"]) == 0
        assert room.pending_requests[0].status == "denied"