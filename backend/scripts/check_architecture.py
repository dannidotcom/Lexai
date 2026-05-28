from __future__ import annotations

import ast
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_DIR = ROOT / "app"

BANNED_IMPORT_PREFIXES = (
    "app.services",
    "app.routers",
    "app.api.auth",
    "app.api.admin",
    "app.repositories.auth",
    "app.utils.security",
)

ALLOWED_IMPORTS_BY_LAYER: dict[str, tuple[str, ...]] = {
    "ai_api_engine": (
        "app.ai_api_engine",
        "app.core",
        "app.middleware",
        "app.models",
        "app.modules",
        "app.schemas",
        "app.shared",
    ),
    "modules.auth_engine": (
        "app.core",
        "app.db",
        "app.dependencies",
        "app.models",
        "app.modules.auth_engine",
        "app.schemas",
    ),
    "modules.rag_vecor_engine": (
        "app.core",
        "app.models",
        "app.modules.rag_vecor_engine",
        "app.schemas",
        "app.shared",
    ),
    "modules.rag_search_engine": (
        "app.core",
        "app.models",
        "app.modules.rag_vecor_engine",
        "app.modules.rag_search_engine",
        "app.schemas",
        "app.shared",
    ),
    "modules.ai_generation_engine": (
        "app.core",
        "app.dependencies",
        "app.models",
        "app.modules.ai_generation_engine",
        "app.modules.rag_search_engine",
        "app.schemas",
        "app.shared",
    ),
    "modules.php_ai_adpater": (
        "app.core",
        "app.models",
        "app.modules.ai_generation_engine",
        "app.modules.php_ai_adpater",
        "app.schemas",
        "app.shared",
    ),
    "modules.rag_vector_engine": (
        "app.modules.rag_vecor_engine",
    ),
    "modules.php_ai_adapter": (
        "app.modules.php_ai_adpater",
    ),
}


def detect_layer(file_path: Path) -> str | None:
    rel = file_path.relative_to(APP_DIR)
    if rel.parts[0] == "ai_api_engine":
        return "ai_api_engine"
    if rel.parts[0] == "modules" and len(rel.parts) > 2:
        return f"modules.{rel.parts[1]}"
    return None


def iter_imports(tree: ast.AST):
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                yield alias.name
        elif isinstance(node, ast.ImportFrom) and node.module:
            yield node.module


def is_allowed(import_name: str, allowed_prefixes: tuple[str, ...]) -> bool:
    return any(import_name == prefix or import_name.startswith(prefix + ".") for prefix in allowed_prefixes)


def main() -> int:
    violations: list[str] = []

    for file_path in APP_DIR.rglob("*.py"):
        source = file_path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(file_path))
        layer = detect_layer(file_path)
        allowed_prefixes = ALLOWED_IMPORTS_BY_LAYER.get(layer, ()) if layer else ()

        for import_name in iter_imports(tree):
            if any(import_name == prefix or import_name.startswith(prefix + ".") for prefix in BANNED_IMPORT_PREFIXES):
                violations.append(f"{file_path}: banned import `{import_name}`")
                continue

            if not layer:
                continue
            if not import_name.startswith("app."):
                continue
            if is_allowed(import_name, allowed_prefixes):
                continue

            violations.append(f"{file_path}: disallowed import `{import_name}` for layer `{layer}`")

    if violations:
        print("Architecture checks failed:\n")
        for v in sorted(violations):
            print(f"- {v}")
        return 1

    print("Architecture checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
