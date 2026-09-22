import asyncio
import json
import unittest

from fastapi.testclient import TestClient

from app.main import (
    app,
    room_manager,
    sio,
    chat_limiter,
    reaction_limiter,
    on_chat_message,
    on_set_watch_source,
    on_sync_update,
)


class RoomStateTests(unittest.TestCase):
    def setUp(self):
        room_manager.rooms.clear()
        room_manager.sid_to_room.clear()
        chat_limiter._hits.clear()
        reaction_limiter._hits.clear()

    def _make_room(self, password=None):
        return room_manager.create_room("host-sid", "Host", password=password)

    def test_password_never_exposed_in_room_state(self):
        room = self._make_room(password="secret123")
        dumped = room.model_dump()
        serialized = json.dumps(dumped)

        self.assertNotIn("secret123", serialized)
        self.assertNotIn("password", dumped["settings"])
        self.assertTrue(dumped["settings"]["has_password"])

    def test_room_without_password_has_password_false(self):
        room = self._make_room(password=None)
        self.assertFalse(room.settings.has_password)

    def test_password_hash_is_not_plaintext(self):
        self._make_room(password="secret123")
        raw = room_manager.rooms[list(room_manager.rooms)[0]]
        stored = raw["password_hash"]
        self.assertIsNotNone(stored)
        self.assertNotIn("secret123", stored)
        self.assertIn("$", stored)

    def test_http_sources_and_healthz(self):
        with TestClient(app) as client:
            r = client.get("/healthz")
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.json(), {"status": "ok"})
            s = client.get("/sources")
            self.assertEqual(s.status_code, 200)
            providers = [x["provider"] for x in s.json()["sources"]]
            self.assertIn("youtube", providers)
            self.assertIn("direct", providers)


class SocketEventTests(unittest.TestCase):
    def setUp(self):
        room_manager.rooms.clear()
        room_manager.sid_to_room.clear()
        chat_limiter._hits.clear()
        reaction_limiter._hits.clear()

    def _capture(self):
        captured = []

        async def fake_emit(event, data, **kwargs):
            captured.append((event, data))

        return fake_emit, captured

    def _run(self, coro):
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()

    def _make_room_with_peer(self):
        room = room_manager.create_room("host-sid", "Host")
        room_manager.join_room(room.code, "peer-sid", "Peer")
        return room

    def test_encrypted_chat_relay_shape(self):
        room = self._make_room_with_peer()
        fake_emit, captured = self._capture()
        orig = sio.emit
        sio.emit = fake_emit
        try:
            res = self._run(on_chat_message("host-sid", {
                "room_code": room.code,
                "encrypted": True,
                "iv": "base64iv==",
                "ciphertext": "base64ct==",
            }))
        finally:
            sio.emit = orig

        self.assertTrue(res["success"], res)
        event, msg = captured[0]
        self.assertEqual(event, "chat_message")
        self.assertTrue(msg["encrypted"])
        self.assertEqual(msg["iv"], "base64iv==")
        self.assertEqual(msg["ciphertext"], "base64ct==")
        self.assertNotIn("text", msg)

    def test_encrypted_chat_rejects_missing_fields(self):
        room = self._make_room_with_peer()
        fake_emit, _ = self._capture()
        orig = sio.emit
        sio.emit = fake_emit
        try:
            res = self._run(on_chat_message("host-sid", {
                "room_code": room.code, "encrypted": True, "iv": "only-iv"
            }))
        finally:
            sio.emit = orig
        self.assertFalse(res["success"])

    def test_plaintext_chat_backward_compat(self):
        room = self._make_room_with_peer()
        fake_emit, captured = self._capture()
        orig = sio.emit
        sio.emit = fake_emit
        try:
            res = self._run(on_chat_message("host-sid", {
                "room_code": room.code, "text": "hello there"
            }))
        finally:
            sio.emit = orig
        self.assertTrue(res["success"], res)
        _, msg = captured[0]
        self.assertEqual(msg["text"], "hello there")
        self.assertNotIn("encrypted", msg)

    def test_watch_source_and_sync(self):
        room = self._make_room_with_peer()
        fake_emit, captured = self._capture()
        orig = sio.emit
        sio.emit = fake_emit
        try:
            res = self._run(on_set_watch_source("host-sid", {
                "room_code": room.code,
                "source": {"provider": "youtube", "video_id": "dQw4w9WgXcQ", "title": "Test"},
            }))
            self.assertTrue(res["success"], res)
            res2 = self._run(on_sync_update("host-sid", {
                "room_code": room.code, "position": 42.0, "playing": True, "rate": 1.0
            }))
            self.assertTrue(res2["success"], res2)
        finally:
            sio.emit = orig

        events = [e for e, _ in captured]
        self.assertIn("watch_source_set", events)
        self.assertIn("sync_state", events)

        room2 = room_manager.get_room_state(room.code)
        self.assertEqual(room2.watch_source["video_id"], "dQw4w9WgXcQ")
        self.assertEqual(room2.sync_state["position"], 42.0)
        self.assertTrue(room2.sync_state["playing"])

    def test_chat_rate_limit(self):
        room = self._make_room_with_peer()
        sid = "spammer-sid"
        room_manager.join_room(room.code, sid, "Spammer")

        fake_emit, _ = self._capture()
        orig = sio.emit
        sio.emit = fake_emit
        results = []
        try:
            for i in range(11):  # limit is 10 per 10s
                results.append(self._run(on_chat_message(sid, {
                    "room_code": room.code, "text": f"msg {i}"
                })))
        finally:
            sio.emit = orig

        self.assertTrue(results[0]["success"])
        self.assertFalse(results[-1]["success"])
        self.assertEqual(results[-1].get("error"), "Rate limited.")


if __name__ == "__main__":
    unittest.main()
