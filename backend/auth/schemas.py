"""
This module stores the pydantic schemas
used in the /api/user/ endpoints
"""

from pydantic import BaseModel, Field


# INPUT SCHEMAS
class NewUser(BaseModel):
    timezone: str = Field(max_length=50, description="User's IANA timezone")


# OUTPUT SCHEMAS
class Token(BaseModel):
    user_id: str = Field(max_length=36, description="User's Cached Token ID")
