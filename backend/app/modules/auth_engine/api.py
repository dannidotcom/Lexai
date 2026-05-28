from app.modules.auth_engine.admin_router import router as admin_router
from app.modules.auth_engine.auth_router import router as auth_router

__all__ = ["auth_router", "admin_router"]
