import io
from pathlib import Path
from services import QueryRequest, answer_question
from fastapi import (
    APIRouter,
    File,
    HTTPException,
    UploadFile,
)
from pypdf import PdfReader

from services import (
    split_text,
    index_pdf_chunks,
    collection
)

router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)

MAX_FILE_SIZE = 10 * 1024 * 1024

@router.get("/health")
def health():
    return {
        "status": "ok",
        "indexed_chunks": collection.count(),
    }

@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    filename = Path(
        file.filename or "document.pdf"
    ).name

    if not filename.lower().endswith(".pdf"):
        raise HTTPException(415, "Only PDF files supported")

    content = await file.read(MAX_FILE_SIZE + 1)

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(413, "PDF exceeds 10 MB")

    try:
        reader = PdfReader(io.BytesIO(content))

        if reader.is_encrypted:
            raise HTTPException(400, "Encrypted PDF unsupported")

        chunks = []

        for page_number, page in enumerate(
            reader.pages, start=1
        ):
            text = page.extract_text() or ""

            for chunk in split_text(text):
                chunks.append((page_number, chunk))

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            400, f"Could not read PDF: {exc}"
        ) from exc

    if not chunks:
        raise HTTPException(
            400,
            "No extractable text found. Scanned PDFs "
            "may require OCR.",
        )

    result = index_pdf_chunks(
        filename, content, chunks
    )

    return {
        "message": "PDF uploaded and indexed",
        "pages": len({
            page for page, _ in chunks
        }),
        **result,
    }

@router.post("/query")
def query_pdf(request: QueryRequest):
    question = request.question.strip()

    if not question:
        from fastapi import HTTPException
        raise HTTPException(
            400, "Question cannot be empty"
        )

    return answer_question(
        question=question,
        top_k=request.top_k,
    )