import asyncio
import base64
import unittest
from unittest.mock import AsyncMock, patch

from app.main import (
    room_manager, sio, on_chat_message, on_request_sync,
    on_set_watch_source, on_sync_update, on_share_screenshot,
    on_join_room, on_signal, on_send_reaction,
)
from app.watch_sources import validate_source, validate_sync


class WatchSourceValidationTests(unittest.TestCase):
    def test_only_supported_source_shapes_are_accepted(self):
        self.assertEqual(validate_source({"provider": "youtube", "video_id": "M7lc1UVf-VE"}),
                         {"provider": "youtube", "video_id": "M7lc1UVf-VE"})
        self.assertEqual(validate_source({"provider": "direct", "url": "https://example.org/video.mp4"})["provider"], "direct")
        for source in (
            {"provider": "youtube", "video_id": "bad"},
            {"provider": "direct", "url": "javascript:alert(1)"},
            {"provider": "direct", "url": "https://evil.example/youtube.com/movie"},
            {"provider": "vimeo", "video_id": "<script>"},
            {"provider": "unknown"},
        ):
            with self.subTest(source=source), self.assertRaises(ValueError):
                validate_source(source)

    def test_non_finite_or_out_of_range_sync_is_rejected(self):
        for position, rate in (("nan", 1), ("inf", 1), (-1, 1), (0, "inf"), (0, 10)):
            with self.subTest(position=position, rate=rate), self.assertRaises(ValueError):
                validate_sync(position, rate)


class RoomLifecycleTests(unittest.TestCase):
    def setUp(self):
        room_manager.rooms.clear()
        room_manager.sid_to_room.clear()

    def run_event(self, event):
        return asyncio.run(event)

    def test_last_admitted_member_leaving_closes_waiting_room(self):
        room = room_manager.create_room("host", "Host", require_approval=True)
        self.assertEqual(room_manager.join_room(room.code, "waiting", "Guest")[1], "waiting")
        room_manager.remove_participant("host")
        self.assertNotIn(room.code, room_manager.rooms)
        self.assertNotIn("waiting", room_manager.sid_to_room)

    def test_malformed_events_return_errors(self):
        for data in (None, [], {"room_code": None}, {"room_code": "ABC123", "nickname": 7}):
            with self.subTest(data=data):
                self.assertFalse(self.run_event(on_join_room("invalid", data))["success"])

    def test_waiting_guests_cannot_signal_or_react_before_admission(self):
        room = room_manager.create_room("host", "Host", require_approval=True)
        room_manager.join_room(room.code, "waiting", "Guest")
        with patch.object(sio, "emit", new_callable=AsyncMock) as emit:
            self.run_event(on_signal("waiting", {"room_code": room.code, "target_id": "host", "signal": {"candidate": {}}}))
            self.run_event(on_send_reaction("waiting", {"room_code": room.code, "emoji": "❤️"}))
            emit.assert_not_awaited()

    def test_switching_video_discards_old_sync_position(self):
        room = room_manager.create_room("host", "Host")
        room_manager.set_watch_source(room.code, {"provider": "youtube", "video_id": "M7lc1UVf-VE"})
        room_manager.update_sync_state(room.code, 40, True, 1, "host")
        room_manager.set_watch_source(room.code, {"provider": "direct", "url": "https://example.org/video.mp4"})
        self.assertIsNone(room_manager.get_sync_state(room.code))

    def test_unjoined_socket_cannot_request_sync(self):
        room = room_manager.create_room("host", "Host")
        result = self.run_event(on_request_sync("stranger", {"room_code": room.code}))
        self.assertFalse(result["success"])

    def test_invalid_video_selection_does_not_change_room(self):
        room = room_manager.create_room("host", "Host")
        result = self.run_event(on_set_watch_source("host", {
            "room_code": room.code, "source": {"provider": "youtube", "video_id": "broken"}
        }))
        self.assertFalse(result["success"])
        self.assertIsNone(room_manager.get_room_state(room.code).watch_source)

    def test_sync_requires_supported_source_and_finite_position(self):
        room = room_manager.create_room("host", "Host")
        payload = {"room_code": room.code, "position": 10, "rate": 1, "playing": True}
        self.assertFalse(self.run_event(on_sync_update("host", payload))["success"])
        room_manager.set_watch_source(room.code, {"provider": "youtube", "video_id": "M7lc1UVf-VE"})
        self.assertFalse(self.run_event(on_sync_update("host", {**payload, "position": "nan"}))["success"])
        self.assertIsNone(room_manager.get_sync_state(room.code))

    def test_protected_chat_rejects_plaintext_and_plain_images(self):
        room = room_manager.create_room("host", "Host", password="secret123")
        plain = self.run_event(on_chat_message("host", {"room_code": room.code, "text": "private"}))
        image = self.run_event(on_share_screenshot("host", {"room_code": room.code, "image_data": "data:image/png;base64,AA=="}))
        self.assertFalse(plain["success"])
        self.assertFalse(image["success"])
        # The server relays a syntactically valid encrypted payload without seeing the text.
        original_emit = sio.emit
        received = []

        async def capture(event, data, **kwargs):
            received.append((event, data))

        sio.emit = capture
        try:
            encrypted = self.run_event(on_chat_message("host", {
                "room_code": room.code,
                "encrypted": True,
                "iv": base64.b64encode(bytes(12)).decode(),
                "ciphertext": base64.b64encode(bytes(32)).decode(),
            }))
        finally:
            sio.emit = original_emit
        self.assertTrue(encrypted["success"])
        self.assertNotIn("text", received[0][1])


if __name__ == "__main__":
    unittest.main()
