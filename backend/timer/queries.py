"""
This module stores database queries used by the timer application
"""

from sqlalchemy import Select, select
from sqlalchemy.orm import selectinload

from ..models import Assignment, PublicUser


def get_user_by_token(token: str) -> Select[tuple[PublicUser]]:
    """Query to select an individual `PublicUser` with a matching token id"""
    return select(PublicUser).where(PublicUser.token == token)


def get_assignment_by_id(assignment_id: int) -> Select[tuple[Assignment]]:
    """
    Query to select an individual `Assignment` with a matching id

    `Uses`:
    - selectinload to retrieve corresponding assignment_statistics
    """
    return (
        select(Assignment)
        .options(selectinload(Assignment.assignment_statistics))
        .where(Assignment.id == assignment_id)
    )


def get_user_timezone(token: str) -> Select[tuple[str]]:
    """Query to select an individual `PublicUser's` timezone attribute"""
    return select(PublicUser.timezone).where(PublicUser.token == token)


def get_all_user_info(id: str) -> Select[tuple[PublicUser]]:
    """
    Query to load a PublicUser with all related assignments
    and their assignment statistics.

    Uses:
    - selectinload for assignments (2nd query, avoids row duplication).
    - joinedload for assignment_statistics (1-to-1, efficient join).
    """
    return (
        select(PublicUser)
        .options(
            selectinload(
                PublicUser.assignments
            ).joinedload(  # 2nd query to retrieve assignments
                Assignment.assignment_statistics  # join in statistics when loading the assignments
            )
        )
        .where(PublicUser.token == id)
    )
