"""Signaling gateway - WebRTC relay, chat, and screen share Socket.IO event handlers."""
import structlog
from pydantic import ValidationError

import socketio

from app.models.enums import ConnectionState, UserRole
from app.schemas.signaling import SignalingRelayPayload
from app.schemas.chat import ChatMessagePayload, ScreenTogglePayload
from app.schemas.errors import ErrorCodes
from app.services.room_service import RoomService
from app.websocket.server import get_socket_session

logger = structlog.get_logger(__name__)


def register_signaling_handlers(sio: socketio.AsyncServer, room_service: RoomService):
    """Register all signaling, chat, and screen share event handlers."""

    @sio.on("signaling:relay")
    async def handle_signaling_relay(sid, data):
        """
        Relay WebRTC signaling data (offer/answer/ICE candidate) to target peer.

        Server never inspects SDP/ICE content - just validates the envelope
        and forwards to the target user's current socket.

        BUG FIX from TS version: Uses user_id to look up target's CURRENT socket_id,
        which handles reconnection correctly (socket_id changes on reconnect).
        """
        try:
            payload = SignalingRelayPayload(**data)
        except (ValidationError, TypeError) as e:
            await sio.emit("error", {
                "code": ErrorCodes.VALIDATION_FAILED,
                "message": f"Invalid signaling payload: {str(e)}",
            }, to=sid)
            return

        # Get sender session
        session = await get_socket_session(sio, sid)
        if not session.get("authenticated") or not session.get("user_id"):
            await sio.emit("error", {
                "code": ErrorCodes.UNAUTHORIZED,
                "message": "Not authenticated",
            }, to=sid)
            return

        sender_user_id = session["user_id"]

        # Get room and validate sender membership
        room = room_service.get_room(payload.code)
        if not room:
            await sio.emit("error", {
                "code": ErrorCodes.ROOM_NOT_FOUND,
                "message": "Room not found",
            }, to=sid)
            return

        sender = room.find_user(sender_user_id)
        if not sender or sender.connection_state != ConnectionState.CONNECTED:
            await sio.emit("error", {
                "code": ErrorCodes.FORBIDDEN,
                "message": "Not a connected member of this room",
            }, to=sid)
            return

        # Find target user by user_id (NOT socket_id - this is the bug fix)
        target = room.find_user(payload.targetUserId)
        if not target:
            await sio.emit("error", {
                "code": ErrorCodes.ROOM_NOT_FOUND,
                "message": "Target user not found in room",
            }, to=sid)
            return

        if target.connection_state != ConnectionState.CONNECTED:
            await sio.emit("error", {
                "code": ErrorCodes.FORBIDDEN,
                "message": "Target user is not connected",
            }, to=sid)
            return

        if not target.socket_id:
            await sio.emit("error", {
                "code": ErrorCodes.INTERNAL_ERROR,
                "message": "Target user has no active socket",
            }, to=sid)
            return

        # Relay to target with sender info added
        relay_data = {
            "data": payload.data,
            "type": payload.type,
            "senderUserId": sender_user_id,
        }
        if payload.streamType:
            relay_data["streamType"] = payload.streamType

        await sio.emit("signaling:relay", relay_data, to=target.socket_id)

        logger.debug(
            "signal_relayed",
            room_code=payload.code,
            type=payload.type,
            sender=sender_user_id,
            target=payload.targetUserId,
            stream_type=payload.streamType,
        )

    @sio.on("chat:message")
    async def handle_chat_message(sid, data):
        """
        Handle chat message relay (fallback when DataChannel unavailable).

        Stores in ring buffer (max 500), deduplicates by clientMessageId,
        broadcasts to room except sender.
        """
        try:
            payload = ChatMessagePayload(**data)
        except (ValidationError, TypeError) as e:
            await sio.emit("error", {
                "code": ErrorCodes.VALIDATION_FAILED,
                "message": f"Invalid chat payload: {str(e)}",
            }, to=sid)
            return

        # Get sender session
        session = await get_socket_session(sio, sid)
        if not session.get("authenticated") or not session.get("user_id"):
            await sio.emit("error", {
                "code": ErrorCodes.UNAUTHORIZED,
                "message": "Not authenticated",
            }, to=sid)
            return

        sender_user_id = session["user_id"]
        sender_nickname = session.get("nickname", "Unknown")

        # Get room and validate sender membership
        room = room_service.get_room(payload.code)
        if not room:
            await sio.emit("error", {
                "code": ErrorCodes.ROOM_NOT_FOUND,
                "message": "Room not found",
            }, to=sid)
            return

        sender = room.find_user(sender_user_id)
        if not sender or sender.connection_state != ConnectionState.CONNECTED:
            await sio.emit("error", {
                "code": ErrorCodes.FORBIDDEN,
                "message": "Not a connected member of this room",
            }, to=sid)
            return

        # Check if chat is disabled for non-admin
        if room.chat_disabled and sender.role != UserRole.ADMIN:
            await sio.emit("error", {
                "code": ErrorCodes.CHAT_DISABLED,
                "message": "Chat is disabled by the room admin",
            }, to=sid)
            return

        # Store message
        result = room_service.add_chat_message(
            code=payload.code,
            sender_id=sender_user_id,
            sender_nickname=sender_nickname,
            message=payload.message,
            timestamp=payload.timestamp,
            client_message_id=payload.clientMessageId,
        )

        if not result:
            return

        stored_msg, is_duplicate = result

        if is_duplicate:
            # Already processed this message, skip broadcast
            return

        # Broadcast to room except sender
        await sio.emit("chat:message", {
            "id": stored_msg.id,
            "senderId": stored_msg.sender_id,
            "senderNickname": stored_msg.sender_nickname,
            "message": stored_msg.message,
            "timestamp": stored_msg.timestamp,
            "clientMessageId": stored_msg.client_message_id,
        }, room=payload.code, skip_sid=sid)

    @sio.on("screen:toggle")
    async def handle_screen_toggle(sid, data):
        """
        Handle screen share toggle.
        Updates room state and broadcasts to all room members.
        """
        try:
            payload = ScreenTogglePayload(**data)
        except (ValidationError, TypeError) as e:
            await sio.emit("error", {
                "code": ErrorCodes.VALIDATION_FAILED,
                "message": f"Invalid screen toggle payload: {str(e)}",
            }, to=sid)
            return

        # Get sender session
        session = await get_socket_session(sio, sid)
        if not session.get("authenticated") or not session.get("user_id"):
            await sio.emit("error", {
                "code": ErrorCodes.UNAUTHORIZED,
                "message": "Not authenticated",
            }, to=sid)
            return

        sender_user_id = session["user_id"]

        # Get room and validate
        room = room_service.get_room(payload.code)
        if not room:
            await sio.emit("error", {
                "code": ErrorCodes.ROOM_NOT_FOUND,
                "message": "Room not found",
            }, to=sid)
            return

        sender = room.find_user(sender_user_id)
        if not sender or sender.connection_state != ConnectionState.CONNECTED:
            await sio.emit("error", {
                "code": ErrorCodes.FORBIDDEN,
                "message": "Not a connected member of this room",
            }, to=sid)
            return

        # Check if partner screen share is disabled
        if sender.role == UserRole.PARTNER and room.partner_screen_share_disabled:
            await sio.emit("error", {
                "code": ErrorCodes.SCREEN_SHARE_DISABLED,
                "message": "Screen sharing is disabled for partners by the room admin",
            }, to=sid)
            return

        # Toggle screen share
        success = room_service.toggle_screen_share(
            code=payload.code,
            user_id=sender_user_id,
            is_sharing=payload.isSharing,
        )

        if success:
            # Broadcast to room
            await sio.emit("screen:toggle", {
                "isSharing": payload.isSharing,
                "sharerUserId": sender_user_id,
            }, room=payload.code)
