"""
Knowledge Base Schemas
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator
from uuid import UUID


# ============================================================================
# Knowledge Base Schemas
# ============================================================================

class KnowledgeBaseCreate(BaseModel):
    """Create a new knowledge base"""
    name: str = Field(..., max_length=255, description="Name of the knowledge base")
    description: Optional[str] = Field(None, description="Description of the knowledge base")
    embedding_model: str = Field(default="all-MiniLM-L6-v2", description="Embedding model to use")
    chunk_size: int = Field(default=512, ge=128, le=2048, description="Chunk size for document splitting")
    chunk_overlap: int = Field(default=64, ge=0, le=512, description="Overlap between chunks")
    max_size_bytes: Optional[int] = Field(default=500 * 1024 * 1024, description="Maximum total size in bytes")


class KnowledgeBaseUpdate(BaseModel):
    """Update knowledge base"""
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    chunk_size: Optional[int] = Field(None, ge=128, le=2048)
    chunk_overlap: Optional[int] = Field(None, ge=0, le=512)


class KnowledgeBaseResponse(BaseModel):
    """Knowledge base response"""
    id: UUID
    user_id: UUID
    name: str
    description: Optional[str]
    embedding_model: str
    chunk_size: int
    chunk_overlap: int
    total_size_bytes: int
    document_count: int
    max_size_bytes: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class KnowledgeBaseListResponse(BaseModel):
    """List of knowledge bases"""
    knowledge_bases: List[KnowledgeBaseResponse]
    total: int


# ============================================================================
# Document Schemas
# ============================================================================

class DocumentMetadata(BaseModel):
    """Document metadata"""
    category: Optional[str] = None
    language: Optional[str] = None
    tags: Optional[List[str]] = None
    url: Optional[str] = None


class DocumentUploadResponse(BaseModel):
    """Document upload response"""
    id: UUID
    knowledge_base_id: UUID
    filename: str
    file_type: str
    file_size_bytes: int
    chunk_count: int
    doc_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator('doc_metadata', mode='before')
    @classmethod
    def validate_doc_metadata(cls, v):
        if v is None:
            return None
        if isinstance(v, dict):
            return v
        # If it's some other object (like SQLAlchemy's internal), return None
        return None


class DocumentListResponse(BaseModel):
    """List of documents in a knowledge base"""
    documents: List[DocumentUploadResponse]
    total: int
    total_size_bytes: int


# ============================================================================
# Query Schemas
# ============================================================================

class KnowledgeBaseQueryRequest(BaseModel):
    """Query a knowledge base with RAG"""
    model: str = Field(..., description="LLM model to use for generation")
    query: str = Field(..., description="User query")
    top_k: int = Field(default=5, ge=1, le=20, description="Number of chunks to retrieve")
    max_context_chunks: int = Field(default=8, ge=1, le=20, description="Maximum chunks to include in context")
    temperature: Optional[float] = Field(default=0.7, ge=0, le=2)
    max_tokens: Optional[int] = Field(default=1000, ge=1)
    stream: bool = Field(default=False, description="Stream the response")


class SourceChunk(BaseModel):
    """Source chunk from retrieval"""
    document_id: UUID
    chunk_index: int
    score: float
    content: str
    metadata: Dict[str, Any]


class KnowledgeBaseQueryResponse(BaseModel):
    """Response from knowledge base query"""
    answer: str
    sources: List[SourceChunk]
    usage: Dict[str, int]
    model: str


class KnowledgeBaseQueryStreamChunk(BaseModel):
    """Streaming chunk for knowledge base query"""
    delta: str
    sources: Optional[List[SourceChunk]] = None
    done: bool = False
