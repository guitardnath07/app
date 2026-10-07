"""Itinerary generation algorithm for CityPulse."""
import math
import random
from datetime import datetime, timezone

from data import PLACES, DEALS, ADULT_CATEGORIES

ORIGIN = {"name": "Place Jean Jaurès", "lat": 47.3905, "lng": 0.6890}
PLACES_BY_ID = {p["id"]: p for p in PLACES}
TICKET_PRICE = 1.70  # Fil Bleu


def parse_hour(s: str) -> float:
    h, m = s.split(":")
    return int(h) + int(m) / 60


def fmt_hour(h: float) -> str:
    total = int(round(h * 60)) % (24 * 60)
    return f"{total // 60:02d}:{total % 60:02d}"


def haversine_km(a, b) -> float:
    r = 6371
    la1, lo1, la2, lo2 = map(math.radians, [a["lat"], a["lng"], b["lat"], b["lng"]])
    d = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(d))


def compute_travel(src, dst, mode: str, people: int):
    km = round(haversine_km(src, dst) * 1.3, 2)
    lines = []
    cost = 0.0
    eff_mode = mode
    if mode == "transit" and km < 0.8:
        eff_mode = "walk"
    if eff_mode == "walk":
        minutes = km / 4.8 * 60
    elif eff_mode == "bike":
        minutes = km / 14 * 60 + 2
        lines = ["VélOcité"]
    elif eff_mode == "car":
        minutes = km / 22 * 60 + 7
        cost = round(km * 0.35 + 2.0, 2)
    else:  # transit
        minutes = km / 16 * 60 + 6
        lines = [t["line"] for t in dst.get("transports", []) if t["type"] in ("tram", "bus")][:2] or ["Bus 2"]
        cost = round(TICKET_PRICE * people, 2)
    minutes = max(3, int(math.ceil(minutes)))
    return {"mode": eff_mode, "duration_min": minutes, "distance_km": km, "lines": lines, "cost": cost,
            "from_name": src.get("name", "")}


def is_open_at(place, weekday: int, hour: float, stay: float) -> bool:
    for day_offset in (0, -1):
        rng = place["hours"][(weekday + day_offset) % 7]
        if not rng:
            continue
        o, c = rng
        h = hour + (24 if day_offset == -1 else 0)
        if o <= h and h + stay <= c:
            return True
    return False


def applicable_deals(place_id: str, people: int, student: bool):
    now = datetime.now(timezone.utc)
    out = []
    for d in DEALS:
        if d["place_id"] != place_id or d["kind"] != "promo":
            continue
        if d["type"] == "etudiant" and not student:
            continue
        if people < d.get("min_people", 1):
            continue
        if d["expires_at"] and datetime.fromisoformat(d["expires_at"]) < now:
            continue
        out.append(d)
    return out


def best_deal(place_id, people, student):
    deals = applicable_deals(place_id, people, student)
    return max(deals, key=lambda d: d["discount_pct"]) if deals else None


SLOT_CATEGORIES = {
    "activite": ["culture", "loisirs", "commerce"],
    "dejeuner": ["resto", "fastfood"],
    "diner": ["resto", "fastfood"],
    "cadeau": ["fleuriste"],
    "soiree": ["bar"],
    "nuit": ["club"],
}
SLOT_LABELS = {
    "activite": "Activité", "cadeau": "Bouquet", "dejeuner": "Déjeuner", "diner": "Dîner", "soiree": "Soirée", "nuit": "Nuit",
}


def place_summary(p):
    return {"id": p["id"], "name": p["name"], "category": p["category"], "image": p["images"][0],
            "address": p["address"], "lat": p["lat"], "lng": p["lng"], "rating": p["rating"],
            "indoor": p["indoor"], "price_level": p["price_level"]}


def build_plan(params: dict) -> dict:
    budget = float(params["budget"])
    people = max(1, int(params["people"]))
    start = parse_hour(params["start"])
    end = parse_hour(params["end"])
    if end <= start:
        end += 24
    weather = params.get("weather", "sun")
    mode = params.get("mode", "walk")
    interests = set(params.get("interests") or [])
    student = bool(params.get("student", False))
    pinned = params.get("pinned") or []
    excludes = {int(k): set(v) for k, v in (params.get("excludes") or {}).items()}
    rng = random.Random(params.get("seed", 1))
    weekday = datetime.now().weekday()
    group = params.get("age_group") or "unknown"
    minor = group == "minor"

    t = start
    prev = ORIGIN
    remaining = budget
    used = set()
    steps = []
    lunch_done = dinner_done = club_done = False
    gift_done = people != 2
    idx = 0
    while t < end - 0.5 and idx < 16:
        if not lunch_done and t >= 14:
            lunch_done = True
        if not dinner_done and t >= 21.5:
            dinner_done = True
        if not lunch_done and t >= 11.75:
            slot = "dejeuner"
        elif not dinner_done and (t >= 19 or (people == 2 and gift_done and t >= 18.5)):
            slot = "diner"
        elif not gift_done and 17 <= t < 19 and (not dinner_done) and end >= 19.5:
            slot = "cadeau"
        elif t >= 22.5 and "fete" in interests and not club_done and not minor and group != "senior":
            slot = "nuit"
        elif not minor and (t >= 21 or (t >= 17.5 and "fete" in interests)):
            slot = "soiree"
        else:
            slot = "activite"

        cats = SLOT_CATEGORIES[slot]
        candidates = []
        for p in PLACES:
            if minor and p["category"] in ADULT_CATEGORIES:
                continue
            if p["category"] not in cats or p["id"] in used or p["id"] in excludes.get(idx, set()):
                continue
            if weather in ("rain", "cold") and not p["indoor"]:
                continue
            travel = compute_travel(prev, p, mode, people)
            arrival = t + travel["duration_min"] / 60
            stay = min(p["duration_min"] / 60, end - arrival)
            min_stay = 0.3 if slot == "cadeau" else 0.5
            if stay < min_stay or not is_open_at(p, weekday, arrival, min(stay, 0.75)):
                continue
            full = round(p["avg_price"] * people, 2)
            deal = best_deal(p["id"], people, student)
            final = round(full * (1 - deal["discount_pct"] / 100), 2) if deal else full
            if final + travel["cost"] > remaining:
                continue
            # keep budget for the rest of the day: soft cap per step
            slots_left = max(1.0, (end - t) / 1.75)
            weight = 1.8 if slot in ("dejeuner", "diner") else 1.0
            over_cap = final + travel["cost"] > remaining / slots_left * weight * 1.6
            score = p["rating"] + 3 * len(interests & set(p["tags"])) + rng.random() * 2.5
            score -= (final / max(budget, 1)) * 4 + travel["duration_min"] / 15
            if weather == "sun" and not p["indoor"]:
                score += 1.5
            if deal:
                score += 1
            if p["category"] == "fastfood":
                score += 1.5 if budget / people < 35 else -1.5
            if group == "young" and (p["category"] in ADULT_CATEGORIES or "fete" in p["tags"] or p["price_level"] == 1):
                score += 1.5
            elif group == "senior":
                score += 1.5 if ("detente" in p["tags"] or p["category"] == "culture") else 0
                score -= 2 if p["category"] == "club" or (p["category"] == "loisirs" and "fete" in p["tags"]) else 0
            elif group == "minor" and (p["category"] in ("loisirs", "culture") or "sport" in p["tags"]):
                score += 1.5
            if slot == "activite" and p["category"] == "commerce" and not (15.5 <= t <= 17.5):
                score -= 2
            if over_cap:
                score -= 50
            if idx < len(pinned) and pinned[idx] == p["id"]:
                score += 1000
            candidates.append((score, p, travel, arrival, stay, full, final, deal))

        if candidates:
            candidates.sort(key=lambda c: c[0], reverse=True)
            _, p, travel, arrival, stay, full, final, deal = candidates[0]
            used.add(p["id"])
            remaining -= final + travel["cost"]
            steps.append({
                "index": idx, "kind": "place", "slot": slot, "slot_label": SLOT_LABELS[slot],
                "start": fmt_hour(arrival), "end": fmt_hour(arrival + stay),
                "title": p["name"], "place": place_summary(p),
                "full_price": full, "final_price": final,
                "deal": {"id": deal["id"], "title": deal["title"], "discount_pct": deal["discount_pct"],
                         "type": deal["type"]} if deal else None,
                "travel_before": travel,
            })
            prev = p
            t = arrival + stay
        elif slot == "cadeau":
            gift_done = True  # no florist available: skip the optional bouquet step
            continue
        elif steps and steps[-1]["kind"] == "free":
            if steps[-1].get("_merged", 0) >= 1:
                break  # nothing affordable/open left: end the day here
            steps[-1]["_merged"] = steps[-1].get("_merged", 0) + 1
            stay = min(1.0, end - t)
            steps[-1]["end"] = fmt_hour(t + stay)
            t += stay
            idx -= 1
        else:
            stay = min(1.0, end - t)
            steps.append({
                "index": idx, "kind": "free", "slot": slot, "slot_label": "Temps libre",
                "start": fmt_hour(t), "end": fmt_hour(t + stay),
                "title": "Flânerie dans le Vieux-Tours" if slot == "activite" else "Pause libre & balade",
                "place": None, "full_price": 0.0, "final_price": 0.0, "deal": None, "travel_before": None,
            })
            t += stay
        if slot == "dejeuner":
            lunch_done = True
        elif slot == "diner":
            dinner_done = True
        elif slot == "nuit":
            club_done = True
        elif slot == "cadeau":
            gift_done = True
        idx += 1

    for s in steps:
        s.pop("_merged", None)
    travel_total = round(sum((s["travel_before"] or {}).get("cost", 0) for s in steps), 2)
    full_places = round(sum(s["full_price"] for s in steps), 2)
    final_places = round(sum(s["final_price"] for s in steps), 2)
    full_total = round(full_places + travel_total, 2)
    final_total = round(final_places + travel_total, 2)
    return {
        "params": {k: params.get(k) for k in ("budget", "people", "start", "end", "weather", "mode",
                                               "interests", "student", "seed", "age_group", "music", "diet")},
        "steps": steps,
        "pinned": [s["place"]["id"] if s["place"] else None for s in steps],
        "totals": {
            "budget": budget, "full_total": full_total, "final_total": final_total,
            "savings": round(full_total - final_total, 2), "travel_total": travel_total,
            "remaining": round(budget - final_total, 2), "within_budget": final_total <= budget,
        },
    }
