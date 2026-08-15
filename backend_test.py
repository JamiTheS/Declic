#!/usr/bin/env python3
"""
Comprehensive backend API test for Déclic content-management endpoints.
Tests auth guards, CRUD, CSV import, bulk operations, and public reads.
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8001/api"
ADMIN_TOKEN = "declic-createur-2025"
WRONG_TOKEN = "wrong-token-123"

# Track created card IDs for cleanup
created_card_ids = []

def log_test(name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   {details}")
    return passed

def test_auth_guard_without_token():
    """Test that write endpoints return 401 without token"""
    print("\n=== 1. AUTH GUARD - Without Token ===")
    
    endpoints = [
        ("POST", "/admin/verify", {}),
        ("POST", "/cards", {"mode": "je-nai-jamais", "texte": "test", "intensite": 1}),
        ("PUT", "/cards/fake-id", {"texte": "updated"}),
        ("DELETE", "/cards/fake-id", None),
        ("POST", "/cards/bulk", {"cards": []}),
        ("POST", "/import/csv", {"csv": "mode,texte\n"}),
        ("GET", "/admin/cards", None),
        ("GET", "/admin/summary", None),
    ]
    
    all_passed = True
    for method, path, body in endpoints:
        url = f"{BASE_URL}{path}"
        try:
            if method == "GET":
                resp = requests.get(url, timeout=10)
            elif method == "POST":
                resp = requests.post(url, json=body, timeout=10)
            elif method == "PUT":
                resp = requests.put(url, json=body, timeout=10)
            elif method == "DELETE":
                resp = requests.delete(url, timeout=10)
            
            passed = resp.status_code == 401
            all_passed &= log_test(
                f"{method} {path} without token returns 401",
                passed,
                f"Got {resp.status_code}" if not passed else ""
            )
        except Exception as e:
            all_passed = False
            log_test(f"{method} {path} without token", False, str(e))
    
    return all_passed

def test_auth_guard_with_wrong_token():
    """Test that write endpoints return 401 with wrong token"""
    print("\n=== 2. AUTH GUARD - With Wrong Token ===")
    
    headers = {"X-Admin-Token": WRONG_TOKEN}
    
    endpoints = [
        ("POST", "/admin/verify", {}),
        ("POST", "/cards", {"mode": "je-nai-jamais", "texte": "test", "intensite": 1}),
    ]
    
    all_passed = True
    for method, path, body in endpoints:
        url = f"{BASE_URL}{path}"
        try:
            if method == "POST":
                resp = requests.post(url, json=body, headers=headers, timeout=10)
            
            passed = resp.status_code == 401
            all_passed &= log_test(
                f"{method} {path} with wrong token returns 401",
                passed,
                f"Got {resp.status_code}" if not passed else ""
            )
        except Exception as e:
            all_passed = False
            log_test(f"{method} {path} with wrong token", False, str(e))
    
    return all_passed

def test_admin_verify_with_token():
    """Test POST /api/admin/verify with correct token"""
    print("\n=== 3. ADMIN VERIFY - With Correct Token ===")
    
    headers = {"X-Admin-Token": ADMIN_TOKEN}
    url = f"{BASE_URL}/admin/verify"
    
    try:
        resp = requests.post(url, headers=headers, timeout=10)
        data = resp.json()
        
        passed = resp.status_code == 200 and data.get("ok") == True
        return log_test(
            "POST /api/admin/verify with token returns {ok: true}",
            passed,
            f"Got {resp.status_code}: {data}" if not passed else ""
        )
    except Exception as e:
        return log_test("POST /api/admin/verify with token", False, str(e))

def test_crud_operations():
    """Test CRUD: POST, PUT, DELETE on /api/cards"""
    print("\n=== 4. CRUD OPERATIONS ===")
    
    headers = {"X-Admin-Token": ADMIN_TOKEN}
    all_passed = True
    
    # CREATE
    create_payload = {
        "mode": "je-nai-jamais",
        "texte": "QA temp card",
        "intensite": 1
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/cards", json=create_payload, headers=headers, timeout=10)
        data = resp.json()
        
        card_id = data.get("id")
        source = data.get("source")
        
        passed = (
            resp.status_code == 200 and
            card_id is not None and
            source == "manual" and
            data.get("texte") == "QA temp card"
        )
        all_passed &= log_test(
            "POST /api/cards creates card with source=manual",
            passed,
            f"Got {resp.status_code}: id={card_id}, source={source}" if not passed else f"Created card {card_id}"
        )
        
        if card_id:
            created_card_ids.append(card_id)
        
        if not card_id:
            return False
        
        # UPDATE
        update_payload = {
            "texte": "QA temp card UPDATED",
            "intensite": 3
        }
        
        resp = requests.put(f"{BASE_URL}/cards/{card_id}", json=update_payload, headers=headers, timeout=10)
        data = resp.json()
        
        passed = (
            resp.status_code == 200 and
            data.get("texte") == "QA temp card UPDATED" and
            data.get("intensite") == 3
        )
        all_passed &= log_test(
            "PUT /api/cards/{id} updates card",
            passed,
            f"Got {resp.status_code}: texte={data.get('texte')}, intensite={data.get('intensite')}" if not passed else ""
        )
        
        # DELETE (first time should succeed)
        resp = requests.delete(f"{BASE_URL}/cards/{card_id}", headers=headers, timeout=10)
        data = resp.json()
        
        passed = resp.status_code == 200 and data.get("deleted") == card_id
        all_passed &= log_test(
            "DELETE /api/cards/{id} deletes card",
            passed,
            f"Got {resp.status_code}: {data}" if not passed else ""
        )
        
        # Remove from cleanup list since we already deleted it
        if card_id in created_card_ids:
            created_card_ids.remove(card_id)
        
        # DELETE again (should return 404)
        resp = requests.delete(f"{BASE_URL}/cards/{card_id}", headers=headers, timeout=10)
        
        passed = resp.status_code == 404
        all_passed &= log_test(
            "DELETE /api/cards/{id} again returns 404",
            passed,
            f"Got {resp.status_code}" if not passed else ""
        )
        
        # PUT on non-existent ID (should return 404)
        resp = requests.put(f"{BASE_URL}/cards/non-existent-id-12345", json={"texte": "test"}, headers=headers, timeout=10)
        
        passed = resp.status_code == 404
        all_passed &= log_test(
            "PUT /api/cards/{non-existent-id} returns 404",
            passed,
            f"Got {resp.status_code}" if not passed else ""
        )
        
    except Exception as e:
        all_passed = False
        log_test("CRUD operations", False, str(e))
    
    return all_passed

def test_csv_import():
    """Test POST /api/import/csv with special parsing"""
    print("\n=== 5. CSV IMPORT ===")
    
    headers = {"X-Admin-Token": ADMIN_TOKEN}
    all_passed = True
    
    # CSV with je-nai-jamais and cash-ou-cash (with // split)
    csv_data = """mode,texte,intensite,premium,packs
je-nai-jamais,QA csv one,2,false,Coloc|Intég
cash-ou-cash,QA optA // QA optB,3,,"""
    
    payload = {"csv": csv_data}
    
    try:
        resp = requests.post(f"{BASE_URL}/import/csv", json=payload, headers=headers, timeout=10)
        data = resp.json()
        
        inserted = data.get("inserted", 0)
        
        passed = resp.status_code == 200 and inserted == 2
        all_passed &= log_test(
            "POST /api/import/csv imports 2 cards",
            passed,
            f"Got {resp.status_code}: inserted={inserted}, response={data}" if not passed else ""
        )
        
        # Verify the cash-ou-cash card has texte_b split correctly
        resp = requests.get(f"{BASE_URL}/admin/cards?mode=cash-ou-cash", headers=headers, timeout=10)
        cards = resp.json()
        
        qa_card = None
        for card in cards:
            if card.get("texte") == "QA optA":
                qa_card = card
                created_card_ids.append(card.get("id"))
                break
        
        if qa_card:
            texte_b = qa_card.get("texte_b")
            passed = texte_b == "QA optB"
            all_passed &= log_test(
                "CSV import: cash-ou-cash '//' split works (texte_b == 'QA optB')",
                passed,
                f"Got texte_b={texte_b}" if not passed else ""
            )
            
            packs = qa_card.get("packs", [])
            passed = isinstance(packs, list)
            all_passed &= log_test(
                "CSV import: packs parsed as list",
                passed,
                f"Got packs={packs} (type={type(packs)})" if not passed else ""
            )
        else:
            all_passed = False
            log_test("CSV import: find imported cash-ou-cash card", False, "Card not found")
        
        # Find and track the je-nai-jamais card
        resp = requests.get(f"{BASE_URL}/admin/cards?mode=je-nai-jamais", headers=headers, timeout=10)
        cards = resp.json()
        
        for card in cards:
            if card.get("texte") == "QA csv one":
                created_card_ids.append(card.get("id"))
                
                # Verify packs parsing
                packs = card.get("packs", [])
                passed = "Coloc" in packs and "Intég" in packs
                all_passed &= log_test(
                    "CSV import: packs '|' separator works (Coloc|Intég)",
                    passed,
                    f"Got packs={packs}" if not passed else ""
                )
                break
        
    except Exception as e:
        all_passed = False
        log_test("CSV import", False, str(e))
    
    return all_passed

def test_bulk_import():
    """Test POST /api/cards/bulk"""
    print("\n=== 6. BULK IMPORT ===")
    
    headers = {"X-Admin-Token": ADMIN_TOKEN}
    
    payload = {
        "cards": [
            {"mode": "action-verite", "texte": "QA bulk 1"},
            {"mode": "action-verite", "texte": "QA bulk 2"}
        ]
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/cards/bulk", json=payload, headers=headers, timeout=10)
        data = resp.json()
        
        inserted = data.get("inserted", 0)
        
        passed = resp.status_code == 200 and inserted == 2
        result = log_test(
            "POST /api/cards/bulk inserts 2 cards",
            passed,
            f"Got {resp.status_code}: inserted={inserted}" if not passed else ""
        )
        
        # Track created cards for cleanup
        if passed:
            resp = requests.get(f"{BASE_URL}/admin/cards?mode=action-verite", headers=headers, timeout=10)
            cards = resp.json()
            for card in cards:
                if card.get("texte") in ["QA bulk 1", "QA bulk 2"]:
                    created_card_ids.append(card.get("id"))
        
        return result
        
    except Exception as e:
        return log_test("Bulk import", False, str(e))

def test_admin_endpoints():
    """Test GET /api/admin/cards and GET /api/admin/summary"""
    print("\n=== 7. ADMIN ENDPOINTS ===")
    
    headers = {"X-Admin-Token": ADMIN_TOKEN}
    all_passed = True
    
    # GET /api/admin/cards
    try:
        resp = requests.get(f"{BASE_URL}/admin/cards", headers=headers, timeout=10)
        cards = resp.json()
        
        passed = resp.status_code == 200 and isinstance(cards, list)
        all_passed &= log_test(
            "GET /api/admin/cards with token returns list",
            passed,
            f"Got {resp.status_code}: {type(cards)}" if not passed else f"Returned {len(cards)} cards"
        )
    except Exception as e:
        all_passed = False
        log_test("GET /api/admin/cards", False, str(e))
    
    # GET /api/admin/summary
    try:
        resp = requests.get(f"{BASE_URL}/admin/summary", headers=headers, timeout=10)
        data = resp.json()
        
        passed = (
            resp.status_code == 200 and
            "total" in data and
            "manual" in data and
            "by_mode" in data
        )
        all_passed &= log_test(
            "GET /api/admin/summary with token returns summary",
            passed,
            f"Got {resp.status_code}: {data}" if not passed else f"Total: {data.get('total')}, Manual: {data.get('manual')}"
        )
    except Exception as e:
        all_passed = False
        log_test("GET /api/admin/summary", False, str(e))
    
    return all_passed

def test_public_reads():
    """Test that public endpoints work WITHOUT token"""
    print("\n=== 8. PUBLIC READS (No Token) ===")
    
    all_passed = True
    
    # GET /api/health
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=10)
        data = resp.json()
        
        passed = resp.status_code == 200 and data.get("status") == "ok"
        all_passed &= log_test(
            "GET /api/health works without token",
            passed,
            f"Got {resp.status_code}: {data}" if not passed else ""
        )
    except Exception as e:
        all_passed = False
        log_test("GET /api/health", False, str(e))
    
    # GET /api/catalog
    try:
        resp = requests.get(f"{BASE_URL}/catalog", timeout=10)
        data = resp.json()
        
        count = data.get("count", 0)
        
        passed = resp.status_code == 200 and count >= 149
        all_passed &= log_test(
            "GET /api/catalog works without token (count >= 149)",
            passed,
            f"Got {resp.status_code}: count={count}" if not passed else f"Count: {count}"
        )
    except Exception as e:
        all_passed = False
        log_test("GET /api/catalog", False, str(e))
    
    # GET /api/catalog?include_premium=false (no premium leaks)
    try:
        resp = requests.get(f"{BASE_URL}/catalog?include_premium=false", timeout=10)
        data = resp.json()
        
        cards = data.get("cards", [])
        has_premium = any(card.get("premium") for card in cards)
        
        passed = resp.status_code == 200 and not has_premium
        all_passed &= log_test(
            "GET /api/catalog?include_premium=false has no premium cards",
            passed,
            f"Found premium cards!" if not passed else ""
        )
    except Exception as e:
        all_passed = False
        log_test("GET /api/catalog?include_premium=false", False, str(e))
    
    # GET /api/cards?mode=je-nai-jamais
    try:
        resp = requests.get(f"{BASE_URL}/cards?mode=je-nai-jamais", timeout=10)
        cards = resp.json()
        
        passed = resp.status_code == 200 and isinstance(cards, list)
        all_passed &= log_test(
            "GET /api/cards?mode=je-nai-jamais works without token",
            passed,
            f"Got {resp.status_code}" if not passed else f"Returned {len(cards)} cards"
        )
    except Exception as e:
        all_passed = False
        log_test("GET /api/cards?mode=je-nai-jamais", False, str(e))
    
    # GET /api/packs
    try:
        resp = requests.get(f"{BASE_URL}/packs", timeout=10)
        data = resp.json()
        
        passed = resp.status_code == 200 and "packs" in data
        all_passed &= log_test(
            "GET /api/packs works without token",
            passed,
            f"Got {resp.status_code}" if not passed else ""
        )
    except Exception as e:
        all_passed = False
        log_test("GET /api/packs", False, str(e))
    
    # POST /api/events
    try:
        payload = {"name": "qa", "props": {}}
        resp = requests.post(f"{BASE_URL}/events", json=payload, timeout=10)
        data = resp.json()
        
        passed = resp.status_code == 200 and data.get("logged") == True
        all_passed &= log_test(
            "POST /api/events works without token",
            passed,
            f"Got {resp.status_code}: {data}" if not passed else ""
        )
    except Exception as e:
        all_passed = False
        log_test("POST /api/events", False, str(e))
    
    return all_passed

def test_airtable_auth_guards():
    """Test that Airtable endpoints return 401 without/with wrong token"""
    print("\n=== 9. AIRTABLE AUTH GUARDS ===")
    
    all_passed = True
    
    # Test without token
    print("\n  Without token:")
    endpoints = [
        ("POST", "/admin/sync", {}),
        ("GET", "/admin/airtable-info", None),
        ("DELETE", "/admin/airtable/rec_dummy_id", None),
    ]
    
    for method, path, body in endpoints:
        url = f"{BASE_URL}{path}"
        try:
            if method == "GET":
                resp = requests.get(url, timeout=10)
            elif method == "POST":
                resp = requests.post(url, json=body, timeout=10)
            elif method == "DELETE":
                resp = requests.delete(url, timeout=10)
            
            passed = resp.status_code == 401
            all_passed &= log_test(
                f"{method} {path} without token returns 401",
                passed,
                f"Got {resp.status_code}" if not passed else ""
            )
        except Exception as e:
            all_passed = False
            log_test(f"{method} {path} without token", False, str(e))
    
    # Test with wrong token
    print("\n  With wrong token:")
    headers = {"X-Admin-Token": WRONG_TOKEN}
    
    for method, path, body in endpoints:
        url = f"{BASE_URL}{path}"
        try:
            if method == "GET":
                resp = requests.get(url, headers=headers, timeout=10)
            elif method == "POST":
                resp = requests.post(url, json=body, headers=headers, timeout=10)
            elif method == "DELETE":
                resp = requests.delete(url, headers=headers, timeout=10)
            
            passed = resp.status_code == 401
            all_passed &= log_test(
                f"{method} {path} with wrong token returns 401",
                passed,
                f"Got {resp.status_code}" if not passed else ""
            )
        except Exception as e:
            all_passed = False
            log_test(f"{method} {path} with wrong token", False, str(e))
    
    return all_passed

def test_airtable_info():
    """Test GET /api/admin/airtable-info with correct token"""
    print("\n=== 10. AIRTABLE INFO ===")
    
    headers = {"X-Admin-Token": ADMIN_TOKEN}
    url = f"{BASE_URL}/admin/airtable-info"
    
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        data = resp.json()
        
        expected_base_id = "app0soKINsLh37gUg"
        expected_table_id = "tblgbeNjwNwITYUGv"
        expected_edit_url = f"https://airtable.com/{expected_base_id}/{expected_table_id}"
        
        passed = (
            resp.status_code == 200 and
            data.get("configured") == True and
            data.get("base_id") == expected_base_id and
            data.get("table_id") == expected_table_id and
            data.get("edit_url") == expected_edit_url
        )
        
        return log_test(
            "GET /api/admin/airtable-info returns correct config",
            passed,
            f"Got {resp.status_code}: {json.dumps(data, indent=2)}" if not passed else f"Config: {json.dumps(data, indent=2)}"
        )
    except Exception as e:
        return log_test("GET /api/admin/airtable-info", False, str(e))

def test_airtable_sync():
    """Test POST /api/admin/sync with correct token"""
    print("\n=== 11. AIRTABLE SYNC ===")
    
    headers = {"X-Admin-Token": ADMIN_TOKEN}
    url = f"{BASE_URL}/admin/sync"
    
    try:
        resp = requests.post(url, headers=headers, timeout=30)
        data = resp.json()
        
        fetched = data.get("fetched", 0)
        synced = data.get("synced", 0)
        active = data.get("active", 0)
        skipped = data.get("skipped", 0)
        
        passed = (
            resp.status_code == 200 and
            data.get("ok") == True and
            fetched == synced and  # fetched and synced should be equal
            fetched == 149 and  # should be around 149
            active == 149 and  # active should be 149
            skipped == 0  # no skipped records
        )
        
        return log_test(
            "POST /api/admin/sync returns correct sync result",
            passed,
            f"Got {resp.status_code}: {json.dumps(data, indent=2)}" if not passed else f"Sync result: fetched={fetched}, synced={synced}, active={active}, skipped={skipped}"
        )
    except Exception as e:
        return log_test("POST /api/admin/sync", False, str(e))

def test_catalog_after_sync():
    """Test GET /api/catalog after sync to verify all modes present"""
    print("\n=== 12. CATALOG AFTER SYNC ===")
    
    all_passed = True
    
    try:
        # Get catalog without token (public endpoint)
        resp = requests.get(f"{BASE_URL}/catalog", timeout=10)
        data = resp.json()
        
        count = data.get("count", 0)
        cards = data.get("cards", [])
        
        # Check count equals synced number (~149)
        passed = resp.status_code == 200 and count == 149
        all_passed &= log_test(
            "GET /api/catalog count equals synced number (149)",
            passed,
            f"Got count={count}" if not passed else f"Count: {count}"
        )
        
        # Check all 7 modes are present
        expected_modes = [
            "qui-est-le-plus",
            "je-nai-jamais",
            "action-verite",
            "cash-ou-cash",
            "le-verdict",
            "tu-me-connais",
            "hot"
        ]
        
        modes_in_catalog = set(card.get("mode") for card in cards)
        
        for mode in expected_modes:
            passed = mode in modes_in_catalog
            all_passed &= log_test(
                f"Catalog contains mode '{mode}'",
                passed,
                f"Mode '{mode}' not found in catalog" if not passed else ""
            )
        
        # Test include_premium=false doesn't include premium cards
        resp = requests.get(f"{BASE_URL}/catalog?include_premium=false", timeout=10)
        data = resp.json()
        cards = data.get("cards", [])
        has_premium = any(card.get("premium") for card in cards)
        
        passed = not has_premium
        all_passed &= log_test(
            "GET /api/catalog?include_premium=false excludes premium cards",
            passed,
            "Found premium cards when include_premium=false" if not passed else ""
        )
        
    except Exception as e:
        all_passed = False
        log_test("Catalog after sync", False, str(e))
    
    return all_passed

def test_public_reads_after_sync():
    """Test public reads still work after Airtable sync"""
    print("\n=== 13. PUBLIC READS AFTER SYNC ===")
    
    all_passed = True
    
    # GET /api/health
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=10)
        data = resp.json()
        
        passed = resp.status_code == 200 and data.get("status") == "ok"
        all_passed &= log_test(
            "GET /api/health works without token",
            passed,
            f"Got {resp.status_code}: {data}" if not passed else ""
        )
    except Exception as e:
        all_passed = False
        log_test("GET /api/health", False, str(e))
    
    # GET /api/cards?mode=hot (should return only hot cards)
    try:
        resp = requests.get(f"{BASE_URL}/cards?mode=hot", timeout=10)
        cards = resp.json()
        
        all_hot = all(card.get("mode") == "hot" for card in cards)
        
        passed = resp.status_code == 200 and isinstance(cards, list) and all_hot
        all_passed &= log_test(
            "GET /api/cards?mode=hot returns only hot cards",
            passed,
            f"Got {resp.status_code}, found non-hot cards" if not passed else f"Returned {len(cards)} hot cards"
        )
    except Exception as e:
        all_passed = False
        log_test("GET /api/cards?mode=hot", False, str(e))
    
    # GET /api/packs
    try:
        resp = requests.get(f"{BASE_URL}/packs", timeout=10)
        data = resp.json()
        
        passed = resp.status_code == 200 and "packs" in data
        all_passed &= log_test(
            "GET /api/packs works without token",
            passed,
            f"Got {resp.status_code}" if not passed else ""
        )
    except Exception as e:
        all_passed = False
        log_test("GET /api/packs", False, str(e))
    
    # POST /api/events
    try:
        payload = {"name": "qa", "props": {}}
        resp = requests.post(f"{BASE_URL}/events", json=payload, timeout=10)
        data = resp.json()
        
        passed = resp.status_code == 200 and data.get("logged") == True
        all_passed &= log_test(
            "POST /api/events works without token",
            passed,
            f"Got {resp.status_code}: {data}" if not passed else ""
        )
    except Exception as e:
        all_passed = False
        log_test("POST /api/events", False, str(e))
    
    return all_passed

def cleanup_test_cards():
    """Delete all QA test cards"""
    print("\n=== 14. CLEANUP ===")
    
    headers = {"X-Admin-Token": ADMIN_TOKEN}
    
    # Get all cards and find any with "QA " in texte
    try:
        resp = requests.get(f"{BASE_URL}/admin/cards", headers=headers, timeout=10)
        all_cards = resp.json()
        
        qa_cards = [card for card in all_cards if card.get("texte", "").startswith("QA ")]
        
        print(f"Found {len(qa_cards)} QA test cards to delete")
        
        deleted_count = 0
        for card in qa_cards:
            card_id = card.get("id")
            if card_id:
                try:
                    resp = requests.delete(f"{BASE_URL}/cards/{card_id}", headers=headers, timeout=10)
                    if resp.status_code == 200:
                        deleted_count += 1
                        print(f"   Deleted: {card.get('texte')} (id: {card_id})")
                except Exception as e:
                    print(f"   Failed to delete {card_id}: {e}")
        
        log_test(f"Deleted {deleted_count} QA test cards", True)
        
        # Verify final catalog count
        resp = requests.get(f"{BASE_URL}/catalog", timeout=10)
        data = resp.json()
        final_count = data.get("count", 0)
        
        passed = final_count == 149
        return log_test(
            "Final catalog count == 149",
            passed,
            f"Got count={final_count}" if not passed else ""
        )
        
    except Exception as e:
        return log_test("Cleanup", False, str(e))

def main():
    print("=" * 60)
    print("Déclic Backend API Test Suite - Airtable Integration")
    print("=" * 60)
    
    results = []
    
    # Run all tests (prioritizing Airtable tests as per review request)
    results.append(("Airtable Auth Guards", test_airtable_auth_guards()))
    results.append(("Airtable Info", test_airtable_info()))
    results.append(("Airtable Sync", test_airtable_sync()))
    results.append(("Catalog After Sync", test_catalog_after_sync()))
    results.append(("Public Reads After Sync", test_public_reads_after_sync()))
    
    # Original content-management tests (kept for regression)
    results.append(("Auth Guard - Without Token", test_auth_guard_without_token()))
    results.append(("Auth Guard - Wrong Token", test_auth_guard_with_wrong_token()))
    results.append(("Admin Verify", test_admin_verify_with_token()))
    results.append(("CRUD Operations", test_crud_operations()))
    results.append(("CSV Import", test_csv_import()))
    results.append(("Bulk Import", test_bulk_import()))
    results.append(("Admin Endpoints", test_admin_endpoints()))
    results.append(("Public Reads", test_public_reads()))
    results.append(("Cleanup", cleanup_test_cards()))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} test groups passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test group(s) failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())
