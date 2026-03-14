"""
Knowledge Base API Routes
OpenAI-style knowledge base management
"""

import os
import uuid
import shutil
from typing import List, Optional
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.models import KnowledgeBase, KnowledgeBaseDocument, User
from app.schemas.knowledge_base import (
    KnowledgeBaseCreate,
    KnowledgeBaseUpdate,
    KnowledgeBaseResponse,
    KnowledgeBaseListResponse,
    DocumentUploadResponse,
    DocumentListResponse,
    KnowledgeBaseQueryRequest,
    KnowledgeBaseQueryResponse,
    DocumentMetadata,
)
from app.api.deps import AuthenticatedUser
from app.core.rag import RAGService
from app.core.config import settings
import json


async def _is_free_tier_user(user) -> bool:
    """Check if user is on free tier (no credits purchased)."""
    credit_balance = getattr(user, 'credit_balance', None)
    if credit_balance is not None and float(credit_balance) > 0:
        return False
    return True

router = APIRouter(prefix="/v1/knowledge-bases", tags=["Knowledge Bases"])

# Storage directory for uploaded files
UPLOAD_DIR = Path("data/kb_uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================================
# Knowledge Base CRUD
# ============================================================================

@router.post("", response_model=KnowledgeBaseResponse, status_code=201)
async def create_knowledge_base(
    kb_data: KnowledgeBaseCreate,
    user: AuthenticatedUser,
    db: AsyncSession = Depends(get_db),
):
    """Create a new knowledge base"""
    
    # Free tier: limit to 1 knowledge base
    if await _is_free_tier_user(user):
        existing = await db.execute(
            select(KnowledgeBase).where(KnowledgeBase.user_id == user.id)
        )
        existing_count = len(existing.scalars().all())
        if existing_count >= settings.FREE_TIER_RAG_MAX_KBS:
            raise HTTPException(
                status_code=429,
                detail=f"Free tier limit: maximum {settings.FREE_TIER_RAG_MAX_KBS} knowledge base. "
                       "Upgrade to create unlimited knowledge bases."
            )
    
    # Create knowledge base
    kb = KnowledgeBase(
        id=uuid.uuid4(),
        user_id=user.id,
        name=kb_data.name,
        description=kb_data.description,
        embedding_model=kb_data.embedding_model,
        chunk_size=kb_data.chunk_size,
        chunk_overlap=kb_data.chunk_overlap,
        max_size_bytes=kb_data.max_size_bytes,
    )
    
    db.add(kb)
    await db.commit()
    await db.refresh(kb)
    
    # Initialize RAG service for this KB
    rag = RAGService()
    await rag.initialize_kb_collection(str(kb.id), str(user.id), kb_data.embedding_model)
    
    return kb


@router.get("", response_model=KnowledgeBaseListResponse)
async def list_knowledge_bases(
    user: AuthenticatedUser,
    db: AsyncSession = Depends(get_db),
):
    """List all knowledge bases for the user"""
    
    result = await db.execute(
        select(KnowledgeBase)
        .where(KnowledgeBase.user_id == user.id)
        .order_by(KnowledgeBase.created_at.desc())
    )
    kbs = result.scalars().all()
    
    return KnowledgeBaseListResponse(
        knowledge_bases=[KnowledgeBaseResponse.model_validate(kb) for kb in kbs],
        total=len(kbs)
    )


@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
async def get_knowledge_base(
    kb_id: uuid.UUID,
    user: AuthenticatedUser,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific knowledge base"""
    
    result = await db.execute(
        select(KnowledgeBase)
        .where(KnowledgeBase.id == kb_id, KnowledgeBase.user_id == user.id)
    )
    kb = result.scalar_one_or_none()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    return kb


@router.patch("/{kb_id}", response_model=KnowledgeBaseResponse)
async def update_knowledge_base(
    kb_id: uuid.UUID,
    kb_update: KnowledgeBaseUpdate,
    user: AuthenticatedUser,
    db: AsyncSession = Depends(get_db),
):
    """Update a knowledge base"""
    
    result = await db.execute(
        select(KnowledgeBase)
        .where(KnowledgeBase.id == kb_id, KnowledgeBase.user_id == user.id)
    )
    kb = result.scalar_one_or_none()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    # Update fields
    if kb_update.name is not None:
        kb.name = kb_update.name
    if kb_update.description is not None:
        kb.description = kb_update.description
    if kb_update.chunk_size is not None:
        kb.chunk_size = kb_update.chunk_size
    if kb_update.chunk_overlap is not None:
        kb.chunk_overlap = kb_update.chunk_overlap
    
    kb.updated_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(kb)
    
    return kb


@router.delete("/{kb_id}", status_code=204)
async def delete_knowledge_base(
    kb_id: uuid.UUID,
    user: AuthenticatedUser,
    db: AsyncSession = Depends(get_db),
):
    """Delete a knowledge base and all its documents"""
    
    result = await db.execute(
        select(KnowledgeBase)
        .where(KnowledgeBase.id == kb_id, KnowledgeBase.user_id == user.id)
    )
    kb = result.scalar_one_or_none()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    # Delete vector collection
    rag = RAGService()
    await rag.delete_kb_collection(str(kb_id))
    
    # Delete uploaded files
    kb_dir = UPLOAD_DIR / str(user.id) / str(kb_id)
    if kb_dir.exists():
        shutil.rmtree(kb_dir)
    
    # Delete from database (cascade will delete documents)
    await db.delete(kb)
    await db.commit()


# ============================================================================
# Document Management
# ============================================================================

@router.post("/{kb_id}/documents", response_model=DocumentUploadResponse, status_code=201)
async def upload_document(
    kb_id: uuid.UUID,
    user: AuthenticatedUser,
    file: UploadFile = File(...),
    metadata: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Upload a document to a knowledge base"""
    
    # Get knowledge base
    result = await db.execute(
        select(KnowledgeBase)
        .where(KnowledgeBase.id == kb_id, KnowledgeBase.user_id == user.id)
    )
    kb = result.scalar_one_or_none()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    # Parse metadata
    doc_metadata = {}
    if metadata:
        try:
            doc_metadata = json.loads(metadata)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid metadata JSON")
    
    # Check file size
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Reset
    
    if file_size == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    
    # Free tier: enforce 500MB total storage limit across all KBs
    if await _is_free_tier_user(user):
        total_result = await db.execute(
            select(func.coalesce(func.sum(KnowledgeBase.total_size_bytes), 0))
            .where(KnowledgeBase.user_id == user.id)
        )
        total_user_storage = total_result.scalar()
        max_bytes = settings.FREE_TIER_RAG_MAX_STORAGE_MB * 1024 * 1024
        if total_user_storage + file_size > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"Free tier limit: maximum {settings.FREE_TIER_RAG_MAX_STORAGE_MB}MB total storage. "
                       "Upgrade for unlimited storage."
            )

    # Check if adding this file exceeds KB limit
    if kb.total_size_bytes + file_size > kb.max_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Adding this file would exceed knowledge base size limit ({kb.max_size_bytes / (1024**2):.0f}MB)"
        )
    
    # Save file
    doc_id = uuid.uuid4()
    kb_dir = UPLOAD_DIR / str(user.id) / str(kb_id)
    kb_dir.mkdir(parents=True, exist_ok=True)
    
    file_ext = Path(file.filename).suffix
    file_path = kb_dir / f"{doc_id}{file_ext}"
    
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    # Process document with RAG service
    rag = RAGService()
    chunk_count = await rag.ingest_document_to_kb(
        kb_id=str(kb_id),
        user_id=str(user.id),
        doc_id=str(doc_id),
        file_path=str(file_path),
        filename=file.filename,
        metadata=doc_metadata,
        chunk_size=kb.chunk_size,
        chunk_overlap=kb.chunk_overlap,
    )
    
    # Create document record
    doc = KnowledgeBaseDocument(
        id=doc_id,
        knowledge_base_id=kb_id,
        filename=file.filename,
        file_type=file_ext.lstrip('.'),
        file_size_bytes=file_size,
        file_path=str(file_path),
        chunk_count=chunk_count,
        doc_metadata=doc_metadata,
    )
    
    db.add(doc)
    
    # Update KB stats
    kb.total_size_bytes += file_size
    kb.document_count += 1
    kb.updated_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(doc)
    
    return doc


@router.get("/{kb_id}/documents", response_model=DocumentListResponse)
async def list_documents(
    kb_id: uuid.UUID,
    user: AuthenticatedUser,
    db: AsyncSession = Depends(get_db),
):
    """List all documents in a knowledge base"""
    
    # Verify KB ownership
    result = await db.execute(
        select(KnowledgeBase)
        .where(KnowledgeBase.id == kb_id, KnowledgeBase.user_id == user.id)
    )
    kb = result.scalar_one_or_none()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    # Get documents
    result = await db.execute(
        select(KnowledgeBaseDocument)
        .where(KnowledgeBaseDocument.knowledge_base_id == kb_id)
        .order_by(KnowledgeBaseDocument.created_at.desc())
    )
    docs = result.scalars().all()
    
    return DocumentListResponse(
        documents=[DocumentUploadResponse.model_validate(doc) for doc in docs],
        total=len(docs),
        total_size_bytes=kb.total_size_bytes
    )


@router.delete("/{kb_id}/documents/{doc_id}", status_code=204)
async def delete_document(
    kb_id: uuid.UUID,
    doc_id: uuid.UUID,
    user: AuthenticatedUser,
    db: AsyncSession = Depends(get_db),
):
    """Delete a document from a knowledge base"""
    
    # Get KB and verify ownership
    result = await db.execute(
        select(KnowledgeBase)
        .where(KnowledgeBase.id == kb_id, KnowledgeBase.user_id == user.id)
    )
    kb = result.scalar_one_or_none()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    # Get document
    result = await db.execute(
        select(KnowledgeBaseDocument)
        .where(
            KnowledgeBaseDocument.id == doc_id,
            KnowledgeBaseDocument.knowledge_base_id == kb_id
        )
    )
    doc = result.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete from vector DB
    rag = RAGService()
    await rag.delete_document_from_kb(str(kb_id), str(doc_id))
    
    # Delete file
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    
    # Update KB stats
    kb.total_size_bytes -= doc.file_size_bytes
    kb.document_count -= 1
    kb.updated_at = datetime.now(timezone.utc)
    
    # Delete from database
    await db.delete(doc)
    await db.commit()


# ============================================================================
# Query with RAG
# ============================================================================

@router.post("/{kb_id}/query", response_model=KnowledgeBaseQueryResponse)
async def query_knowledge_base(
    kb_id: uuid.UUID,
    query_request: KnowledgeBaseQueryRequest,
    request: Request,
    user: AuthenticatedUser,
    db: AsyncSession = Depends(get_db),
):
    """Query a knowledge base with RAG (retrieval + generation in one call)"""
    
    # Verify KB ownership
    result = await db.execute(
        select(KnowledgeBase)
        .where(KnowledgeBase.id == kb_id, KnowledgeBase.user_id == user.id)
    )
    kb = result.scalar_one_or_none()
    
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    if kb.document_count == 0:
        raise HTTPException(status_code=400, detail="Knowledge base has no documents")
    
    # Perform RAG query
    # Extract authorization header from original request
    auth_header = request.headers.get("Authorization", "")
    
    # Use the actual API key if provided, otherwise use system internal key
    if auth_header:
        api_key = auth_header.replace("Bearer ", "")
    else:
        # Use system internal key for cookie-authenticated requests
        api_key = settings.INTERNAL_SYSTEM_KEY
    
    rag = RAGService()
    response = await rag.query_knowledge_base(
        kb_id=str(kb_id),
        user_id=str(user.id),
        query=query_request.query,
        model=query_request.model,
        api_key=api_key,
        top_k=query_request.top_k,
        max_context_chunks=query_request.max_context_chunks,
        temperature=query_request.temperature,
        max_tokens=query_request.max_tokens,
    )
    
    return response
