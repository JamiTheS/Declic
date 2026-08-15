"""Backend tests for Airtable configuration + sync (source of truth for Déclic catalog).

Endpoints under test:
- GET  /api/admin/airtable-info   (auth: X-Admin-Token)
- POST /api/admin/sync            (auth: X-Admin-Token)
- GET  /api/catalog               (public)
- GET  /api/cards?actif=true      (public)
- GET  /api/admin/cards           (auth: X-Admin-Token) — check airtable_id presence
"""
import os
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")).rstrip("/")
ADMIN_TOKEN = "declic-admin-2026"
EXPECTED_BASE_ID = "app0soKINsLh37gUg"
EXPECTED_TABLE_ID = "tblgbeNjwNwITYUGv"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_headers():
    return {"X-Admin-Token": ADMIN_TOKEN, "Content-Type": "application/json"}


# --------------------------- /api/admin/airtable-info ---------------------------


class TestAirtableInfo:
    def test_airtable_info_ok_with_token(self, api, admin_headers):
        r = api.get(f"{BASE_URL}/api/admin/airtable-info", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("configured") is True
        assert data.get("base_id") == EXPECTED_BASE_ID
        assert data.get("table_id") == EXPECTED_TABLE_ID
        assert data.get("edit_url") is not None
        assert EXPECTED_BASE_ID in data["edit_url"]
        assert EXPECTED_TABLE_ID in data["edit_url"]

    def test_airtable_info_without_token_401(self, api):
        r = api.get(f"{BASE_URL}/api/admin/airtable-info", timeout=30)
        assert r.status_code == 401, r.text

    def test_airtable_info_bad_token_401(self, api):
        r = api.get(
            f"{BASE_URL}/api/admin/airtable-info",
            headers={"X-Admin-Token": "wrong-token"},
            timeout=30,
        )
        assert r.status_code == 401, r.text


# --------------------------- /api/admin/sync ---------------------------


class TestAirtableSync:
    def test_sync_without_token_401(self, api):
        r = api.post(f"{BASE_URL}/api/admin/sync", timeout=60)
        assert r.status_code == 401, r.text

    def test_sync_ok_and_populates_catalog(self, api, admin_headers):
        r = api.post(f"{BASE_URL}/api/admin/sync", headers=admin_headers, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert isinstance(data.get("fetched"), int) and data["fetched"] > 0
        assert isinstance(data.get("synced"), int) and data["synced"] > 0
        assert isinstance(data.get("active"), int) and data["active"] > 0
        # Store rough size for the next test
        pytest.airtable_synced = data["synced"]
        pytest.airtable_active = data["active"]
        pytest.airtable_fetched = data["fetched"]


# --------------------------- /api/catalog (public) ---------------------------


class TestCatalog:
    def test_catalog_public_returns_synced_cards(self, api):
        r = api.get(f"{BASE_URL}/api/catalog", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        count = data.get("count")
        cards = data.get("cards", [])
        assert isinstance(count, int) and count > 0
        assert len(cards) == count
        # After a fresh sync, all cards should come from Airtable
        airtable_cards = [c for c in cards if c.get("source") == "airtable"]
        assert len(airtable_cards) > 0, "No cards with source=airtable in /api/catalog"
        # Roughly aligned with the sync result (~357 expected)
        expected_active = getattr(pytest, "airtable_active", None)
        if expected_active is not None:
            assert count == expected_active, (
                f"/api/catalog count ({count}) != sync active ({expected_active})"
            )

    def test_catalog_cards_have_required_fields(self, api):
        r = api.get(f"{BASE_URL}/api/catalog", timeout=30)
        assert r.status_code == 200
        cards = r.json().get("cards", [])
        assert cards, "Empty catalog"
        sample = cards[0]
        for field in ("id", "mode", "texte", "actif", "source"):
            assert field in sample, f"Missing field '{field}' in card: {sample}"

    def test_cards_endpoint_actif_true(self, api):
        r = api.get(f"{BASE_URL}/api/cards", params={"actif": "true"}, timeout=30)
        assert r.status_code == 200, r.text
        cards = r.json()
        assert isinstance(cards, list) and len(cards) > 0
        for c in cards[:20]:
            assert c.get("actif") is True


# --------------------------- Airtable IDs (via /api/admin/cards) ---------------------------


class TestAirtableIdPersistence:
    def test_admin_cards_have_airtable_id(self, api, admin_headers):
        r = api.get(f"{BASE_URL}/api/admin/cards", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        cards = r.json()
        assert isinstance(cards, list) and len(cards) > 0
        airtable_cards = [c for c in cards if c.get("source") == "airtable"]
        assert len(airtable_cards) > 0, "No source=airtable cards in /api/admin/cards"
        with_id = [c for c in airtable_cards if c.get("airtable_id")]
        # Every airtable-sourced card must carry its record id
        assert len(with_id) == len(airtable_cards), (
            f"Only {len(with_id)}/{len(airtable_cards)} airtable cards have airtable_id"
        )
        # Airtable record IDs start with 'rec'
        assert all(c["airtable_id"].startswith("rec") for c in with_id[:20])

    def test_admin_cards_without_token_401(self, api):
        r = api.get(f"{BASE_URL}/api/admin/cards", timeout=30)
        assert r.status_code == 401, r.text
