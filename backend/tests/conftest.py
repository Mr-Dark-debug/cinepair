"""Shared test fixtures."""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.core.config import Settings, settings
from app.state.memory_store import MemoryRoomStore
from app.services.token_service import TokenService
from app.services.room_service import RoomService
from app.services.ice_service import IceServerService
from app.api.dependencies import init_services


@pytest.fixture
def memory_store():
    """Fresh memory store for each test."""
    store = MemoryRoomStore()
    yield store
    store.clear()


@pytest.fixture
def token_service():
    """Token service instance."""
    return TokenService()


@pytest.fixture
def room_service(memory_store, token_service):
    """Room service with fresh store."""
    return RoomService(memory_store, settings, token_service)


@pytest.fixture
def ice_service():
    """ICE service instance."""
    return IceServerService(settings)


@pytest_asyncio.fixture
async def async_client(room_service, ice_service, token_service):
    """Async HTTP test client using the real FastAPI app."""
    from app.api.routes import router
    from fastapi import FastAPI

    # Create a fresh test app
    test_app = FastAPI()
    test_app.include_router(router)

    # Initialize DI with test services
    init_services(room_service, ice_service, token_service)

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
