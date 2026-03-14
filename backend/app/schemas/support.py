"""
Pydantic schemas for Support and AI Assistant API
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

from app.models.support import (
    TicketStatus, TicketPriority, TicketCategory,
    ChatSessionStatus, MessageSender
)


# ============================================================================
# Support Ticket Schemas
# ============================================================================

class SupportTicketBase(BaseModel):
    subject: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1)
    priority: Optional[TicketPriority] = TicketPriority.MEDIUM
    category: Optional[TicketCategory] = TicketCategory.GENERAL
    metadata: Optional[Dict[str, Any]] = None


class SupportTicketCreate(SupportTicketBase):
    pass


class SupportTicketResponse(BaseModel):
    id: UUID
    user_id: UUID
    subject: str
    description: str
    priority: Optional[TicketPriority] = TicketPriority.MEDIUM
    category: Optional[TicketCategory] = TicketCategory.GENERAL
    metadata: Optional[Dict[str, Any]] = Field(None, alias="ticket_metadata")
    status: TicketStatus
    assigned_agent_id: Optional[UUID] = None
    resolution: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        populate_by_name = True


class TicketMessageBase(BaseModel):
    message: str = Field(..., min_length=1)
    attachments: Optional[List[str]] = None


class TicketMessageCreate(TicketMessageBase):
    pass


class TicketMessageResponse(TicketMessageBase):
    id: UUID
    ticket_id: UUID
    sender_id: UUID
    is_internal: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# AI Chat Schemas
# ============================================================================

class ChatSessionBase(BaseModel):
    context: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None


class ChatSessionCreate(ChatSessionBase):
    pass


class ChatSessionResponse(ChatSessionBase):
    id: UUID
    user_id: UUID
    session_id: str
    status: ChatSessionStatus
    started_at: datetime
    ended_at: Optional[datetime]
    last_activity: datetime

    class Config:
        from_attributes = True


class ChatMessageBase(BaseModel):
    message: str = Field(..., min_length=1)
    metadata: Optional[Dict[str, Any]] = None


class ChatMessageCreate(ChatMessageBase):
    session_id: Optional[str] = None


class ChatMessageResponse(ChatMessageBase):
    id: UUID
    session_id: UUID
    sender: MessageSender
    confidence_score: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True


class ChatMessageWithResponse(BaseModel):
    user_message: ChatMessageResponse
    ai_message: ChatMessageResponse
    session_id: str


# ============================================================================
# AI Knowledge Base Schemas
# ============================================================================

class AIKnowledgeBaseBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1, max_length=100)
    tags: Optional[List[str]] = None
    source: str = Field(..., min_length=1, max_length=255)


class AIKnowledgeBaseCreate(AIKnowledgeBaseBase):
    pass


class AIKnowledgeBaseResponse(AIKnowledgeBaseBase):
    id: UUID
    embedding: Optional[List[float]]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True