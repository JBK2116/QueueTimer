"""
This module stores the routers for the main timer endpoints
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Assignment, AssignmentStatistic, PublicUser
from . import queries, schemas, services

log = logging.getLogger(__name__)

router = APIRouter()


# CREATE ENDPOINTS
@router.post(path="/")
async def create_assignment(
    data: schemas.CreateAssignment,
    user_id: str = Depends(services.get_user_id_header),
    db_session: AsyncSession = Depends(get_db),
) -> schemas.GetAssignment:
    result = await db_session.execute(queries.get_user_by_id(id=user_id))
    user: PublicUser | None = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    minute_duration: int = services.convert_hours_minutes_to_minutes(data.duration)

    try:
        assignment = Assignment(
            title=data.title, max_duration=minute_duration, user_id=user.id
        )
        assignment_statistics = AssignmentStatistic()
        assignment.assignment_statistics = (
            assignment_statistics  # Use one to one relationship
        )

    except ValueError:
        logging.exception(
            msg="Error creating assignment - Client provided invalid information",
            extra={"user_id": f"{user.id}", "token_id": user_id},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error occurred creating assignment",
        )

    db_session.add(assignment)

    try:
        await db_session.commit()
        return services.create_get_assignment_schema(
            assignment=assignment,
            statistics=assignment_statistics,
            user_time_region=user.timezone,
        )
    except IntegrityError:
        logging.exception(
            msg="Exception occurred when creating assignment and assignment statistics",
            extra={
                "assignment_id": f"{getattr(assignment, 'id', 'None')}",
                "assignment_statistics_id": f"{getattr(assignment_statistics, 'id', 'None')}",
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error saving assignment",
        )
