from fastapi import FastAPI, APIRouter, HTTPException, Request, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import random
import uuid
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import httpx
import hashlib
import secrets
import bcrypt
import jwt
from datetime import date
from pydantic import EmailStr, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from data import PLACES, DEALS, TRANSIT_STOPS, ADULT_CATEGORIES  # noqa: E402
from planner import build_plan, PLACES_BY_ID, is_open_at, place_summary  # noqa: E402
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone  # noqa: E402

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
TZ = ZoneInfo("Europe/Paris")
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
JWT_TTL_DAYS = 7

app = FastAPI()
api = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------- models
class SessionIn(BaseModel):
    session_id: str


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None


class PlanIn(BaseModel):
    budget: float
    people: int = 1
    start: str = "10:00"
    end: str = "19:00"
    weather: str = "sun"
    mode: str = "walk"
    interests: List[str] = []
    student: bool = False
    seed: Optional[int] = None
    pinned: Optional[List[Optional[str]]] = None
    excludes: Optional[Dict[str, List[str]]] = None
    with_ai: bool = True


class ItineraryIn(BaseModel):
    name: str
    plan: dict
    ai: Optional[dict] = None


# ---------------------------------------------------------------- auth
def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def compute_age(birthdate: Optional[str]) -> Optional[int]:
    if not birthdate:
        return None
    try:
        b = date.fromisoformat(birthdate)
    except ValueError:
        return None
    t = now_local().date()
    return t.year - b.year - ((t.month, t.day) < (b.month, b.day))


def age_group(age: Optional[int]) -> str:
    if age is None:
        return "unknown"
    if age < 18:
        return "minor"
    if age <= 25:
        return "young"
    if age < 60:
        return "adult"
    return "senior"


def user_out(u: dict) -> dict:
    age = compute_age(u.get("birthdate"))
    return {
        "user_id": u["user_id"], "email": u["email"], "name": u.get("name", ""),
        "first_name": u.get("first_name", ""), "last_name": u.get("last_name", ""),
        "phone": u.get("phone", ""), "birthdate": u.get("birthdate"), "picture": u.get("picture"),
        "age": age, "age_group": age_group(age),
        "preferences": u.get("preferences") or {"interests": [], "music": [], "diet": []},
        "has_password": bool(u.get("password_hash")),
        "auth_providers": u.get("auth_providers") or ["google"],
    }


async def get_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Non authentifié")
    token = auth[7:].strip()
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        try:
            claims = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM],
                                options={"require": ["sub", "exp", "jti"]})
        except jwt.InvalidTokenError:
            raise HTTPException(401, "Session invalide")
        sess = await db.user_sessions.find_one({"token_hash": token_hash(token), "kind": "password_jwt"}, {"_id": 0})
        if not sess or sess["user_id"] != claims["sub"]:
            raise HTTPException(401, "Session invalide")
    exp = sess["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(401, "Session expirée")
    u = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not u:
        raise HTTPException(401, "Utilisateur introuvable")
    return u


async def issue_jwt_session(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(days=JWT_TTL_DAYS)
    token = jwt.encode({"sub": user_id, "email": email, "jti": secrets.token_urlsafe(16), "iat": now, "exp": exp,
                        "typ": "password"}, JWT_SECRET, algorithm=JWT_ALGORITHM)
    await db.user_sessions.insert_one({"token_hash": token_hash(token), "user_id": user_id, "kind": "password_jwt",
                                       "created_at": now, "expires_at": exp})
    return token


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()


def check_pw(pw: str, h: Optional[str]) -> bool:
    if not h:
        bcrypt.checkpw(b"dummy", DUMMY_HASH)
        return False
    return bcrypt.checkpw(pw.encode(), h.encode())


DUMMY_HASH = bcrypt.hashpw(b"dummy", bcrypt.gensalt(rounds=12))


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(default="", max_length=60)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class ChangePasswordIn(BaseModel):
    current_password: Optional[str] = None
    new_password: str = Field(min_length=8, max_length=72)


class ProfileIn(BaseModel):
    first_name: Optional[str] = Field(default=None, max_length=60)
    last_name: Optional[str] = Field(default=None, max_length=60)
    phone: Optional[str] = Field(default=None, max_length=30)
    birthdate: Optional[str] = None
    preferences: Optional[dict] = None


@api.post("/auth/register", status_code=201)
async def register(body: RegisterIn):
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}, {"_id": 1}):
        raise HTTPException(409, "Un compte existe déjà avec cet email")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {"user_id": user_id, "email": email, "first_name": body.first_name.strip(),
           "last_name": body.last_name.strip(), "name": f"{body.first_name.strip()} {body.last_name.strip()}".strip(),
           "picture": None, "password_hash": hash_pw(body.password), "auth_providers": ["password"],
           "created_at": datetime.now(timezone.utc)}
    try:
        await db.users.insert_one(doc)
    except Exception:
        raise HTTPException(409, "Un compte existe déjà avec cet email")
    token = await issue_jwt_session(user_id, email)
    return {"session_token": token, "user": user_out(doc)}


@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.strip().lower()
    u = await db.users.find_one({"email": email}, {"_id": 0})
    if not u or not check_pw(body.password, u.get("password_hash")):
        raise HTTPException(401, "Email ou mot de passe incorrect")
    token = await issue_jwt_session(u["user_id"], email)
    return {"session_token": token, "user": user_out(u)}


@api.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, request: Request):
    user = await get_user(request)
    stored = user.get("password_hash")
    if stored and (not body.current_password or not check_pw(body.current_password, stored)):
        raise HTTPException(400, "Mot de passe actuel incorrect")
    if body.current_password and body.current_password == body.new_password:
        raise HTTPException(400, "Le nouveau mot de passe doit être différent")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"password_hash": hash_pw(body.new_password)},
                                                             "$addToSet": {"auth_providers": "password"}})
    # revoke other password sessions, keep the current one
    current = request.headers.get("Authorization", "")[7:].strip()
    await db.user_sessions.delete_many({"user_id": user["user_id"], "kind": "password_jwt",
                                        "token_hash": {"$ne": token_hash(current)}})
    return {"ok": True}


@api.patch("/me/profile")
async def update_profile(body: ProfileIn, request: Request):
    user = await get_user(request)
    upd = {k: v.strip() if isinstance(v, str) else v for k, v in body.model_dump().items() if v is not None}
    if "birthdate" in upd:
        age = compute_age(upd["birthdate"])
        if age is None or age < 0 or age > 120:
            raise HTTPException(400, "Date de naissance invalide")
    if "preferences" in upd:
        p = upd["preferences"]
        upd["preferences"] = {k: [str(x) for x in (p.get(k) or [])][:10] for k in ("interests", "music", "diet")}
    if "first_name" in upd or "last_name" in upd:
        fn = upd.get("first_name", user.get("first_name", ""))
        ln = upd.get("last_name", user.get("last_name", ""))
        upd["name"] = f"{fn} {ln}".strip() or user.get("name", "")
    if upd:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": upd})
    u = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return user_out(u)


@api.delete("/me")
async def delete_account(request: Request):
    user = await get_user(request)
    uid = user["user_id"]
    for coll in ("user_sessions", "favorites", "claims", "itineraries"):
        await db[coll].delete_many({"user_id": uid})
    await db.users.delete_one({"user_id": uid})
    return {"ok": True}


@api.post("/auth/session")
async def auth_session(body: SessionIn):
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                         headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(401, "Session Google invalide")
    data = r.json()
    existing = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"picture": data.get("picture")},
                                                         "$addToSet": {"auth_providers": "google"}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        parts = (data.get("name") or "").split(" ", 1)
        await db.users.insert_one({"user_id": user_id, "email": data["email"], "name": data["name"],
                                   "first_name": parts[0], "last_name": parts[1] if len(parts) > 1 else "",
                                   "picture": data.get("picture"), "auth_providers": ["google"],
                                   "created_at": datetime.now(timezone.utc)})
    now = datetime.now(timezone.utc)
    await db.user_sessions.insert_one({"session_token": data["session_token"], "user_id": user_id,
                                       "expires_at": now + timedelta(days=7), "created_at": now})
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": data["session_token"], "user": user_out(u)}


@api.get("/auth/me")
async def auth_me(request: Request):
    return user_out(await get_user(request))


@api.post("/auth/logout")
async def auth_logout(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        tok = auth[7:].strip()
        await db.user_sessions.delete_one({"session_token": tok})
        await db.user_sessions.delete_one({"token_hash": token_hash(tok)})
    return {"ok": True}


# ---------------------------------------------------------------- helpers
def now_local():
    return datetime.now(TZ)


def place_is_open(p) -> bool:
    n = now_local()
    return is_open_at(p, n.weekday(), n.hour + n.minute / 60, 0)


def is_minor(user: dict) -> bool:
    return age_group(compute_age(user.get("birthdate"))) == "minor"


def adult_place(place_id: Optional[str]) -> bool:
    p = PLACES_BY_ID.get(place_id) if place_id else None
    return bool(p and p["category"] in ADULT_CATEGORIES)


def active_deals():
    now = datetime.now(timezone.utc)
    return [d for d in DEALS if not d["expires_at"] or datetime.fromisoformat(d["expires_at"]) > now]


def deals_for(place_id):
    return [d for d in active_deals() if d["place_id"] == place_id]


def fmt_hours(rng):
    if not rng:
        return "Fermé"
    def f(h):
        h = h % 24
        return f"{int(h):02d}h{int(round((h % 1) * 60)):02d}"
    return f"{f(rng[0])} – {f(rng[1])}"


def place_out(p, fav_ids=None):
    ds = deals_for(p["id"])
    out = {k: v for k, v in p.items() if k != "hours"}
    out["is_open"] = place_is_open(p)
    out["deals_count"] = len(ds)
    out["best_discount"] = max([d["discount_pct"] for d in ds], default=0)
    out["today_hours"] = fmt_hours(p["hours"][now_local().weekday()])
    if fav_ids is not None:
        out["is_favorite"] = p["id"] in fav_ids
    return out


async def fav_ids_for(user_id):
    doc = await db.favorites.find_one({"user_id": user_id}, {"_id": 0})
    return set(doc["place_ids"]) if doc else set()


# ---------------------------------------------------------------- places & deals
@api.get("/")
async def root():
    return {"message": "CityPulse API"}


@api.get("/transit-stops")
async def transit_stops():
    return TRANSIT_STOPS


@api.get("/weather")
async def weather():
    day = now_local().timetuple().tm_yday
    options = [("sun", "Ensoleillé", 22), ("rain", "Averses", 14), ("cold", "Froid sec", 4), ("sun", "Éclaircies", 18)]
    k, label, temp = options[day % len(options)]
    return {"city": "Tours", "condition": k, "label": label, "temp_c": temp}


@api.get("/places")
async def list_places(request: Request, q: Optional[str] = None, category: Optional[str] = None,
                      price: Optional[int] = None, open_now: bool = False, deals: bool = False):
    user = await get_user(request)
    favs = await fav_ids_for(user["user_id"])
    res = []
    cats = category.split(",") if category else None
    minor = is_minor(user)
    for p in PLACES:
        if minor and p["category"] in ADULT_CATEGORIES:
            continue
        if cats and p["category"] not in cats:
            continue
        if price and p["price_level"] != price:
            continue
        if q and q.lower() not in (p["name"] + " " + p["description"] + " " + p["address"]).lower():
            continue
        if open_now and not place_is_open(p):
            continue
        if deals and not deals_for(p["id"]):
            continue
        res.append(place_out(p, favs))
    return res


@api.get("/places/{place_id}")
async def get_place(place_id: str, request: Request):
    user = await get_user(request)
    p = PLACES_BY_ID.get(place_id)
    if not p:
        raise HTTPException(404, "Lieu introuvable")
    if is_minor(user) and p["category"] in ADULT_CATEGORIES:
        raise HTTPException(403, "Lieu réservé aux personnes majeures")
    out = place_out(p, await fav_ids_for(user["user_id"]))
    days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
    out["week_hours"] = [{"day": days[i], "hours": fmt_hours(p["hours"][i]), "today": i == now_local().weekday()}
                         for i in range(7)]
    out["deals"] = deals_for(place_id)
    return out


@api.get("/deals")
async def list_deals(request: Request, type: Optional[str] = None):
    user = await get_user(request)
    minor = is_minor(user)
    res = []
    for d in active_deals():
        if type and d["type"] != type:
            continue
        if minor and adult_place(d["place_id"]):
            continue
        item = dict(d)
        p = PLACES_BY_ID.get(d["place_id"]) if d["place_id"] else None
        item["place"] = place_summary(p) if p else None
        res.append(item)
    res.sort(key=lambda d: (d["type"] != "flash", d["expires_at"] or "9999"))
    return res


@api.post("/deals/{deal_id}/claim")
async def claim_deal(deal_id: str, request: Request):
    user = await get_user(request)
    deal = next((d for d in DEALS if d["id"] == deal_id), None)
    if not deal:
        raise HTTPException(404, "Bon plan introuvable")
    if is_minor(user) and adult_place(deal["place_id"]):
        raise HTTPException(403, "Offre réservée aux personnes majeures")
    existing = await db.claims.find_one({"user_id": user["user_id"], "deal_id": deal_id}, {"_id": 0})
    if existing:
        return existing
    claim = {"user_id": user["user_id"], "deal_id": deal_id,
             "code": f"CP-{uuid.uuid4().hex[:4].upper()}-{uuid.uuid4().hex[:4].upper()}",
             "title": deal["title"], "created_at": datetime.now(timezone.utc).isoformat()}
    await db.claims.insert_one(dict(claim))
    return claim


# ---------------------------------------------------------------- favorites
@api.get("/favorites")
async def get_favorites(request: Request):
    user = await get_user(request)
    favs = await fav_ids_for(user["user_id"])
    return [place_out(PLACES_BY_ID[i], favs) for i in favs if i in PLACES_BY_ID]


@api.post("/favorites/{place_id}")
async def toggle_favorite(place_id: str, request: Request):
    user = await get_user(request)
    if place_id not in PLACES_BY_ID:
        raise HTTPException(404, "Lieu introuvable")
    favs = await fav_ids_for(user["user_id"])
    if place_id in favs:
        favs.discard(place_id)
        is_fav = False
    else:
        favs.add(place_id)
        is_fav = True
    await db.favorites.update_one({"user_id": user["user_id"]}, {"$set": {"place_ids": list(favs)}}, upsert=True)
    return {"place_id": place_id, "is_favorite": is_fav}


# ---------------------------------------------------------------- planner
AGE_LABEL = {"minor": "mineur (moins de 18 ans)", "young": "étudiant / jeune actif (18-25 ans)",
             "adult": "adulte actif", "senior": "senior (60 ans et plus), préfère le calme", "unknown": "adulte"}


async def ai_tips(plan: dict) -> dict:
    p = plan["params"]
    lines = [f"{s['start']}-{s['end']} {s['slot_label']}: {s['title']}" for s in plan["steps"]]
    prompt = (
        f"Journée à Tours pour {p['people']} personne(s), budget {p['budget']}€, météo {p['weather']}, "
        f"centres d'intérêt: {', '.join(p['interests'] or ['varié'])}. Profil d'âge: {AGE_LABEL.get(p.get('age_group'), 'adulte')}. "
        f"Musique préférée: {', '.join(p.get('music') or []) or 'non précisée'}. Régime: {', '.join(p.get('diet') or []) or 'aucun'}. "
        f"Si mineur: aucun alcool ni vie nocturne. Coût final {plan['totals']['final_total']}€, "
        f"économies {plan['totals']['savings']}€.\nProgramme:\n" + "\n".join(lines) +
        "\n\nRéponds en français, sans markdown. Ligne 1: un titre accrocheur (max 6 mots). "
        "Ligne 2: un résumé chaleureux (max 25 mots). Puis exactement 3 lignes commençant par '- ' "
        "avec des conseils pratiques locaux (max 18 mots chacun)."
    )
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"plan-{uuid.uuid4().hex[:8]}",
                   system_message="Tu es CityPulse, un guide local expert de Tours, concis et chaleureux."
                   ).with_model("anthropic", "claude-sonnet-5-5")

    async def run():
        text = ""
        async for ev in chat.stream_message(UserMessage(text=prompt)):
            if isinstance(ev, TextDelta):
                text += ev.content
            elif isinstance(ev, StreamDone):
                break
        return text

    try:
        text = await asyncio.wait_for(run(), timeout=25)
        rows = [r.strip() for r in text.strip().splitlines() if r.strip()]
        tips = [r[2:].strip() for r in rows if r.startswith("- ")]
        others = [r for r in rows if not r.startswith("- ")]
        return {"title": others[0] if others else "Votre journée à Tours",
                "summary": others[1] if len(others) > 1 else "",
                "tips": tips[:3]}
    except Exception as e:
        logger.warning(f"AI tips failed: {e}")
        return {"title": "Votre journée à Tours", "summary": "Un programme équilibré qui respecte votre budget.",
                "tips": ["Pensez au ticket journée Fil Bleu si vous multipliez les trajets.",
                         "Le Vieux-Tours se découvre très bien à pied.",
                         "Présentez vos QR codes CityPulse en caisse pour profiter des remises."]}


@api.post("/planner/generate")
async def generate(body: PlanIn, request: Request):
    user = await get_user(request)
    if body.budget < 0 or body.people < 1:
        raise HTTPException(400, "Paramètres invalides")
    params = body.model_dump()
    params["age_group"] = age_group(compute_age(user.get("birthdate")))
    prefs = user.get("preferences") or {}
    params["music"] = prefs.get("music") or []
    params["diet"] = prefs.get("diet") or []
    if params["seed"] is None:
        params["seed"] = random.randint(1, 10_000_000)
    plan = build_plan(params)
    plan["ai"] = await ai_tips(plan) if body.with_ai else None
    return plan


# ---------------------------------------------------------------- itineraries
@api.post("/itineraries")
async def save_itinerary(body: ItineraryIn, request: Request):
    user = await get_user(request)
    doc = {"id": uuid.uuid4().hex, "user_id": user["user_id"], "name": body.name.strip() or "Ma journée",
           "plan": body.plan, "ai": body.ai, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.itineraries.insert_one(dict(doc))
    return doc


@api.get("/itineraries")
async def list_itineraries(request: Request):
    user = await get_user(request)
    return await db.itineraries.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.get("/itineraries/{it_id}")
async def get_itinerary(it_id: str, request: Request):
    user = await get_user(request)
    doc = await db.itineraries.find_one({"id": it_id, "user_id": user["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Itinéraire introuvable")
    return doc


@api.delete("/itineraries/{it_id}")
async def delete_itinerary(it_id: str, request: Request):
    user = await get_user(request)
    await db.itineraries.delete_one({"id": it_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------------------------------------------------------------- stats
@api.get("/me/stats")
async def stats(request: Request):
    user = await get_user(request)
    its = await db.itineraries.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    claims = await db.claims.count_documents({"user_id": user["user_id"]})
    favs = await fav_ids_for(user["user_id"])
    month_names = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"]
    now = now_local()
    months = []
    for i in range(5, -1, -1):
        y, m = now.year, now.month - i
        while m <= 0:
            m += 12
            y -= 1
        months.append({"key": f"{y}-{m:02d}", "label": month_names[m - 1], "spent": 0.0, "saved": 0.0})
    by_key = {mo["key"]: mo for mo in months}
    total_saved = total_spent = 0.0
    for it in its:
        t = it["plan"].get("totals", {})
        total_saved += t.get("savings", 0)
        total_spent += t.get("final_total", 0)
        key = it["created_at"][:7]
        if key in by_key:
            by_key[key]["spent"] = round(by_key[key]["spent"] + t.get("final_total", 0), 2)
            by_key[key]["saved"] = round(by_key[key]["saved"] + t.get("savings", 0), 2)
    return {"total_saved": round(total_saved, 2), "total_spent": round(total_spent, 2),
            "itineraries_count": len(its), "claims_count": claims, "favorites_count": len(favs),
            "monthly": months}


@api.get("/me/finance")
async def finance(request: Request):
    user = await get_user(request)
    base = await stats(request)
    its = await db.itineraries.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    tx = []
    for it in its:
        for st in it["plan"].get("steps", []):
            if st.get("kind") != "place" or not st.get("full_price"):
                continue
            tx.append({"id": f"{it['id']}-{st['index']}", "date": it["created_at"], "itinerary_id": it["id"],
                       "itinerary_name": it["name"], "label": st["title"],
                       "category": (st.get("place") or {}).get("category"),
                       "full": st["full_price"], "final": st["final_price"],
                       "saved": round(st["full_price"] - st["final_price"], 2),
                       "deal": (st.get("deal") or {}).get("title")})
        travel = it["plan"].get("totals", {}).get("travel_total", 0)
        if travel:
            tx.append({"id": f"{it['id']}-travel", "date": it["created_at"], "itinerary_id": it["id"],
                       "itinerary_name": it["name"], "label": "Transports", "category": "transport",
                       "full": travel, "final": travel, "saved": 0.0, "deal": None})
    total = base["total_spent"] + base["total_saved"]
    base["savings_ratio"] = round(base["total_saved"] / total * 100, 1) if total else 0.0
    base["transactions"] = tx[:200]
    return base


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    info = await db.user_sessions.index_information()
    if "session_token_1" in info and not info["session_token_1"].get("partialFilterExpression"):
        await db.user_sessions.drop_index("session_token_1")
    await db.user_sessions.create_index("session_token", unique=True,
                                        partialFilterExpression={"session_token": {"$type": "string"}})
    await db.user_sessions.create_index("token_hash", unique=True,
                                        partialFilterExpression={"token_hash": {"$type": "string"}})
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
