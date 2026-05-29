from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.logging import logger
from app.schemas.schemas import (
    ChunkSchema,
    DocumentInputSchema,
    DocumentSchema,
    LegifranceIngestInputSchema,
    LegifranceIngestResultSchema,
)
from app.modules.rag_vecor_engine.application import document_service, kali_to_ingest_batches, parse_kali_json

router = APIRouter(prefix="/documents", tags=["Documents and Ingestion"])


@router.get("", response_model=List[DocumentSchema])
async def list_documents(
    domain: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await document_service.list_documents(db, domain=domain, status=status, limit=limit, offset=offset)


@router.post("", response_model=DocumentSchema, status_code=201)
async def ingest_document(data: DocumentInputSchema, db: AsyncSession = Depends(get_db)):
    return await document_service.ingest_document(db, data)


@router.post("/ingest/legifrance", response_model=LegifranceIngestResultSchema, status_code=201)
async def ingest_legifrance_json(data: LegifranceIngestInputSchema, db: AsyncSession = Depends(get_db)):
    try:
        kali_doc = parse_kali_json(data.kaliJson)
    except Exception as exc:
        logger.warning("Failed to parse KALI JSON", error=str(exc))
        raise HTTPException(status_code=400, detail=f"Invalid KALI JSON: {exc}")

    if not kali_doc.title:
        raise HTTPException(status_code=400, detail="KALI JSON missing required 'title' field")

    batches = kali_to_ingest_batches(kali_doc, batch_by=data.batchBy)
    if not batches:
        raise HTTPException(status_code=400, detail="No articles found in KALI JSON sections")

    logger.info(
        "Ingesting KALI document",
        kali_id=kali_doc.kali_id,
        title=kali_doc.title[:80],
        batches=len(batches),
        total_articles=kali_doc.total_articles,
    )

    created_docs = []
    for batch in batches:
        try:
            doc_schema = await document_service.ingest_document(
                db,
                DocumentInputSchema(**batch),
            )
            created_docs.append(doc_schema)
        except Exception as exc:
            logger.warning("Failed to ingest KALI batch", title=batch.get("title", "?"), error=str(exc))

    return LegifranceIngestResultSchema(
        kaliId=kali_doc.kali_id,
        conventionTitle=kali_doc.title,
        jurisState=kali_doc.juris_state,
        documentsCreated=len(created_docs),
        totalArticles=kali_doc.total_articles,
        documents=created_docs,
    )


@router.get("/{id}", response_model=DocumentSchema)
async def get_document(id: str, db: AsyncSession = Depends(get_db)):
    doc = await document_service.get_document(db, id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{id}", status_code=204)
async def delete_document(id: str, db: AsyncSession = Depends(get_db)):
    ok = await document_service.delete_document(db, id)
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found")


@router.get("/{id}/chunks", response_model=List[ChunkSchema])
async def get_document_chunks(id: str, db: AsyncSession = Depends(get_db)):
    return await document_service.get_chunks(db, id)


__all__ = ["router"]
