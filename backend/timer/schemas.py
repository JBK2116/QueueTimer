"""
This module stores the pydantic schemas
used in the /api/assignments/ endpoints
"""

from pydantic import BaseModel, Field

# INPUT SCHEMAS


class CreateAssignment(BaseModel):
    title: str = Field(max_length=50)
    duration: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$", max_length=5)


class UpdateAssignment(BaseModel):
    title: str = Field(max_length=50)
    duration: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$", max_length=5)


# OUTPUT SCHEMAS
class GetAssignment(BaseModel):
    id: int
    title: str
    max_duration: int  # minutes
    start_time: str | None = None  # HH:MM:SS - If Field Is Set In DB
    elapsed_time: str | None = None  # HH:MM:SS - If Field Is Set In DB
    end_time: str | None = None  # HH:MM:SS - If Field Is Set In DB
    pause_count: int
    is_started: bool
    is_paused: bool
    is_complete: bool


class StartAssignment(BaseModel):
    start_time: str = Field(
        pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$", max_length=8
    )  # HH:MM:SS
    estimated_end_time: str = Field(
        pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$", max_length=8
    )  # HH:MM:SS


class PauseAssignmentResult(BaseModel):
    elapsed_time: str = Field(
        pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$", max_length=8
    )  # HH:MM:SS


class EndAssignmentSchemaOut(BaseModel):
    elapsed_time: str = Field(
        pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$", max_length=8
    )  # HH:MM:SS
    end_time: str = Field(
        pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$", max_length=8
    )  # HH:MM:SS
