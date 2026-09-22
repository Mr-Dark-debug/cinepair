"""Lightweight account store for CinePair.

Uses the stdlib ``sqlite3`` module (no ORM, no external DB service). Passwords are
PBKDF2 hashed; sessions are opaque tokens. Layered on top of guest mode: rooms keep
working with nickname-only identity regardless of accounts.
"""

from __future__ import annotations

import os
import secrets
import sqlite3
import threading
import time
from typing import Optional

from .security import hash_password, verify_password

_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
_DB_PATH = os.getenv("DB_PATH") or os.path.join(_BASE, "cinepair.db")

_lock = threading.Lock()
_conn: Optional[sqlite3.Connection] = None


def _db() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(_DB_PATH, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _init_schema(_conn)
    return _conn


def _init_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            partner_id INTEGER,
            created_at REAL NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS tokens (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at REAL NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pair_codes (
            code TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at REAL NOT NULL
        )
        """
    )
    conn.commit()


def reset_for_tests() -> None:
    """Delete all rows. Used by the test suite to isolate state."""
    with _lock:
        db = _db()
        db.execute("DELETE FROM tokens")
        db.execute("DELETE FROM pair_codes")
        db.execute("DELETE FROM users")
        db.commit()


def _user_row_to_dict(row: sqlite3.Row) -> dict:
    return {"id": row["id"], "nickname": row["nickname"], "partner_id": row["partner_id"]}


def register_user(nickname: str, password: str) -> dict:
    """Create a user. Raises ValueError if the nickname is taken."""
    with _lock:
        db = _db()
        existing = db.execute(
            "SELECT id FROM users WHERE nickname = ?", (nickname,)
        ).fetchone()
        if existing:
            raise ValueError("Nickname is already taken.")
        cur = db.execute(
            "INSERT INTO users (nickname, password_hash, created_at) VALUES (?, ?, ?)",
            (nickname, hash_password(password), time.time()),
        )
        db.commit()
        row = db.execute(
            "SELECT * FROM users WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    return _user_row_to_dict(row)


def login_user(nickname: str, password: str) -> dict:
    """Authenticate a user. Raises ValueError on bad credentials."""
    with _lock:
        db = _db()
        row = db.execute(
            "SELECT * FROM users WHERE nickname = ?", (nickname,)
        ).fetchone()
    if not row or not verify_password(password, row["password_hash"]):
        raise ValueError("Invalid nickname or password.")
    return _user_row_to_dict(row)


def create_token(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with _lock:
        db = _db()
        db.execute(
            "INSERT INTO tokens (token, user_id, created_at) VALUES (?, ?, ?)",
            (token, user_id, time.time()),
        )
        db.commit()
    return token


def get_user_by_token(token: str) -> Optional[dict]:
    with _lock:
        db = _db()
        row = db.execute(
            """
            SELECT u.* FROM tokens t
            JOIN users u ON u.id = t.user_id
            WHERE t.token = ?
            """,
            (token,),
        ).fetchone()
    if not row:
        return None
    return _user_row_to_dict(row)


def create_pair_code(user_id: int) -> str:
    code = secrets.token_urlsafe(6).upper().replace("-", "")[:8]
    with _lock:
        db = _db()
        db.execute("DELETE FROM pair_codes WHERE user_id = ?", (user_id,))
        db.execute(
            "INSERT INTO pair_codes (code, user_id, created_at) VALUES (?, ?, ?)",
            (code, user_id, time.time()),
        )
        db.commit()
    return code


def confirm_pair(user_id: int, code: str) -> Optional[dict]:
    """Link two accounts via a pair code. Returns the partner user dict or None."""
    with _lock:
        db = _db()
        row = db.execute(
            "SELECT * FROM pair_codes WHERE code = ?", (code,)
        ).fetchone()
        if not row or row["user_id"] == user_id:
            return None
        partner_id = row["user_id"]
        db.execute(
            "UPDATE users SET partner_id = ? WHERE id = ?", (partner_id, user_id)
        )
        db.execute(
            "UPDATE users SET partner_id = ? WHERE id = ?", (user_id, partner_id)
        )
        db.execute("DELETE FROM pair_codes WHERE code = ?", (code,))
        db.commit()
        partner = db.execute(
            "SELECT * FROM users WHERE id = ?", (partner_id,)
        ).fetchone()
    return _user_row_to_dict(partner)
