import unittest

from fastapi.testclient import TestClient

from app.main import app


class HealthzTests(unittest.TestCase):
    def test_healthz_returns_ok(self):
        with TestClient(app) as client:
            response = client.get("/healthz")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})


if __name__ == "__main__":
    unittest.main()
