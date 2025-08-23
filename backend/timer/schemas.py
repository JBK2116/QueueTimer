"""
Pydantic schemas for the /api/assignments/ endpoints.
"""

from pydantic import BaseModel, ConfigDict, Field


# INPUT SCHEMAS
class CreateAssignment(BaseModel):
    title: str = Field(
        max_length=50, description="Title of the assignment (example: 'Do Homework')"
    )
    duration: str = Field(
        pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$",
        max_length=5,
        description="Duration in HH:MM (example: 01:00 = 1 hour, 11:20 = 11 hours 20 minutes). "
        "Range: 00:01–23:59",
    )


class UpdateAssignment(BaseModel):
    title: str = Field(max_length=50, description="Updated title of the assignment")
    duration: str = Field(
        pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$",
        max_length=5,
        description="Updated duration in HH:MM (example: 01:00 = 1 hour, 11:20 = 11 hours 20 minutes). "
        "Range: 00:01–23:59",
    )


# OUTPUT SCHEMAS
class GetAssignment(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Unique ID of the assignment")
    title: str = Field(description="Title of the assignment")
    max_duration_minutes: int = Field(description="Maximum duration in minutes")
    start_time_formatted: str | None = Field(
        default=None, description="Start time in HH:MM:SS if started, else None"
    )
    elapsed_time_formatted: str | None = Field(
        default=None, description="Elapsed time in HH:MM:SS if started, else None"
    )
    end_time_formatted: str | None = Field(
        default=None, description="End time in HH:MM:SS if started, else None"
    )
    pause_count: int = Field(description="Number of pauses during the assignment")
    is_started: bool = Field(
        default=False, description="Whether the assignment has started (default: false)"
    )
    is_paused: bool = Field(
        default=False,
        description="Whether the assignment is currently paused (default: false)",
    )
    is_complete: bool = Field(
        default=False,
        description="Whether the assignment is completed (default: false)",
    )


class StartAssignment(BaseModel):
    start_time: str = Field(
        pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$",
        max_length=8,
        description="Start time in HH:MM:SS",
    )
    estimated_end_time: str = Field(
        pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$",
        max_length=8,
        description="Estimated end time in HH:MM:SS (start_time + duration)",
    )


class PauseAssignmentResult(BaseModel):
    elapsed_time: str = Field(
        pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$",
        max_length=8,
        description="Current elapsed time in HH:MM:SS",
    )


class ResumeAssignmentResult(BaseModel):
    new_end_time: str = Field(
        pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$",
        max_length=8,
        description="New end time in HH:MM:SS",
    )


class EndAssignmentSchemaOut(BaseModel):
    elapsed_time: str = Field(
        pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$",
        max_length=8,
        description="Total elapsed time in HH:MM:SS",
    )
    end_time: str = Field(
        pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$",
        max_length=8,
        description="End time in HH:MM:SS (start_time + elapsed_time)",
    )
