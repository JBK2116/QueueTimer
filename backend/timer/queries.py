"""
This module stores database queries used by the timer application
"""

from sqlalchemy import Select, select

from ..models import PublicUser


def get_user_by_id(id: str) -> Select[tuple[PublicUser]]:
    """Query to select an individual `PublicUser` with a matching token id"""
    return select(PublicUser).where(PublicUser.token == id)
