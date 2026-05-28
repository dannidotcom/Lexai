from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.schemas import DocumentSchema
from app.modules.rag_vecor_engine.application import pdf_ingest_service

router = APIRouter(prefix="/documents", tags=["Documents and Ingestion"])


@router.post("/upload-pdf", response_model=DocumentSchema)
async def upload_pdf(
    file: UploadFile = File(...),
    title: str = Form(...),
    source: str = Form(...),
    domain: str = Form(...),
    documentType: str = Form("texte"),
    db: Session = Depends(get_db),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    data = await file.read()
    try:
        result = await pdf_ingest_service.ingest_pdf_bytes(
            db=db,
            file_bytes=data,
            title=title,
            source=source,
            domain=domain,
            document_type=documentType,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to ingest PDF")


__all__ = ["router"]
