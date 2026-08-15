"""Backend API tests for Déclic."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://dev-emergent-lab.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "declic-admin-2026")
OLD_ADMIN_TOKEN = "declic-createur-2025"
ADMIN_HEADERS = {"Content-Type": "application/json", "X-Admin-Token": ADMIN_TOKEN}
OLD_ADMIN_HEADERS = {"Content-Type": "application/json", "X-Admin-Token": OLD_ADMIN_TOKEN}

EXPECTED_MODES = {
    "qui-est-le-plus", "je-nai-jamais", "action-verite",
    "cash-ou-cash", "le-verdict", "tu-me-connais",
}


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# --- Health ---
def test_health(s):
    r = s.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "catalog_version" in body


# --- Catalog ---
def test_catalog_full(s):
    r = s.get(f"{API}/catalog", timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert "version" in body and "count" in body
    assert body["count"] >= 30, f"expected many cards, got {body['count']}"
    modes = {c["mode"] for c in body["cards"]}
    assert EXPECTED_MODES.issubset(modes), f"missing modes: {EXPECTED_MODES - modes}"
    assert isinstance(body["packs"], list)
    assert isinstance(body["presets"], list)
    assert isinstance(body["vibes"], list)


def test_catalog_no_premium(s):
    r = s.get(f"{API}/catalog", params={"include_premium": "false"}, timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert all(c["premium"] is False for c in body["cards"]), "premium leaked in non-premium catalog"


# --- Cards filters ---
def test_cards_filter_mode(s):
    r = s.get(f"{API}/cards", params={"mode": "je-nai-jamais"}, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert len(data) > 0
    assert all(c["mode"] == "je-nai-jamais" for c in data)


def test_cards_filter_premium(s):
    r = s.get(f"{API}/cards", params={"premium": "true"}, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert len(data) > 0
    assert all(c["premium"] is True for c in data)


# --- Admin auth ---
def test_admin_requires_token(s):
    assert s.post(f"{API}/admin/verify", timeout=10).status_code == 401
    assert s.post(f"{API}/cards", json={"mode": "je-nai-jamais", "texte": "x"}, timeout=10).status_code == 401


def test_admin_old_token_rejected(s):
    """OLD hardcoded token must no longer be accepted (rotated)."""
    r = s.post(f"{API}/admin/verify", headers=OLD_ADMIN_HEADERS, timeout=10)
    assert r.status_code == 401, f"OLD token should be rejected, got {r.status_code}"


def test_admin_verify_ok(s):
    r = s.post(f"{API}/admin/verify", headers=ADMIN_HEADERS, timeout=10)
    assert r.status_code == 200 and r.json()["ok"] is True


def test_admin_summary(s):
    r = s.get(f"{API}/admin/summary", headers=ADMIN_HEADERS, timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert "total" in body and "by_mode" in body


# --- CRUD (admin token) ---
class TestCardCRUD:
    def test_full_crud(self, s):
        payload = {
            "mode": "je-nai-jamais",
            "texte": "TEST_ Je n'ai jamais testé une API en 2026.",
            "intensite": 1,
            "tags_theme": ["general"],
        }
        r = s.post(f"{API}/cards", json=payload, headers=ADMIN_HEADERS, timeout=10)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["id"]
        assert created["source"] == "manual"
        cid = created["id"]

        r = s.put(f"{API}/cards/{cid}", json={"intensite": 3, "texte": "TEST_ updated"}, headers=ADMIN_HEADERS, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["intensite"] == 3

        r = s.delete(f"{API}/cards/{cid}", headers=ADMIN_HEADERS, timeout=10)
        assert r.status_code == 200
        assert r.json()["deleted"] == cid

        r = s.delete(f"{API}/cards/{cid}", headers=ADMIN_HEADERS, timeout=10)
        assert r.status_code == 404

    def test_update_nonexistent(self, s):
        r = s.put(f"{API}/cards/does-not-exist", json={"intensite": 2}, headers=ADMIN_HEADERS, timeout=10)
        assert r.status_code == 404


# --- Bulk + CSV import ---
def test_csv_import_and_cleanup(s):
    csv_text = (
        "mode,texte,intensite,premium,packs\n"
        "je-nai-jamais,ZZTEST import csv un,2,false,Coloc|Intég\n"
        "cash-ou-cash,ZZTEST option A // ZZTEST option B,3,,\n"
    )
    r = s.post(f"{API}/import/csv", json={"csv": csv_text}, headers=ADMIN_HEADERS, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["inserted"] == 2

    # find & cleanup
    r = s.get(f"{API}/admin/cards", params={"mode": "cash-ou-cash"}, headers=ADMIN_HEADERS, timeout=10)
    cards = [c for c in r.json() if c["texte"].startswith("ZZTEST")]
    assert cards and cards[0]["texte_b"] == "ZZTEST option B"
    r2 = s.get(f"{API}/admin/cards", params={"mode": "je-nai-jamais"}, headers=ADMIN_HEADERS, timeout=10)
    cards += [c for c in r2.json() if c["texte"].startswith("ZZTEST")]
    for c in cards:
        s.delete(f"{API}/cards/{c['id']}", headers=ADMIN_HEADERS, timeout=10)


# --- Packs ---
def test_packs(s):
    r = s.get(f"{API}/packs", timeout=10)
    assert r.status_code == 200
    packs = r.json()["packs"]
    for p in packs:
        assert "count" in p and "premium" in p and "label" in p


# --- Events ---
def test_event_log(s):
    r = s.post(f"{API}/events", json={"name": "test_event", "props": {"foo": "bar"}}, timeout=10)
    assert r.status_code == 200
    assert r.json()["logged"] is True
