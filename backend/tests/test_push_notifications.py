"""Backend tests for the new Emergent-managed push notification endpoints.

Covers:
  * POST /api/register-push
      - 422 on missing body fields (Pydantic validation)
      - 500 with clean detail 'EMERGENT_PUSH_KEY missing or invalid' (relay
        returns 401 because EMERGENT_PUSH_KEY=placeholder in preview). Must NOT
        crash / 502 / return a stacktrace.
  * POST /api/admin/broadcast
      - 401 when X-Admin-Token header is missing
      - 401 when the token is wrong
      - 200 + {sent:0, recipients:0} when authenticated (no devices registered)
      - 422 when required body fields missing
  * Non-regression: /api/health returns catalog_version 3, /api/catalog still
    returns ~357 cards, /api/admin/verify and /api/admin/summary still work.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://dev-emergent-lab.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "declic-admin-2026")
ADMIN_HEADERS = {"Content-Type": "application/json", "X-Admin-Token": ADMIN_TOKEN}


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# --------------------------- /api/register-push ---------------------------


class TestRegisterPush:
    def test_missing_body_returns_422(self, s):
        r = s.post(f"{API}/register-push", json={}, timeout=10)
        assert r.status_code == 422, r.text

    def test_missing_field_returns_422(self, s):
        # device_token missing
        r = s.post(
            f"{API}/register-push",
            json={"user_id": "TEST_dev-1", "platform": "android"},
            timeout=10,
        )
        assert r.status_code == 422, r.text

    def test_placeholder_key_returns_clean_500(self, s):
        """EMERGENT_PUSH_KEY=placeholder -> relay 401 -> we translate to 500
        with detail 'EMERGENT_PUSH_KEY missing or invalid'. This is EXPECTED in
        preview and must be a clean JSON error, not a crash / 502."""
        r = s.post(
            f"{API}/register-push",
            json={
                "user_id": "TEST_dev-1",
                "platform": "android",
                "device_token": "TEST_token_abcdef",
            },
            timeout=15,
        )
        assert r.status_code == 500, f"expected 500 (relay auth failure), got {r.status_code}: {r.text}"
        # Must be clean JSON with 'detail'
        body = r.json()
        assert "detail" in body, f"no 'detail' in body: {body}"
        assert body["detail"] == "EMERGENT_PUSH_KEY missing or invalid", body


# --------------------------- /api/admin/broadcast ---------------------------


class TestAdminBroadcast:
    payload = {"title": "TEST_ Rejoins la partie", "message": "TEST_ On lance une soirée ?"}

    def test_no_token_returns_401(self, s):
        r = s.post(f"{API}/admin/broadcast", json=self.payload, timeout=10)
        assert r.status_code == 401, r.text

    def test_wrong_token_returns_401(self, s):
        r = s.post(
            f"{API}/admin/broadcast",
            json=self.payload,
            headers={"Content-Type": "application/json", "X-Admin-Token": "not-the-token"},
            timeout=10,
        )
        assert r.status_code == 401, r.text

    def test_valid_token_returns_zero_recipients(self, s):
        r = s.post(f"{API}/admin/broadcast", json=self.payload, headers=ADMIN_HEADERS, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "sent" in body and "recipients" in body, body
        assert isinstance(body["sent"], int) and isinstance(body["recipients"], int)
        # No devices registered in preview -> zeros
        assert body["recipients"] == 0, body
        assert body["sent"] == 0, body

    def test_missing_fields_returns_422(self, s):
        r = s.post(f"{API}/admin/broadcast", json={"title": "only-title"}, headers=ADMIN_HEADERS, timeout=10)
        assert r.status_code == 422, r.text

    def test_accepts_optional_action_url(self, s):
        r = s.post(
            f"{API}/admin/broadcast",
            json={**self.payload, "action_url": "declic://home"},
            headers=ADMIN_HEADERS,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["recipients"] == 0 and body["sent"] == 0


# --------------------------- Non-regression ---------------------------


class TestNonRegression:
    def test_health_catalog_version(self, s):
        r = s.get(f"{API}/health", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert body["catalog_version"] == 3, f"expected catalog_version=3, got {body.get('catalog_version')}"

    def test_catalog_still_returns_many_cards(self, s):
        r = s.get(f"{API}/catalog", timeout=15)
        assert r.status_code == 200
        body = r.json()
        # Spec says ~357 cards; allow a small margin
        assert body["count"] >= 300, f"catalog shrank: {body['count']}"
        assert body["version"] == 3

    def test_admin_verify_still_works(self, s):
        r = s.post(f"{API}/admin/verify", headers=ADMIN_HEADERS, timeout=10)
        assert r.status_code == 200 and r.json()["ok"] is True

    def test_admin_summary_still_works(self, s):
        r = s.get(f"{API}/admin/summary", headers=ADMIN_HEADERS, timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "total" in body and "by_mode" in body
        assert body.get("catalog_version") == 3
