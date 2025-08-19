"""
This module stores the routers for the main timer endpoints
"""

from fastapi import APIRouter

from .schemas import UserTimeZone

router = APIRouter()


@router.post(path="/timezone/")
def timezone(timezone: UserTimeZone) -> None:
    print(timezone.timezone)
