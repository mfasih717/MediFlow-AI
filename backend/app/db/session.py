# -*- coding: utf-8 -*-
"""MediFlow AI - Async Database Session & SQLAlchemy Engine
Supports PostgreSQL 16 with pgvector extension and connection pooling.
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base
from sqlalchemy import text

from app.core.config import settings
from app.core.logging import logger

Base = declarative_base()

# Configure engine with asyncpg dialect
engine_kwargs = {
    "echo": settings.DB_ECHO,
    "future": True,
}

# Only apply pool sizing for real PostgreSQL engines, not in-memory SQLite
if "sqlite" not in settings.DATABASE_URL:
    engine_kwargs.update({
        "pool_size": settings.DB_POOL_SIZE,
        "max_overflow": settings.DB_MAX_OVERFLOW,
        "pool_pre_ping": True,
    })

try:
    engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)
except Exception as exc:
    logger.warning("PostgreSQL engine initialization deferred/fallback: %s", exc)
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False, future=True)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an async database session.

    FIX HIGH-6: Session is NOT auto-committed here. Each write-path service method
    is responsible for calling session.commit() explicitly. This prevents unnecessary
    COMMIT calls on read-only (GET) requests.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as exc:
            await session.rollback()
            raise exc
        finally:
            await session.close()


async def init_db() -> None:
    """Initializes tables and ensures pgvector extension is present."""
    async with engine.begin() as conn:
        try:
            if "postgresql" in settings.DATABASE_URL:
                # Enable pgvector extension for clinical embeddings
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                logger.info("Verified PostgreSQL pgvector extension.")
        except Exception as exc:
            logger.warning("Could not execute pgvector extension creation (may already exist or insufficient privileges): %s", exc)

        # Create all metadata tables
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables initialized successfully.")
