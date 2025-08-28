"""
This module stores the main business logic
functions for the timer application endpoints
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import Header, HTTPException

from ..models import Assignment, AssignmentStatistic
from .schemas import GetAssignment


def get_user_id_header(x_user_id: str = Header(None)) -> str:
    """
    Extracts the X-User-ID string from the Http request header.

    Returns the string if valid, raises Http exception otherwise.

    `Used solely via depedency injection in a router function`
    """
    if not x_user_id:
        raise HTTPException(
            status_code=400, detail={"error": "Missing X-User-ID Header"}
        )
    try:
        _ = uuid.UUID(x_user_id)
        return x_user_id
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid UUID format in X-User-ID header"
        )


def convert_hours_minutes_to_seconds(time: str) -> int:
    """
    Convert HH:MM string into total seconds.
    """
    hours, minutes = map(int, time.split(":"))
    return hours * 3600 + minutes * 60


def create_get_assignment_schema(
    assignment: Assignment, statistics: AssignmentStatistic, user_time_region: str
) -> GetAssignment:
    assignment_data: dict[str, Any] = {
        "id": assignment.id,
        "title": assignment.title,
        "max_duration_minutes": assignment.max_duration // 60,
        "start_time_formatted": format_time(
            time=statistics.start_time, local_time_region=user_time_region
        )
        if statistics.start_time
        else None,
        "elapsed_time_formatted": format_time_backwards(time=statistics.elapsed_time)
        if statistics.elapsed_time
        else None,
        "end_time_formatted": format_time(
            time=statistics.end_time, local_time_region=user_time_region
        )
        if statistics.end_time
        else None,
        "pause_count": statistics.pause_count,
        "is_started": assignment.is_started,
        "is_paused": assignment.is_paused,
        "is_complete": assignment.is_complete,
    }

    return GetAssignment(**assignment_data)


def format_time(time: datetime, local_time_region: str) -> str:
    """
    Converts a datetime object to a local timezone and returns a string
    rounded to the nearest second.
    """
    local_time_zone = ZoneInfo(key=local_time_region)
    updated_time = time.astimezone(tz=local_time_zone)
    # Calculate total seconds with microseconds
    total_seconds = (
        updated_time.hour * 3600
        + updated_time.minute * 60
        + updated_time.second
        + updated_time.microsecond / 1_000_000
    )
    rounded_seconds = round(total_seconds)
    hours = int(rounded_seconds // 3600)
    minutes = int((rounded_seconds % 3600) // 60)
    seconds = int(rounded_seconds % 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def format_time_backwards(time: float) -> str:
    """
    Converts the given elapsed time (in seconds) to an HH:MM:SS string,
    rounded to the nearest second for a clean display.
    """
    rounded_time = round(time)
    hours = int(rounded_time // 3600)
    minutes = int((rounded_time % 3600) // 60)
    seconds = int(rounded_time % 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def calculate_start_time() -> datetime:
    """
    Calculates the assignments start time

    Returns
        - datetime: Datetime stored in UTC
    """
    return datetime.now(tz=timezone.utc)


def calculate_estimated_end_time(
    start_time: datetime, duration_seconds: float
) -> datetime:
    """
    Calculates the estimated end time of an assignment.

    Args:
        start_time (datetime): Assignment start time (UTC).
        duration_seconds (int): Assignment duration in seconds.

    Returns:
        datetime: Estimated end time in UTC.
    """
    return start_time + timedelta(seconds=duration_seconds)


def calculate_elapsed_time(start_time: datetime) -> float:
    """
    Calculates the assignments current elapsed time.
    `Formula: current time - start time`

    Args:
        start_time (datetime): Start time in datetime object

    Returns:
        int: Elapsed time in `seconds`
    """
    current_time = datetime.now(tz=timezone.utc)
    time_difference: timedelta = current_time - start_time
    return time_difference.total_seconds()


def calculate_remaining_time_for_pause(
    max_duration_seconds: float, elapsed_duration_seconds: float
) -> float:
    """
    Calculates the assignments remaining time.

    `Formula: max_duration (seconds) - elapsed_duration(seconds`

    Returns:
        float - Remaining duration in seconds
    """
    return max_duration_seconds - elapsed_duration_seconds
