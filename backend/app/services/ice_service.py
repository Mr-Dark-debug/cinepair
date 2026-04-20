import base64
import hashlib
import hmac
import time

from app.core.config import Settings


class IceServerService:
    """Service for generating ICE server configurations with ephemeral TURN credentials."""

    def __init__(self, settings: Settings) -> None:
        self._stun_urls = settings.stun_urls_list
        self._turn_url = settings.TURN_URL
        self._turn_secret = settings.TURN_SECRET
        self._turn_ttl = settings.TURN_TTL_SECONDS

    def get_ice_servers(self) -> dict:
        """Get ICE server configuration with ephemeral TURN credentials."""
        servers: list[dict] = []

        # Always include STUN servers
        if self._stun_urls:
            servers.append({"urls": self._stun_urls})

        # Add TURN server with ephemeral credentials if configured
        if self._turn_url and self._turn_secret:
            expires_at = int(time.time()) + self._turn_ttl
            username = f"{expires_at}:cinepair"

            # HMAC-SHA1 credential generation (standard TURN REST API)
            credential = base64.b64encode(
                hmac.new(
                    self._turn_secret.encode("utf-8"),
                    username.encode("utf-8"),
                    hashlib.sha1,
                ).digest()
            ).decode("utf-8")

            servers.append(
                {
                    "urls": self._turn_url,
                    "username": username,
                    "credential": credential,
                }
            )

            return {"iceServers": servers, "expiresAt": expires_at}

        return {"iceServers": servers, "expiresAt": None}
