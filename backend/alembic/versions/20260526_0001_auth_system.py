"""create auth system

Revision ID: 20260526_0001
Revises:
Create Date: 2026-05-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260526_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    user_role = postgresql.ENUM("USER", "ADMIN", "CUSTOM", name="user_role")
    user_role.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "auth_users",
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=160), nullable=True),
        sa.Column("role", user_role, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_verified", sa.Boolean(), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_auth_users_email"), "auth_users", ["email"], unique=False)

    op.create_table(
        "auth_user_sessions",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_key", sa.String(length=64), nullable=False),
        sa.Column("refresh_family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("device_name", sa.String(length=160), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["auth_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("refresh_family_id"),
        sa.UniqueConstraint("session_key"),
    )
    op.create_index(op.f("ix_auth_user_sessions_refresh_family_id"), "auth_user_sessions", ["refresh_family_id"], unique=False)
    op.create_index(op.f("ix_auth_user_sessions_session_key"), "auth_user_sessions", ["session_key"], unique=False)
    op.create_index("ix_auth_user_sessions_user_active", "auth_user_sessions", ["user_id", "revoked_at"], unique=False)

    op.create_table(
        "auth_refresh_tokens",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("family_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("replaced_by_token_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["auth_users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["session_id"], ["auth_user_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(op.f("ix_auth_refresh_tokens_family_id"), "auth_refresh_tokens", ["family_id"], unique=False)
    op.create_index(op.f("ix_auth_refresh_tokens_token_hash"), "auth_refresh_tokens", ["token_hash"], unique=False)
    op.create_index("ix_auth_refresh_tokens_user_active", "auth_refresh_tokens", ["user_id", "revoked_at"], unique=False)
    op.create_index("ix_auth_refresh_tokens_session_active", "auth_refresh_tokens", ["session_id", "revoked_at"], unique=False)

    for table_name in ("auth_password_reset_tokens", "auth_email_verification_tokens"):
        op.create_table(
            table_name,
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("token_hash", sa.String(length=128), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["auth_users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("token_hash"),
        )
        op.create_index(op.f(f"ix_{table_name}_token_hash"), table_name, ["token_hash"], unique=False)

    op.create_table(
        "auth_audit_logs",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["auth_users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_auth_audit_logs_event"), "auth_audit_logs", ["event"], unique=False)
    op.create_index("ix_auth_audit_logs_user_event", "auth_audit_logs", ["user_id", "event"], unique=False)

    op.create_table(
        "auth_blacklisted_tokens",
        sa.Column("jti", sa.String(length=64), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.String(length=80), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["auth_users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("jti"),
    )
    op.create_index(op.f("ix_auth_blacklisted_tokens_jti"), "auth_blacklisted_tokens", ["jti"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_auth_blacklisted_tokens_jti"), table_name="auth_blacklisted_tokens")
    op.drop_table("auth_blacklisted_tokens")
    op.drop_index("ix_auth_audit_logs_user_event", table_name="auth_audit_logs")
    op.drop_index(op.f("ix_auth_audit_logs_event"), table_name="auth_audit_logs")
    op.drop_table("auth_audit_logs")
    for table_name in ("auth_email_verification_tokens", "auth_password_reset_tokens"):
        op.drop_index(op.f(f"ix_{table_name}_token_hash"), table_name=table_name)
        op.drop_table(table_name)
    op.drop_index("ix_auth_refresh_tokens_session_active", table_name="auth_refresh_tokens")
    op.drop_index("ix_auth_refresh_tokens_user_active", table_name="auth_refresh_tokens")
    op.drop_index(op.f("ix_auth_refresh_tokens_token_hash"), table_name="auth_refresh_tokens")
    op.drop_index(op.f("ix_auth_refresh_tokens_family_id"), table_name="auth_refresh_tokens")
    op.drop_table("auth_refresh_tokens")
    op.drop_index("ix_auth_user_sessions_user_active", table_name="auth_user_sessions")
    op.drop_index(op.f("ix_auth_user_sessions_session_key"), table_name="auth_user_sessions")
    op.drop_index(op.f("ix_auth_user_sessions_refresh_family_id"), table_name="auth_user_sessions")
    op.drop_table("auth_user_sessions")
    op.drop_index(op.f("ix_auth_users_email"), table_name="auth_users")
    op.drop_table("auth_users")
    postgresql.ENUM(name="user_role").drop(op.get_bind(), checkfirst=True)
