"""
Pydantic schemas for credits and billing
"""

from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field


# ============================================================================
# Request Schemas
# ============================================================================

class PurchaseCreditsRequest(BaseModel):
    """Purchase credits request"""
    package: str = Field(
        ...,
        description="Package name: starter, basic, growth, pro"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "package": "growth"
            }
        }


class CustomPurchaseRequest(BaseModel):
    """Custom amount purchase request"""
    token_amount: int = Field(..., ge=100000, le=1000000000)
    
    class Config:
        json_schema_extra = {
            "example": {
                "token_amount": 5000000
            }
        }


class VerifyPaymentRequest(BaseModel):
    """Razorpay payment verification request"""
    payment_order_id: str
    payment_id: str
    payment_signature: str


# ============================================================================
# Response Schemas
# ============================================================================

class CreditBalanceResponse(BaseModel):
    """Credit balance response"""
    balance_tokens: int
    balance_inr_equivalent: float
    reserved_tokens: int
    available_tokens: int
    total_purchased: int
    total_used: int
    currency: str = "INR"
    
    class Config:
        json_schema_extra = {
            "example": {
                "balance_tokens": 5000000,
                "balance_inr_equivalent": 500.0,
                "reserved_tokens": 0,
                "available_tokens": 5000000,
                "total_purchased": 10000000,
                "total_used": 5000000,
                "currency": "INR"
            }
        }


class CreditPackageResponse(BaseModel):
    """Credit package information"""
    id: str
    name: str
    tokens: int
    price: float
    currency: str = "INR"
    discount_percent: int
    effective_rate_per_1k: float
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "growth",
                "name": "Growth",
                "tokens": 10000000,
                "price": 5999.0,
                "currency": "INR",
                "discount_percent": 40,
                "effective_rate_per_1k": 0.60
            }
        }


class CreditPackagesListResponse(BaseModel):
    """List of available credit packages"""
    packages: List[CreditPackageResponse]


class RazorpayOrderResponse(BaseModel):
    """Razorpay order creation response"""
    order_id: str
    amount: int  # In paise
    currency: str
    payment_key: str
    name: str = "InferX Credits"
    description: str
    prefill_email: Optional[str] = None
    prefill_name: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "order_id": "order_xyz123",
                "amount": 599900,
                "currency": "INR",
                "payment_key": "your-payment-key",
                "name": "InferX Credits",
                "description": "10M tokens - Growth Package",
                "prefill_email": "user@example.com"
            }
        }


class PaymentVerificationResponse(BaseModel):
    """Payment verification response"""
    success: bool
    message: str
    tokens_added: int
    new_balance: int
    transaction_id: UUID


class PurchaseHistoryItem(BaseModel):
    """Single purchase history item"""
    id: UUID
    token_amount: int
    price_paid: float
    currency: str
    payment_method: Optional[str]
    payment_status: str
    purchased_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class PurchaseHistoryResponse(BaseModel):
    """Purchase history response"""
    purchases: List[PurchaseHistoryItem]
    total: int
    page: int
    per_page: int


class TransactionHistoryItem(BaseModel):
    """Single transaction history item"""
    id: UUID
    transaction_type: str  # purchase, usage, refund, adjustment
    amount_tokens: int
    balance_before: int
    balance_after: int
    description: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class TransactionHistoryResponse(BaseModel):
    """Transaction history response"""
    transactions: List[TransactionHistoryItem]
    total: int
    page: int
    per_page: int
