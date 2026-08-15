"""Admin auth + cards CRUD backend tests for Déclic.

Verifies the ADMIN_TOKEN guard on /api/admin/* and /api/cards write endpoints
after the ADMIN_TOKEN env fix (declic-admin-2026).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or "http://localhost:8001"
ADMIN_TOKEN = "declic-admin-2026"
BAD_TOKEN = "not-the-right-token"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_headers():
    return {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}


# --------------------- /api/admin/verify ---------------------

class TestAdminVerify:
    def test_verify_with_good_token(self, api, auth_headers):
        r = api.post(f"{BASE_URL}/api/admin/verify", headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True

    def test_verify_with_bad_token(self, api):
        r = api.post(
            f"{BASE_URL}/api/admin/verify",
            headers={"X-Admin-Token": BAD_TOKEN, "Content-Type": "application/json"},
        )
        assert r.status_code == 401, r.text

    def test_verify_without_header(self, api):
        # Must be 401 (jeton invalide), NOT 503 (env not configured)
        r = api.post(f"{BASE_URL}/api/admin/verify")
        assert r.status_code == 401, r.text
        assert r.status_code != 503


# --------------------- /api/admin/summary + /api/admin/cards ---------------------

class TestAdminReadEndpoints:
    def test_admin_summary_ok(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/admin/summary", headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "total" in body and isinstance(body["total"], int)
        assert "premium" in body and isinstance(body["premium"], int)
        assert "by_mode" in body and isinstance(body["by_mode"], dict)

    def test_admin_summary_unauthorized(self, api):
        r = api.get(f"{BASE_URL}/api/admin/summary")
        assert r.status_code == 401

    def test_admin_cards_ok(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/admin/cards", headers=auth_headers)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)


# --------------------- /api/cards CRUD ---------------------

class TestCardCrud:
    created_id = None

    def test_create_card_ok(self, api, auth_headers):
        payload = {
            "mode": "je-nai-jamais",
            "texte": "TEST_never have I ever tested this endpoint",
            "intensite": 2,
            "tags_theme": ["general"],
            "premium": False,
            "actif": True,
        }
        r = api.post(f"{BASE_URL}/api/cards", headers=auth_headers, json=payload)
        assert r.status_code == 200, r.text
        card = r.json()
        assert card["source"] == "manual"
        assert card["texte"] == payload["texte"]
        assert card["mode"] == payload["mode"]
        assert "id" in card and card["id"]
        TestCardCrud.created_id = card["id"]

        # Verify persistence via GET /api/admin/cards
        r2 = api.get(f"{BASE_URL}/api/admin/cards", headers=auth_headers)
        assert r2.status_code == 200
        ids = [c["id"] for c in r2.json()]
        assert card["id"] in ids

    def test_create_card_unauthorized(self, api):
        payload = {"mode": "je-nai-jamais", "texte": "TEST_should not create"}
        # no header
        r = api.post(f"{BASE_URL}/api/cards", json=payload,
                     headers={"Content-Type": "application/json"})
        assert r.status_code == 401
        # bad token
        r2 = api.post(f"{BASE_URL}/api/cards", json=payload,
                      headers={"X-Admin-Token": BAD_TOKEN, "Content-Type": "application/json"})
        assert r2.status_code == 401

    def test_update_card_ok(self, api, auth_headers):
        assert TestCardCrud.created_id, "create_card_ok must run first"
        cid = TestCardCrud.created_id
        r = api.put(
            f"{BASE_URL}/api/cards/{cid}",
            headers=auth_headers,
            json={"texte": "TEST_updated text", "intensite": 4},
        )
        assert r.status_code == 200, r.text
        card = r.json()
        assert card["texte"] == "TEST_updated text"
        assert card["intensite"] == 4
        assert card["id"] == cid

    def test_update_card_unauthorized(self, api):
        cid = TestCardCrud.created_id or "does-not-matter"
        r = api.put(
            f"{BASE_URL}/api/cards/{cid}",
            headers={"Content-Type": "application/json"},
            json={"texte": "nope"},
        )
        assert r.status_code == 401

    def test_delete_card_ok(self, api, auth_headers):
        assert TestCardCrud.created_id, "create_card_ok must run first"
        cid = TestCardCrud.created_id
        r = api.delete(f"{BASE_URL}/api/cards/{cid}", headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("deleted") == cid

        # Verify deletion — deleting again should 404
        r2 = api.delete(f"{BASE_URL}/api/cards/{cid}", headers=auth_headers)
        assert r2.status_code == 404

    def test_delete_card_unauthorized(self, api):
        r = api.delete(
            f"{BASE_URL}/api/cards/some-id",
            headers={"X-Admin-Token": BAD_TOKEN},
        )
        assert r.status_code == 401
