"""
InferX Backend — BYOK Edition
FastAPI application entry point.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import settings
from app.core.database import init_db

# ── Routers ────────────────────────────────────────────────────────────────
from app.api.routes import (
    auth,
    users,
    api_keys,
    completions,
    usage,
    models,
    credits,
    support,
    knowledge_bases,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("inferx")


# ── Lifespan ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting InferX BYOK API…")
    await init_db()
    yield
    logger.info("Shutting down InferX BYOK API.")


# ── App ────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="InferX",
    description=(
        "OpenAI-compatible AI gateway. "
        "BYOK: configure your own provider API keys in `.env`."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)


# ── Middleware ─────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ─────────────────────────────────────────────────────────────────

app.include_router(auth.router,            prefix="/api")
app.include_router(users.router,           prefix="/api")
app.include_router(api_keys.router,        prefix="/api")
app.include_router(usage.router,           prefix="/api")
app.include_router(models.router,          prefix="/api")
app.include_router(credits.router,         prefix="/api")
app.include_router(support.router,         prefix="/api")
app.include_router(knowledge_bases.router, prefix="/api")

# OpenAI-compatible inference endpoints
app.include_router(completions.router)     # mounts at /v1/...


# ── Health ─────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Meta"])
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/", tags=["Meta"])
async def root():
    return {
        "name": "InferX",
        "description": "BYOK AI gateway — OpenAI-compatible API",
        "docs": "/docs",
        "version": "1.0.0",
    }
