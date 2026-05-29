from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import require_permission
from app.models.auth import User
from app.modules.ai_generation_engine.prompt_crud_service import prompt_crud_service
from app.schemas.schemas import (
    PromptBaseCreateSchema,
    PromptBaseReadSchema,
    PromptBaseUpdateSchema,
    PromptTemplateCreateSchema,
    PromptTemplateReadSchema,
    PromptTemplateUpdateSchema,
    PromptVersionCreateSchema,
    PromptVersionReadSchema,
    PromptVersionUpdateSchema,
)

router = APIRouter(prefix="/ai/prompts", tags=["AI Prompt Administration"])


def _map_service_error(exc: ValueError) -> HTTPException:
    message = str(exc)
    if "already exists" in message:
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)


@router.get("/bases", response_model=list[PromptBaseReadSchema])
async def list_prompt_bases(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_permission("admin:prompts:read")),
    db: AsyncSession = Depends(get_db),
):
    return await prompt_crud_service.list_prompt_bases(db, status=status_filter, limit=limit, offset=offset)


@router.get("/bases/{prompt_base_id}", response_model=PromptBaseReadSchema)
async def get_prompt_base(
    prompt_base_id: uuid.UUID,
    _: User = Depends(require_permission("admin:prompts:read")),
    db: AsyncSession = Depends(get_db),
):
    prompt_base = await prompt_crud_service.get_prompt_base(db, prompt_base_id)
    if not prompt_base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt base not found")
    return prompt_base


@router.post("/bases", response_model=PromptBaseReadSchema, status_code=status.HTTP_201_CREATED)
async def create_prompt_base(
    payload: PromptBaseCreateSchema,
    _: User = Depends(require_permission("admin:prompts:create")),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await prompt_crud_service.create_prompt_base(db, payload)
    except ValueError as exc:
        raise _map_service_error(exc) from exc


@router.patch("/bases/{prompt_base_id}", response_model=PromptBaseReadSchema)
async def update_prompt_base(
    prompt_base_id: uuid.UUID,
    payload: PromptBaseUpdateSchema,
    _: User = Depends(require_permission("admin:prompts:update")),
    db: AsyncSession = Depends(get_db),
):
    prompt_base = await prompt_crud_service.get_prompt_base(db, prompt_base_id)
    if not prompt_base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt base not found")

    try:
        return await prompt_crud_service.update_prompt_base(db, prompt_base, payload)
    except ValueError as exc:
        raise _map_service_error(exc) from exc


@router.delete("/bases/{prompt_base_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt_base(
    prompt_base_id: uuid.UUID,
    _: User = Depends(require_permission("admin:prompts:delete")),
    db: AsyncSession = Depends(get_db),
):
    prompt_base = await prompt_crud_service.get_prompt_base(db, prompt_base_id)
    if not prompt_base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt base not found")

    try:
        await prompt_crud_service.delete_prompt_base(db, prompt_base)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Prompt base is still referenced") from exc


@router.get("/templates", response_model=list[PromptTemplateReadSchema])
async def list_prompt_templates(
    feature_id: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_permission("admin:prompts:read")),
    db: AsyncSession = Depends(get_db),
):
    return await prompt_crud_service.list_prompt_templates(
        db,
        feature_id=feature_id,
        status=status_filter,
        limit=limit,
        offset=offset,
    )


@router.get("/templates/{template_id}", response_model=PromptTemplateReadSchema)
async def get_prompt_template(
    template_id: uuid.UUID,
    _: User = Depends(require_permission("admin:prompts:read")),
    db: AsyncSession = Depends(get_db),
):
    template = await prompt_crud_service.get_prompt_template(db, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt template not found")
    return template


@router.post("/templates", response_model=PromptTemplateReadSchema, status_code=status.HTTP_201_CREATED)
async def create_prompt_template(
    payload: PromptTemplateCreateSchema,
    _: User = Depends(require_permission("admin:prompts:create")),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await prompt_crud_service.create_prompt_template(db, payload)
    except ValueError as exc:
        raise _map_service_error(exc) from exc


@router.patch("/templates/{template_id}", response_model=PromptTemplateReadSchema)
async def update_prompt_template(
    template_id: uuid.UUID,
    payload: PromptTemplateUpdateSchema,
    _: User = Depends(require_permission("admin:prompts:update")),
    db: AsyncSession = Depends(get_db),
):
    template = await prompt_crud_service.get_prompt_template(db, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt template not found")

    try:
        return await prompt_crud_service.update_prompt_template(db, template, payload)
    except ValueError as exc:
        raise _map_service_error(exc) from exc


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt_template(
    template_id: uuid.UUID,
    _: User = Depends(require_permission("admin:prompts:delete")),
    db: AsyncSession = Depends(get_db),
):
    template = await prompt_crud_service.get_prompt_template(db, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt template not found")

    try:
        await prompt_crud_service.delete_prompt_template(db, template)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Prompt template is still referenced") from exc


@router.get("/versions", response_model=list[PromptVersionReadSchema])
async def list_prompt_versions(
    feature_id: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(require_permission("admin:prompts:read")),
    db: AsyncSession = Depends(get_db),
):
    return await prompt_crud_service.list_prompt_versions(
        db,
        feature_id=feature_id,
        status=status_filter,
        limit=limit,
        offset=offset,
    )


@router.get("/versions/{prompt_version_id}", response_model=PromptVersionReadSchema)
async def get_prompt_version(
    prompt_version_id: uuid.UUID,
    _: User = Depends(require_permission("admin:prompts:read")),
    db: AsyncSession = Depends(get_db),
):
    prompt_version = await prompt_crud_service.get_prompt_version(db, prompt_version_id)
    if not prompt_version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt version not found")
    return prompt_version


@router.post("/versions", response_model=PromptVersionReadSchema, status_code=status.HTTP_201_CREATED)
async def create_prompt_version(
    payload: PromptVersionCreateSchema,
    _: User = Depends(require_permission("admin:prompts:create")),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await prompt_crud_service.create_prompt_version(db, payload)
    except ValueError as exc:
        raise _map_service_error(exc) from exc


@router.patch("/versions/{prompt_version_id}", response_model=PromptVersionReadSchema)
async def update_prompt_version(
    prompt_version_id: uuid.UUID,
    payload: PromptVersionUpdateSchema,
    _: User = Depends(require_permission("admin:prompts:update")),
    db: AsyncSession = Depends(get_db),
):
    prompt_version = await prompt_crud_service.get_prompt_version(db, prompt_version_id)
    if not prompt_version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt version not found")

    try:
        return await prompt_crud_service.update_prompt_version(db, prompt_version, payload)
    except ValueError as exc:
        raise _map_service_error(exc) from exc


@router.delete("/versions/{prompt_version_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prompt_version(
    prompt_version_id: uuid.UUID,
    _: User = Depends(require_permission("admin:prompts:delete")),
    db: AsyncSession = Depends(get_db),
):
    prompt_version = await prompt_crud_service.get_prompt_version(db, prompt_version_id)
    if not prompt_version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt version not found")

    await prompt_crud_service.delete_prompt_version(db, prompt_version)


__all__ = ["router"]
