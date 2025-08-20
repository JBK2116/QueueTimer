"""
This module stores the database models for this project
"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func

from .db import Base

# * IN @validates - key=attribute being checked, value=value assigned to attribute on object creation


class BaseClass(Base):
    __abstract__ = True
    id = Column(Integer, primary_key=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)


class PublicUser(BaseClass):
    __tablename__ = "public_users"
    timezone = Column(
        String(length=100), nullable=False
    )  # timezone str received from frontend
    token = Column(
        String(length=36), nullable=False
    )  # stores auto generated uuid4 token


class Assignment(BaseClass):
    __tablename__ = "assignments"
    title = Column(String(length=50), nullable=False)
    max_duration = Column(Integer)  # In Minutes
    is_started = Column(Boolean, default=False, nullable=False)
    is_paused = Column(Boolean, default=False, nullable=False)
    is_complete = Column(Boolean, default=False, nullable=False)
    assignment_statistics = relationship(
        "AssignmentStatistics", uselist=False, back_populates="assignment"
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
    start_time = Column(DateTime(timezone=True), nullable=True)
    elapsed_time = Column(Integer)  # In Seconds
    end_time = Column(DateTime(timezone=True), nullable=True)
    pause_count = Column(Integer, default=0)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    assignment = relationship("Assignment", back_populates="assignment_statistics")
