import os
import uuid
import shutil
import tempfile
from pathlib import Path
from database import VECTOR_DB_DIR, vector_store, UPLOAD_DIR, CHUNK_OVERLAP, CHUNK_SIZE,langChainllm,langChainembeddings
from fastapi import APIRouter, FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from services import QueryRequest, QueryResponse
from langchain_core.messages import SystemMessage, HumanMessage

from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
    Docx2txtLoader,
)
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate

lngrouter = APIRouter(
    prefix="/LangChainRag",
    tags=["LangChainRag"],
)

@lngrouter.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename or Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported",
        )

    document_id = str(uuid.uuid4())
    temp_path = None

    try:
        # Save the uploaded file temporarily.
        with tempfile.NamedTemporaryFile(
            suffix=".pdf",
            dir=UPLOAD_DIR,
            delete=False,
        ) as temp_file:
            temp_path = Path(temp_file.name)
            shutil.copyfileobj(file.file, temp_file)

        if temp_path.stat().st_size == 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded PDF is empty",
            )

        # Extract PDF text.
        loader = PyPDFLoader(str(temp_path))
        pages = loader.load()

        if not any(page.page_content.strip() for page in pages):
            raise HTTPException(
                status_code=422,
                detail=(
                    "No extractable text found. "
                    "The PDF may be scanned or image-only."
                ),
            )

        # Attach metadata to each page.
        for page in pages:
            page.metadata["document_id"] = document_id
            page.metadata["source"] = file.filename

        # Split pages into smaller searchable chunks.
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
        )

        chunks = text_splitter.split_documents(pages)

        if not chunks:
            raise HTTPException(
                status_code=422,
                detail="No text chunks could be created",
            )

        # Assign stable IDs to individual chunks.
        chunk_ids = [
            f"{document_id}:{index}"
            for index in range(len(chunks))
        ]

        # Generate embeddings and store chunks in ChromaDB.
        vector_store.add_documents(
            documents=chunks,
            ids=chunk_ids,
        )

        return {
            "message": "PDF uploaded and indexed successfully",
            "document_id": document_id,
            "filename": file.filename,
            "pages": len(pages),
            "chunks_created": len(chunks),
            "chunk_size": CHUNK_SIZE,
            "chunk_overlap": CHUNK_OVERLAP,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"PDF processing failed: {str(exc)}",
        ) from exc
    finally:
        await file.close()
        if temp_path and temp_path.exists():
            temp_path.unlink()

@lngrouter.post("/query", response_model=QueryResponse)
def query_documents(request: QueryRequest):
    try:
        
        # Search across all documents or restrict to one PDF.
        search_kwargs = {"k": request.top_k}

        if request.document_id:
            search_kwargs["filter"] = {
                "document_id": request.document_id
            }

        retriever = vector_store.as_retriever(
            search_type="similarity",
            search_kwargs=search_kwargs,
        )

        relevant_chunks = retriever.invoke(request.question)

        if not relevant_chunks:
            return QueryResponse(
                question=request.question,
                answer="No relevant chunks were found in the uploaded PDFs.",
                sources=[],
            )

        # Build context from retrieved chunks.
        context_parts = []
        sources = []

        for index, doc in enumerate(relevant_chunks, start=1):
            source = doc.metadata.get("source", "unknown")
            page = doc.metadata.get("page")

            context_parts.append(
                f"[Chunk {index}]\n"
                f"Source: {source}\n"
                f"Page: {page}\n"
                f"Content:\n{doc.page_content}"
            )

            sources.append({
                "chunk": index,
                "document_id": doc.metadata.get("document_id"),
                "filename": source,
                "page": page + 1 if isinstance(page, int) else None,
                "content": doc.page_content,
            })

        context = "\n\n".join(context_parts)

        # Generate a grounded response using the retrieved context.
        messages = [
            SystemMessage(
                content=(
                    "You are a helpful document question-answering assistant. "
                    "Answer using only the supplied context. "
                    "If the context does not contain the answer, "
                    "say that the uploaded documents do not provide "
                    "enough information. Cite the filename and page "
                    "when relevant. Do not invent facts."
                )
            ),
            HumanMessage(
                content=(
                    f"Context:\n{context}\n\n"
                    f"Question: {request.question}"
                )
            ),
        ]

        result = langChainllm.invoke(messages)

        return QueryResponse(
            question=request.question,
            answer=result.content,
            sources=sources,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"RAG query failed: {str(exc)}",
        ) from exc

@lngrouter.get("/documents")
def list_documents():
    try:
        stored = vector_store.get(include=["metadatas"])
        documents = {}

        for metadata in stored.get("metadatas") or []:
            if not metadata:
                continue

            document_id = metadata.get("document_id")
            if not document_id:
                continue

            if document_id not in documents:
                documents[document_id] = {
                    "document_id": document_id,
                    "filename": metadata.get("source", "unknown"),
                    "chunks": 0,
                }

            documents[document_id]["chunks"] += 1

        return {"documents": list(documents.values())}

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not list documents: {str(exc)}",
        ) from exc

@lngrouter.delete("/documents/{document_id}")
def delete_document(document_id: str):
    try:
        stored = vector_store.get(
            where={"document_id": document_id},
            include=["metadatas"],
        )

        chunk_ids = stored.get("ids", [])

        if not chunk_ids:
            raise HTTPException(
                status_code=404,
                detail="Document not found",
            )

        vector_store.delete(ids=chunk_ids)

        return {
            "message": "Document chunks deleted successfully",
            "document_id": document_id,
            "chunks_deleted": len(chunk_ids),
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Document deletion failed: {str(exc)}",
        ) from exc