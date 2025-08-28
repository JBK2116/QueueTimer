"""
This module stores the routers for the main timer endpoints
"""

import logging
from datetime import datetime, timedelta
from datetime import timezone as tzone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Assignment, AssignmentStatistic, PublicUser
from . import queries, schemas, services

log = logging.getLogger(__name__)

router = APIRouter()


# CREATE ENDPOINTS
@router.post(
    path="/", status_code=status.HTTP_201_CREATED, response_model=schemas.GetAssignment
)
async def create_assignment(
    data: schemas.CreateAssignment,
    user_id: str = Depends(services.get_user_id_header),
    db_session: AsyncSession = Depends(get_db),
) -> schemas.GetAssignment:
    result = await db_session.execute(queries.get_user_by_token(token=user_id))
    user: PublicUser | None = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User not found"
        )

    max_duration_seconds: int = services.convert_hours_minutes_to_seconds(data.duration)

    try:
        assignment = Assignment(
            title=data.title, max_duration=max_duration_seconds, user_id=user.id
        )
        assignment_statistics = AssignmentStatistic(
            start_time=None,  # set when assignment starts
            elapsed_time=0,
            end_time=None,  # set when assignment ends
            pause_count=0,
        )
        assignment.assignment_statistics = assignment_statistics

    except ValueError as e:
        logging.exception(
            msg="Error creating assignment - Client provided invalid information",
            extra={"user_id": f"{user.id}", "token_id": user_id, "error": str(e)},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{e}",
        )

    db_session.add(assignment)

    try:
        await db_session.commit()
        await db_session.refresh(assignment)
        await db_session.refresh(assignment_statistics)

        return services.create_get_assignment_schema(
            assignment=assignment,
            statistics=assignment_statistics,
            user_time_region=user.timezone,
        )
    except IntegrityError as e:
        await db_session.rollback()
        logging.exception(
            msg="Exception occurred when creating assignment and assignment statistics",
            extra={
                "assignment_id": f"{getattr(assignment, 'id', 'None')}",
                "assignment_statistics_id": f"{getattr(assignment_statistics, 'id', 'None')}",
                "error": str(e),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error saving assignment",
        )


# READ ENDPOINTS
@router.get(path="/")
async def get_assignments(
    user_id: str = Depends(services.get_user_id_header),
    db_session: AsyncSession = Depends(get_db),
) -> list[schemas.GetAssignment]:
    result = await db_session.execute(queries.get_all_user_info(id=user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User not found"
        )
    assignment_schemas: list[schemas.GetAssignment] = []
    for assignment in user.assignments:
        schema = services.create_get_assignment_schema(
            assignment=assignment,
            statistics=assignment.assignment_statistics,
            user_time_region=user.timezone,
        )
        assignment_schemas.append(schema)
    return assignment_schemas


@router.get(path="/{id}/")
async def get_assignment(
    id: int,
    user_id: str = Depends(services.get_user_id_header),
    db_session: AsyncSession = Depends(get_db),
) -> schemas.GetAssignment:
    user_timezone_query = await db_session.execute(
        queries.get_user_timezone(token=user_id)
    )
    timezone = user_timezone_query.scalar_one_or_none()
    if not timezone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User not found"
        )
    assignment_query = await db_session.execute(
        queries.get_assignment_by_id(assignment_id=id, user_token=user_id)
    )
    assignment = assignment_query.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment Not Found")
    return services.create_get_assignment_schema(
        assignment=assignment,
        statistics=assignment.assignment_statistics,
        user_time_region=timezone,
    )


# UPDATE ENDPOINTS
@router.patch(path="/{id}/")
async def update_assignment(
    id: int,
    data: schemas.UpdateAssignment,
    user_id: str = Depends(services.get_user_id_header),
    db_session: AsyncSession = Depends(get_db),
) -> schemas.GetAssignment:
    user_timezone_query = await db_session.execute(
        queries.get_user_timezone(token=user_id)
    )
    timezone = user_timezone_query.scalar_one_or_none()
    if not timezone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User not found"
        )
    assignment_query = await db_session.execute(
        queries.get_assignment_by_id(assignment_id=id, user_token=user_id)
    )
    assignment = assignment_query.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment Not Found")
    assignment.title = data.title
    db_session.add(assignment)
    await db_session.commit()
    await db_session.refresh(assignment)
    return services.create_get_assignment_schema(
        assignment=assignment,
        statistics=assignment.assignment_statistics,
        user_time_region=timezone,
    )


# DELETE ENDPOINTS
@router.delete(
    path="/{id}/",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        204: {"description": "Assignment successfully deleted"},
        404: {"description": "Assignment not found"},
        422: {"description": "Validation Error"},
    },
)
async def delete_assignment(
    id: int,
    user_id: str = Depends(services.get_user_id_header),
    db_session: AsyncSession = Depends(get_db),
) -> None:
    result = await db_session.execute(
        queries.delete_assignment_by_id(assignment_id=id, user_token=user_id)
    )
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found"
        )
    await db_session.commit()


# ASSIGNMENT STATE CHANGE ENDPOINTS
@router.post(
    path="/start/{id}/",
    response_model=schemas.StartAssignment,
    status_code=status.HTTP_200_OK,
)
async def start_assignment(
    id: int,
    user_id: str = Depends(services.get_user_id_header),
    db_session: AsyncSession = Depends(get_db),
) -> schemas.StartAssignment:
    user_timezone_query = await db_session.execute(
        queries.get_user_timezone(token=user_id)
    )
    timezone = user_timezone_query.scalar_one_or_none()
    if not timezone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User not found"
        )
    assignment_query = await db_session.execute(
        queries.get_assignment_by_id(assignment_id=id, user_token=user_id)
    )
    assignment = assignment_query.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment Not Found")

    if assignment.is_started:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment has already started",
        )
    elif assignment.is_paused:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment has already been started and is currently paused",
        )
    elif assignment.is_complete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment has already been completed",
        )
    assignment_start_time = services.calculate_start_time()
    estimated_end_time = services.calculate_estimated_end_time(
        start_time=assignment_start_time, duration_seconds=assignment.max_duration
    )

    assignment.is_started = True
    assignment.assignment_statistics.start_time = assignment_start_time
    db_session.add(assignment)
    db_session.add(assignment.assignment_statistics)
    await db_session.commit()
    return schemas.StartAssignment(
        start_time=services.format_time(
            time=assignment_start_time, local_time_region=timezone
        ),
        estimated_end_time=services.format_time(
            time=estimated_end_time, local_time_region=timezone
        ),
    )


@router.post(
    path="/pause/{id}/",
    response_model=schemas.PauseAssignmentResult,
    status_code=status.HTTP_200_OK,
)
async def pause_assignment(
    id: int,
    user_id: str = Depends(services.get_user_id_header),
    db_session: AsyncSession = Depends(get_db),
) -> schemas.PauseAssignmentResult:
    user_timezone_query = await db_session.execute(
        queries.get_user_timezone(token=user_id)
    )
    timezone = user_timezone_query.scalar_one_or_none()
    if not timezone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User not found"
        )
    assignment_query = await db_session.execute(
        queries.get_assignment_by_id(assignment_id=id, user_token=user_id)
    )
    assignment = assignment_query.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment Not Found")

    if not assignment.is_started:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment hasn't been started yet",
        )
    elif assignment.is_paused:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment is already paused",
        )
    elif assignment.is_complete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment has already been completed",
        )

    last_active_start_time = (
        assignment.assignment_statistics.last_resumed_time
        or assignment.assignment_statistics.start_time
    )
    if not isinstance(last_active_start_time, datetime):
        log.exception(
            msg="Attempted to pause but last active start time is not a datetime object.",
            extra={
                "assignment_id": assignment.id,
                "assignment_statistics_id": assignment.assignment_statistics.id,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error occurred calculating pause time.",
        )

    # Calculate the duration of the most recent active run
    current_run_duration_seconds = (
        datetime.now(tz=tzone.utc) - last_active_start_time
    ).total_seconds()

    previously_elapsed_seconds = assignment.assignment_statistics.elapsed_time or 0.0
    total_elapsed_seconds = previously_elapsed_seconds + current_run_duration_seconds

    remaining_time_seconds = services.calculate_remaining_time_for_pause(
        max_duration_seconds=float(assignment.max_duration),
        elapsed_duration_seconds=total_elapsed_seconds,
    )

    assignment.is_paused = True
    assignment.assignment_statistics.elapsed_time = total_elapsed_seconds
    assignment.assignment_statistics.remaining_seconds = remaining_time_seconds
    assignment.assignment_statistics.last_paused_time = datetime.now(tz=tzone.utc)
    assignment.assignment_statistics.pause_count += 1

    db_session.add(assignment)
    db_session.add(assignment.assignment_statistics)
    await db_session.commit()

    return schemas.PauseAssignmentResult(
        elapsed_time=services.format_time_backwards(total_elapsed_seconds)
    )


@router.post(
    path="/resume/{id}/",
    status_code=status.HTTP_200_OK,
    response_model=schemas.ResumeAssignmentResult,
)
async def resume_assignment(
    id: int,
    user_id: str = Depends(services.get_user_id_header),
    db_session: AsyncSession = Depends(get_db),
) -> schemas.ResumeAssignmentResult:
    user_timezone_query = await db_session.execute(
        queries.get_user_timezone(token=user_id)
    )
    timezone = user_timezone_query.scalar_one_or_none()
    if not timezone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User not found"
        )
    assignment_query = await db_session.execute(
        queries.get_assignment_by_id(assignment_id=id, user_token=user_id)
    )
    assignment = assignment_query.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment Not Found")

    if not assignment.is_started:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment hasn't been started yet",
        )
    elif not assignment.is_paused:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment is already running",
        )
    elif assignment.is_complete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment has already been completed",
        )
    if not isinstance(assignment.assignment_statistics.elapsed_time, float):
        logging.exception(
            msg="Attempted to calculate remaining time but assignments elapsed time is not an float",
            extra={
                "assignment_id": assignment.id,
                "assignment_statistics_id": assignment.assignment_statistics.id,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error calculating remaining time",
        )

    if not isinstance(assignment.assignment_statistics.remaining_seconds, float):
        logging.exception(
            msg="Attempted to calculate assignments new end time but assignments remaining minutes is not an float",
            extra={
                "assignment_id": assignment.id,
                "assignment_statistics_id": assignment.assignment_statistics.id,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error calculating remaining time",
        )

    new_estimated_end_time: datetime = services.calculate_estimated_end_time(
        start_time=datetime.now(tz=tzone.utc),
        duration_seconds=assignment.assignment_statistics.remaining_seconds,
    )
    assignment.assignment_statistics.last_resumed_time = datetime.now(tz=tzone.utc)
    assignment.is_paused = False
    db_session.add(assignment)
    db_session.add(assignment.assignment_statistics)
    await db_session.commit()
    return schemas.ResumeAssignmentResult(
        new_end_time=services.format_time(
            time=new_estimated_end_time, local_time_region=timezone
        )
    )


@router.post(
    path="/complete/{id}/",
    status_code=status.HTTP_200_OK,
)
async def complete_assignment(
    id: int,
    user_id: str = Depends(services.get_user_id_header),
    db_session: AsyncSession = Depends(get_db),
) -> None:
    assignment_query = await db_session.execute(
        queries.get_assignment_by_id(assignment_id=id, user_token=user_id)
    )
    assignment = assignment_query.scalar_one_or_none()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Assignment Not Found"
        )
    if not assignment.is_started:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment hasn't been started yet",
        )
    if assignment.is_complete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignment has already been completed",
        )
    start_time = assignment.assignment_statistics.start_time
    if not isinstance(start_time, datetime):
        log.exception(
            msg="Assignment start_time is invalid",
            extra={
                "assignment_id": assignment.id,
                "assignment_statistics_id": assignment.assignment_statistics.id,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error calculating start time",
        )

    now = datetime.now(tz=tzone.utc)
    total_elapsed = assignment.assignment_statistics.elapsed_time or 0.0
    if not assignment.is_paused:
        last_active_start = (
            assignment.assignment_statistics.last_resumed_time
            or assignment.assignment_statistics.start_time
        )
        total_elapsed += (now - last_active_start).total_seconds()  # type: ignore -> last active start is guarenteed to exist by now

    # CASE 1: Auto-completed: total time >= max duration
    if total_elapsed >= assignment.max_duration:
        final_elapsed_time = assignment.max_duration
        if assignment.is_paused:
            end_time = assignment.assignment_statistics.last_paused_time
        else:
            # Back-calculate when it should have completed
            excess_time = total_elapsed - assignment.max_duration
            end_time = now - timedelta(seconds=excess_time)

    # CASE 2: Never paused + manual completion
    elif not assignment.assignment_statistics.last_paused_time:
        final_elapsed_time = min(
            round((now - start_time).total_seconds()),
            assignment.max_duration,
        )
        end_time = now

    # CASE 3: Paused + manual completion
    else:
        if assignment.is_paused:
            # Still paused - use elapsed time from when it was paused
            final_elapsed_time = assignment.assignment_statistics.elapsed_time
            end_time = assignment.assignment_statistics.last_paused_time
        else:
            # Was resumed after pause - add time since resume
            paused_elapsed_time = assignment.assignment_statistics.elapsed_time
            last_resumed_time = assignment.assignment_statistics.last_resumed_time

            if last_resumed_time:
                time_since_resume = (now - last_resumed_time).total_seconds()
                final_elapsed_time = min(
                    paused_elapsed_time + time_since_resume,  # type: ignore
                    assignment.max_duration,
                )
            else:
                # somehow not paused but no resume time
                final_elapsed_time = paused_elapsed_time

            end_time = now
    assignment.is_paused = False
    assignment.is_complete = True
    assignment.assignment_statistics.elapsed_time = final_elapsed_time
    assignment.assignment_statistics.end_time = end_time

    db_session.add(assignment)
    db_session.add(assignment.assignment_statistics)
    await db_session.commit()
