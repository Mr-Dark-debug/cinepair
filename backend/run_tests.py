"""Run backend tests against an isolated in-memory account database."""

import os
import unittest

os.environ["DB_PATH"] = ":memory:"
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "")

suite = unittest.defaultTestLoader.discover("tests")
result = unittest.TextTestRunner(verbosity=2).run(suite)
raise SystemExit(not result.wasSuccessful())
