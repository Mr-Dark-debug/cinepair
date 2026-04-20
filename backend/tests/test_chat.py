"""Tests for chat functionality."""
import time
import pytest
from app.services.room_service import RoomService
from app.schemas.room import RoomSettingsUpdate

class TestChat:
    def test_add_chat_message(self, room_service: RoomService):
        """Should add a message to the room's chat."""
        create = room_service.create_room(nickname="Admin")
        msg, is_duplicate = room_service.add_chat_message(
            code=create.room.code,
            sender_id=create.user_id,
            sender_nickname="Admin",
            message="Hello world!",
            timestamp=time.time(),
            client_message_id="msg-123"
        )
        assert msg is not None
        assert is_duplicate is False
        assert msg.message == "Hello world!"
        assert msg.sender_id == create.user_id
        
        room = room_service.get_room(create.room.code)
        assert len(room.chat_messages) == 1
        assert room.chat_messages[0].message == "Hello world!"

    def test_chat_history_retention_limit(self, room_service: RoomService):
        """Should limit chat history to MAX_CHAT_MESSAGES."""
        create = room_service.create_room(nickname="Admin")
        
        # Add 505 messages
        for i in range(505):
            room_service.add_chat_message(
                code=create.room.code,
                sender_id=create.user_id,
                sender_nickname="Admin",
                message=f"Message {i}",
                timestamp=time.time()
            )
            
        room = room_service.get_room(create.room.code)
        assert len(room.chat_messages) == 500  # MAX_CHAT_MESSAGES
        assert room.chat_messages[-1].message == "Message 504"
        assert room.chat_messages[0].message == "Message 5"

    def test_chat_message_deduplication(self, room_service: RoomService):
        """Should deduplicate messages with the same client_message_id."""
        create = room_service.create_room(nickname="Admin")
        
        # Add first time
        msg1, is_dup1 = room_service.add_chat_message(
            code=create.room.code,
            sender_id=create.user_id,
            sender_nickname="Admin",
            message="Hello",
            timestamp=time.time(),
            client_message_id="unique-id-1"
        )
        assert is_dup1 is False
        
        # Add second time
        msg2, is_dup2 = room_service.add_chat_message(
            code=create.room.code,
            sender_id=create.user_id,
            sender_nickname="Admin",
            message="Hello",
            timestamp=time.time(),
            client_message_id="unique-id-1"
        )
        assert is_dup2 is True
        assert msg1.id == msg2.id
        
        room = room_service.get_room(create.room.code)
        assert len(room.chat_messages) == 1

    def test_chat_disabling_effects(self, room_service: RoomService):
        """Should reflect chat disabled setting."""
        create = room_service.create_room(nickname="Admin")
        
        # Initially enabled
        room = room_service.get_room(create.room.code)
        assert room.chat_disabled is False
        
        # Disable chat
        room_service.update_room_settings(
            code=create.room.code,
            admin_user_id=create.user_id,
            settings=RoomSettingsUpdate(chat_disabled=True)
        )
        
        room = room_service.get_room(create.room.code)
        assert room.chat_disabled is True
