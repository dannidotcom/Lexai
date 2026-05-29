from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.db_models import Message, Session as SessionModel
from app.modules.ai_generation_engine.application import ai_service
from app.modules.ai_generation_engine.prompt_service import PromptConfigurationError, prompt_service
from app.schemas.schemas import AiAnalyzeInputSchema, AiQueryInputSchema, AiResponseSchema, MessageSchema, SessionInputSchema, SessionSchema

router = APIRouter(prefix="/ai", tags=["AI Interactions"])


async def _ensure_feature_prompt(db: AsyncSession, feature_id: str) -> None:
    try:
        await prompt_service.resolve_active_prompt(db, feature_id)
    except PromptConfigurationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _default_feature_for_task(task_type: str) -> str:
    return f"ai.{task_type}"


@router.post("/query", response_model=AiResponseSchema)
async def ai_query(data: AiQueryInputSchema, db: AsyncSession = Depends(get_db)):
    data.featureId = data.featureId or _default_feature_for_task("query")
    await _ensure_feature_prompt(db, data.featureId)
    return await ai_service.query(data, db)


@router.post("/query/stream")
async def ai_query_stream(data: AiQueryInputSchema, db: AsyncSession = Depends(get_db)):
    data.featureId = data.featureId or _default_feature_for_task("query")
    await _ensure_feature_prompt(db, data.featureId)
    return StreamingResponse(
        ai_service.query_stream(data, db),
        media_type="text/event-stream",
    )


@router.post("/explain", response_model=AiResponseSchema)
async def ai_explain(data: AiQueryInputSchema, db: AsyncSession = Depends(get_db)):
    from app.schemas.schemas import TaskType

    data.taskType = TaskType.EXPLAIN
    data.featureId = data.featureId or _default_feature_for_task("explain")
    await _ensure_feature_prompt(db, data.featureId)
    return await ai_service.query(data, db)


@router.post("/explain/stream")
async def ai_explain_stream(data: AiQueryInputSchema, db: AsyncSession = Depends(get_db)):
    from app.schemas.schemas import TaskType

    data.taskType = TaskType.EXPLAIN
    data.featureId = data.featureId or _default_feature_for_task("explain")
    await _ensure_feature_prompt(db, data.featureId)
    return StreamingResponse(
        ai_service.query_stream(data, db),
        media_type="text/event-stream",
    )


@router.post("/analyze", response_model=AiResponseSchema)
async def ai_analyze(data: AiAnalyzeInputSchema, db: AsyncSession = Depends(get_db)):
    data.featureId = data.featureId or _default_feature_for_task("analyze")
    await _ensure_feature_prompt(db, data.featureId)
    return await ai_service.analyze(data, db)


@router.post("/analyze/stream")
async def ai_analyze_stream(data: AiAnalyzeInputSchema, db: AsyncSession = Depends(get_db)):
    data.featureId = data.featureId or _default_feature_for_task("analyze")
    await _ensure_feature_prompt(db, data.featureId)
    return StreamingResponse(
        ai_service.analyze_stream(data, db),
        media_type="text/event-stream",
    )


@router.get("/sessions", response_model=List[SessionSchema])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(
                SessionModel.id,
                SessionModel.title,
                SessionModel.domain,
                SessionModel.created_at,
                SessionModel.updated_at,
                func.count(Message.id).label("message_count"),
            )
            .outerjoin(Message, Message.session_id == SessionModel.id)
            .group_by(
                SessionModel.id,
                SessionModel.title,
                SessionModel.domain,
                SessionModel.created_at,
                SessionModel.updated_at,
            )
            .order_by(SessionModel.updated_at.desc())
        )
    ).all()
    return [
        SessionSchema(
            id=row.id,
            title=row.title,
            domain=row.domain,
            messageCount=row.message_count,
            createdAt=row.created_at.isoformat(),
            updatedAt=row.updated_at.isoformat(),
        )
        for row in rows
    ]


@router.post("/sessions", response_model=SessionSchema, status_code=201)
async def create_session(data: SessionInputSchema, db: AsyncSession = Depends(get_db)):
    session = SessionModel(title=data.title, domain=data.domain)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionSchema(
        id=session.id,
        title=session.title,
        domain=session.domain,
        messageCount=0,
        createdAt=session.created_at.isoformat(),
        updatedAt=session.updated_at.isoformat(),
    )


@router.get("/sessions/{sessionId}/messages", response_model=List[MessageSchema])
async def get_session_messages(sessionId: str, db: AsyncSession = Depends(get_db)):
    session = await db.scalar(select(SessionModel).where(SessionModel.id == sessionId))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = (await db.execute(select(Message).where(Message.session_id == sessionId).order_by(Message.created_at))).scalars().all()
    result = []
    for m in messages:
        from app.schemas.schemas import CitationSchema

        citations = []
        if m.citations:
            for c in m.citations:
                try:
                    citations.append(CitationSchema(**c))
                except Exception:
                    pass
        result.append(
            MessageSchema(
                id=m.id,
                sessionId=m.session_id,
                role=m.role,
                content=m.content,
                citations=citations,
                createdAt=m.created_at.isoformat(),
            )
        )
    return result


__all__ = ["router"]
