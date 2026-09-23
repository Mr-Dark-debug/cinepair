"""Transactional account storage: PostgreSQL in hosting, SQLite for local use."""
from __future__ import annotations

import hashlib
import os
import secrets
import threading
import time
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import Column, Float, Index, Integer, MetaData, Table, Text, create_engine, func, select
from sqlalchemy.engine import URL
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.pool import StaticPool
from .security import hash_password, verify_password

TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60
PAIR_CODE_LIFETIME_SECONDS = 10 * 60
_lock = threading.RLock()
_engine = None
_metadata = MetaData()
_users = Table("users", _metadata,
    Column("id", Integer, primary_key=True),
    Column("nickname", Text, nullable=False, unique=True),
    Column("password_hash", Text, nullable=False),
    Column("partner_id", Integer),
    Column("created_at", Float, nullable=False))
Index("uq_users_nickname_lower", func.lower(_users.c.nickname), unique=True)
_tokens = Table("tokens", _metadata,
    Column("token", Text, primary_key=True),
    Column("user_id", Integer, nullable=False, index=True),
    Column("created_at", Float, nullable=False))
_codes = Table("pair_codes", _metadata,
    Column("code", Text, primary_key=True),
    Column("user_id", Integer, nullable=False),
    Column("created_at", Float, nullable=False))


def _get_engine():
    global _engine
    if _engine is None:
        url = os.getenv("DATABASE_URL", "")
        if url.startswith(("postgres://", "postgresql://")):
            url = "postgresql+psycopg://" + url.split("://", 1)[1]
        if url:
            if not url.startswith("postgresql+psycopg://"):
                raise ValueError("DATABASE_URL must be a PostgreSQL connection URL.")
            engine = create_engine(url, pool_pre_ping=True, pool_size=2, max_overflow=2,
                connect_args={"connect_timeout": 5, "prepare_threshold": None})
        else:
            path = os.getenv("DB_PATH") or str(Path(__file__).resolve().parent.parent / "cinepair.db")
            engine = create_engine(URL.create("sqlite", database=path),
                connect_args={"check_same_thread": False}, poolclass=StaticPool)
        try:
            _metadata.create_all(engine)
        except Exception:
            engine.dispose()
            raise
        _engine = engine
    return _engine


@contextmanager
def _transaction():
    # The lock serializes local SQLite access; row locks protect PostgreSQL pairs.
    with _lock:
        with _get_engine().begin() as db:
            yield db


def storage_health() -> bool:
    try:
        with _transaction() as db:
            db.execute(select(1)).scalar_one()
        return True
    except (OSError, ValueError, SQLAlchemyError):
        return False


def reset_for_tests() -> None:
    """Only the isolated test runner should call this function."""
    with _transaction() as db:
        for table in (_tokens, _codes, _users):
            db.execute(table.delete())


def _public(row) -> dict:
    return {name: row[name] for name in ("id", "nickname", "partner_id")}


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def register_user(nickname: str, password: str) -> dict:
    password_hash = hash_password(password)
    try:
        with _transaction() as db:
            if db.execute(select(_users.c.id).where(func.lower(_users.c.nickname) == nickname.lower())).first():
                raise ValueError("Nickname is already taken.")
            result = db.execute(_users.insert().values(nickname=nickname, password_hash=password_hash, created_at=time.time()))
            row = db.execute(select(_users).where(_users.c.id == result.inserted_primary_key[0])).mappings().one()
            return _public(row)
    except IntegrityError as exc:
        raise ValueError("Nickname is already taken.") from exc


def login_user(nickname: str, password: str) -> dict:
    with _transaction() as db:
        row = db.execute(select(_users).where(func.lower(_users.c.nickname) == nickname.lower())).mappings().first()
    if not row or not verify_password(password, row["password_hash"]):
        raise ValueError("Invalid nickname or password.")
    return _public(row)


def create_token(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with _transaction() as db:
        db.execute(_tokens.delete().where(_tokens.c.created_at < time.time() - TOKEN_LIFETIME_SECONDS))
        db.execute(_tokens.insert().values(token=_token_hash(token), user_id=user_id, created_at=time.time()))
    return token


def get_user_by_token(token: str) -> dict | None:
    with _transaction() as db:
        row = db.execute(select(_users).join(_tokens, _tokens.c.user_id == _users.c.id).where(
            _tokens.c.token == _token_hash(token),
            _tokens.c.created_at >= time.time() - TOKEN_LIFETIME_SECONDS)).mappings().first()
    return _public(row) if row else None


def create_pair_code(user_id: int) -> str:
    code = secrets.token_hex(5).upper()
    with _transaction() as db:
        db.execute(_codes.delete().where((_codes.c.user_id == user_id) | (_codes.c.created_at < time.time() - PAIR_CODE_LIFETIME_SECONDS)))
        db.execute(_codes.insert().values(code=code, user_id=user_id, created_at=time.time()))
    return code


def confirm_pair(user_id: int, code: str) -> dict | None:
    with _transaction() as db:
        invitation = db.execute(select(_codes).where(_codes.c.code == code)).mappings().first()
        if not invitation or invitation["user_id"] == user_id or invitation["created_at"] < time.time() - PAIR_CODE_LIFETIME_SECONDS:
            return None
        partner_id = invitation["user_id"]
        people = db.execute(select(_users).where(_users.c.id.in_([user_id, partner_id])).order_by(_users.c.id).with_for_update()).mappings().all()
        if len(people) != 2 or any(person["partner_id"] is not None for person in people):
            return None
        if not db.execute(select(_codes.c.code).where(_codes.c.code == code)).first():
            return None
        db.execute(_users.update().where(_users.c.id == user_id).values(partner_id=partner_id))
        db.execute(_users.update().where(_users.c.id == partner_id).values(partner_id=user_id))
        db.execute(_codes.delete().where(_codes.c.user_id.in_([user_id, partner_id])))
        return _public(db.execute(select(_users).where(_users.c.id == partner_id)).mappings().one())


def revoke_token(token: str) -> None:
    with _transaction() as db:
        db.execute(_tokens.delete().where(_tokens.c.token == _token_hash(token)))


def unpair_user(user_id: int) -> bool:
    with _transaction() as db:
        partner_id = db.execute(select(_users.c.partner_id).where(_users.c.id == user_id)).scalar_one_or_none()
        if partner_id is None:
            return False
        db.execute(select(_users.c.id).where(_users.c.id.in_([user_id, partner_id])).order_by(_users.c.id).with_for_update()).all()
        db.execute(_users.update().where((_users.c.id == user_id) | ((_users.c.id == partner_id) & (_users.c.partner_id == user_id))).values(partner_id=None))
        db.execute(_codes.delete().where(_codes.c.user_id.in_([user_id, partner_id])))
    return True


def change_password(user_id: int, old_password: str, new_password: str, current_token: str) -> bool:
    with _transaction() as db:
        row = db.execute(select(_users).where(_users.c.id == user_id).with_for_update()).mappings().first()
        if not row or not verify_password(old_password, row["password_hash"]):
            return False
        db.execute(_users.update().where(_users.c.id == user_id).values(password_hash=hash_password(new_password)))
        db.execute(_tokens.delete().where(_tokens.c.user_id == user_id, _tokens.c.token != _token_hash(current_token)))
    return True
