"""Presence gateway - room management Socket.IO event handlers."""
import structlog
from pydantic import ValidationError

import socketio

from app.models.enums import ConnectionState, UserRole, RoomStatus
from app.schemas.room import (
    SocketRoomCreatePayload,
    SocketRoomJoinPayload,
    SocketJoinResponsePayload,
    SocketToggleApprovalPayload,
    SocketSettingsUpdatePayload,
    SocketLeavePayload,
    SocketPeerReadyPayload,
)
from app.schemas.errors import ErrorCodes
from app.services.room_service import RoomService
from app.services.token_service import TokenService
from app.utils.helpers import generate_user_id, generate_session_id
from app.websocket.server import get_socket_session

logger = structlog.get_logger(__name__)


def register_presence_handlers(sio: socketio.AsyncServer, room_service: RoomService, token_service: TokenService):
    """Register all presence/room management event handlers."""

    @sio.event
    async def connect(sid, environ, auth):
        """Handle new socket connection."""
        from app.websocket.server import authenticate_socket
        result = await authenticate_socket(sio, sid, environ, auth)

        if result:
            session = await get_socket_session(sio, sid)
            # If authenticated and has a room, update socket ID and join socket room
            if session.get("authenticated") and session.get("user_id"):
                user_id = session["user_id"]
                room_code = session.get("room_code")

                # Update socket ID in room service
                room_service.update_user_socket(user_id, sid)

                # Join the Socket.IO room for broadcasts
                if room_code:
                    sio.enter_room(sid, room_code)

                    # Check if this is a reconnection
                    room = room_service.get_room(room_code)
                    if room:
                        user = room.find_user(user_id)
                        if user and user.connection_state == ConnectionState.RECONNECTING:
                            # Mark as reconnected
                            room_service.mark_user_reconnected(user_id, sid)
                            # Notify room
                            await sio.emit("room:user-reconnected", {
                                "userId": user_id,
                                "nickname": user.nickname,
                            }, room=room_code, skip_sid=sid)

                logger.info("socket_connected_authenticated", sid=sid, user_id=user_id)
            else:
                logger.debug("socket_connected_unauthenticated", sid=sid)

        return result  # True to accept, False to reject

    @sio.on("room:create")
    async def handle_room_create(sid, data):
        """Handle room creation. Returns callback response."""
        try:
            payload = SocketRoomCreatePayload(**data)
        except (ValidationError, TypeError) as e:
            return {"error": {"code": ErrorCodes.VALIDATION_FAILED, "message": str(e)}}

        try:
            result = room_service.create_room(
                nickname=payload.nickname,
                password=payload.password,
                require_approval=payload.requireApproval,
            )

            # Update socket session with user info
            await sio.save_session(sid, {
                "user_id": result.user_id,
                "session_id": result.session_id,
                "room_code": result.room.code,
                "role": "admin",
                "nickname": payload.nickname,
                "authenticated": True,
            })

            # Update socket ID on the user record
            room_service.update_user_socket(result.user_id, sid)

            # Join the Socket.IO room for broadcasts
            sio.enter_room(sid, result.room.code)

            # Return success to callback
            return {
                "code": result.room.code,
                "userId": result.user_id,
                "sessionToken": result.token,
                "requireApproval": result.room.require_approval,
                "hasPassword": result.room.has_password,
            }
        except Exception as e:
            logger.error("room_create_failed", error=str(e), sid=sid)
            return {"error": {"code": ErrorCodes.INTERNAL_ERROR, "message": "Failed to create room"}}

    @sio.on("room:join")
    async def handle_room_join(sid, data):
        """Handle room join attempt. Returns callback response."""
        try:
            payload = SocketRoomJoinPayload(**data)
        except (ValidationError, TypeError) as e:
            return {"error": {"code": ErrorCodes.VALIDATION_FAILED, "message": str(e)}}

        try:
            # Generate new user ID for this joiner
            user_id = generate_user_id()
            session_id = generate_session_id()

            result = room_service.validate_join(
                code=payload.code,
                password=payload.password,
                user_id=None,
                nickname=payload.nickname,
            )

            if result.action == "error":
                # Special case: APPROVAL_REQUIRED uses a different error format
                if result.error_code == ErrorCodes.APPROVAL_REQUIRED:
                    return {"code": "APPROVAL_REQUIRED"}
                return {"error": {"code": result.error_code, "message": result.error_message}}

            if result.action == "request":
                # Approval required - create pending request
                join_request = room_service.create_join_request(
                    code=payload.code,
                    user_id=user_id,
                    socket_id=sid,
                    nickname=payload.nickname,
                )

                if not join_request:
                    return {"error": {"code": ErrorCodes.INTERNAL_ERROR, "message": "Failed to create request"}}

                # Save session for this pending user
                await sio.save_session(sid, {
                    "user_id": user_id,
                    "session_id": session_id,
                    "room_code": payload.code,
                    "role": None,
                    "nickname": payload.nickname,
                    "authenticated": False,
                })

                # Notify admin about join request
                room = room_service.get_room(payload.code)
                if room:
                    admin_user = room.find_user(room.admin_user_id)
                    if admin_user and admin_user.socket_id:
                        await sio.emit("room:join-request", {
                            "id": join_request.id,
                            "userId": user_id,
                            "nickname": payload.nickname,
                            "createdAt": int(join_request.created_at * 1000),
                        }, to=admin_user.socket_id)

                # Return APPROVAL_REQUIRED to the callback
                return {"code": "APPROVAL_REQUIRED"}

            if result.action == "join":
                # Direct join
                user = room_service.add_user_to_room(
                    code=payload.code,
                    user_id=user_id,
                    session_id=session_id,
                    socket_id=sid,
                    nickname=payload.nickname,
                )

                if not user:
                    return {"error": {"code": ErrorCodes.INTERNAL_ERROR, "message": "Failed to join room"}}

                # Generate token
                token = token_service.create_token(
                    user_id=user_id,
                    session_id=session_id,
                    room_code=payload.code,
                    role="partner",
                    nickname=payload.nickname,
                )

                # Update socket session
                await sio.save_session(sid, {
                    "user_id": user_id,
                    "session_id": session_id,
                    "room_code": payload.code,
                    "role": "partner",
                    "nickname": payload.nickname,
                    "authenticated": True,
                })

                # Join Socket.IO room
                sio.enter_room(sid, payload.code)

                # Get room for response data
                room = room_service.get_room(payload.code)
                users_list = [
                    {"userId": u.user_id, "nickname": u.nickname, "role": u.role.value}
                    for u in room.users
                    if u.connection_state == ConnectionState.CONNECTED
                ]

                # Notify existing room members
                await sio.emit("room:user-joined", {
                    "userId": user_id,
                    "nickname": payload.nickname,
                    "role": "partner",
                }, room=payload.code, skip_sid=sid)

                # Return success to callback
                return {
                    "code": room.code,
                    "userId": user_id,
                    "role": "partner",
                    "sessionToken": token,
                    "users": users_list,
                    "requireApproval": room.require_approval,
                    "isScreenSharing": room.is_screen_sharing,
                }

            if result.action == "reconnect":
                # Handle reconnection
                room_service.mark_user_reconnected(result.user.user_id, sid)

                token = token_service.create_token(
                    user_id=result.user.user_id,
                    session_id=result.user.session_id,
                    room_code=payload.code,
                    role=result.user.role.value,
                    nickname=result.user.nickname,
                )

                await sio.save_session(sid, {
                    "user_id": result.user.user_id,
                    "session_id": result.user.session_id,
                    "room_code": payload.code,
                    "role": result.user.role.value,
                    "nickname": result.user.nickname,
                    "authenticated": True,
                })

                sio.enter_room(sid, payload.code)

                room = room_service.get_room(payload.code)
                users_list = [
                    {"userId": u.user_id, "nickname": u.nickname, "role": u.role.value}
                    for u in room.users
                    if u.connection_state == ConnectionState.CONNECTED
                ]

                # Notify room of reconnection
                await sio.emit("room:user-reconnected", {
                    "userId": result.user.user_id,
                    "nickname": result.user.nickname,
                }, room=payload.code, skip_sid=sid)

                return {
                    "code": room.code,
                    "userId": result.user.user_id,
                    "role": result.user.role.value,
                    "sessionToken": token,
                    "users": users_list,
                    "requireApproval": room.require_approval,
                    "isScreenSharing": room.is_screen_sharing,
                }

            return {"error": {"code": ErrorCodes.INTERNAL_ERROR, "message": "Unexpected state"}}

        except Exception as e:
            logger.error("room_join_failed", error=str(e), sid=sid)
            return {"error": {"code": ErrorCodes.INTERNAL_ERROR, "message": "Failed to join room"}}

    @sio.on("room:join-response")
    async def handle_join_response(sid, data):
        """Handle admin's response to a join request."""
        try:
            payload = SocketJoinResponsePayload(**data)
        except (ValidationError, TypeError) as e:
            await sio.emit("error", {"code": ErrorCodes.VALIDATION_FAILED, "message": str(e)}, to=sid)
            return

        session = await get_socket_session(sio, sid)
        if not session.get("authenticated"):
            await sio.emit("error", {"code": ErrorCodes.UNAUTHORIZED, "message": "Not authenticated"}, to=sid)
            return

        admin_user_id = session["user_id"]

        result = room_service.process_join_response(
            code=payload.code,
            request_id=payload.requestId,
            approved=payload.approved,
            admin_user_id=admin_user_id,
            reason=payload.reason,
        )

        if not result.success:
            await sio.emit("error", {"code": ErrorCodes.FORBIDDEN, "message": result.error_message}, to=sid)
            return

        if payload.approved and result.request:
            # Find the joiner's socket
            joiner_sid = result.request.socket_id

            if result.user and result.token:
                # Update joiner's session
                await sio.save_session(joiner_sid, {
                    "user_id": result.request.user_id,
                    "session_id": result.user.session_id,
                    "room_code": payload.code,
                    "role": "partner",
                    "nickname": result.request.nickname,
                    "authenticated": True,
                })

                # Add joiner to Socket.IO room
                sio.enter_room(joiner_sid, payload.code)

                room = room_service.get_room(payload.code)
                users_list = [
                    {"userId": u.user_id, "nickname": u.nickname, "role": u.role.value}
                    for u in room.users
                    if u.connection_state == ConnectionState.CONNECTED
                ]

                # Send approval response to joiner
                await sio.emit("room:join-response", {
                    "approved": True,
                }, to=joiner_sid)

                # Send full room data to joiner
                await sio.emit("room:joined", {
                    "code": room.code,
                    "userId": result.request.user_id,
                    "role": "partner",
                    "sessionToken": result.token,
                    "users": users_list,
                    "requireApproval": room.require_approval,
                    "isScreenSharing": room.is_screen_sharing,
                }, to=joiner_sid)

                # Notify existing members (except joiner)
                await sio.emit("room:user-joined", {
                    "userId": result.request.user_id,
                    "nickname": result.request.nickname,
                    "role": "partner",
                }, room=payload.code, skip_sid=joiner_sid)
        else:
            # Denied - notify joiner
            if result.request:
                await sio.emit("room:join-response", {
                    "approved": False,
                    "reason": payload.reason,
                }, to=result.request.socket_id)

    @sio.on("room:toggle-approval")
    async def handle_toggle_approval(sid, data):
        """Handle admin toggling the approval requirement."""
        try:
            payload = SocketToggleApprovalPayload(**data)
        except (ValidationError, TypeError) as e:
            await sio.emit("error", {"code": ErrorCodes.VALIDATION_FAILED, "message": str(e)}, to=sid)
            return

        session = await get_socket_session(sio, sid)
        if not session.get("authenticated"):
            await sio.emit("error", {"code": ErrorCodes.UNAUTHORIZED, "message": "Not authenticated"}, to=sid)
            return

        success = room_service.toggle_approval(
            code=payload.code,
            admin_user_id=session["user_id"],
            require_approval=payload.requireApproval,
        )

        if success:
            # Broadcast to room
            await sio.emit("room:approval-changed", {
                "requireApproval": payload.requireApproval,
            }, room=payload.code)

    @sio.on("room:leave")
    async def handle_room_leave(sid, data):
        """Handle user leaving a room."""
        try:
            payload = SocketLeavePayload(**data)
        except (ValidationError, TypeError) as e:
            await sio.emit("error", {"code": ErrorCodes.VALIDATION_FAILED, "message": str(e)}, to=sid)
            return

        session = await get_socket_session(sio, sid)
        if not session.get("authenticated") or not session.get("user_id"):
            return

        user_id = session["user_id"]
        result = room_service.remove_user(user_id)

        if result:
            # Leave Socket.IO room
            sio.leave_room(sid, payload.code)

            if result.room_closed:
                # Room closed (admin left) - notify all remaining
                await sio.emit("room:closed", {
                    "reason": "Admin left the room",
                }, room=payload.code)
                # Disconnect all from the socket room
                await sio.close_room(payload.code)
            else:
                # Partner left - notify remaining users
                await sio.emit("room:user-left", {
                    "userId": user_id,
                    "nickname": result.removed_user.nickname if result.removed_user else "Unknown",
                }, room=payload.code)

            # Clear socket session
            await sio.save_session(sid, {
                "user_id": None,
                "session_id": None,
                "room_code": None,
                "role": None,
                "nickname": None,
                "authenticated": False,
            })

    @sio.on("room:settings-update")
    async def handle_settings_update(sid, data):
        """
        Handle live admin controls update.

        Admin can change mid-session:
        - max_users (applies soft lock if current count > new max, no kicks)
        - is_locked (lock/unlock room)
        - chat_disabled (disable chat for non-admin users)
        - partner_screen_share_disabled (disable partner screen sharing)
        - require_approval (toggle approval requirement)

        Also supports clearing all pending requests via a special action.
        """
        try:
            payload = SocketSettingsUpdatePayload(**data)
        except (ValidationError, TypeError) as e:
            await sio.emit("error", {"code": ErrorCodes.VALIDATION_FAILED, "message": str(e)}, to=sid)
            return

        session = await get_socket_session(sio, sid)
        if not session.get("authenticated"):
            await sio.emit("error", {"code": ErrorCodes.UNAUTHORIZED, "message": "Not authenticated"}, to=sid)
            return

        admin_user_id = session["user_id"]

        # Apply settings update
        applied = room_service.update_room_settings(
            code=payload.code,
            admin_user_id=admin_user_id,
            settings=payload.settings,
        )

        if applied is None:
            await sio.emit("error", {"code": ErrorCodes.FORBIDDEN, "message": "Not authorized to change settings"}, to=sid)
            return

        if applied:
            # Broadcast settings update to all room participants
            await sio.emit("room:settings-update", {
                "settings": applied,
            }, room=payload.code)

            # If approval was toggled, also emit the legacy event for compatibility
            if "require_approval" in applied:
                await sio.emit("room:approval-changed", {
                    "requireApproval": applied["require_approval"],
                }, room=payload.code)

    @sio.on("room:clear-requests")
    async def handle_clear_requests(sid, data):
        """Handle admin clearing all pending join requests."""
        try:
            code = data.get("code", "") if isinstance(data, dict) else ""
            if not code or len(code) != 8:
                await sio.emit("error", {"code": ErrorCodes.VALIDATION_FAILED, "message": "Invalid room code"}, to=sid)
                return
        except Exception:
            await sio.emit("error", {"code": ErrorCodes.VALIDATION_FAILED, "message": "Invalid payload"}, to=sid)
            return

        session = await get_socket_session(sio, sid)
        if not session.get("authenticated"):
            await sio.emit("error", {"code": ErrorCodes.UNAUTHORIZED, "message": "Not authenticated"}, to=sid)
            return

        admin_user_id = session["user_id"]

        cleared = room_service.clear_pending_requests(
            code=code,
            admin_user_id=admin_user_id,
        )

        # Notify each cleared requester that they were denied
        for request in cleared:
            if request.socket_id:
                await sio.emit("room:join-response", {
                    "approved": False,
                    "reason": "All pending requests were cleared by the admin",
                }, to=request.socket_id)

    @sio.on("peer:ready")
    async def handle_peer_ready(sid, data):
        """Handle peer ready signal - initiates WebRTC negotiation."""
        try:
            payload = SocketPeerReadyPayload(**data)
        except (ValidationError, TypeError) as e:
            await sio.emit("error", {"code": ErrorCodes.VALIDATION_FAILED, "message": str(e)}, to=sid)
            return

        session = await get_socket_session(sio, sid)
        if not session.get("authenticated"):
            return

        room = room_service.get_room(payload.code)
        if not room:
            return

        # Check if we have 2 connected users
        connected = room.connected_users
        if len(connected) < 2:
            return

        # Determine polite/impolite roles
        # Admin is impolite (creates offers), Partner is polite (responds)
        for user in connected:
            if user.socket_id:
                # Admin (impolite): receives target as partner
                # Partner (polite): receives target as admin
                other_user = next((u for u in connected if u.user_id != user.user_id), None)
                if other_user:
                    is_polite = user.role == UserRole.PARTNER
                    await sio.emit("peer:start-negotiation", {
                        "targetUserId": other_user.user_id,
                        "polite": is_polite,
                    }, to=user.socket_id)

    @sio.event
    async def disconnect(sid):
        """Handle socket disconnection."""
        session = await get_socket_session(sio, sid)

        if not session.get("authenticated") or not session.get("user_id"):
            # Check if this was a pending request socket
            store = room_service._store
            pending_result = store.find_pending_request_by_socket(sid)
            if pending_result:
                room, request = pending_result
                room.pending_requests = [r for r in room.pending_requests if r.socket_id != sid]
                store.update_room(room.code, room)
                logger.info("pending_request_removed", room_code=room.code, socket_id=sid)
            return

        user_id = session["user_id"]
        room_code = session.get("room_code")

        # Mark as disconnected (enters grace period)
        disconnect_result = room_service.mark_user_disconnected(user_id)

        if disconnect_result:
            room, user = disconnect_result
            # Notify room members
            await sio.emit("room:user-disconnected", {
                "userId": user_id,
                "nickname": user.nickname,
                "reconnecting": True,
            }, room=room_code, skip_sid=sid)

        logger.info("socket_disconnected", sid=sid, user_id=user_id, room_code=room_code)
