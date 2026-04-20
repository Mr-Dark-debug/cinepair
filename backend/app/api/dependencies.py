"""Dependency injection for FastAPI routes."""
from app.services.room_service import RoomService
from app.services.ice_service import IceServerService
from app.services.token_service import TokenService

# These will be initialized in main.py and set here
_room_service: RoomService | None = None
_ice_service: IceServerService | None = None
_token_service: TokenService | None = None


def init_services(
    room_service: RoomService,
    ice_service: IceServerService,
    token_service: TokenService,
) -> None:
    """Initialize service instances. Called from main.py."""
    global _room_service, _ice_service, _token_service
    _room_service = room_service
    _ice_service = ice_service
    _token_service = token_service


def get_room_service() -> RoomService:
    """Get the room service instance."""
    assert _room_service is not None, "Services not initialized"
    return _room_service


def get_ice_service() -> IceServerService:
    """Get the ICE server service instance."""
    assert _ice_service is not None, "Services not initialized"
    return _ice_service


def get_token_service() -> TokenService:
    """Get the token service instance."""
    assert _token_service is not None, "Services not initialized"
    return _token_service
