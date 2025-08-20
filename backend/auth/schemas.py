"""
This module stores the pydantic schemas
used in the /api/user/ endpoints
"""

from pydantic import BaseModel, Field


# INPUT SCHEMAS
class TimeZone(BaseModel):
    timezone: str = Field(max_length=50)


# OUTPUT SCHEMAS
class TokenID(BaseModel):
    user_id: str = Field(max_length=36)
