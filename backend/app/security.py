"""Shared security helpers for the CinePair backend.

Small, dependency-free utilities: PBKDF2 password hashing and an in-memory
fixed-window rate limiter.
"""

from __future__ import annotations

import hashlib
import os
import time
from collections import defaultdict, deque


def hash_password(password: str) -> str:
    """Return a salted PBKDF2-SHA256 hash as ``salt_hex$digest_hex``."""
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return salt.hex() + "$" + digest.hex()


def verify_password(password: str, stored: str) -> bool:
    """Verify a password against a ``salt_hex$digest_hex`` string."""
    if not stored or "$" not in stored:
        return False
    try:
        salt_hex, digest_hex = stored.split("$", 1)
        salt = bytes.fromhex(salt_hex)
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return digest.hex() == digest_hex


class RateLimiter:
    """In-memory fixed-window rate limiter keyed by a string id."""

    def __init__(self, limit: int = 10, window_seconds: float = 10.0) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        """Return True if the action is within the rate limit, else False."""
        now = time.monotonic()
        q = self._hits[key]
        while q and now - q[0] >= self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        return True
