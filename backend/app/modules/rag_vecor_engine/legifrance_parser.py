"""
Parser for Legifrance KALI JSON format (Conventions collectives).
Handles the nested sections -> articles structure, strips HTML,
and maps KALI metadata to LexIA document fields.
"""

from __future__ import annotations

import re
from html.parser import HTMLParser
from typing import Any, Dict, List, Optional


class _HTMLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self._parts: List[str] = []

    def handle_data(self, data: str):
        self._parts.append(data)

    def get_text(self) -> str:
        return re.sub(r"\s+", " ", " ".join(self._parts)).strip()


def strip_html(html: str) -> str:
    if not html:
        return ""
    parser = _HTMLStripper()
    parser.feed(html)
    return parser.get_text()


KALI_DOMAIN_MAP = {
    "KALITEXT": "convention_collective",
    "LEGIARTI": "code",
    "LEGISCTA": "code",
}

JURIS_STATE_LABELS = {
    "VIGUEUR": "En vigueur",
    "VIGUEUR_ETEN": "En vigueur etendu",
    "ABROGE": "Abroge",
    "ABROGE_DIFF": "Abroge differe",
    "MODIFIE": "Modifie",
}


class ParsedArticle:
    __slots__ = ("id", "cid", "num", "content", "etat", "section_path", "section_id", "historique")

    def __init__(
        self,
        id: str,
        cid: str,
        num: str,
        content: str,
        etat: str,
        section_path: str,
        section_id: str,
        historique: Optional[str] = None,
    ):
        self.id = id
        self.cid = cid
        self.num = num
        self.content = content
        self.etat = etat
        self.section_path = section_path
        self.section_id = section_id
        self.historique = historique


class ParsedSection:
    __slots__ = ("id", "title", "etat", "articles", "subsections")

    def __init__(self, id: str, title: str, etat: str):
        self.id = id
        self.title = title
        self.etat = etat
        self.articles: List[ParsedArticle] = []
        self.subsections: List["ParsedSection"] = []


class KaliDocument:
    def __init__(
        self,
        kali_id: str,
        title: str,
        juris_state: str,
        mots_cles: List[str],
        sections: List[ParsedSection],
    ):
        self.kali_id = kali_id
        self.title = title
        self.juris_state = juris_state
        self.mots_cles = mots_cles
        self.sections = sections

    @property
    def all_articles(self) -> List[ParsedArticle]:
        result: List[ParsedArticle] = []

        def _walk(sections: List[ParsedSection]):
            for section in sections:
                result.extend(section.articles)
                _walk(section.subsections)

        _walk(self.sections)
        return result

    @property
    def total_articles(self) -> int:
        return len(self.all_articles)


def _parse_articles(articles_json: List[Dict], section_path: str, section_id: str) -> List[ParsedArticle]:
    seen_nums: set = set()
    result: List[ParsedArticle] = []
    for art in articles_json:
        num = art.get("num", "").strip()
        if num in seen_nums:
            continue
        seen_nums.add(num)

        raw_content = art.get("content", "")
        text = strip_html(raw_content)
        if not text:
            continue

        if num:
            text = f"Art. {num}\n{text}"

        historique = art.get("historique") or None

        result.append(
            ParsedArticle(
                id=art.get("id", ""),
                cid=art.get("cid", ""),
                num=num,
                content=text,
                etat=art.get("etat", "VIGUEUR"),
                section_path=section_path,
                section_id=section_id,
                historique=historique,
            )
        )
    return result


def _parse_sections(sections_json: List[Dict], path_parts: Optional[List[str]] = None) -> List[ParsedSection]:
    if path_parts is None:
        path_parts = []

    result: List[ParsedSection] = []
    for section in sections_json:
        title = (section.get("title") or "").strip()
        etat = section.get("etat", "VIGUEUR")
        sec_id = section.get("id", "")

        current_path = path_parts + [title] if title else path_parts
        section_path = " > ".join(current_path)

        parsed = ParsedSection(id=sec_id, title=title, etat=etat)
        parsed.articles = _parse_articles(
            section.get("articles", []),
            section_path=section_path,
            section_id=sec_id,
        )
        parsed.subsections = _parse_sections(section.get("sections", []), current_path)

        result.append(parsed)
    return result


def parse_kali_json(data: Dict[str, Any]) -> KaliDocument:
    kali_id = data.get("id", "")
    title = (data.get("title") or "").strip()
    juris_state = data.get("jurisState", "VIGUEUR")
    mots_cles = [k for k in (data.get("motsCles") or []) if k]
    sections = _parse_sections(data.get("sections", []))

    return KaliDocument(
        kali_id=kali_id,
        title=title,
        juris_state=juris_state,
        mots_cles=mots_cles,
        sections=sections,
    )


def kali_to_ingest_batches(
    doc: KaliDocument,
    batch_by: str = "section",
) -> List[Dict[str, Any]]:
    kali_url = f"https://www.legifrance.gouv.fr/conv_coll/id/{doc.kali_id}/"

    base_meta = {
        "kaliId": doc.kali_id,
        "jurisState": doc.juris_state,
        "jurisStateLabel": JURIS_STATE_LABELS.get(doc.juris_state, doc.juris_state),
        "motsCles": doc.mots_cles[:20],
    }

    if batch_by == "full" or not doc.sections:
        all_arts = doc.all_articles
        content = _articles_to_text(all_arts)
        return [
            {
                "title": doc.title,
                "source": "Legifrance",
                "domain": "travail",
                "subDomain": "convention_collective",
                "documentType": "convention",
                "content": content or doc.title,
                "url": kali_url,
                "version": "KALI",
                "metadata": {**base_meta, "articleCount": len(all_arts)},
            }
        ]

    batches: List[Dict[str, Any]] = []

    def _section_to_batch(section: ParsedSection):
        arts = _collect_articles(section)
        if not arts:
            return

        content = _articles_to_text(arts)
        if not content.strip():
            return

        section_label = section.title or "Sans titre"
        batch_title = f"{doc.title[:80]} - {section_label}" if section.title else doc.title[:100]

        batches.append(
            {
                "title": batch_title[:200],
                "source": "Legifrance",
                "domain": "travail",
                "subDomain": "convention_collective",
                "documentType": "convention",
                "content": content,
                "url": kali_url,
                "version": "KALI",
                "metadata": {
                    **base_meta,
                    "sectionId": section.id,
                    "sectionTitle": section_label,
                    "sectionEtat": section.etat,
                    "articleCount": len(arts),
                },
            }
        )

    for top_section in doc.sections:
        _section_to_batch(top_section)

    if not batches:
        return kali_to_ingest_batches(doc, batch_by="full")

    return batches


def _collect_articles(section: ParsedSection) -> List[ParsedArticle]:
    result = list(section.articles)
    for sub in section.subsections:
        result.extend(_collect_articles(sub))
    return result


def _articles_to_text(articles: List[ParsedArticle]) -> str:
    parts: List[str] = []
    for art in articles:
        if not art.content.strip():
            continue
        etat_note = f" [{JURIS_STATE_LABELS.get(art.etat, art.etat)}]" if art.etat != "VIGUEUR" else ""

        if art.section_path:
            parts.append(f"[{art.section_path}]{etat_note}")

        parts.append(art.content)

        if art.historique:
            parts.append(f"  -> Historique : {art.historique}")

        parts.append("")

    return "\n".join(parts).strip()


__all__ = [
    "ParsedArticle",
    "ParsedSection",
    "KaliDocument",
    "KALI_DOMAIN_MAP",
    "JURIS_STATE_LABELS",
    "strip_html",
    "parse_kali_json",
    "kali_to_ingest_batches",
]
