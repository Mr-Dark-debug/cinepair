from typing import Iterator, Optional

from app.models.enums import JoinRequestStatus, RoomStatus
from app.models.room import JoinRequest, Room, RoomUser


class MemoryRoomStore:
    """In-memory room storage using a dictionary."""

    def __init__(self) -> None:
        self._rooms: dict[str, Room] = {}

    def create_room(self, room: Room) -> None:
        self._rooms[room.code.upper()] = room

    def get_room(self, code: str) -> Optional[Room]:
        return self._rooms.get(code.upper())

    def update_room(self, code: str, room: Room) -> None:
        self._rooms[code.upper()] = room

    def delete_room(self, code: str) -> bool:
        return self._rooms.pop(code.upper(), None) is not None

    def find_user_room(self, user_id: str) -> Optional[tuple[Room, RoomUser]]:
        for room in self._rooms.values():
            user = room.find_user(user_id)
            if user:
                return (room, user)
        return None

    def find_pending_request_by_socket(
        self, socket_id: str
    ) -> Optional[tuple[Room, JoinRequest]]:
        for room in self._rooms.values():
            for req in room.pending_requests:
                if req.socket_id == socket_id and req.status == JoinRequestStatus.PENDING:
                    return (room, req)
        return None

    def get_all_rooms(self) -> Iterator[Room]:
        return iter(list(self._rooms.values()))

    def get_stats(self) -> dict:
        total = len(self._rooms)
        active = sum(1 for r in self._rooms.values() if r.status == RoomStatus.ACTIVE)
        waiting = sum(1 for r in self._rooms.values() if r.status == RoomStatus.WAITING)
        return {"totalRooms": total, "activeRooms": active, "waitingRooms": waiting}

    def room_exists(self, code: str) -> bool:
        return code.upper() in self._rooms

    def clear(self) -> None:
        self._rooms.clear()
