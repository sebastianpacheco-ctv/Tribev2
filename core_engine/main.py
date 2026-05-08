import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from core_engine.api.routes import diagnostics

load_dotenv()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    diagnostics._cleanup_old_requests()
    yield


app = FastAPI(
    title="TRIBE v2 Core Engine",
    description="Brain-inspired predictive foundation model API for creative diagnostics.",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
if _raw_origins.strip():
    _allowed_origins: list[str] | str = [o.strip() for o in _raw_origins.split(",") if o.strip()]
    _allow_credentials = True
else:
    # Dev mode — no ALLOWED_ORIGINS configured, allow all
    _allowed_origins = ["*"]
    _allow_credentials = False  # credentials + wildcard not allowed by spec

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API-Key middleware ────────────────────────────────────────────────────────
_PUBLIC_PATHS = {"/", "/docs", "/redoc", "/openapi.json"}

@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    expected_key = os.getenv("NEURALSEED_API_KEY", "")
    # Skip auth if no key is configured (dev mode) or path is public
    if not expected_key or request.url.path in _PUBLIC_PATHS:
        return await call_next(request)
    provided = request.headers.get("X-API-Key", "")
    if provided != expected_key:
        return JSONResponse(status_code=401, content={"detail": "Invalid or missing API key."})
    return await call_next(request)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(diagnostics.router, prefix="/api/v1/diagnostics", tags=["diagnostics"])

@app.get("/")
async def root():
    return {
        "status": "online",
        "engine": "TRIBE v2",
        "version": "2.0.0",
    }
