from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.schemas import (
    DocumentSchema, DocumentInputSchema, ChunkSchema,
    LegifranceIngestInputSchema, LegifranceIngestResultSchema,
)
from app.services.document_service import document_service
from app.services.legifrance_parser import parse_kali_json, kali_to_ingest_batches
from app.core.logging import logger

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=List[DocumentSchema])
def list_documents(
    domain: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return document_service.list_documents(db, domain=domain, status=status, limit=limit, offset=offset)


@router.post("", response_model=DocumentSchema, status_code=201)
async def ingest_document(data: DocumentInputSchema, db: Session = Depends(get_db)):
    return await document_service.ingest_document(db, data)


@router.post("/ingest/legifrance", response_model=LegifranceIngestResultSchema, status_code=201)
async def ingest_legifrance_json(data: LegifranceIngestInputSchema, db: Session = Depends(get_db)):
    """
    Import a Légifrance KALI JSON document (Convention collective).
    Parses the KALI structure, extracts articles section by section,
    and creates one LexIA document per top-level Titre (or one for the whole text).
    """
    try:
        kali_doc = parse_kali_json(data.kaliJson)
    except Exception as e:
        logger.warning("Failed to parse KALI JSON", error=str(e))
        raise HTTPException(status_code=400, detail=f"Invalid KALI JSON: {e}")

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
        except Exception as e:
            logger.warning("Failed to ingest KALI batch", title=batch.get("title", "?"), error=str(e))

    return LegifranceIngestResultSchema(
        kaliId=kali_doc.kali_id,
        conventionTitle=kali_doc.title,
        jurisState=kali_doc.juris_state,
        documentsCreated=len(created_docs),
        totalArticles=kali_doc.total_articles,
        documents=created_docs,
    )


@router.get("/{id}", response_model=DocumentSchema)
def get_document(id: str, db: Session = Depends(get_db)):
    doc = document_service.get_document(db, id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{id}", status_code=204)
def delete_document(id: str, db: Session = Depends(get_db)):
    ok = document_service.delete_document(db, id)
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found")


@router.get("/{id}/chunks", response_model=List[ChunkSchema])
def get_document_chunks(id: str, db: Session = Depends(get_db)):
    return document_service.get_chunks(db, id)
