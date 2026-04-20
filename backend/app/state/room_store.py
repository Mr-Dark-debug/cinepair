from typing import Iterator, Optional, Protocol

from app.models.room import JoinRequest, Room, RoomUser


class RoomStore(Protocol):
    """Abstract protocol for room state storage."""

    def create_room(self, room: Room) -> None:
        """Store a new room."""
        ...

    def get_room(self, code: str) -> Optional[Room]:
        """Get room by code (case-insensitive)."""
        ...

    def update_room(self, code: str, room: Room) -> None:
        """Update an existing room."""
        ...

    def delete_room(self, code: str) -> bool:
        """Delete a room. Returns True if existed."""
        ...

    def find_user_room(self, user_id: str) -> Optional[tuple[Room, RoomUser]]:
        """Find which room a user is in."""
        ...

    def find_pending_request_by_socket(
        self, socket_id: str
    ) -> Optional[tuple[Room, JoinRequest]]:
        """Find a pending join request by socket ID."""
        ...

    def get_all_rooms(self) -> Iterator[Room]:
        """Iterate over all rooms."""
        ...

    def get_stats(self) -> dict:
        """Get room statistics."""
        ...

    def room_exists(self, code: str) -> bool:
        """Check if a room code is taken."""
        ...

    def clear(self) -> None:
        """Clear all rooms (for testing)."""
        ...
