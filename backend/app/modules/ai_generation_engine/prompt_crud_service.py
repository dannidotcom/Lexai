from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import AiFeatureRegistry, PromptBase, PromptTemplate, PromptVersion
from app.schemas.schemas import (
    PromptBaseCreateSchema,
    PromptBaseUpdateSchema,
    PromptTemplateCreateSchema,
    PromptTemplateUpdateSchema,
    PromptVersionCreateSchema,
    PromptVersionUpdateSchema,
)


class PromptCrudService:
    async def list_prompt_bases(self, db: AsyncSession, status: str | None, limit: int, offset: int) -> list[PromptBase]:
        stmt = select(PromptBase)
        if status:
            stmt = stmt.where(PromptBase.status == status)
        stmt = stmt.order_by(PromptBase.created_at.desc()).offset(offset).limit(limit)
        return list((await db.execute(stmt)).scalars().all())

    async def get_prompt_base(self, db: AsyncSession, prompt_base_id: uuid.UUID) -> PromptBase | None:
        return await db.scalar(select(PromptBase).where(PromptBase.id == prompt_base_id))

    async def create_prompt_base(self, db: AsyncSession, payload: PromptBaseCreateSchema) -> PromptBase:
        version = payload.version or await self._next_prompt_base_version(db)
        exists = await db.scalar(select(PromptBase).where(PromptBase.version == version))
        if exists:
            raise ValueError(f"PromptBase version {version} already exists")

        prompt_base = PromptBase(
            content=payload.content,
            version=version,
            status=payload.status,
        )
        db.add(prompt_base)
        await db.commit()
        await db.refresh(prompt_base)
        return prompt_base

    async def update_prompt_base(self, db: AsyncSession, prompt_base: PromptBase, payload: PromptBaseUpdateSchema) -> PromptBase:
        changed = False

        if "content" in payload.model_fields_set and payload.content is not None and prompt_base.content != payload.content:
            prompt_base.content = payload.content
            changed = True

        if "status" in payload.model_fields_set and payload.status is not None and prompt_base.status != payload.status:
            prompt_base.status = payload.status
            changed = True

        if not changed:
            raise ValueError("No fields to update")

        await db.commit()
        await db.refresh(prompt_base)
        return prompt_base

    async def delete_prompt_base(self, db: AsyncSession, prompt_base: PromptBase) -> None:
        await db.delete(prompt_base)
        await db.commit()

    async def list_prompt_templates(
        self,
        db: AsyncSession,
        feature_id: str | None,
        status: str | None,
        limit: int,
        offset: int,
    ) -> list[PromptTemplate]:
        stmt = select(PromptTemplate)
        if feature_id:
            stmt = stmt.where(PromptTemplate.feature_id == feature_id)
        if status:
            stmt = stmt.where(PromptTemplate.status == status)
        stmt = stmt.order_by(PromptTemplate.created_at.desc()).offset(offset).limit(limit)
        return list((await db.execute(stmt)).scalars().all())

    async def get_prompt_template(self, db: AsyncSession, template_id: uuid.UUID) -> PromptTemplate | None:
        return await db.scalar(select(PromptTemplate).where(PromptTemplate.id == template_id))

    async def create_prompt_template(self, db: AsyncSession, payload: PromptTemplateCreateSchema) -> PromptTemplate:
        version = payload.version or await self._next_template_version(db, payload.feature_id)
        exists = await db.scalar(
            select(PromptTemplate).where(
                PromptTemplate.feature_id == payload.feature_id,
                PromptTemplate.version == version,
            )
        )
        if exists:
            raise ValueError(f"PromptTemplate version {version} already exists for feature_id '{payload.feature_id}'")

        template = PromptTemplate(
            feature_id=payload.feature_id,
            name=payload.name,
            domain=payload.domain,
            sub_domain=payload.sub_domain,
            task_type=payload.task_type,
            expected_format=payload.expected_format,
            business_rules=payload.business_rules,
            template_content=payload.template_content,
            version=version,
            status=payload.status,
        )
        db.add(template)
        await db.flush()

        feature = await db.scalar(select(AiFeatureRegistry).where(AiFeatureRegistry.feature_id == payload.feature_id))
        if feature:
            feature.template_id = template.id

        await db.commit()
        await db.refresh(template)
        return template

    async def update_prompt_template(self, db: AsyncSession, template: PromptTemplate, payload: PromptTemplateUpdateSchema) -> PromptTemplate:
        changed = False

        if "name" in payload.model_fields_set and payload.name is not None and template.name != payload.name:
            template.name = payload.name
            changed = True

        if "domain" in payload.model_fields_set and payload.domain is not None and template.domain != payload.domain:
            template.domain = payload.domain
            changed = True

        if "sub_domain" in payload.model_fields_set and template.sub_domain != payload.sub_domain:
            template.sub_domain = payload.sub_domain
            changed = True

        if "task_type" in payload.model_fields_set and payload.task_type is not None and template.task_type != payload.task_type:
            template.task_type = payload.task_type
            changed = True

        if (
            "expected_format" in payload.model_fields_set
            and payload.expected_format is not None
            and template.expected_format != payload.expected_format
        ):
            template.expected_format = payload.expected_format
            changed = True

        if "business_rules" in payload.model_fields_set and template.business_rules != payload.business_rules:
            template.business_rules = payload.business_rules
            changed = True

        if (
            "template_content" in payload.model_fields_set
            and payload.template_content is not None
            and template.template_content != payload.template_content
        ):
            template.template_content = payload.template_content
            changed = True

        if "status" in payload.model_fields_set and payload.status is not None and template.status != payload.status:
            template.status = payload.status
            changed = True

        if not changed:
            raise ValueError("No fields to update")

        await db.commit()
        await db.refresh(template)
        return template

    async def delete_prompt_template(self, db: AsyncSession, template: PromptTemplate) -> None:
        await db.delete(template)
        await db.commit()

    async def list_prompt_versions(
        self,
        db: AsyncSession,
        feature_id: str | None,
        status: str | None,
        limit: int,
        offset: int,
    ) -> list[PromptVersion]:
        stmt = select(PromptVersion)
        if feature_id:
            stmt = stmt.where(PromptVersion.feature_id == feature_id)
        if status:
            stmt = stmt.where(PromptVersion.status == status)
        stmt = stmt.order_by(PromptVersion.created_at.desc()).offset(offset).limit(limit)
        return list((await db.execute(stmt)).scalars().all())

    async def get_prompt_version(self, db: AsyncSession, prompt_version_id: uuid.UUID) -> PromptVersion | None:
        return await db.scalar(select(PromptVersion).where(PromptVersion.id == prompt_version_id))

    async def create_prompt_version(self, db: AsyncSession, payload: PromptVersionCreateSchema) -> PromptVersion:
        await self._validate_prompt_version_links(
            db,
            feature_id=payload.feature_id,
            prompt_base_id=payload.prompt_base_id,
            template_id=payload.template_id,
        )

        version = payload.version or await self._next_prompt_version(db, payload.feature_id)
        exists = await db.scalar(
            select(PromptVersion).where(
                PromptVersion.feature_id == payload.feature_id,
                PromptVersion.version == version,
            )
        )
        if exists:
            raise ValueError(f"PromptVersion version {version} already exists for feature_id '{payload.feature_id}'")

        prompt_version = PromptVersion(
            feature_id=payload.feature_id,
            prompt_base_id=payload.prompt_base_id,
            template_id=payload.template_id,
            system_prompt=payload.system_prompt,
            user_prompt_template=payload.user_prompt_template,
            version=version,
            status=payload.status,
        )
        db.add(prompt_version)
        await db.commit()
        await db.refresh(prompt_version)
        return prompt_version

    async def update_prompt_version(
        self,
        db: AsyncSession,
        prompt_version: PromptVersion,
        payload: PromptVersionUpdateSchema,
    ) -> PromptVersion:
        next_prompt_base_id = payload.prompt_base_id or prompt_version.prompt_base_id
        next_template_id = payload.template_id or prompt_version.template_id

        await self._validate_prompt_version_links(
            db,
            feature_id=prompt_version.feature_id,
            prompt_base_id=next_prompt_base_id,
            template_id=next_template_id,
        )

        changed = False

        if "prompt_base_id" in payload.model_fields_set and payload.prompt_base_id and prompt_version.prompt_base_id != payload.prompt_base_id:
            prompt_version.prompt_base_id = payload.prompt_base_id
            changed = True

        if "template_id" in payload.model_fields_set and payload.template_id and prompt_version.template_id != payload.template_id:
            prompt_version.template_id = payload.template_id
            changed = True

        if (
            "system_prompt" in payload.model_fields_set
            and payload.system_prompt is not None
            and prompt_version.system_prompt != payload.system_prompt
        ):
            prompt_version.system_prompt = payload.system_prompt
            changed = True

        if (
            "user_prompt_template" in payload.model_fields_set
            and payload.user_prompt_template is not None
            and prompt_version.user_prompt_template != payload.user_prompt_template
        ):
            prompt_version.user_prompt_template = payload.user_prompt_template
            changed = True

        if "status" in payload.model_fields_set and payload.status is not None and prompt_version.status != payload.status:
            prompt_version.status = payload.status
            changed = True

        if not changed:
            raise ValueError("No fields to update")

        await db.commit()
        await db.refresh(prompt_version)
        return prompt_version

    async def delete_prompt_version(self, db: AsyncSession, prompt_version: PromptVersion) -> None:
        await db.delete(prompt_version)
        await db.commit()

    async def _validate_prompt_version_links(
        self,
        db: AsyncSession,
        *,
        feature_id: str,
        prompt_base_id: uuid.UUID,
        template_id: uuid.UUID,
    ) -> None:
        feature = await db.scalar(select(AiFeatureRegistry).where(AiFeatureRegistry.feature_id == feature_id))
        if not feature:
            raise ValueError(f"Feature '{feature_id}' does not exist in ai_feature_registry")

        prompt_base = await db.scalar(select(PromptBase).where(PromptBase.id == prompt_base_id))
        if not prompt_base:
            raise ValueError("prompt_base_id does not exist")

        template = await db.scalar(select(PromptTemplate).where(PromptTemplate.id == template_id))
        if not template:
            raise ValueError("template_id does not exist")

        if template.feature_id != feature_id:
            raise ValueError("template feature_id mismatch with prompt_version feature_id")

        if feature.template_id != template_id:
            raise ValueError(
                "template_id does not match ai_feature_registry.template_id for this feature_id"
            )

    async def _next_prompt_base_version(self, db: AsyncSession) -> int:
        current = await db.scalar(select(func.max(PromptBase.version)))
        return int((current or 0) + 1)

    async def _next_template_version(self, db: AsyncSession, feature_id: str) -> int:
        current = await db.scalar(select(func.max(PromptTemplate.version)).where(PromptTemplate.feature_id == feature_id))
        return int((current or 0) + 1)

    async def _next_prompt_version(self, db: AsyncSession, feature_id: str) -> int:
        current = await db.scalar(select(func.max(PromptVersion.version)).where(PromptVersion.feature_id == feature_id))
        return int((current or 0) + 1)


prompt_crud_service = PromptCrudService()


__all__ = ["PromptCrudService", "prompt_crud_service"]
