from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session as DBSession

from app.models.db_models import AiFeatureRegistry, PromptBase, PromptTemplate, PromptVersion


class PromptConfigurationError(RuntimeError):
    pass


@dataclass(slots=True)
class ResolvedPromptConfiguration:
    feature_id: str
    domain: str
    sub_domain: str | None
    task_type: str
    prompt_version: int
    system_prompt: str
    user_prompt_template: str


class PromptService:
    _placeholder_pattern = re.compile(r"{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}")

    def resolve_active_prompt(self, db: DBSession, feature_id: str) -> ResolvedPromptConfiguration:
        feature = (
            db.query(AiFeatureRegistry)
            .filter(
                AiFeatureRegistry.feature_id == feature_id,
                AiFeatureRegistry.enabled.is_(True),
            )
            .first()
        )
        if not feature:
            raise PromptConfigurationError(f"No enabled feature registry found for feature_id '{feature_id}'")

        template = (
            db.query(PromptTemplate)
            .filter(
                PromptTemplate.id == feature.template_id,
                PromptTemplate.status == "active",
            )
            .order_by(PromptTemplate.version.desc())
            .first()
        )
        if not template:
            raise PromptConfigurationError(f"No active prompt_template found for feature_id '{feature_id}'")

        prompt_base = (
            db.query(PromptBase)
            .filter(PromptBase.status == "active")
            .order_by(PromptBase.version.desc(), PromptBase.created_at.desc())
            .first()
        )
        if not prompt_base:
            raise PromptConfigurationError(f"No active prompt_base found for feature_id '{feature_id}'")

        prompt_version = (
            db.query(PromptVersion)
            .filter(
                PromptVersion.feature_id == feature_id,
                PromptVersion.prompt_base_id == prompt_base.id,
                PromptVersion.template_id == template.id,
                PromptVersion.status == "active",
            )
            .order_by(PromptVersion.version.desc(), PromptVersion.created_at.desc())
            .first()
        )
        if not prompt_version:
            raise PromptConfigurationError(f"No active prompt_version found for feature_id '{feature_id}'")

        system_prompt = self._join_non_empty(
            prompt_base.content,
            template.business_rules,
            template.expected_format,
            prompt_version.system_prompt,
        )
        user_prompt_template = self._join_non_empty(
            template.template_content,
            prompt_version.user_prompt_template,
        )

        if not system_prompt.strip():
            raise PromptConfigurationError(f"Active system prompt is empty for feature_id '{feature_id}'")
        if not user_prompt_template.strip():
            raise PromptConfigurationError(f"Active user prompt template is empty for feature_id '{feature_id}'")

        return ResolvedPromptConfiguration(
            feature_id=feature.feature_id,
            domain=feature.domain,
            sub_domain=feature.sub_domain,
            task_type=feature.task_type,
            prompt_version=prompt_version.version,
            system_prompt=system_prompt,
            user_prompt_template=user_prompt_template,
        )

    def render_user_prompt(self, config: ResolvedPromptConfiguration, values: dict[str, Any]) -> str:
        variables = {k: "" if v is None else str(v) for k, v in values.items()}

        def replace(match: re.Match[str]) -> str:
            key = match.group(1)
            if key not in variables:
                raise PromptConfigurationError(
                    f"Missing prompt variable '{key}' for feature_id '{config.feature_id}'"
                )
            return variables[key]

        return self._placeholder_pattern.sub(replace, config.user_prompt_template)

    @staticmethod
    def _join_non_empty(*parts: str | None) -> str:
        return "\n\n".join(part.strip() for part in parts if part and part.strip())


prompt_service = PromptService()


__all__ = [
    "PromptConfigurationError",
    "ResolvedPromptConfiguration",
    "PromptService",
    "prompt_service",
]
