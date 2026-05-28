# LexIA Backend Auth Platform

FastAPI production-ready authentication module for LexIA with PostgreSQL, async SQLAlchemy, Alembic, JWT access tokens, opaque rotating refresh tokens, HTTPOnly cookies, role-based access control and security audit logs.

## Stack

- Python 3.12
- FastAPI + Swagger OpenAPI at `/docs`
- SQLAlchemy async + PostgreSQL
- Alembic migrations
- Pydantic validation
- bcrypt password hashing
- JWT access token with configurable expiration
- HTTPOnly secure cookies for access and refresh tokens
- Nginx reverse proxy and Docker Compose

## Auth Features

- Register with strong password validation and email verification token
- Login with brute-force throttling and structured audit logs
- Logout with refresh-token revocation
- Refresh token rotation with reuse detection
- Forgot password and reset password tokens with one-time use
- Current user endpoint
- USER and ADMIN roles
- Admin user list and delete endpoints
- Security headers, CORS, CSRF origin checks, strict request validation

## Environment

Copy `.env.example` to `.env` and set real values:

```bash
DATABASE_URL=postgresql://lexia_user:change_me@postgres:5432/lexia_db
SECRET_KEY=replace-with-at-least-32-random-bytes
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=14
RESET_PASSWORD_TOKEN_EXPIRE_MINUTES=30
VERIFY_EMAIL_TOKEN_EXPIRE_MINUTES=1440
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=secret
SMTP_FROM=security@example.com
```

## Local Development

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8080
```

## Docker

```bash
docker compose --env-file .env up --build
```

Services:

- Frontend: `http://localhost`
- Backend API: `http://localhost/api`
- Swagger: `http://localhost/api` proxied, direct backend docs at `http://localhost:8080/docs`
- PostgreSQL: `localhost:5432`

## API

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/verify-email
GET    /api/auth/me
GET    /api/admin/users
DELETE /api/admin/users/{id}
```

Import `postman_collection.json` into Postman for examples.

## Tests

```bash
pytest
```

The CI workflow runs Python tests, Alembic migrations, TypeScript checks and the frontend build.

## Production Notes

- Use a long random `SECRET_KEY` and rotate it with a planned token invalidation window.
- Set `COOKIE_SECURE=true` behind HTTPS.
- Keep `CORS_ORIGINS` limited to trusted frontend origins.
- Use a managed SMTP provider for email delivery.
- Run Alembic migrations as a release step instead of relying on `create_all`.
- Replace the in-process brute-force limiter with Redis for horizontally scaled deployments.
