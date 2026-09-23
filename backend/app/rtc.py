"""Short-lived coturn REST credentials; the shared secret stays on the backend."""
import base64
import hashlib
import hmac
import os
import time


def ice_configuration(sid: str) -> dict:
    servers = [{"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]}]
    urls = [url.strip() for url in os.getenv("TURN_URLS", "").split(",") if url.strip().startswith(("turn:", "turns:"))]
    secret = os.getenv("TURN_SHARED_SECRET", "")
    if urls and secret:
        username = f"{int(time.time()) + 3600}:{sid}"
        credential = base64.b64encode(hmac.new(secret.encode(), username.encode(), hashlib.sha1).digest()).decode()
        servers.append({"urls": urls, "username": username, "credential": credential})
    return {"iceServers": servers}
