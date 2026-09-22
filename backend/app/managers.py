import random
import string
import time
from typing import Optional

from .schemas import RoomSettings, Participant, WaitingParticipant, RoomState
from .security import hash_password, verify_password


class RoomManager:
    def __init__(self):
        # Maps room_code -> dict representing Room
        self.rooms: dict[str, dict] = {}
        # Maps socket_sid -> room_code
        self.sid_to_room: dict[str, str] = {}

    def get_public_metrics(self) -> dict[str, int]:
        """Return aggregate room counters safe to expose publicly."""
        active_participants = sum(len(room["participants"]) for room in self.rooms.values())
        waiting_guests = sum(len(room["waiting_list"]) for room in self.rooms.values())
        return {
            "active_rooms": len(self.rooms),
            "active_participants": active_participants,
            "waiting_guests": waiting_guests,
        }

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
        require_approval: bool = False,
        avatar_seed: Optional[str] = None,
        avatar_palette: Optional[str] = None,
    ) -> RoomState:
        """Create a new room and add the admin to it."""
        room_code = self._generate_room_code()

        password_hash = hash_password(password) if password else None

        settings = RoomSettings(
            max_participants=max_participants,
            require_approval=require_approval,
            has_password=password_hash is not None,
        )

        admin = Participant(
            id=admin_sid,
            nickname=nickname,
            is_admin=True,
            camera_on=False,
            mic_on=False,
            screen_share_on=False,
            avatar_seed=avatar_seed,
            avatar_palette=avatar_palette,
        )

        self.rooms[room_code] = {
            "code": room_code,
            "admin_id": admin_sid,
            "settings": settings,
            "password_hash": password_hash,
            "participants": {admin_sid: admin},
            "waiting_list": {},
            "watch_source": None,
            "sync_state": None,
            "queue": [],
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
                WaitingParticipant(
                    id=wp.id, nickname=wp.nickname,
                    avatar_seed=wp.avatar_seed, avatar_palette=wp.avatar_palette,
                )
                for wp in room["waiting_list"].values()
            ],
            watch_source=room.get("watch_source"),
            sync_state=room.get("sync_state"),
            queue=list(room.get("queue", [])),
        )

    def join_room(
        self,
        room_code: str,
        sid: str,
        nickname: str,
        password: Optional[str] = None,
        avatar_seed: Optional[str] = None,
        avatar_palette: Optional[str] = None,
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
        if room.get("password_hash") and not verify_password(password or "", room["password_hash"]):
            return False, "Incorrect room password.", None

        # 2. Verify capacity limits
        current_count = len(room["participants"]) + len(room["waiting_list"])
        if current_count >= settings.max_participants:
            return False, "Room is currently full.", None

        # 3. Check if user needs approval in waiting room
        if settings.require_approval:
            waiting_user = WaitingParticipant(
                id=sid, nickname=nickname,
                avatar_seed=avatar_seed, avatar_palette=avatar_palette,
            )
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
            screen_share_on=False,
            avatar_seed=avatar_seed,
            avatar_palette=avatar_palette,
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
            screen_share_on=False,
            avatar_seed=waiting_user.avatar_seed,
            avatar_palette=waiting_user.avatar_palette,
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
            was_admin_removed = False  # Reset since we gracefully transferred it

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
            if password:
                room["password_hash"] = hash_password(password)
                settings.has_password = True
            else:
                # Empty string / None clears the password
                room["password_hash"] = None
                settings.has_password = False

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

    # --- Watch-together playback state (revamp) ---

    @staticmethod
    def _source_key(source: dict) -> tuple:
        return (source.get("provider"), source.get("video_id") or source.get("url"))

    def set_watch_source(self, room_code: str, source: dict) -> Optional[RoomState]:
        room = self.rooms.get(room_code)
        if not room:
            return None
        room["watch_source"] = source
        return self.get_room_state(room_code)

    def update_sync_state(
        self,
        room_code: str,
        position: float,
        playing: bool,
        rate: float,
        sid: str,
    ) -> Optional[dict]:
        room = self.rooms.get(room_code)
        if not room:
            return None
        room["sync_state"] = {
            "position": position,
            "playing": playing,
            "rate": rate,
            "updated_by": sid,
            "updated_at": time.time(),
        }
        return room["sync_state"]

    def get_sync_state(self, room_code: str) -> Optional[dict]:
        room = self.rooms.get(room_code)
        return room.get("sync_state") if room else None

    def add_to_queue(self, room_code: str, source: dict) -> Optional[RoomState]:
        room = self.rooms.get(room_code)
        if not room:
            return None
        if not any(self._source_key(s) == self._source_key(source) for s in room["queue"]):
            room["queue"].append(source)
        return self.get_room_state(room_code)

    def remove_from_queue(self, room_code: str, source: dict) -> Optional[RoomState]:
        room = self.rooms.get(room_code)
        if not room:
            return None
        key = self._source_key(source)
        room["queue"] = [s for s in room["queue"] if self._source_key(s) != key]
        return self.get_room_state(room_code)
