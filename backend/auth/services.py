"""
This module stores the main business logic
for the auth endpoints
"""

import uuid
from datetime import datetime, timedelta, timezone


def generate_token_expiry_time(token_duration_length: int, time_unit: str = "days") -> datetime:
    """
    Generates a datetime object set to the current time
    of function called + token_duration_length

    Args:
        token_duration_length: Token duration to add to the current datetime
        time_unit: Unit of length - Must be "minutes", "hours" or "days"
    
    Returns:
        Datetime: Datetime object representing the token expiry date

    Note: `type defaults to days'
    """
    now = datetime.now(tz=timezone.utc)
    match time_unit.lower():
        case "minutes":
            extra_time = timedelta(minutes=token_duration_length)
        case "hours":
            extra_time = timedelta(hours=token_duration_length)
        case _:
            extra_time = timedelta(days=token_duration_length)
    token_expiry_time = now + extra_time
    return token_expiry_time


def generate_uuid_token() -> str:
    return str(uuid.uuid4())
