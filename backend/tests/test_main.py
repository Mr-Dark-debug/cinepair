import unittest

from fastapi.testclient import TestClient

from app.main import app, room_manager


class SignalingApiTests(unittest.TestCase):
    def setUp(self):
        room_manager.rooms.clear()
        room_manager.sid_to_room.clear()
        self.client = TestClient(app)

    def test_root_supports_head_requests(self):
        response = self.client.head("/")

        self.assertEqual(response.status_code, 200)

    def test_stats_reports_only_aggregate_room_counts(self):
        room_manager.create_room(admin_sid="host-1", nickname="Host")

        response = self.client.get("/stats")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "active_rooms": 1,
                "active_participants": 1,
                "waiting_guests": 0,
            },
        )


if __name__ == "__main__":
    unittest.main()
