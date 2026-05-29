import asyncio
from pathlib import Path

from app.core.session import AsyncSessionLocal
from app.modules.rag_vecor_engine.application import pdf_ingest_service

SOURCES_DIR = Path(__file__).resolve().parents[1] / "sources"


async def ingest_all():
    files = list(SOURCES_DIR.glob("**/*.pdf"))
    if not files:
        print("No PDF files found in:", SOURCES_DIR)
        return

    async def ingest_file(path: Path):
        print("Processing", path)
        with open(path, "rb") as f:
            data = f.read()

        async with AsyncSessionLocal() as db:
            try:
                title = path.stem
                source = "local_sources"
                domain = "unknown"
                res = await pdf_ingest_service.ingest_pdf_bytes(db=db, file_bytes=data, title=title, source=source, domain=domain)
                print("Ingested:", res.id if hasattr(res, "id") else res)
            except Exception as e:
                print("Failed to ingest", path, e)

    for p in files:
        await ingest_file(p)


if __name__ == "__main__":
    asyncio.run(ingest_all())
