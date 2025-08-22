"""
This module stores the pydantic schemas
used in the /api/assignments/ endpoints
"""

from pydantic import BaseModel, ConfigDict, Field

# INPUT SCHEMAS


class CreateAssignment(BaseModel):
    title: str = Field(max_length=50)
    duration: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$", max_length=5)


class UpdateAssignment(BaseModel):
    title: str = Field(max_length=50)
    duration: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$", max_length=5)


# OUTPUT SCHEMAS
class GetAssignment(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    max_duration_minutes: int
    start_time_formatted: str | None = None
    elapsed_time_formatted: str | None = None
    end_time_formatted: str | None = None
    pause_count: int
    is_started: bool = False
    is_paused: bool = False
    is_complete: bool = False


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
