from pydantic import BaseModel, Field
from typing import Optional

class QueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=10000)
    document_id: Optional[str] = None
    top_k: int = Field(default=4, ge=1, le=20)


class QueryResponse(BaseModel):
    question: str
    answer: str
    sources: list[dict]