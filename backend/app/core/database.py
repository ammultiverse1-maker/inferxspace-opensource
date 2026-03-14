"""
Database configuration and session management for InferX API Platform
Uses SQLAlchemy async with connection pooling
OWASP A03: Injection - Parameterized queries via ORM
"""

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import AsyncAdaptedQueuePool, NullPool

from app.core.config import settings


# Determine if we're using SQLite (for development)
is_sqlite = settings.DATABASE_URL.startswith("sqlite")

# Create async engine with appropriate configuration
if is_sqlite:
    # SQLite with WAL mode + NullPool for multi-worker safety.
    # NullPool creates a fresh connection per request and closes it immediately
    # after use, so no worker holds an open write lock that blocks others.
    # WAL mode + busy_timeout handles the remaining serialization transparently.
    engine = create_async_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
        connect_args={"check_same_thread": False, "timeout": 60},
        echo=settings.DEBUG,
    )

    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, connection_record):
        """Enable WAL journal mode and other SQLite performance pragmas."""
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=60000")   # 60 s retry on lock
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA cache_size=-64000")    # 64 MB page cache
        cursor.execute("PRAGMA temp_store=MEMORY")
        cursor.close()
else:
    # PostgreSQL with connection pooling
    engine = create_async_engine(
        settings.DATABASE_URL,
        poolclass=AsyncAdaptedQueuePool,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_pre_ping=True,
        echo=settings.DEBUG,
    )

# Session factory
async_session_maker = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False
)


class Base(DeclarativeBase):
    """Base class for all database models"""
    pass


async def get_db() -> AsyncSession:
    """
    Dependency for getting database sessions
    Ensures proper session cleanup
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """
    Initialize database tables
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Auto-migrate: add missing columns (safe for SQLite)
    async with engine.begin() as conn:
        # Add 'role' column to users table if missing
        try:
            await conn.execute(text("SELECT role FROM users LIMIT 1"))
        except Exception:
            try:
                await conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user' NOT NULL"))
            except Exception:
                pass  # column might already exist in another worker


async def close_db():
    """
    Close database connections
    """
    await engine.dispose()
