from __future__ import annotations

import asyncio
from io import BytesIO
from typing import Optional

from pypdf import PdfReader
from sqlalchemy.orm import Session as DBSession

from app.core.logging import logger
from app.schemas.schemas import DocumentInputSchema
from app.modules.rag_vecor_engine.document_service import document_service


class PDFIngestService:
    async def extract_text_from_pdf_bytes(self, data: bytes) -> str:
        return await asyncio.to_thread(self._extract_text_sync, data)

    def _extract_text_sync(self, data: bytes) -> str:
        try:
            reader = PdfReader(BytesIO(data))
            texts = []
            for page in reader.pages:
                try:
                    texts.append(page.extract_text() or "")
                except Exception:
                    continue
            full_text = "\n\n".join([t.strip() for t in texts if t and t.strip()])
            return full_text
        except Exception as exc:
            logger.error("Failed to extract PDF text", error=str(exc))
            return ""

    async def ingest_pdf_bytes(
        self,
        db: DBSession,
        file_bytes: bytes,
        title: str,
        source: str,
        domain: str,
        document_type: str = "texte",
        metadata: Optional[dict] = None,
    ) -> dict:
        text = await self.extract_text_from_pdf_bytes(file_bytes)
        if not text:
            raise ValueError("No text extracted from PDF")

        data = DocumentInputSchema(
            title=title,
            source=source,
            domain=domain,
            subDomain=None,
            documentType=document_type,
            content=text,
            url=None,
            version=None,
            metadata=metadata or {},
        )

        result = await document_service.ingest_document(db, data)
        return result


pdf_ingest_service = PDFIngestService()


__all__ = ["PDFIngestService", "pdf_ingest_service"]
