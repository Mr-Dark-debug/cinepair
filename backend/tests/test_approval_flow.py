"""Tests for the join approval flow."""
import pytest
from app.services.room_service import RoomService
from app.models.enums import JoinRequestStatus


class TestApprovalFlow:
    def test_create_join_request(self, room_service: RoomService):
        """Should create a pending join request."""
        create = room_service.create_room(nickname="Admin", require_approval=True)
        request = room_service.create_join_request(
            code=create.room.code,
            user_id="joiner1",
            socket_id="sock-joiner",
            nickname="Joiner",
        )
        assert request is not None
        assert request.status == JoinRequestStatus.PENDING
        assert request.nickname == "Joiner"

    def test_approve_join_request(self, room_service: RoomService):
        """Admin approving should add user to room."""
        create = room_service.create_room(nickname="Admin", require_approval=True)
        request = room_service.create_join_request(
            code=create.room.code,
            user_id="joiner1",
            socket_id="sock-joiner",
            nickname="Joiner",
        )
        result = room_service.process_join_response(
            code=create.room.code,
            request_id=request.id,
            approved=True,
            admin_user_id=create.user_id,
        )
        assert result.success is True
        assert result.user is not None
        assert result.token is not None
        # User should be in room
        room = room_service.get_room(create.room.code)
        assert len(room.users) == 2

    def test_deny_join_request(self, room_service: RoomService):
        """Admin denying should not add user to room."""
        create = room_service.create_room(nickname="Admin", require_approval=True)
        request = room_service.create_join_request(
            code=create.room.code,
            user_id="joiner1",
            socket_id="sock-joiner",
            nickname="Joiner",
        )
        result = room_service.process_join_response(
            code=create.room.code,
            request_id=request.id,
            approved=False,
            admin_user_id=create.user_id,
            reason="Not today",
        )
        assert result.success is True
        # User should NOT be in room
        room = room_service.get_room(create.room.code)
        assert len(room.users) == 1

    def test_non_admin_cannot_approve(self, room_service: RoomService):
        """Non-admin should not be able to approve requests."""
        create = room_service.create_room(nickname="Admin", require_approval=True)
        request = room_service.create_join_request(
            code=create.room.code,
            user_id="joiner1",
            socket_id="sock-joiner",
            nickname="Joiner",
        )
        result = room_service.process_join_response(
            code=create.room.code,
            request_id=request.id,
            approved=True,
            admin_user_id="fake-user-id",  # Not the admin
        )
        assert result.success is False

    def test_approve_already_processed_request(self, room_service: RoomService):
        """Should reject approving an already-processed request."""
        create = room_service.create_room(nickname="Admin", require_approval=True)
        request = room_service.create_join_request(
            code=create.room.code,
            user_id="joiner1",
            socket_id="sock-joiner",
            nickname="Joiner",
        )
        # Approve first time
        room_service.process_join_response(
            code=create.room.code, request_id=request.id, approved=True, admin_user_id=create.user_id
        )
        # Try again
        result = room_service.process_join_response(
            code=create.room.code, request_id=request.id, approved=True, admin_user_id=create.user_id
        )
        assert result.success is False
