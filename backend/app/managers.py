import random
import string
from typing import Optional
from .schemas import RoomSettings, Participant, WaitingParticipant, RoomState

class RoomManager:
    def __init__(self):
        # Maps room_code -> dict representing Room
        self.rooms: dict[str, dict] = {}
        # Maps socket_sid -> room_code
        self.sid_to_room: dict[str, str] = {}

    def _generate_room_code(self) -> str:
        """Generate a unique 6-character alphanumeric room code."""
        while True:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
            if code not in self.rooms:
                return code

    def create_room(
        self,
        admin_sid: str,
        nickname: str,
        password: Optional[str] = None,
        max_participants: int = 10,
        require_approval: bool = False
    ) -> RoomState:
        """Create a new room and add the admin to it."""
        room_code = self._generate_room_code()
        
        # Instantiate defaults
        settings = RoomSettings(
            max_participants=max_participants,
            require_approval=require_approval,
            password=password
        )
        
        admin = Participant(
            id=admin_sid,
            nickname=nickname,
            is_admin=True,
            camera_on=False,
            mic_on=False,
            screen_share_on=False
        )

        self.rooms[room_code] = {
            "code": room_code,
            "admin_id": admin_sid,
            "settings": settings,
            "participants": {admin_sid: admin},
            "waiting_list": {}
        }
        
        self.sid_to_room[admin_sid] = room_code
        return self.get_room_state(room_code)

    def get_room_state(self, room_code: str) -> Optional[RoomState]:
        """Fetch the public/serializable state of a room."""
        room = self.rooms.get(room_code)
        if not room:
            return None
            
        return RoomState(
            code=room["code"],
            admin_id=room["admin_id"],
            settings=room["settings"],
            participants=list(room["participants"].values()),
            waiting_list=[
                WaitingParticipant(id=wp.id, nickname=wp.nickname)
                for wp in room["waiting_list"].values()
            ]
        )

    def join_room(
        self,
        room_code: str,
        sid: str,
        nickname: str,
        password: Optional[str] = None
    ) -> tuple[bool, str, Optional[RoomState]]:
        """
        Attempt to join a room.
        Returns: (success_bool, status_str_or_error_msg, Optional[RoomState])
        status_str can be: 'joined' or 'waiting'
        """
        room = self.rooms.get(room_code)
        if not room:
            return False, "Room does not exist.", None

        settings: RoomSettings = room["settings"]

        # 1. Verify password if one is configured
        if settings.password and settings.password != password:
            return False, "Incorrect room password.", None

        # 2. Verify capacity limits
        current_count = len(room["participants"]) + len(room["waiting_list"])
        if current_count >= settings.max_participants:
            return False, "Room is currently full.", None

        # 3. Check if user needs approval in waiting room
        if settings.require_approval:
            waiting_user = WaitingParticipant(id=sid, nickname=nickname)
            room["waiting_list"][sid] = waiting_user
            self.sid_to_room[sid] = room_code
            return True, "waiting", self.get_room_state(room_code)

        # 4. Standard instant join
        new_participant = Participant(
            id=sid,
            nickname=nickname,
            is_admin=False,
            camera_on=False,
            mic_on=False,
            screen_share_on=False
        )
        room["participants"][sid] = new_participant
        self.sid_to_room[sid] = room_code
        return True, "joined", self.get_room_state(room_code)

    def admit_participant(self, room_code: str, sid: str) -> tuple[bool, Optional[RoomState]]:
        """Move a user from the waiting room to active participants list."""
        room = self.rooms.get(room_code)
        if not room or sid not in room["waiting_list"]:
            return False, None

        waiting_user = room["waiting_list"].pop(sid)
        new_participant = Participant(
            id=waiting_user.id,
            nickname=waiting_user.nickname,
            is_admin=False,
            camera_on=False,
            mic_on=False,
            screen_share_on=False
        )
        room["participants"][sid] = new_participant
        return True, self.get_room_state(room_code)

    def deny_participant(self, room_code: str, sid: str) -> tuple[bool, Optional[RoomState]]:
        """Remove a user from the waiting room list."""
        room = self.rooms.get(room_code)
        if not room or sid not in room["waiting_list"]:
            return False, None

        room["waiting_list"].pop(sid)
        if sid in self.sid_to_room:
            del self.sid_to_room[sid]
        return True, self.get_room_state(room_code)

    def remove_participant(self, sid: str) -> tuple[Optional[str], Optional[RoomState], bool]:
        """
        Remove participant from their current room.
        Returns: (room_code, Optional[RoomState], was_admin_removed)
        """
        room_code = self.sid_to_room.pop(sid, None)
        if not room_code:
            return None, None, False

        room = self.rooms.get(room_code)
        if not room:
            return room_code, None, False

        was_admin_removed = False

        # If they were in the waiting room list
        if sid in room["waiting_list"]:
            room["waiting_list"].pop(sid)
        # If they were an active participant
        elif sid in room["participants"]:
            participant = room["participants"].pop(sid)
            if participant.is_admin:
                was_admin_removed = True

        # Clean up empty room
        if not room["participants"] and not room["waiting_list"]:
            self.rooms.pop(room_code)
            return room_code, None, was_admin_removed

        # If admin left but other participants exist, transfer admin status to next user
        if was_admin_removed and room["participants"]:
            next_admin_sid = next(iter(room["participants"].keys()))
            room["admin_id"] = next_admin_sid
            room["participants"][next_admin_sid].is_admin = True
            was_admin_removed = False # Reset since we gracefully transferred it

        return room_code, self.get_room_state(room_code), was_admin_removed

    def update_participant_media(
        self,
        room_code: str,
        sid: str,
        camera_on: Optional[bool] = None,
        mic_on: Optional[bool] = None,
        screen_share_on: Optional[bool] = None
    ) -> Optional[RoomState]:
        """Update media track statuses of a participant."""
        room = self.rooms.get(room_code)
        if not room or sid not in room["participants"]:
            return None

        p: Participant = room["participants"][sid]
        if camera_on is not None:
            p.camera_on = camera_on
        if mic_on is not None:
            p.mic_on = mic_on
        if screen_share_on is not None:
            p.screen_share_on = screen_share_on

        return self.get_room_state(room_code)

    def update_room_settings(
        self,
        room_code: str,
        max_participants: Optional[int] = None,
        require_approval: Optional[bool] = None,
        password: Optional[str] = "NO_CHANGE"
    ) -> Optional[RoomState]:
        """Update room configuration parameters."""
        room = self.rooms.get(room_code)
        if not room:
            return None

        settings: RoomSettings = room["settings"]
        if max_participants is not None:
            settings.max_participants = max_participants
        if require_approval is not None:
            settings.require_approval = require_approval
        if password != "NO_CHANGE":
            settings.password = password

        return self.get_room_state(room_code)

    def transfer_admin(self, room_code: str, current_admin_sid: str, new_admin_sid: str) -> Optional[RoomState]:
        """Transfer room administrative ownership to another active participant."""
        room = self.rooms.get(room_code)
        if not room or room["admin_id"] != current_admin_sid:
            return None

        if new_admin_sid not in room["participants"]:
            return None

        # Re-assign variables
        room["participants"][current_admin_sid].is_admin = False
        room["participants"][new_admin_sid].is_admin = True
        room["admin_id"] = new_admin_sid

        return self.get_room_state(room_code)
