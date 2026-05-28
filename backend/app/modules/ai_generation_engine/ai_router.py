from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.db_models import Message, Session as SessionModel
from app.modules.ai_generation_engine.prompt_service import PromptConfigurationError, prompt_service
from app.schemas.schemas import AiAnalyzeInputSchema, AiQueryInputSchema, AiResponseSchema, MessageSchema, SessionInputSchema, SessionSchema
from app.modules.ai_generation_engine.application import ai_service

router = APIRouter(prefix="/ai", tags=["AI Interactions"])


def _ensure_feature_prompt(db: Session, feature_id: str) -> None:
    try:
        prompt_service.resolve_active_prompt(db, feature_id)
    except PromptConfigurationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _default_feature_for_task(task_type: str) -> str:
    return f"ai.{task_type}"


@router.post("/query", response_model=AiResponseSchema)
async def ai_query(data: AiQueryInputSchema, db: Session = Depends(get_db)):
    data.featureId = data.featureId or _default_feature_for_task("query")
    _ensure_feature_prompt(db, data.featureId)
    return await ai_service.query(data, db)


@router.post("/query/stream")
async def ai_query_stream(data: AiQueryInputSchema, db: Session = Depends(get_db)):
    data.featureId = data.featureId or _default_feature_for_task("query")
    _ensure_feature_prompt(db, data.featureId)
    return StreamingResponse(
        ai_service.query_stream(data, db),
        media_type="text/event-stream",
    )


@router.post("/explain", response_model=AiResponseSchema)
async def ai_explain(data: AiQueryInputSchema, db: Session = Depends(get_db)):
    from app.schemas.schemas import TaskType

    data.taskType = TaskType.EXPLAIN
    data.featureId = data.featureId or _default_feature_for_task("explain")
    _ensure_feature_prompt(db, data.featureId)
    return await ai_service.query(data, db)


@router.post("/explain/stream")
async def ai_explain_stream(data: AiQueryInputSchema, db: Session = Depends(get_db)):
    from app.schemas.schemas import TaskType

    data.taskType = TaskType.EXPLAIN
    data.featureId = data.featureId or _default_feature_for_task("explain")
    _ensure_feature_prompt(db, data.featureId)
    return StreamingResponse(
        ai_service.query_stream(data, db),
        media_type="text/event-stream",
    )


@router.post("/analyze", response_model=AiResponseSchema)
async def ai_analyze(data: AiAnalyzeInputSchema, db: Session = Depends(get_db)):
    data.featureId = data.featureId or _default_feature_for_task("analyze")
    _ensure_feature_prompt(db, data.featureId)
    return await ai_service.analyze(data, db)


@router.post("/analyze/stream")
async def ai_analyze_stream(data: AiAnalyzeInputSchema, db: Session = Depends(get_db)):
    data.featureId = data.featureId or _default_feature_for_task("analyze")
    _ensure_feature_prompt(db, data.featureId)
    return StreamingResponse(
        ai_service.analyze_stream(data, db),
        media_type="text/event-stream",
    )


@router.get("/sessions", response_model=List[SessionSchema])
def list_sessions(db: Session = Depends(get_db)):
    sessions = db.query(SessionModel).order_by(SessionModel.updated_at.desc()).all()
    return [
        SessionSchema(
            id=s.id,
            title=s.title,
            domain=s.domain,
            messageCount=s.message_count,
            createdAt=s.created_at.isoformat(),
            updatedAt=s.updated_at.isoformat(),
        )
        for s in sessions
    ]


@router.post("/sessions", response_model=SessionSchema, status_code=201)
def create_session(data: SessionInputSchema, db: Session = Depends(get_db)):
    session = SessionModel(title=data.title, domain=data.domain)
    db.add(session)
    db.commit()
    db.refresh(session)
    return SessionSchema(
        id=session.id,
        title=session.title,
        domain=session.domain,
        messageCount=0,
        createdAt=session.created_at.isoformat(),
        updatedAt=session.updated_at.isoformat(),
    )


@router.get("/sessions/{sessionId}/messages", response_model=List[MessageSchema])
def get_session_messages(sessionId: str, db: Session = Depends(get_db)):
    session = db.query(SessionModel).filter(SessionModel.id == sessionId).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = db.query(Message).filter(Message.session_id == sessionId).order_by(Message.created_at).all()
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
