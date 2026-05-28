from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.database import SessionLocal, init_db
from app.models.db_models import AiFeatureRegistry, PromptBase, PromptTemplate, PromptVersion


BASE_PROMPT_VERSION = 1

BASE_PROMPT_CONTENT = """
Tu es LexIA, moteur IA interne.

Regles absolues:
- Reponds en francais.
- Utilise uniquement le contexte fourni.
- N'invente pas de sources.
- Si une information manque, indique-le explicitement.
- Ne donne jamais de conseil juridique definitif.
- La validation humaine reste obligatoire.
""".strip()


@dataclass(slots=True)
class FeatureSeed:
    feature_id: str
    name: str
    module_php: str
    task_type: str
    domain: str
    sub_domain: str | None
    expected_format: str
    business_rules: str
    template_content: str
    system_prompt: str
    user_prompt_template: str
    required_permissions: list[str]
    mode: str = "sync"
    risk_level: str = "high"
    template_version: int = 1
    prompt_version: int = 1


FEATURES: list[FeatureSeed] = [
    FeatureSeed(
        feature_id="ai.query",
        name="LexIA Query",
        module_php="Lexia\\Ai\\QueryModule",
        task_type="query",
        domain="juridique",
        sub_domain=None,
        expected_format="1) Reponse synthetique 2) Analyse basee sur le contexte 3) Sources utilisees",
        business_rules="Refuser toute extrapolation sans contexte explicite.",
        template_content="""
CONTEXTE:
{{context}}

QUESTION:
{{question}}

DOMAINE: {{domain}}
SOUS_DOMAINE: {{sub_domain}}
CONTEXTE_METIER: {{business_context}}
""".strip(),
        system_prompt="""
Mode QUERY.
Tu reponds strictement a partir du contexte fourni.
Tu dois signaler toute incertitude.
""".strip(),
        user_prompt_template="""
Rends une reponse operationnelle en trois sections:
1) Reponse courte
2) Raisonnement base sur les sources
3) Liste des sources
""".strip(),
        required_permissions=["ai:query"],
    ),
    FeatureSeed(
        feature_id="ai.explain",
        name="LexIA Explain",
        module_php="Lexia\\Ai\\ExplainModule",
        task_type="explain",
        domain="juridique",
        sub_domain=None,
        expected_format="1) Explication simple 2) Points clefs 3) Sources utilisees",
        business_rules="Le ton doit rester pedagogique et neutre.",
        template_content="""
CONTEXTE:
{{context}}

CONCEPT_A_EXPLIQUER:
{{question}}

DOMAINE: {{domain}}
SOUS_DOMAINE: {{sub_domain}}
CONTEXTE_METIER: {{business_context}}
""".strip(),
        system_prompt="""
Mode EXPLAIN.
Explique avec clarte sans deformer les sources.
""".strip(),
        user_prompt_template="""
Structure la sortie:
1) Definition simple
2) Details utiles
3) Sources
""".strip(),
        required_permissions=["ai:explain"],
    ),
    FeatureSeed(
        feature_id="ai.analyze",
        name="LexIA Analyze",
        module_php="Lexia\\Ai\\AnalyzeModule",
        task_type="analyze",
        domain="juridique",
        sub_domain=None,
        expected_format="1) Resume 2) Analyse juridique 3) Risques 4) Zones d'incertitude 5) Sources",
        business_rules="Toujours mentionner que la conclusion doit etre validee par un humain.",
        template_content="""
CONTEXTE:
{{context}}

QUESTION:
{{question}}

SITUATION:
{{situation}}

DOMAINE: {{domain}}
SOUS_DOMAINE: {{sub_domain}}
CONTEXTE_METIER: {{business_context}}
""".strip(),
        system_prompt="""
Mode ANALYZE.
Sois structure, factuel et prudent.
""".strip(),
        user_prompt_template="""
Structure la reponse:
1) Resume
2) Analyse
3) Risques
4) Incertitudes
5) Sources
""".strip(),
        required_permissions=["ai:analyze"],
    ),
]


def _upsert_prompt_base(db: Session) -> PromptBase:
    prompt_base = db.query(PromptBase).filter(PromptBase.version == BASE_PROMPT_VERSION).first()
    if not prompt_base:
        prompt_base = PromptBase(
            content=BASE_PROMPT_CONTENT,
            version=BASE_PROMPT_VERSION,
            status="active",
        )
        db.add(prompt_base)
    else:
        prompt_base.content = BASE_PROMPT_CONTENT
        prompt_base.status = "active"

    db.flush()
    return prompt_base


def _upsert_prompt_template(db: Session, feature: FeatureSeed) -> PromptTemplate:
    template = (
        db.query(PromptTemplate)
        .filter(
            PromptTemplate.feature_id == feature.feature_id,
            PromptTemplate.version == feature.template_version,
        )
        .first()
    )

    if not template:
        template = PromptTemplate(
            feature_id=feature.feature_id,
            name=feature.name,
            domain=feature.domain,
            sub_domain=feature.sub_domain,
            task_type=feature.task_type,
            expected_format=feature.expected_format,
            business_rules=feature.business_rules,
            template_content=feature.template_content,
            version=feature.template_version,
            status="active",
        )
        db.add(template)
    else:
        template.name = feature.name
        template.domain = feature.domain
        template.sub_domain = feature.sub_domain
        template.task_type = feature.task_type
        template.expected_format = feature.expected_format
        template.business_rules = feature.business_rules
        template.template_content = feature.template_content
        template.status = "active"

    db.flush()
    return template


def _upsert_feature_registry(db: Session, feature: FeatureSeed, template: PromptTemplate) -> AiFeatureRegistry:
    registry = db.query(AiFeatureRegistry).filter(AiFeatureRegistry.feature_id == feature.feature_id).first()

    if not registry:
        registry = AiFeatureRegistry(
            feature_id=feature.feature_id,
            module_php=feature.module_php,
            domain=feature.domain,
            sub_domain=feature.sub_domain,
            task_type=feature.task_type,
            template_id=template.id,
            mode=feature.mode,
            risk_level=feature.risk_level,
            enabled=True,
            required_permissions=feature.required_permissions,
        )
        db.add(registry)
    else:
        registry.module_php = feature.module_php
        registry.domain = feature.domain
        registry.sub_domain = feature.sub_domain
        registry.task_type = feature.task_type
        registry.template_id = template.id
        registry.mode = feature.mode
        registry.risk_level = feature.risk_level
        registry.enabled = True
        registry.required_permissions = feature.required_permissions

    db.flush()
    return registry


def _upsert_prompt_version(db: Session, feature: FeatureSeed, prompt_base: PromptBase, template: PromptTemplate) -> PromptVersion:
    prompt_version = (
        db.query(PromptVersion)
        .filter(
            PromptVersion.feature_id == feature.feature_id,
            PromptVersion.version == feature.prompt_version,
        )
        .first()
    )

    if not prompt_version:
        prompt_version = PromptVersion(
            feature_id=feature.feature_id,
            prompt_base_id=prompt_base.id,
            template_id=template.id,
            system_prompt=feature.system_prompt,
            user_prompt_template=feature.user_prompt_template,
            version=feature.prompt_version,
            status="active",
        )
        db.add(prompt_version)
    else:
        prompt_version.prompt_base_id = prompt_base.id
        prompt_version.template_id = template.id
        prompt_version.system_prompt = feature.system_prompt
        prompt_version.user_prompt_template = feature.user_prompt_template
        prompt_version.status = "active"

    db.flush()
    return prompt_version


def seed_prompt_data() -> None:
    init_db()
    db = SessionLocal()
    try:
        prompt_base = _upsert_prompt_base(db)

        for feature in FEATURES:
            template = _upsert_prompt_template(db, feature)
            _upsert_feature_registry(db, feature, template)
            _upsert_prompt_version(db, feature, prompt_base, template)

        db.commit()
        print("Seed completed: prompt_base, prompt_templates, ai_feature_registry, prompt_versions")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_prompt_data()
