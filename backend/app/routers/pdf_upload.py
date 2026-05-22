from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.pdf_ingest_service import pdf_ingest_service
from app.models.schemas import DocumentSchema

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
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to ingest PDF")
