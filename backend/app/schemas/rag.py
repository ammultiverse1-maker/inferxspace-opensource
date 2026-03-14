"""
Pydantic schemas for RAG API
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class DocumentUploadResponse(BaseModel):
    """Response for document upload (AWS-style with enhanced metadata)"""
    document_id: str = Field(..., description="Unique document identifier")
    filename: str = Field(..., description="Original filename")
    chunks_processed: int = Field(..., description="Number of text chunks created")
    status: str = Field(..., description="Upload status")
    total_characters: Optional[int] = Field(None, description="Total characters in document")
    file_type: Optional[str] = Field(None, description="File type/extension")
    indexed_at: Optional[str] = Field(None, description="Indexing timestamp")


class DocumentSearchRequest(BaseModel):
    """Request for document search"""
    query: str = Field(..., min_length=1, max_length=1000, description="Search query")
    limit: Optional[int] = Field(10, ge=1, le=20, description="Maximum number of results")
    document_ids: Optional[List[str]] = Field(None, description="Filter by specific document IDs")


class DocumentSearchResult(BaseModel):
    """Individual search result (AWS Kendra-style)"""
    content: str = Field(..., description="Relevant text content")
    metadata: Dict[str, Any] = Field(..., description="Document metadata including chunk position")
    similarity_score: float = Field(..., ge=0, le=1, description="Similarity score")
    rank: Optional[int] = Field(None, description="Result ranking position")


class DocumentSearchResponse(BaseModel):
    """Response for document search"""
    query: str = Field(..., description="Original search query")
    results: List[DocumentSearchResult] = Field(..., description="Search results")
    total_results: int = Field(..., description="Total number of results")


class DocumentInfo(BaseModel):
    """Document information"""
    document_id: str = Field(..., description="Unique document identifier")
    filename: str = Field(..., description="Original filename")
    uploaded_at: str = Field(..., description="Upload timestamp")
    chunk_count: int = Field(..., description="Number of text chunks")
    file_size: int = Field(..., description="File size in bytes")


class DocumentListResponse(BaseModel):
    """Response for document listing"""
    documents: List[DocumentInfo] = Field(..., description="List of user documents")
    total_documents: int = Field(..., description="Total number of documents")


class DocumentDeleteResponse(BaseModel):
    """Response for document deletion"""
    document_id: str = Field(..., description="Deleted document identifier")
    deleted: bool = Field(..., description="Deletion status")
    message: str = Field(..., description="Status message")