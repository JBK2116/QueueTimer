"""
This module stores the test database handling and
globally used fixtures
"""

import os
from typing import Any, AsyncGenerator

import pytest_asyncio
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .auth.services import generate_token_expiry_time, generate_uuid_token
from .db import Base
from .models import PublicUser

load_dotenv()

# PYTESTING DATABASE
testing_connection_url: str = f"postgresql+asyncpg://{os.getenv('DEV_DB_USER')}:{os.getenv('DEV_DB_PASSWORD')}@{os.getenv('DEV_DB_HOST')}:{os.getenv('DEV_DB_PORT')}/{os.getenv('DEV_TEST_DB_NAME')}"

test_engine = create_async_engine(
    testing_connection_url,
    pool_size=5,
    max_overflow=5,
    pool_pre_ping=True,
    echo=False,
    future=True,
)

# Create session factory
async_test_session_factory = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_database() -> AsyncGenerator[None, None]:
    """Set up and tear down the test database schema once per session."""
    try:
        # create database tables
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        yield
    finally:
        # delete tables after all tests
        try:
            async with test_engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
        except Exception as e:
            print(f"Error during database cleanup: {e}")
        finally:
            await test_engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(
    setup_test_database: AsyncGenerator[None, None],
) -> AsyncGenerator[AsyncSession, None]:
    """Provide a database session with an automatic rollback."""
    async with async_test_session_factory() as session:
        # Begin a transaction
        await session.begin()
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.rollback()
            await session.close()


@pytest_asyncio.fixture
async def create_user(db_session: AsyncSession) -> str:
    """Create a test user and return its token."""
    data: dict[str, Any] = {
        "timezone": "America/New_York",
        "token": generate_uuid_token(),
        "token_expiry_time": generate_token_expiry_time(
            token_duration_length=5, time_unit="minutes"
        ),
    }
    user = PublicUser(**data)
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user.token


# Configure pytest-asyncio plugin
pytest_plugins = ("pytest_asyncio",)
