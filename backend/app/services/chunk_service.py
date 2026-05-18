from __future__ import annotations
import re
from typing import List, Dict, Any
from app.core.config import settings
from app.core.logging import logger


def _split_text(text: str, chunk_size: int, overlap: int) -> List[str]:
    separators = ["\n\n", "\n", ". ", " ", ""]
    chunks = []

    def split_recursive(t: str, seps: List[str]) -> List[str]:
        if not t:
            return []
        if len(t) <= chunk_size:
            return [t.strip()] if t.strip() else []
        if not seps:
            return [t[i:i+chunk_size] for i in range(0, len(t), chunk_size - overlap)]

        sep = seps[0]
        parts = t.split(sep) if sep else list(t)
        results = []
        current = ""

        for part in parts:
            candidate = current + (sep if current else "") + part
            if len(candidate) <= chunk_size:
                current = candidate
            else:
                if current:
                    results.append(current.strip())
                if len(part) > chunk_size:
                    sub = split_recursive(part, seps[1:])
                    results.extend(sub)
                    current = ""
                else:
                    current = part

        if current:
            results.append(current.strip())

        return [r for r in results if r]

    raw_chunks = split_recursive(text, separators)

    for i, chunk in enumerate(raw_chunks):
        if i > 0 and overlap > 0:
            prev = raw_chunks[i - 1]
            overlap_text = prev[-overlap:] if len(prev) > overlap else prev
            chunk = overlap_text + " " + chunk
        chunks.append(chunk)

    return chunks


def _extract_article_id(text: str) -> str | None:
    patterns = [
        r"Article\s+(L?\d+[\-\.]\d*(?:[\-\.]\d+)*)",
        r"Art\.\s+(L?\d+[\-\.]\d*(?:[\-\.]\d+)*)",
        r"Art\s+(L?\d+[\-\.]\d*(?:[\-\.]\d+)*)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)
    return None


def _detect_statut_juridique(text: str, metadata: Dict[str, Any]) -> str:
    text_upper = text.upper()
    if "ABROG" in text_upper:
        return "ABROGE"
    if "VIGUEUR_ETEN" in text_upper or "VIGUEUR ETENDU" in text_upper:
        return "VIGUEUR_ETEN"
    return metadata.get("statut_juridique", "VIGUEUR")


def build_chunks(
    content: str,
    document_id: str,
    domain: str,
    source: str,
    document_title: str,
    metadata: Dict[str, Any] | None = None,
) -> List[Dict[str, Any]]:
    if metadata is None:
        metadata = {}

    raw_chunks = _split_text(
        content,
        chunk_size=settings.chunk_size,
        overlap=settings.chunk_overlap,
    )

    chunks = []
    for i, chunk_text in enumerate(raw_chunks):
        if not chunk_text.strip():
            continue

        statut = _detect_statut_juridique(chunk_text, metadata)
        if statut == "ABROGE":
            logger.debug("Skipping abrogated chunk", document_id=document_id, index=i)
            continue

        article_id = _extract_article_id(chunk_text)

        section_path = metadata.get("section_path", f"section_{i}")
        if i > 0:
            section_path = f"{metadata.get('section_path', 'section')}/{i}"

        chunks.append({
            "document_id": document_id,
            "content": chunk_text,
            "section_path": section_path,
            "article_id": article_id,
            "statut_juridique": statut,
            "chunk_index": i,
            "embedding_generated": False,
            "qdrant_id": None,
            "domain": domain,
            "source": source,
            "document_title": document_title,
        })

    logger.info(
        "Built chunks",
        document_id=document_id,
        total_raw=len(raw_chunks),
        total_valid=len(chunks),
    )
    return chunks
