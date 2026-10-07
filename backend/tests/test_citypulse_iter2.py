"""Iteration 2 backend tests for CityPulse.
New features: email/password auth, profile update, change-password, delete account,
finance endpoint, transit-stops, minor filtering on places/deals/claim/places/{id},
planner minor-safe (no bars/clubs/night slots).
"""
import os
import uuid
import time
import requests
import pytest
from datetime import date, timedelta

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL",
                     "https://day-planner-243.preview.emergentagent.com").rstrip("/")
GOOGLE_TOKEN = "test_session_citypulse"  # seeded Google user_test001


def mkmail():
    return f"TEST_{uuid.uuid4().hex[:10]}@example.com"


def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------------------------------------------------------- email/password auth
class TestEmailAuth:
    def setup_method(self):
        self.c = s()
        self.email = mkmail()
        self.pw = "Motdepasse1"

    def test_register_login_me(self):
        # register
        r = self.c.post(f"{BASE}/api/auth/register",
                        json={"email": self.email, "password": self.pw,
                              "first_name": "Alice", "last_name": "Durand"})
        assert r.status_code == 201, r.text
        body = r.json()
        token = body["session_token"]
        assert body["user"]["email"] == self.email.lower()
        assert body["user"]["has_password"] is True
        # me returns new fields
        me = self.c.get(f"{BASE}/api/auth/me",
                        headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        d = me.json()
        for k in ("age", "age_group", "has_password", "preferences", "auth_providers"):
            assert k in d
        assert d["age"] is None  # no birthdate yet
        assert d["age_group"] == "unknown"
        # duplicate -> 409
        r2 = self.c.post(f"{BASE}/api/auth/register",
                         json={"email": self.email, "password": self.pw,
                               "first_name": "Alice"})
        assert r2.status_code == 409
        # short password -> 422
        r3 = self.c.post(f"{BASE}/api/auth/register",
                         json={"email": mkmail(), "password": "short",
                               "first_name": "Bob"})
        assert r3.status_code == 422

        # login wrong pw
        r4 = self.c.post(f"{BASE}/api/auth/login",
                         json={"email": self.email, "password": "wrongpass9"})
        assert r4.status_code == 401

        # login ok
        r5 = self.c.post(f"{BASE}/api/auth/login",
                         json={"email": self.email, "password": self.pw})
        assert r5.status_code == 200
        assert r5.json()["user"]["email"] == self.email.lower()

        # cleanup
        self.c.delete(f"{BASE}/api/me",
                      headers={"Authorization": f"Bearer {token}"})


# ---------------------------------------------------------- profile + change pw + delete
class TestProfileFlow:
    def _register(self, c):
        email = mkmail()
        pw = "Motdepasse1"
        r = c.post(f"{BASE}/api/auth/register",
                   json={"email": email, "password": pw,
                         "first_name": "Carol", "last_name": "Y"})
        assert r.status_code == 201
        return r.json()["session_token"], email, pw

    def test_profile_update_and_birthdate_validation(self):
        c = s()
        tok, email, pw = self._register(c)
        H = {"Authorization": f"Bearer {tok}"}
        # invalid date
        r = c.patch(f"{BASE}/api/me/profile", headers=H,
                    json={"birthdate": "not-a-date"})
        assert r.status_code == 400
        # future date
        future = (date.today() + timedelta(days=10)).isoformat()
        r = c.patch(f"{BASE}/api/me/profile", headers=H,
                    json={"birthdate": future})
        assert r.status_code == 400
        # valid: 1998 -> age_group adult/young
        r = c.patch(f"{BASE}/api/me/profile", headers=H,
                    json={"birthdate": "1998-05-14",
                          "phone": "0601020304",
                          "preferences": {"interests": ["culture", "gourmand"],
                                           "music": ["jazz"],
                                           "diet": ["vege"]}})
        assert r.status_code == 200
        d = r.json()
        assert d["phone"] == "0601020304"
        assert d["age"] is not None and d["age"] >= 25
        assert d["age_group"] in ("young", "adult")
        assert set(d["preferences"]["interests"]) == {"culture", "gourmand"}
        # cleanup
        c.delete(f"{BASE}/api/me", headers=H)

    def test_change_password_requires_current(self):
        c = s()
        tok, email, pw = self._register(c)
        H = {"Authorization": f"Bearer {tok}"}
        # missing current
        r = c.post(f"{BASE}/api/auth/change-password", headers=H,
                   json={"new_password": "Nouveau1234"})
        assert r.status_code == 400
        # wrong current
        r = c.post(f"{BASE}/api/auth/change-password", headers=H,
                   json={"current_password": "wrong1234", "new_password": "Nouveau1234"})
        assert r.status_code == 400
        # same as current -> 400
        r = c.post(f"{BASE}/api/auth/change-password", headers=H,
                   json={"current_password": pw, "new_password": pw})
        assert r.status_code == 400
        # ok
        new_pw = "Nouveau1234"
        r = c.post(f"{BASE}/api/auth/change-password", headers=H,
                   json={"current_password": pw, "new_password": new_pw})
        assert r.status_code == 200
        # old pw login fails
        assert c.post(f"{BASE}/api/auth/login",
                     json={"email": email, "password": pw}).status_code == 401
        # new pw login works
        lr = c.post(f"{BASE}/api/auth/login",
                    json={"email": email, "password": new_pw})
        assert lr.status_code == 200
        # cleanup
        c.delete(f"{BASE}/api/me", headers=H)

    def test_delete_account(self):
        c = s()
        tok, email, pw = self._register(c)
        H = {"Authorization": f"Bearer {tok}"}
        r = c.delete(f"{BASE}/api/me", headers=H)
        assert r.status_code == 200
        # token invalidated
        me = c.get(f"{BASE}/api/auth/me", headers=H)
        assert me.status_code == 401
        # cannot login
        lr = c.post(f"{BASE}/api/auth/login",
                    json={"email": email, "password": pw})
        assert lr.status_code == 401


# ---------------------------------------------------------- finance + transit
class TestFinanceAndTransit:
    H = {"Authorization": f"Bearer {GOOGLE_TOKEN}"}

    def test_transit_stops(self):
        r = requests.get(f"{BASE}/api/transit-stops")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        st = data[0]
        for k in ("id", "name", "type", "lat", "lng"):
            assert k in st
        types = {x["type"] for x in data}
        assert types & {"tram", "bus", "velo"}

    def test_finance_contains_savings_ratio_and_tx(self):
        c = s()
        # make sure at least one itinerary saved
        plan = c.post(f"{BASE}/api/planner/generate", headers=self.H,
                      json={"budget": 80, "people": 2, "with_ai": False, "seed": 101}).json()
        it = c.post(f"{BASE}/api/itineraries", headers=self.H,
                    json={"name": "TEST_finance", "plan": plan, "ai": None}).json()
        try:
            r = c.get(f"{BASE}/api/me/finance", headers=self.H)
            assert r.status_code == 200
            d = r.json()
            for k in ("total_saved", "total_spent", "savings_ratio",
                      "monthly", "transactions"):
                assert k in d
            assert isinstance(d["savings_ratio"], (int, float))
            assert isinstance(d["transactions"], list)
            # at least one tx should link to our itinerary
            assert any(tx["itinerary_id"] == it["id"] for tx in d["transactions"])
        finally:
            c.delete(f"{BASE}/api/itineraries/{it['id']}", headers=self.H)


# ---------------------------------------------------------- minor user filtering
class TestMinor:
    def _make_minor(self, c):
        tok = c.post(f"{BASE}/api/auth/register",
                     json={"email": mkmail(), "password": "Motdepasse1",
                           "first_name": "Teen"}).json()["session_token"]
        H = {"Authorization": f"Bearer {tok}"}
        bd = (date.today() - timedelta(days=365 * 15)).isoformat()
        r = c.patch(f"{BASE}/api/me/profile", headers=H, json={"birthdate": bd})
        assert r.status_code == 200
        assert r.json()["age_group"] == "minor"
        return tok, H

    def test_places_hide_adult_for_minor(self):
        c = s()
        tok, H = self._make_minor(c)
        try:
            r = c.get(f"{BASE}/api/places", headers=H)
            assert r.status_code == 200
            cats = {p["category"] for p in r.json()}
            # bars/clubs excluded for minors
            assert "bar" not in cats
            assert "club" not in cats
        finally:
            c.delete(f"{BASE}/api/me", headers=H)

    def test_adult_place_detail_403_for_minor(self):
        c = s()
        tok, H = self._make_minor(c)
        try:
            # find any bar via adult account
            full = requests.get(f"{BASE}/api/places",
                                headers={"Authorization": f"Bearer {GOOGLE_TOKEN}"}).json()
            bar = next((p for p in full if p["category"] in ("bar", "club")), None)
            if not bar:
                pytest.skip("no adult place seeded")
            r = c.get(f"{BASE}/api/places/{bar['id']}", headers=H)
            assert r.status_code == 403
        finally:
            c.delete(f"{BASE}/api/me", headers=H)

    def test_deals_filter_and_claim_403_for_minor(self):
        c = s()
        tok, H = self._make_minor(c)
        try:
            # deals exclude adult-place deals
            deals = c.get(f"{BASE}/api/deals", headers=H).json()
            full_places = {p["id"]: p for p in requests.get(
                f"{BASE}/api/places",
                headers={"Authorization": f"Bearer {GOOGLE_TOKEN}"}).json()}
            for d in deals:
                if d["place_id"] and d["place_id"] in full_places:
                    assert full_places[d["place_id"]]["category"] not in ("bar", "club")
            # find an adult deal via adult session
            all_deals = requests.get(
                f"{BASE}/api/deals",
                headers={"Authorization": f"Bearer {GOOGLE_TOKEN}"}).json()
            adult_deal = next((d for d in all_deals
                               if d["place_id"] in full_places
                               and full_places[d["place_id"]]["category"] in ("bar", "club")),
                              None)
            if adult_deal:
                r = c.post(f"{BASE}/api/deals/{adult_deal['id']}/claim", headers=H)
                assert r.status_code == 403
        finally:
            c.delete(f"{BASE}/api/me", headers=H)

    def test_planner_minor_no_bar_or_night(self):
        c = s()
        tok, H = self._make_minor(c)
        try:
            r = c.post(f"{BASE}/api/planner/generate", headers=H,
                       json={"budget": 80, "people": 1, "start": "10:00",
                             "end": "23:30", "weather": "sun", "mode": "walk",
                             "interests": [], "with_ai": False, "seed": 55})
            assert r.status_code == 200
            plan = r.json()
            for st in plan["steps"]:
                if st.get("kind") == "place":
                    cat = (st.get("place") or {}).get("category")
                    assert cat not in ("bar", "club"), f"minor got {cat}"
                lbl = (st.get("slot_label") or "").lower()
                assert "soir" not in lbl and "nuit" not in lbl, f"minor got slot {lbl}"
        finally:
            c.delete(f"{BASE}/api/me", headers=H)


# ---------------------------------------------------------- google user password set
class TestGoogleUserSetPassword:
    def test_google_user_can_set_password_without_current(self):
        """user_test001 is google-only. Changing password without current should work
        once (has_password==False). We then revert by deleting the hash via another
        change. Here we only validate the first branch using a NEW google-like user.
        To avoid altering seeded test user permanently, we use the register-based
        user flow instead: create user with password, then simulate 'no password'
        branch by deleting password_hash via Mongo is not available here.
        Simpler: just verify current API: for seeded google user, has_password is
        False and changing password without current_password succeeds (200)."""
        c = s()
        H = {"Authorization": f"Bearer {GOOGLE_TOKEN}"}
        me = c.get(f"{BASE}/api/auth/me", headers=H).json()
        if me.get("has_password"):
            pytest.skip("seeded google user already has password")
        r = c.post(f"{BASE}/api/auth/change-password", headers=H,
                   json={"new_password": "TempPass1234"})
        assert r.status_code == 200
        # verify login now works for that user
        lr = c.post(f"{BASE}/api/auth/login",
                    json={"email": me["email"], "password": "TempPass1234"})
        assert lr.status_code == 200
        # restore seeded user to google-only state
        try:
            from dotenv import load_dotenv
            load_dotenv("/app/backend/.env")
            from pymongo import MongoClient
            m = MongoClient(os.environ["MONGO_URL"])
            db = m[os.environ["DB_NAME"]]
            db.users.update_one({"user_id": "user_test001"},
                                {"$unset": {"password_hash": ""},
                                 "$set": {"auth_providers": ["google"]}})
            db.user_sessions.delete_many({"user_id": "user_test001",
                                          "kind": "password_jwt"})
        except Exception as e:
            print("restore failed:", e)
