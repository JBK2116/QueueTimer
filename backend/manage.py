import asyncio
import logging
import logging.config
from datetime import datetime, timezone

import typer
from sqlalchemy import delete
from sqlalchemy.exc import SQLAlchemyError

from .db import general_db
from .logging_config import LOGGING_CONFIG
from .models import PublicUser

logging.config.dictConfig(LOGGING_CONFIG)
log = logging.getLogger("timer")


async def cleanup() -> None:
    delete_query = delete(PublicUser).where(
        PublicUser.token_expiry_time < datetime.now(tz=timezone.utc)
    )
    async with general_db() as session:
        try:
            result = await session.execute(delete_query)
            await session.commit()
            if result.rowcount > 0:
                log.info(f"Cleaned up {result.rowcount} expired token users")
            else:
                log.info("No expired token users located in the database")
        except SQLAlchemyError:
            log.exception("Unable to cleanup expired token accounts from the database")
            await session.rollback()


app = typer.Typer()


@app.command()
def execute_cleanup() -> None:
    asyncio.run(cleanup())


if __name__ == "__main__":
    app()
