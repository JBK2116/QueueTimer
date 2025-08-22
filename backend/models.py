"""
This module stores the database models for this project
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates
from sqlalchemy.sql import func

from .db import Base

# * IN @validates - key=attribute being checked, value=value assigned to attribute on object creation


class BaseClass(Base):
    __abstract__ = True
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=False, default=func.now()
    )


class PublicUser(BaseClass):
    __tablename__ = "public_users"

    timezone: Mapped[str] = mapped_column(
        String(length=100), nullable=False
    )  # timezone str received from frontend
    token: Mapped[str] = mapped_column(
        String(length=36), nullable=False, unique=True
    )  # stores auto generated uuid4 token
    token_expiry_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )  # Calculated prior to object creation

    assignments: Mapped[list["Assignment"]] = relationship(
        "Assignment", back_populates="user", cascade="all, delete"
    )


class Assignment(BaseClass):
    __tablename__ = "assignments"

    title: Mapped[str] = mapped_column(String(length=50), nullable=False)
    max_duration: Mapped[int] = mapped_column(Integer, nullable=False)  # In Minutes
    is_started: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_paused: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_complete: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("public_users.id"), nullable=False
    )
    user: Mapped["PublicUser"] = relationship(
        "PublicUser", back_populates="assignments"
    )
    assignment_statistics: Mapped["AssignmentStatistic"] = relationship(
        "AssignmentStatistic",
        uselist=False,
        back_populates="assignment",
        cascade="all, delete",
    )

    @validates("title")
    def validate_title(self, key: str, value: str) -> str:
        if 1 <= len(value) <= 50:
            return value
        else:
            raise ValueError(f"title length out of bounds: {len(value)}")

    @validates("max_duration")
    def validate_max_duration(self, key: str, value: int) -> int:
        if 1 <= value <= 60 * 24:
            return value
        else:
            raise ValueError(f"max_duration out of bounds: {value}")


class AssignmentStatistic(BaseClass):
    __tablename__ = "assignment_statistics"

    start_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    elapsed_time: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=0
    )  # In Seconds
    end_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    pause_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    assignment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("assignments.id"), nullable=False, unique=True
    )

    assignment: Mapped["Assignment"] = relationship(
        "Assignment", back_populates="assignment_statistics"
    )
