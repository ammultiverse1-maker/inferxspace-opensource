"""
Database models for InferX API Platform
Based on the architecture document schema
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    Column, String, Boolean, DateTime, Integer, BigInteger,
    ForeignKey, Text, Numeric, JSON, UniqueConstraint, Index,
    Enum as SQLEnum, Uuid
)
from sqlalchemy.dialects.postgresql import INET
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.core.database import Base


# ============================================================================
# User Models
# ============================================================================

class User(Base):
    """User account model"""
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(255))
    company: Mapped[Optional[str]] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    role: Mapped[str] = mapped_column(String(20), default="user")  # user | admin | super_admin
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
    
    # Relationships
    api_keys: Mapped[List["APIKey"]] = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    credits: Mapped["UserCredit"] = relationship("UserCredit", back_populates="user", uselist=False, cascade="all, delete-orphan")
    rate_limit: Mapped["RateLimit"] = relationship("RateLimit", back_populates="user", uselist=False, cascade="all, delete-orphan")
    usage_logs: Mapped[List["UsageLog"]] = relationship("UsageLog", back_populates="user")
    purchases: Mapped[List["CreditPurchase"]] = relationship("CreditPurchase", back_populates="user")
    transactions: Mapped[List["CreditTransaction"]] = relationship("CreditTransaction", back_populates="user")
    support_tickets: Mapped[List["SupportTicket"]] = relationship("SupportTicket", back_populates="user")
    chat_sessions: Mapped[List["ChatSession"]] = relationship("ChatSession", back_populates="user")


class APIKey(Base):
    """API key model for authentication"""
    __tablename__ = "api_keys"
    
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
    key_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(20), nullable=False)  # First 12 chars for display
    name: Mapped[Optional[str]] = mapped_column(String(100))  # User-defined key name
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="api_keys")
    usage_logs: Mapped[List["UsageLog"]] = relationship("UsageLog", back_populates="api_key")
    
    __table_args__ = (
        Index("idx_api_keys_hash", "key_hash", postgresql_where="is_active = true"),
        Index("idx_api_keys_user", "user_id"),
    )


# ============================================================================
# Credit Management
# ============================================================================

class UserCredit(Base):
    """User credit balance model"""
    __tablename__ = "user_credits"
    
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False
    )
    balance_tokens: Mapped[int] = mapped_column(BigInteger, default=0)
    reserved_tokens: Mapped[int] = mapped_column(BigInteger, default=0)
    total_purchased: Mapped[int] = mapped_column(BigInteger, default=0)
    total_used: Mapped[int] = mapped_column(BigInteger, default=0)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="credits")
    
    __table_args__ = (
        Index("idx_credits_user", "user_id"),
    )


class CreditPurchase(Base):
    """Credit purchase history"""
    __tablename__ = "credit_purchases"
    
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    token_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    price_paid: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    payment_method: Mapped[Optional[str]] = mapped_column(String(50))
    payment_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True)  # Razorpay payment ID
    payment_order_id: Mapped[Optional[str]] = mapped_column(String(255))
    payment_status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, completed, failed, refunded
    payment_signature: Mapped[Optional[str]] = mapped_column(String(500))
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON)
    purchased_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="purchases")
    
    __table_args__ = (
        Index("idx_purchases_user", "user_id", "purchased_at"),
        Index("idx_purchases_status", "payment_status", "purchased_at"),
    )


class CreditTransaction(Base):
    """Credit transaction audit trail"""
    __tablename__ = "credit_transactions"
    
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    usage_log_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("usage_logs.id")
    )
    purchase_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("credit_purchases.id")
    )
    transaction_type: Mapped[str] = mapped_column(String(50), nullable=False)  # purchase, usage, refund, adjustment
    amount_tokens: Mapped[int] = mapped_column(BigInteger, nullable=False)  # Positive for credit, negative for debit
    balance_before: Mapped[int] = mapped_column(BigInteger, nullable=False)
    balance_after: Mapped[int] = mapped_column(BigInteger, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="transactions")
    
    __table_args__ = (
        Index("idx_transactions_user", "user_id", "created_at"),
        Index("idx_transactions_type", "transaction_type", "created_at"),
    )


# ============================================================================
# Model Pricing
# ============================================================================

class ModelPricing(Base):
    """Model pricing configuration"""
    __tablename__ = "model_pricing"
    
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    model_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[Optional[str]] = mapped_column(String(100))  # meta, mistral, qwen
    input_price_per_1m: Mapped[Decimal] = mapped_column(Numeric(10, 6), nullable=False)
    output_price_per_1m: Mapped[Decimal] = mapped_column(Numeric(10, 6), nullable=False)
    context_window: Mapped[Optional[int]] = mapped_column(Integer)
    max_output_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    supports_streaming: Mapped[bool] = mapped_column(Boolean, default=True)
    supports_function_calling: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    deployment_type: Mapped[str] = mapped_column(String(50), default="shared")  # shared, dedicated
    gpu_type: Mapped[Optional[str]] = mapped_column(String(50))  # a100, l40s, h100
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
    
    __table_args__ = (
        Index("idx_pricing_active", "is_active", "model_id"),
    )


# ============================================================================
# Usage Tracking
# ============================================================================

class UsageLog(Base):
    """Detailed usage logs for each API request"""
    __tablename__ = "usage_logs"
    
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    api_key_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("api_keys.id")
    )
    request_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    
    # Model info
    model_id: Mapped[str] = mapped_column(String(100), nullable=False)
    endpoint: Mapped[Optional[str]] = mapped_column(String(100))  # /v1/chat/completions, /v1/embeddings
    
    # Token usage
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # Cost calculation
    input_cost: Mapped[Decimal] = mapped_column(Numeric(12, 8), nullable=False)
    output_cost: Mapped[Decimal] = mapped_column(Numeric(12, 8), nullable=False)
    
    # Performance metrics
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer)
    ttft_ms: Mapped[Optional[int]] = mapped_column(Integer)  # Time to first token
    throughput_tokens_per_sec: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    
    # Request/Response data (optional, for debugging)
    request_payload: Mapped[Optional[dict]] = mapped_column(JSON)
    response_payload: Mapped[Optional[dict]] = mapped_column(JSON)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    
    # Metadata
    status: Mapped[str] = mapped_column(String(50), default="success")  # success, error, timeout
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))  # IPv6 support
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="usage_logs")
    api_key: Mapped["APIKey"] = relationship("APIKey", back_populates="usage_logs")
    
    __table_args__ = (
        Index("idx_usage_user_time", "user_id", "created_at"),
        Index("idx_usage_model", "model_id", "created_at"),
        Index("idx_usage_request", "request_id"),
        Index("idx_usage_status", "status", "created_at"),
    )


class UsageAggregation(Base):
    """Aggregated usage data for analytics"""
    __tablename__ = "usage_aggregations"
    
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    model_id: Mapped[Optional[str]] = mapped_column(String(100))
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    total_requests: Mapped[int] = mapped_column(Integer, default=0)
    total_input_tokens: Mapped[int] = mapped_column(BigInteger, default=0)
    total_output_tokens: Mapped[int] = mapped_column(BigInteger, default=0)
    total_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    
    avg_latency_ms: Mapped[Optional[int]] = mapped_column(Integer)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        UniqueConstraint("user_id", "model_id", "date", name="uq_user_model_date"),
        Index("idx_agg_user_date", "user_id", "date"),
        Index("idx_agg_model_date", "model_id", "date"),
    )


# ============================================================================
# Rate Limiting
# ============================================================================

class RateLimit(Base):
    """User rate limit configuration"""
    __tablename__ = "rate_limits"
    
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id"),
        unique=True,
        nullable=False
    )
    tier: Mapped[str] = mapped_column(String(50), default="free")  # free, starter, growth, enterprise
    
    # Rate limits
    requests_per_minute: Mapped[int] = mapped_column(Integer, default=10)
    requests_per_day: Mapped[int] = mapped_column(Integer, default=1000)
    max_tokens_per_request: Mapped[int] = mapped_column(Integer, default=4096)
    max_tokens_per_day: Mapped[int] = mapped_column(Integer, default=100000)
    
    # Priority
    priority_level: Mapped[int] = mapped_column(Integer, default=1)  # Higher = better queue position
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="rate_limit")


# ============================================================================
# Knowledge Base Models
# ============================================================================

class KnowledgeBase(Base):
    """Knowledge base container for documents"""
    __tablename__ = "knowledge_bases"
    
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    embedding_model: Mapped[str] = mapped_column(String(100), default="all-MiniLM-L6-v2")
    chunk_size: Mapped[int] = mapped_column(Integer, default=512)
    chunk_overlap: Mapped[int] = mapped_column(Integer, default=64)
    total_size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    document_count: Mapped[int] = mapped_column(Integer, default=0)
    max_size_bytes: Mapped[int] = mapped_column(BigInteger, default=500 * 1024 * 1024)  # 500MB default
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User")
    documents: Mapped[List["KnowledgeBaseDocument"]] = relationship(
        "KnowledgeBaseDocument",
        back_populates="knowledge_base",
        cascade="all, delete-orphan"
    )


class KnowledgeBaseDocument(Base):
    """Documents within a knowledge base"""
    __tablename__ = "kb_documents"
    
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    knowledge_base_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("knowledge_bases.id"),
        nullable=False,
        index=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50))
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    file_path: Mapped[str] = mapped_column(String(500))
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    doc_metadata: Mapped[Optional[dict]] = mapped_column(JSON)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
    
    # Relationships
    knowledge_base: Mapped["KnowledgeBase"] = relationship("KnowledgeBase", back_populates="documents")


# ============================================================================
# System Metrics
# ============================================================================

class SystemMetric(Base):
    """System health metrics"""
    __tablename__ = "system_metrics"
    
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    metric_type: Mapped[str] = mapped_column(String(100), nullable=False)  # gpu_utilization, queue_depth, error_rate
    model_id: Mapped[Optional[str]] = mapped_column(String(100))
    pod_name: Mapped[Optional[str]] = mapped_column(String(255))
    
    value: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False)
    unit: Mapped[Optional[str]] = mapped_column(String(50))
    
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        Index("idx_metrics_type_time", "metric_type", "timestamp"),
    )
