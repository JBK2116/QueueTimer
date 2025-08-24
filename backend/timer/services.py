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


def convert_hours_minutes_to_minutes(time: str) -> int:
    """
    Calculates the duration of the provided time in minutes

    `Assumes that the provided time is in HH:MM format`
    """
    hours, minutes = map(int, time.split(":"))
    return hours * 60 + minutes


def create_get_assignment_schema(
    assignment: Assignment, statistics: AssignmentStatistic, user_time_region: str
) -> GetAssignment:
    assignment_data: dict[str, Any] = {
        "id": assignment.id,
        "title": assignment.title,
        "max_duration_minutes": assignment.max_duration,
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
    Converts the given `time` into the provided `local_time_region`, then returns it in HH:MM:SS format
    """
    local_time_zone = ZoneInfo(key=local_time_region)
    updated_time = time.astimezone(tz=local_time_zone)
    return updated_time.strftime("%H:%M:%S")


def format_time_backwards(time: int) -> str:
    """
    Converts the given time to a HH:MM:SS format

    `Assumes that time is in units of seconds`
    """
    hours = time // 3600
    minutes = (time % 3600) // 60
    seconds = time % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def calculate_start_time() -> datetime:
    """
    Calculates the assignments start time

    Returns
        - datetime: Datetime stored in UTC
    """
    return datetime.now(tz=timezone.utc)


def calculate_estimated_end_time(
    start_time: datetime, duration: int, duration_unit: str = "minutes"
) -> datetime:
    """
    Calculates the assignments estimated end time.
    `Formula: start_time + duration`

    Args:
        start_time (datetime): Start time in datetime object
        duration (int): Assignment duration
        duration_unit (str): Duration unit - Must be either minutes or seconds, defaults to minutes

    Returns:
        datetime: Datetime stored in UTC

    """
    match duration_unit.lower():
        case "seconds":
            return start_time + timedelta(seconds=duration)
        case _:
            return start_time + timedelta(minutes=duration)


def calculate_elapsed_time(start_time: datetime) -> int:
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
    return int(time_difference.total_seconds())


def calculate_remaining_time(max_duration: int, elapsed_duration: int) -> int:
    """
    Calculates the assignments remaining time.

    `Formula: max_duration (minutes) - elapsed_duration(seconds converted  to minutes)`

    Returns:
        int - Remaining duration in minutes

    """
    return max_duration - int(elapsed_duration / 60)
