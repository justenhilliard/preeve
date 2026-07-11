import os
from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

load_dotenv()


class Base(DeclarativeBase):
    pass


DATABASE_URL = os.getenv("DATABASE_URL", "")

engine = create_async_engine(DATABASE_URL, pool_pre_ping=True) if DATABASE_URL else None
async_session_factory = (
    async_sessionmaker(engine, expire_on_commit=False) if engine is not None else None
)


async def get_async_session() -> AsyncGenerator[AsyncSession]:
    """Yield an async database session."""
    if async_session_factory is None:
        raise RuntimeError("DATABASE_URL is not configured.")

    async with async_session_factory() as session:
        yield session
