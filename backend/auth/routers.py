"""
This module stores the routers for the authentication endpoints
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import PublicUser
from ..timer.queries import get_user_by_token
from ..timer.services import get_user_id_header
from .schemas import NewUser, Token
from .services import generate_token_expiry_time, generate_uuid_token

log = logging.getLogger(__name__)

router = APIRouter()


@router.post(path="/test/", status_code=status.HTTP_200_OK)
async def test_token(
    token: str = Depends(get_user_id_header), db_session: AsyncSession = Depends(get_db)
) -> None:
    user_query = await db_session.execute(get_user_by_token(token=token))
    user = user_query.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Token is invalid or expired"
        )


@router.post(path="/", response_model=Token, status_code=status.HTTP_201_CREATED)
async def new_user(
    data: NewUser, db_session: AsyncSession = Depends(get_db)
) -> Token | JSONResponse:
    token: str = generate_uuid_token()
    token_expiry_time: datetime = generate_token_expiry_time(
        token_duration_length=1, time_unit="days"
    )
    user = PublicUser(
        token=token, token_expiry_time=token_expiry_time, timezone=data.timezone
    )
    db_session.add(instance=user)
    try:
        await db_session.commit()
        return Token(user_id=token)
    except IntegrityError:
        log.exception(
            msg="Error saving Public User object to database",
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error saving user to database",
        )
