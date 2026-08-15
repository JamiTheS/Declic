from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import asyncio
import logging
import requests
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from seed_cards import SEED_CARDS

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN")

# Airtable = single source of truth for the question catalog.
AIRTABLE_TOKEN = os.environ.get("AIRTABLE_TOKEN", "")
AIRTABLE_BASE_ID = os.environ.get("AIRTABLE_BASE_ID", "")
AIRTABLE_TABLE = os.environ.get("AIRTABLE_TABLE", "")
AIRTABLE_URL = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/{AIRTABLE_TABLE}"


def airtable_configured() -> bool:
    return bool(AIRTABLE_TOKEN and AIRTABLE_BASE_ID and AIRTABLE_TABLE)

# Emergent managed push notifications (SuprSend relay). The key is injected by
# the deployment pipeline; keep "placeholder" locally so the code path works.
PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
_push_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": PUSH_KEY},
    timeout=10.0,
)

app = FastAPI(title="Déclic API")
api_router = APIRouter(prefix="/api")

CATALOG_VERSION = 3

# ----------------------------- Models -----------------------------


class Card(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mode: str  # qui-est-le-plus | je-nai-jamais | action-verite | cash-ou-cash | le-verdict | tu-me-connais | hot
    texte: str
    texte_b: Optional[str] = None          # for cash-ou-cash (second option)
    variante: Optional[str] = None         # action-verite: 'action' | 'verite'
    vibe: Optional[str] = None             # content vibe (Fun / Découverte / Sans filtre / Hot)
    gage: str = "Bois une gorgée"
    alternative: str = "Révèle un secret de plus"
    intensite: int = 1                     # 1..5
    tags_theme: List[str] = Field(default_factory=lambda: ["general"])
    packs: List[str] = Field(default_factory=list)  # presets (Intég, Coloc, Entre meufs, Couples…)
    premium: bool = False
    age18: bool = False
    actif: bool = True
    source: str = "seed"                   # "seed" | "manual" | "airtable"
    airtable_id: Optional[str] = None      # record id in Airtable (source of truth)
    version: int = CATALOG_VERSION


class CardCreate(BaseModel):
    mode: str
    texte: str
    texte_b: Optional[str] = None
    variante: Optional[str] = None
    vibe: Optional[str] = None
    gage: str = "Bois une gorgée"
    alternative: str = "Révèle un secret de plus"
    intensite: int = 1
    tags_theme: List[str] = Field(default_factory=lambda: ["general"])
    packs: List[str] = Field(default_factory=list)
    premium: bool = False
    age18: bool = False
    actif: bool = True


class CardUpdate(BaseModel):
    mode: Optional[str] = None
    texte: Optional[str] = None
    texte_b: Optional[str] = None
    variante: Optional[str] = None
    vibe: Optional[str] = None
    gage: Optional[str] = None
    alternative: Optional[str] = None
    intensite: Optional[int] = None
    tags_theme: Optional[List[str]] = None
    packs: Optional[List[str]] = None
    premium: Optional[bool] = None
    age18: Optional[bool] = None
    actif: Optional[bool] = None


class BulkImport(BaseModel):
    cards: List[CardCreate]


class CsvImport(BaseModel):
    csv: str


class AnalyticsEvent(BaseModel):
    name: str
    props: dict = Field(default_factory=dict)


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str   # "android" | "ios"
    device_token: str


class BroadcastBody(BaseModel):
    title: str
    message: str
    action_url: Optional[str] = None


# ----------------------------- Auth -----------------------------


async def require_admin(x_admin_token: Optional[str] = Header(None)):
    """Simple shared-token guard for content-management (write) endpoints."""
    if not ADMIN_TOKEN:
        # Fail closed: no token configured means the back-office is locked.
        raise HTTPException(status_code=503, detail="Espace créateur non configuré")
    if not x_admin_token or x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Jeton créateur invalide")
    return True


# ----------------------------- Public read routes -----------------------------


@api_router.get("/")
async def root():
    return {"message": "Déclic API", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"status": "ok", "catalog_version": CATALOG_VERSION}


@api_router.get("/catalog")
async def get_catalog(include_premium: bool = True):
    """Full active catalog + derived packs. Local-first client caches this."""
    query = {"actif": True}
    if not include_premium:
        query["premium"] = False
    docs = await db.cards.find(query, {"_id": 0}).to_list(5000)
    packs = _derive_packs(docs)
    return {
        "version": CATALOG_VERSION,
        "count": len(docs),
        "cards": docs,
        "packs": packs,
        "presets": _derive_presets(docs),
        "vibes": _derive_vibes(docs),
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }


@api_router.get("/cards", response_model=List[Card])
async def list_cards(
    mode: Optional[str] = None,
    theme: Optional[str] = None,
    premium: Optional[bool] = None,
    actif: Optional[bool] = None,
):
    query: dict = {}
    if mode is not None:
        query["mode"] = mode
    if theme is not None:
        query["tags_theme"] = theme
    if premium is not None:
        query["premium"] = premium
    if actif is not None:
        query["actif"] = actif
    docs = await db.cards.find(query, {"_id": 0}).to_list(5000)
    return [Card(**d) for d in docs]


@api_router.get("/packs")
async def get_packs():
    docs = await db.cards.find({"actif": True}, {"_id": 0}).to_list(5000)
    return {"packs": _derive_packs(docs)}


@api_router.post("/events")
async def log_event(event: AnalyticsEvent):
    """Anonymous analytics — no personal data."""
    doc = {
        "id": str(uuid.uuid4()),
        "name": event.name,
        "props": event.props,
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    await db.events.insert_one(doc)
    doc.pop("_id", None)
    return {"logged": True}


# ----------------------------- Push notifications (Emergent managed) -----------------------------


@api_router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    """Register a device's native push token with the Emergent relay.

    Déclic has no accounts, so `user_id` is a stable per-device id generated on
    the client. We keep the id (not the token) locally so the owner can
    broadcast re-engagement pushes. Token resolution is handled by the relay.
    """
    resp = await _push_client.post("/api/v1/push/users/register", json=body.model_dump())
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()
    await db.push_users.update_one(
        {"user_id": body.user_id},
        {"$set": {"user_id": body.user_id, "platform": body.platform,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"status": "registered"}


async def send_push(recipients: List[str], data: dict, idempotency_key: Optional[str] = None) -> None:
    """Relay a push to a list of user ids (max 100). Never call from web/frontend."""
    if not recipients:
        return
    if len(recipients) > 100:
        raise ValueError("max 100 recipients per /trigger call; chunk before sending")
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")
    payload: dict = {"recipients": recipients, "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    resp = await _push_client.post("/api/v1/push/trigger", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()


@api_router.post("/admin/broadcast")
async def admin_broadcast(body: BroadcastBody, _: bool = Depends(require_admin)):
    """Owner-triggered re-engagement push to every registered device (chunked)."""
    users = await db.push_users.find({}, {"_id": 0, "user_id": 1}).to_list(100000)
    ids = [u["user_id"] for u in users if u.get("user_id")]
    if not ids:
        return {"sent": 0, "recipients": 0}
    data = {"title": body.title, "message": body.message}
    if body.action_url:
        data["action_url"] = body.action_url
    sent = 0
    for i in range(0, len(ids), 100):
        chunk = ids[i:i + 100]
        try:
            await send_push(chunk, data, idempotency_key=f"broadcast-{i}-{body.title[:24]}")
            sent += len(chunk)
        except Exception as e:  # noqa: BLE001
            logger.warning("Broadcast chunk failed (non-blocking): %s", e)
    return {"sent": sent, "recipients": len(ids)}


# ----------------------------- Admin (content management) -----------------------------


@api_router.post("/admin/verify")
async def admin_verify(_: bool = Depends(require_admin)):
    """PIN-gate check for the in-app content back-office."""
    return {"ok": True}


@api_router.get("/admin/cards", response_model=List[Card])
async def admin_list_cards(
    mode: Optional[str] = None,
    _: bool = Depends(require_admin),
):
    """All cards (active + inactive), newest manual first — for the back-office."""
    query: dict = {}
    if mode:
        query["mode"] = mode
    docs = await db.cards.find(query, {"_id": 0}).to_list(10000)
    # manual content first so the owner sees what they just added
    docs.sort(key=lambda d: (0 if d.get("source") == "manual" else 1))
    return [Card(**d) for d in docs]


@api_router.get("/admin/summary")
async def admin_summary(_: bool = Depends(require_admin)):
    docs = await db.cards.find({}, {"_id": 0}).to_list(10000)
    by_mode: dict = {}
    for d in docs:
        by_mode[d["mode"]] = by_mode.get(d["mode"], 0) + 1
    return {
        "total": len(docs),
        "manual": sum(1 for d in docs if d.get("source") == "manual"),
        "premium": sum(1 for d in docs if d.get("premium")),
        "by_mode": by_mode,
        "catalog_version": CATALOG_VERSION,
    }


@api_router.post("/cards", response_model=Card)
async def create_card(payload: CardCreate, _: bool = Depends(require_admin)):
    card = Card(**payload.dict(), source="manual")
    await db.cards.insert_one(card.dict())
    return card


@api_router.put("/cards/{card_id}", response_model=Card)
async def update_card(card_id: str, payload: CardUpdate, _: bool = Depends(require_admin)):
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.cards.find_one_and_update(
        {"id": card_id}, {"$set": updates}, return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Card not found")
    result.pop("_id", None)
    return Card(**result)


@api_router.delete("/cards/{card_id}")
async def delete_card(card_id: str, _: bool = Depends(require_admin)):
    result = await db.cards.delete_one({"id": card_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"deleted": card_id}


@api_router.post("/cards/bulk")
async def bulk_create(payload: BulkImport, _: bool = Depends(require_admin)):
    """Insert many hand-crafted cards at once (JSON)."""
    cards = [Card(**c.dict(), source="manual") for c in payload.cards]
    if cards:
        await db.cards.insert_many([c.dict() for c in cards])
    return {"inserted": len(cards)}


@api_router.post("/import/csv")
async def import_csv(payload: CsvImport, _: bool = Depends(require_admin)):
    """Tolerant CSV ingestion for the owner to grow the catalog remotely.

    Friendly header (any subset, order-free):
      mode,texte,texte_b,variante,vibe,intensite,gage,alternative,tags_theme,packs,premium,age18
    List columns (tags_theme, packs) accept `|` or `;` separators.
    cash-ou-cash: a single `texte` split by `//` fills texte / texte_b automatically.
    """
    text = (payload.csv or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="CSV vide")

    # detect delimiter (comma or semicolon)
    sample = text.splitlines()[0]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","

    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    inserted = 0
    skipped = 0
    errors: List[str] = []
    to_insert: List[dict] = []

    for i, row in enumerate(reader, start=2):
        try:
            norm = { (k or "").strip().lower(): (v.strip() if isinstance(v, str) else v)
                     for k, v in row.items() if k }
            mode = norm.get("mode")
            texte = norm.get("texte")
            if not mode or not texte:
                skipped += 1
                continue

            texte_b = norm.get("texte_b") or None
            if mode == "cash-ou-cash" and not texte_b and "//" in texte:
                parts = texte.split("//", 1)
                texte, texte_b = parts[0].strip(), parts[1].strip()

            card = Card(
                mode=mode,
                texte=texte,
                texte_b=texte_b,
                variante=norm.get("variante") or None,
                vibe=norm.get("vibe") or norm.get("ambiance") or None,
                gage=norm.get("gage") or "Bois une gorgée",
                alternative=norm.get("alternative") or norm.get("alternative_sans_alcool") or "Révèle un secret de plus",
                intensite=_to_int(norm.get("intensite"), 1),
                tags_theme=_to_list(norm.get("tags_theme")) or ["general"],
                packs=_to_list(norm.get("packs")),
                premium=_to_bool(norm.get("premium")),
                age18=_to_bool(norm.get("age18")),
                actif=_to_bool(norm.get("actif"), default=True),
                source="manual",
            )
            to_insert.append(card.dict())
            inserted += 1
        except Exception as e:  # noqa: BLE001
            errors.append(f"ligne {i}: {e}")

    if to_insert:
        await db.cards.insert_many(to_insert)

    return {"inserted": inserted, "skipped": skipped, "errors": errors[:20]}


# ----------------------------- Airtable sync (source of truth) -----------------------------


def _airtable_headers() -> dict:
    return {"Authorization": f"Bearer {AIRTABLE_TOKEN}", "Content-Type": "application/json"}


def _airtable_fetch_all() -> List[dict]:
    """Blocking: fetch every record from the Airtable table (offset pagination)."""
    records: List[dict] = []
    offset = None
    while True:
        params = {"pageSize": 100}
        if offset:
            params["offset"] = offset
        r = requests.get(AIRTABLE_URL, headers=_airtable_headers(), params=params, timeout=30)
        if r.status_code == 429:
            import time as _t
            _t.sleep(31)
            continue
        r.raise_for_status()
        data = r.json()
        records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            break
    return records


def _airtable_delete(record_id: str) -> int:
    r = requests.delete(f"{AIRTABLE_URL}/{record_id}", headers=_airtable_headers(), timeout=30)
    return r.status_code


def _map_airtable_record(rec: dict) -> Optional[dict]:
    """Map one Airtable record to a Card dict. Returns None if invalid."""
    f = rec.get("fields", {})
    mode = f.get("mode")
    texte = f.get("texte")
    if not mode or not texte:
        return None
    try:
        card = Card(
            mode=mode,
            texte=texte,
            texte_b=(f.get("texte_b") or None),
            variante=(f.get("variante") or None),
            vibe=(f.get("vibe") or None),
            gage=(f.get("gage") or "Bois une gorgée"),
            alternative=(f.get("alternative") or "Révèle un secret de plus"),
            intensite=_to_int(f.get("intensite"), 1),
            tags_theme=_to_list(f.get("tags_theme")) or ["general"],
            packs=_to_list(f.get("packs")),
            premium=bool(f.get("premium", False)),
            age18=bool(f.get("age18", False)),
            actif=bool(f.get("actif", False)),
            source="airtable",
            airtable_id=rec.get("id"),
        )
    except Exception:  # noqa: BLE001
        return None
    d = card.dict()
    d["airtable_id"] = rec.get("id")
    return d


async def sync_from_airtable() -> dict:
    """Mirror the whole catalog from Airtable into MongoDB (source of truth)."""
    if not airtable_configured():
        raise HTTPException(status_code=503, detail="Airtable non configuré")
    loop = asyncio.get_running_loop()
    records = await loop.run_in_executor(None, _airtable_fetch_all)
    cards = [c for c in (_map_airtable_record(r) for r in records) if c]
    await db.cards.delete_many({})
    if cards:
        await db.cards.insert_many(cards)
    await db.meta.update_one(
        {"_id": "catalog"},
        {"$set": {"version": CATALOG_VERSION, "source": "airtable",
                  "synced_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    active = sum(1 for c in cards if c.get("actif"))
    return {"fetched": len(records), "synced": len(cards), "active": active,
            "skipped": len(records) - len(cards)}


@api_router.post("/admin/sync")
async def admin_sync(_: bool = Depends(require_admin)):
    """Pull the latest catalog from Airtable and mirror it into the app DB."""
    result = await sync_from_airtable()
    return {"ok": True, **result}


@api_router.get("/admin/airtable-info")
async def airtable_info(_: bool = Depends(require_admin)):
    return {
        "configured": airtable_configured(),
        "base_id": AIRTABLE_BASE_ID,
        "table_id": AIRTABLE_TABLE,
        "edit_url": f"https://airtable.com/{AIRTABLE_BASE_ID}/{AIRTABLE_TABLE}" if airtable_configured() else None,
    }


@api_router.delete("/admin/airtable/{record_id}")
async def delete_airtable_card(record_id: str, _: bool = Depends(require_admin)):
    """Delete a question in Airtable (source of truth) and mirror the removal locally."""
    if not airtable_configured():
        raise HTTPException(status_code=503, detail="Airtable non configuré")
    loop = asyncio.get_running_loop()
    status = await loop.run_in_executor(None, _airtable_delete, record_id)
    if status not in (200, 404):
        raise HTTPException(status_code=502, detail=f"Airtable a répondu {status}")
    await db.cards.delete_one({"airtable_id": record_id})
    return {"deleted": record_id, "airtable_status": status}


# ----------------------------- Helpers -----------------------------

PACK_LABELS = {
    "general": "Général",
    "amitié": "Amitié",
    "absurde": "Absurde",
    "argent": "Argent",
    "embarrassant": "Gênant",
    "réseaux": "Réseaux",
    "séduction": "Séduction",
    "secret": "Secrets",
    "ex": "Spécial ex",
    "couple": "Couples",
    "opinion": "Opinions",
    "sexe": "Sexe",
    "honte": "Honte",
    "fierté": "Fierté",
    "alcool": "Alcool",
    "famille": "Famille",
    "physique": "Physique",
}


def _to_int(v, default=1):
    try:
        return max(1, min(5, int(float(v))))
    except (TypeError, ValueError):
        return default


def _to_bool(v, default=False):
    if v is None or v == "":
        return default
    return str(v).strip().lower() in {"1", "true", "vrai", "oui", "yes", "x", "y"}


def _to_list(v):
    if not v:
        return []
    for sep in ["|", ";"]:
        if sep in v:
            return [x.strip() for x in v.split(sep) if x.strip()]
    return [x.strip() for x in v.split(",") if x.strip()]


def _derive_packs(docs: List[dict]) -> List[dict]:
    counts: dict = {}
    premium_counts: dict = {}
    for d in docs:
        for tag in d.get("tags_theme", []):
            counts[tag] = counts.get(tag, 0) + 1
            if d.get("premium"):
                premium_counts[tag] = premium_counts.get(tag, 0) + 1
    packs = []
    for tag, count in counts.items():
        if count < 3:
            continue  # skip tiny packs
        is_premium = premium_counts.get(tag, 0) > count / 2
        packs.append({
            "id": tag,
            "label": PACK_LABELS.get(tag, tag.capitalize()),
            "count": count,
            "premium": is_premium,
        })
    packs.sort(key=lambda p: (p["premium"], -p["count"]))
    return packs


VIBE_ORDER = ["Découverte", "Fun", "Sans filtre", "Hot"]


def _derive_presets(docs: List[dict]) -> List[dict]:
    """Presets are 100% data-driven from the `packs` column (comma list per card)."""
    counts: dict = {}
    prem: dict = {}
    hot: dict = {}
    for d in docs:
        for p in d.get("packs", []) or []:
            counts[p] = counts.get(p, 0) + 1
            if d.get("premium"):
                prem[p] = prem.get(p, 0) + 1
            if d.get("age18") or d.get("vibe") == "Hot":
                hot[p] = hot.get(p, 0) + 1
    presets = []
    for name, count in counts.items():
        presets.append({
            "id": name,
            "label": name,
            "count": count,
            "premium": prem.get(name, 0) > count / 2,
            "hot": hot.get(name, 0) > 0,
        })
    presets.sort(key=lambda p: -p["count"])
    return presets


def _derive_vibes(docs: List[dict]) -> List[dict]:
    counts: dict = {}
    for d in docs:
        v = d.get("vibe")
        if v:
            counts[v] = counts.get(v, 0) + 1
    ordered = [v for v in VIBE_ORDER if v in counts] + [v for v in counts if v not in VIBE_ORDER]
    return [{"id": v, "label": v, "count": counts[v], "hot": v == "Hot"} for v in ordered]


# ----------------------------- Startup -----------------------------

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_sync():
    """Airtable is the source of truth: mirror it on boot. Fallback to seed if unreachable."""
    if airtable_configured():
        try:
            result = await sync_from_airtable()
            logger.info("Airtable sync on startup: %s", result)
            if result["synced"] > 0:
                return
        except Exception as e:  # noqa: BLE001
            logger.warning("Airtable sync failed on startup (%s) — using local fallback.", e)
    # Fallback: seed only if the DB is empty (keeps offline/dev working).
    count = await db.cards.count_documents({})
    if count == 0:
        logger.info("Seeding fallback catalog (%d cards)...", len(SEED_CARDS))
        docs = [Card(**c).dict() for c in SEED_CARDS]
        if docs:
            await db.cards.insert_many(docs)
        await db.meta.update_one(
            {"_id": "catalog"}, {"$set": {"version": CATALOG_VERSION, "source": "seed"}}, upsert=True,
        )
    else:
        logger.info("Catalog kept as-is (%d cards).", count)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    await _push_client.aclose()
