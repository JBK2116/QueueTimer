import os
from typing import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.declarative import declarative_base

load_dotenv()

connection_url: str = f"postgresql+asyncpg://{os.getenv('DEV_DB_USER')}:{os.getenv('DEV_DB_PASSWORD')}@{os.getenv('DEV_DB_HOST')}:{os.getenv('DEV_DB_PORT')}/{os.getenv('DEV_DB_NAME')}"
alembic_connection_url: str = f"postgresql+psycopg2://{os.getenv('DEV_DB_USER')}:{os.getenv('DEV_DB_PASSWORD')}@{os.getenv('DEV_DB_HOST')}:{os.getenv('DEV_DB_PORT')}/{os.getenv('DEV_DB_NAME')}"
engine = create_async_engine(
    connection_url, pool_size=20, max_overflow=0, pool_pre_ping=True
)

Base = declarative_base()

async_session_generator = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_generator() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
