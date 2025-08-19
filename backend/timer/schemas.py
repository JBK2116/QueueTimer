"""
This module stores the globally used pydantic schemas to handle outgoing requests
"""

from pydantic import BaseModel


class UserTimeZone(BaseModel):
    timezone: str
