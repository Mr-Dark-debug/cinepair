import os
import unittest

# In-memory DB for isolated tests (must be set before importing app).
os.environ["DB_PATH"] = ":memory:"

from fastapi.testclient import TestClient

from app.main import app
from app.auth import reset_for_tests


class AuthApiTests(unittest.TestCase):
    def setUp(self):
        reset_for_tests()
        self.client = TestClient(app)

    def _register(self, nickname="alice", password="password123"):
        return self.client.post(
            "/auth/register", json={"nickname": nickname, "password": password}
        )

    def test_register_login_me_roundtrip(self):
        r = self._register()
        self.assertEqual(r.status_code, 200, r.text)
        token = r.json()["token"]
        self.assertEqual(r.json()["user"]["nickname"], "alice")

        me = self.client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me.status_code, 200, me.text)
        self.assertEqual(me.json()["user"]["nickname"], "alice")

        r2 = self.client.post(
            "/auth/login", json={"nickname": "alice", "password": "password123"}
        )
        self.assertEqual(r2.status_code, 200, r2.text)
        self.assertIn("token", r2.json())

    def test_register_short_password_400(self):
        r = self.client.post("/auth/register", json={"nickname": "alice", "password": "short"})
        self.assertEqual(r.status_code, 400)

    def test_register_duplicate_nickname_409(self):
        self._register()
        r = self._register()
        self.assertEqual(r.status_code, 409)

    def test_login_bad_password_401(self):
        self._register()
        r = self.client.post(
            "/auth/login", json={"nickname": "alice", "password": "wrongpass"}
        )
        self.assertEqual(r.status_code, 401)

    def test_me_without_token_401(self):
        r = self.client.get("/auth/me")
        self.assertEqual(r.status_code, 401)

    def test_pairing_links_partners(self):
        r1 = self._register("alice", "password123")
        token1 = r1.json()["token"]
        r2 = self._register("bob", "password456")
        token2 = r2.json()["token"]

        code = self.client.post(
            "/auth/pair", headers={"Authorization": f"Bearer {token1}"}
        ).json()["pair_code"]

        confirm = self.client.post(
            "/auth/pair/confirm",
            json={"pair_code": code},
            headers={"Authorization": f"Bearer {token2}"},
        )
        self.assertEqual(confirm.status_code, 200, confirm.text)
        self.assertEqual(confirm.json()["partner"]["nickname"], "alice")

        me2 = self.client.get("/auth/me", headers={"Authorization": f"Bearer {token2}"}).json()
        self.assertEqual(me2["user"]["partner_id"], r1.json()["user"]["id"])


if __name__ == "__main__":
    unittest.main()
