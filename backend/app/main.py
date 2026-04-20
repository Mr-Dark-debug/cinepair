"""CinePair Backend - ASGI Application Entry Point."""
import asyncio
from contextlib import asynccontextmanager

import socketio
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import setup_logging
from app.api.routes import router
from app.api.dependencies import init_services
from app.websocket.server import create_sio_server
from app.websocket.presence import register_presence_handlers
from app.websocket.signaling import register_signaling_handlers
from app.services.room_service import RoomService
from app.services.token_service import TokenService
from app.services.ice_service import IceServerService
from app.state.memory_store import MemoryRoomStore

# Initialize logging first
setup_logging()
logger = structlog.get_logger(__name__)

# --- Service Initialization ---
store = MemoryRoomStore()
token_service = TokenService()
room_service = RoomService(store, settings, token_service)
ice_service = IceServerService(settings)

# Initialize dependency injection for FastAPI routes
init_services(room_service, ice_service, token_service)

# --- Background Tasks ---
_background_tasks: list[asyncio.Task] = []


async def cleanup_expired_rooms_loop():
    """Background task: clean up expired rooms every 15 minutes."""
    while True:
        try:
            await asyncio.sleep(900)  # 15 minutes
            count = room_service.cleanup_expired_rooms()
            if count > 0:
                logger.info("background_cleanup", rooms_deleted=count)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("cleanup_error", error=str(e))


async def purge_reconnections_loop():
    """Background task: purge expired reconnections every 10 seconds."""
    while True:
        try:
            await asyncio.sleep(10)
            purged = room_service.purge_expired_reconnections()
            if purged:
                logger.info("reconnection_purge", purged_users=len(purged))
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("purge_error", error=str(e))


# --- FastAPI Lifespan ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown."""
    # Startup
    logger.info(
        "server_starting",
        port=settings.PORT,
        environment=settings.ENVIRONMENT,
        cors_origins=settings.cors_origins_list,
    )

    # Start background tasks
    _background_tasks.append(asyncio.create_task(cleanup_expired_rooms_loop()))
    _background_tasks.append(asyncio.create_task(purge_reconnections_loop()))

    logger.info("background_tasks_started", tasks=["cleanup_expired_rooms", "purge_reconnections"])

    yield

    # Shutdown
    logger.info("server_shutting_down")

    # Cancel background tasks
    for task in _background_tasks:
        task.cancel()

    # Wait for tasks to finish
    await asyncio.gather(*_background_tasks, return_exceptions=True)
    _background_tasks.clear()

    # Cleanup
    store.clear()
    logger.info("server_shutdown_complete")


# --- FastAPI App ---
fastapi_app = FastAPI(
    title="CinePair Backend",
    description="Real-time co-watching signaling server",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include HTTP routes
fastapi_app.include_router(router)

# --- Socket.IO Server ---
sio = create_sio_server(settings)

# Register event handlers
register_presence_handlers(sio, room_service, token_service)
register_signaling_handlers(sio, room_service)

# --- Combined ASGI App ---
# Socket.IO wraps FastAPI - this is the final ASGI application
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)
