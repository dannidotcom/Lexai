import pytest
from httpx import ASGITransport, AsyncClient

from backend.app.core.session import AsyncSessionLocal, init_auth_db
from app.main import app
from app.models.auth import User, UserRole
from app.modules.auth_engine.security import hash_password


pytestmark = pytest.mark.asyncio


async def test_register_me_and_admin_flow() -> None:
    await init_auth_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        register = await client.post(
            "/api/auth/register",
            json={
                "email": "new-user@example.com",
                "password": "StrongPass123!",
                "confirm_password": "StrongPass123!",
                "full_name": "New User",
            },
        )
        assert register.status_code in {201, 409}

        async with AsyncSessionLocal() as session:
            user = User(
                email="admin@example.com",
                hashed_password=hash_password("StrongPass123!"),
                full_name="Admin",
                role=UserRole.ADMIN,
                is_verified=True,
                is_active=True,
            )
            session.add(user)
            await session.commit()

        login = await client.post("/api/auth/login", json={"email": "admin@example.com", "password": "StrongPass123!"})
        assert login.status_code == 200
        body = login.json()
        assert body["user"]["role"] == "ADMIN"

        me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
        assert me.status_code == 200

        users = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {body['access_token']}"})
        assert users.status_code == 200


async def test_forgot_password_is_enumeration_safe() -> None:
    await init_auth_db()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        response = await client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
        assert response.status_code == 200
