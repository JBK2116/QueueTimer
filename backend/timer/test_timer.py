"""
Test suite for the timer application

Will seperate into multiple files if this one
grows too large
"""

from typing import AsyncGenerator

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from ..conftest import async_test_session_factory
from ..db import get_db
from ..main import app
from . import schemas


# Make the tests use the queuetimer_pytest database session
async def override_get_db() -> AsyncGenerator[AsyncSession]:
    async with async_test_session_factory() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app=app)


class TestCreateAssignment:
    async def test_create_assignment(self, create_user: str) -> None:
        """Test valid create assignment post request"""
        user_token: str = create_user
        response = client.post(
            url="/api/assignments/",
            headers={"X-User-ID": f"{user_token}"},
            json={"title": "TestTitle", "duration": "03:25"},
        )
        response_obj = schemas.GetAssignment(**response.json())
        assert response.status_code == 200
        assert isinstance(response_obj, schemas.GetAssignment)
        assert response_obj.title == "TestTitle"
