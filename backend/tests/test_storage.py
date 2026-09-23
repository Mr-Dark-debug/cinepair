import os
import tempfile
import unittest
from unittest.mock import patch
from app import auth
from app.rtc import ice_configuration


class PersistenceTests(unittest.TestCase):
    def test_accounts_and_sessions_survive_engine_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {"DATABASE_URL": "", "DB_PATH": os.path.join(directory, "accounts.db")}), patch.object(auth, "_engine", None):
                try:
                    user = auth.register_user("Persistent", "password123")
                    token = auth.create_token(user["id"])
                    auth._engine.dispose()
                    auth._engine = None
                    self.assertEqual(auth.login_user("persistent", "password123")["id"], user["id"])
                    self.assertEqual(auth.get_user_by_token(token)["id"], user["id"])
                    auth.revoke_token(token)
                    self.assertIsNone(auth.get_user_by_token(token))
                finally:
                    if auth._engine is not None:
                        auth._engine.dispose()

    def test_turn_credentials_are_ephemeral_and_do_not_expose_shared_secret(self):
        with patch.dict(os.environ, {"TURN_URLS": "turn:relay.example.org:3478", "TURN_SHARED_SECRET": "server-only-secret"}), patch("app.rtc.time.time", return_value=1000):
            config = ice_configuration("participant")
        relay = config["iceServers"][1]
        self.assertEqual(relay["username"], "4600:participant")
        self.assertNotIn("server-only-secret", str(config))
        self.assertTrue(relay["credential"])
