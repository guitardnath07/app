"""End-to-end backend tests for CityPulse API.

Covers: auth, places, deals, favorites, planner, itineraries, stats, weather.
Uses seeded Bearer token (test_session_citypulse / user_test001).
"""
import os
import time
import requests
import pytest

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://day-planner-243.preview.emergentagent.com").rstrip("/")
TOKEN = "test_session_citypulse"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# -------- auth
class TestAuth:
    def test_me_unauthorized(self, s):
        r = s.get(f"{BASE}/api/auth/me")
        assert r.status_code == 401

    def test_me_ok(self, s):
        r = s.get(f"{BASE}/api/auth/me", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["user_id"] == "user_test001"
        assert d["email"] == "test.user@example.com"


# -------- places
class TestPlaces:
    def test_list_places(self, s):
        r = s.get(f"{BASE}/api/places", headers=AUTH)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 10
        p = data[0]
        for k in ("id", "name", "category", "is_open", "today_hours", "is_favorite", "deals_count"):
            assert k in p

    def test_filter_query_and_category(self, s):
        r = s.get(f"{BASE}/api/places", headers=AUTH, params={"q": "chocolat"})
        assert r.status_code == 200
        assert any("chocolat" in p["name"].lower() for p in r.json())
        r2 = s.get(f"{BASE}/api/places", headers=AUTH, params={"category": "resto,bar"})
        assert r2.status_code == 200
        assert all(p["category"] in ("resto", "bar") for p in r2.json())

    def test_filter_price_and_deals(self, s):
        r = s.get(f"{BASE}/api/places", headers=AUTH, params={"price": 2})
        assert r.status_code == 200
        assert all(p["price_level"] == 2 for p in r.json())
        r2 = s.get(f"{BASE}/api/places", headers=AUTH, params={"deals": "true"})
        assert r2.status_code == 200
        assert all(p["deals_count"] >= 1 for p in r2.json())

    def test_get_place_detail(self, s):
        r = s.get(f"{BASE}/api/places/musee-beaux-arts", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == "musee-beaux-arts"
        assert isinstance(d["week_hours"], list) and len(d["week_hours"]) == 7
        assert isinstance(d["deals"], list)

    def test_get_place_404(self, s):
        r = s.get(f"{BASE}/api/places/does-not-exist", headers=AUTH)
        assert r.status_code == 404


# -------- deals
class TestDeals:
    def test_list_deals(self, s):
        r = s.get(f"{BASE}/api/deals", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert len(d) >= 10
        # flash should come first
        assert d[0]["type"] == "flash"

    def test_filter_type(self, s):
        for t in ("flash", "etudiant", "groupe", "permanent"):
            r = s.get(f"{BASE}/api/deals", headers=AUTH, params={"type": t})
            assert r.status_code == 200
            data = r.json()
            assert all(x["type"] == t for x in data), f"Filter {t} failed"

    def test_claim_idempotent(self, s):
        r1 = s.post(f"{BASE}/api/deals/d-petitpat-20/claim", headers=AUTH)
        assert r1.status_code == 200
        code1 = r1.json()["code"]
        assert code1.startswith("CP-")
        r2 = s.post(f"{BASE}/api/deals/d-petitpat-20/claim", headers=AUTH)
        assert r2.status_code == 200
        assert r2.json()["code"] == code1

    def test_claim_404(self, s):
        r = s.post(f"{BASE}/api/deals/doesnt/claim", headers=AUTH)
        assert r.status_code == 404


# -------- favorites
class TestFavorites:
    def test_toggle_twice(self, s):
        pid = "cathedrale-saint-gatien"
        r1 = s.post(f"{BASE}/api/favorites/{pid}", headers=AUTH)
        assert r1.status_code == 200
        state1 = r1.json()["is_favorite"]
        r2 = s.post(f"{BASE}/api/favorites/{pid}", headers=AUTH)
        assert r2.status_code == 200
        assert r2.json()["is_favorite"] != state1

    def test_add_then_list_then_remove(self, s):
        pid = "halles-tours"
        # ensure added
        r = s.post(f"{BASE}/api/favorites/{pid}", headers=AUTH)
        if not r.json()["is_favorite"]:
            r = s.post(f"{BASE}/api/favorites/{pid}", headers=AUTH)
        assert r.json()["is_favorite"] is True
        lst = s.get(f"{BASE}/api/favorites", headers=AUTH).json()
        assert any(p["id"] == pid for p in lst)
        # cleanup
        s.post(f"{BASE}/api/favorites/{pid}", headers=AUTH)

    def test_favorite_unknown_place(self, s):
        r = s.post(f"{BASE}/api/favorites/nope", headers=AUTH)
        assert r.status_code == 404


# -------- planner
class TestPlanner:
    def test_generate_no_ai(self, s):
        body = {"budget": 60, "people": 2, "start": "10:00", "end": "19:00",
                "weather": "sun", "mode": "walk", "interests": ["culture", "gourmand"],
                "student": False, "seed": 42, "with_ai": False}
        r = s.post(f"{BASE}/api/planner/generate", headers=AUTH, json=body)
        assert r.status_code == 200
        plan = r.json()
        assert plan["ai"] is None
        assert plan["totals"]["final_total"] <= body["budget"] + 0.01
        # chronological steps
        starts = [st["start"] for st in plan["steps"]]
        assert starts == sorted(starts)
        # within budget flag
        assert plan["totals"]["within_budget"] is True

    def test_generate_with_ai(self, s):
        body = {"budget": 80, "people": 2, "start": "11:00", "end": "22:00",
                "weather": "sun", "mode": "walk", "interests": ["culture"],
                "student": False, "seed": 7, "with_ai": True}
        r = s.post(f"{BASE}/api/planner/generate", headers=AUTH, json=body, timeout=40)
        assert r.status_code == 200
        plan = r.json()
        assert plan["ai"] is not None
        assert plan["ai"]["title"]
        assert isinstance(plan["ai"]["tips"], list)

    def test_invalid_params(self, s):
        r = s.post(f"{BASE}/api/planner/generate", headers=AUTH,
                   json={"budget": -5, "people": 1, "with_ai": False})
        assert r.status_code == 400

    def test_pinned_and_excludes_swap(self, s):
        base = {"budget": 100, "people": 2, "start": "10:00", "end": "22:00",
                "weather": "sun", "mode": "walk", "interests": ["culture"],
                "student": False, "seed": 11, "with_ai": False}
        r1 = s.post(f"{BASE}/api/planner/generate", headers=AUTH, json=base).json()
        if not r1["steps"]:
            pytest.skip("empty plan")
        step0 = r1["steps"][0]
        if step0["kind"] != "place":
            pytest.skip("first step not a place")
        orig = step0["place"]["id"]
        # exclude step 0
        base["excludes"] = {"0": [orig]}
        r2 = s.post(f"{BASE}/api/planner/generate", headers=AUTH, json=base).json()
        if r2["steps"] and r2["steps"][0]["kind"] == "place":
            assert r2["steps"][0]["place"]["id"] != orig


# -------- itineraries
class TestItineraries:
    def test_crud(self, s):
        plan = s.post(f"{BASE}/api/planner/generate", headers=AUTH,
                      json={"budget": 50, "people": 1, "with_ai": False, "seed": 3}).json()
        r = s.post(f"{BASE}/api/itineraries", headers=AUTH,
                   json={"name": "TEST_itin", "plan": plan, "ai": None})
        assert r.status_code == 200
        it_id = r.json()["id"]
        lst = s.get(f"{BASE}/api/itineraries", headers=AUTH).json()
        assert any(i["id"] == it_id for i in lst)
        single = s.get(f"{BASE}/api/itineraries/{it_id}", headers=AUTH)
        assert single.status_code == 200
        assert single.json()["name"] == "TEST_itin"
        d = s.delete(f"{BASE}/api/itineraries/{it_id}", headers=AUTH)
        assert d.status_code == 200
        g = s.get(f"{BASE}/api/itineraries/{it_id}", headers=AUTH)
        assert g.status_code == 404


# -------- stats & weather
class TestMisc:
    def test_stats(self, s):
        r = s.get(f"{BASE}/api/me/stats", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_saved", "total_spent", "itineraries_count", "claims_count",
                  "favorites_count", "monthly"):
            assert k in d
        assert len(d["monthly"]) == 6

    def test_weather(self, s):
        r = s.get(f"{BASE}/api/weather", headers=AUTH)
        assert r.status_code == 200
        d = r.json()
        assert d["city"] == "Tours"
        assert d["condition"] in ("sun", "rain", "cold")
