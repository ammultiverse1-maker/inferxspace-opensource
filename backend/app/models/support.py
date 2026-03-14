"""
Support and AI Assistant models for InferXSpace
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, BigInteger,
    ForeignKey, Text, JSON, Enum as SQLEnum, Uuid, Float
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from enum import Enum

from app.core.database import Base


class TicketStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class TicketPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TicketCategory(str, Enum):
    API_ISSUES = "api_issues"
    BILLING = "billing"
    MODELS = "models"
    KNOWLEDGE_BASE = "knowledge_base"
    ACCOUNT = "account"
    GENERAL = "general"


class ChatSessionStatus(str, Enum):
    ACTIVE = "active"
    ENDED = "ended"
    TRANSFERRED = "transferred"


class MessageSender(str, Enum):
    USER = "user"
    AI = "ai"
    AGENT = "agent"


# ============================================================================
# Support Ticket Models
# ============================================================================

class SupportTicket(Base):
    """Support ticket model"""
    __tablename__ = "support_tickets"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[TicketStatus] = mapped_column(
        SQLEnum(TicketStatus),
        default=TicketStatus.OPEN
    )
    priority: Mapped[TicketPriority] = mapped_column(
        SQLEnum(TicketPriority),
        default=TicketPriority.MEDIUM
    )
    category: Mapped[TicketCategory] = mapped_column(
        SQLEnum(TicketCategory),
        default=TicketCategory.GENERAL
    )
    assigned_agent_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True))
    resolution: Mapped[Optional[str]] = mapped_column(Text)
    ticket_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="support_tickets")
    messages: Mapped[List["TicketMessage"]] = relationship("TicketMessage", back_populates="ticket", cascade="all, delete-orphan")


class TicketMessage(Base):
    """Messages within a support ticket"""
    __tablename__ = "ticket_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    ticket_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("support_tickets.id", ondelete="CASCADE"),
        nullable=False
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False)  # Internal agent notes
    attachments: Mapped[Optional[List[str]]] = mapped_column(JSON)  # File URLs
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    ticket: Mapped["SupportTicket"] = relationship("SupportTicket", back_populates="messages")
    sender: Mapped["User"] = relationship("User")


# ============================================================================
# AI Chat Models
# ============================================================================

class ChatSession(Base):
    """AI chat session model"""
    __tablename__ = "chat_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    session_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    status: Mapped[ChatSessionStatus] = mapped_column(
        SQLEnum(ChatSessionStatus),
        default=ChatSessionStatus.ACTIVE
    )
    context: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)  # Session context
    session_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)  # Additional metadata
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_activity: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="chat_sessions")
    messages: Mapped[List["ChatMessage"]] = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    """Individual chat messages"""
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False
    )
    sender: Mapped[MessageSender] = mapped_column(
        SQLEnum(MessageSender),
        nullable=False
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    message_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)  # AI response metadata, attachments, etc.
    confidence_score: Mapped[Optional[float]] = mapped_column(Float)  # AI confidence in response
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    session: Mapped["ChatSession"] = relationship("ChatSession", back_populates="messages")


# ============================================================================
# AI Knowledge Base Models
# ============================================================================

class AIKnowledgeBase(Base):
    """Knowledge base for AI assistant training"""
    __tablename__ = "ai_knowledge_base"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)  # api, billing, models, etc.
    tags: Mapped[Optional[List[str]]] = mapped_column(JSON)
    embedding: Mapped[Optional[List[float]]] = mapped_column(JSON)  # Vector embedding
    source: Mapped[str] = mapped_column(String(255))  # URL or document reference
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )