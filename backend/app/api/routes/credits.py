"""
Credits and billing API routes.

Payment integration: NOT included in this open-source version.
To add payments, integrate Stripe, LemonSqueezy, or any provider:
  1. Add your payment provider SDK to requirements.txt
  2. Add keys to .env (e.g. STRIPE_SECRET_KEY)
  3. Implement the /purchase and /verify endpoints below

Out-of-the-box this version supports:
  - Viewing credit balance
  - Admin manual top-up via the /admin/grant endpoint
  - Transaction and purchase history
"""

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.config import settings, CREDIT_PACKAGES
from app.models.models import UserCredit, CreditPurchase, CreditTransaction
from app.schemas.credits import (
    CreditBalanceResponse,
    CreditPackageResponse,
    CreditPackagesListResponse,
    PurchaseHistoryItem,
    PurchaseHistoryResponse,
    TransactionHistoryItem,
    TransactionHistoryResponse,
)
from app.schemas.auth import MessageResponse
from app.api.deps import CurrentUser

router = APIRouter(prefix="/credits", tags=["Credits & Billing"])


# ============================================================================
# Get Credit Balance
# ============================================================================

@router.get("/balance", response_model=CreditBalanceResponse)
async def get_balance(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Get current credit balance."""
    result = await db.execute(
        select(UserCredit).where(UserCredit.user_id == current_user.id)
    )
    credits = result.scalar_one_or_none()

    if not credits:
        credits = UserCredit(user_id=current_user.id, balance_tokens=0, total_purchased=0, total_used=0)
        db.add(credits)
        await db.commit()
        await db.refresh(credits)

    return CreditBalanceResponse(
        balance_tokens=credits.balance_tokens,
        balance_usd=Decimal(str(credits.balance_tokens)) / Decimal("1000000"),
        total_purchased=credits.total_purchased,
        total_used=credits.total_used,
    )


# ============================================================================
# List Credit Packages
# ============================================================================

@router.get("/packages", response_model=CreditPackagesListResponse)
async def list_packages():
    """List available credit packages (configure CREDIT_PACKAGES in config.py)."""
    packages = [
        CreditPackageResponse(
            id=pkg["id"],
            name=pkg["name"],
            tokens=pkg["tokens"],
            price_usd=pkg["price_usd"],
            bonus_tokens=pkg.get("bonus_tokens", 0),
        )
        for pkg in CREDIT_PACKAGES
    ]
    return CreditPackagesListResponse(packages=packages)


# ============================================================================
# Purchase Credits — Payment Integration Placeholder
# ============================================================================

@router.post("/purchase")
async def purchase_credits(
    request: Request,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Purchase credits.

    NOTE: This endpoint is a placeholder. To enable payments:

    **Stripe** (recommended):
    ```python
    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="payment",
        success_url=f"{settings.FRONTEND_URL}/dashboard?success=1",
        cancel_url=f"{settings.FRONTEND_URL}/credits",
    )
    return {"checkout_url": session.url}
    ```

    See docs/PAYMENTS.md for a complete guide.
    """
    raise HTTPException(
        status_code=501,
        detail=(
            "Payment integration not configured. "
            "See docs/PAYMENTS.md to integrate Stripe, LemonSqueezy, or another provider. "
            "For development / testing, use POST /credits/admin/grant."
        ),
    )


@router.post("/verify")
async def verify_payment(
    request: Request,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Verify payment and credit the user — implement alongside /purchase."""
    raise HTTPException(
        status_code=501,
        detail="Payment verification not configured. See docs/PAYMENTS.md.",
    )


# ============================================================================
# Admin: Grant Credits (dev / manual top-ups)
# ============================================================================

@router.post("/admin/grant", response_model=MessageResponse)
async def admin_grant_credits(
    request: Request,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Manually grant credits to a user.
    Body: {"user_id": "uuid-or-omit-for-self", "tokens": 1000000, "note": "reason"}

    Protect this endpoint with an admin role check in production.
    """
    body = await request.json()
    target_user_id = body.get("user_id") or current_user.id
    tokens = int(body.get("tokens", 0))
    note = body.get("note", "Manual grant")

    if tokens <= 0:
        raise HTTPException(status_code=400, detail="tokens must be > 0")

    result = await db.execute(
        select(UserCredit).where(UserCredit.user_id == target_user_id)
    )
    credits = result.scalar_one_or_none()

    if not credits:
        credits = UserCredit(
            user_id=target_user_id,
            balance_tokens=0,
            total_purchased=0,
            total_used=0
        )
        db.add(credits)

    credits.balance_tokens += tokens
    credits.total_purchased += tokens

    txn = CreditTransaction(
        user_id=target_user_id,
        amount_tokens=tokens,
        transaction_type="grant",
        description=note,
    )
    db.add(txn)
    await db.commit()

    return MessageResponse(message=f"Granted {tokens:,} tokens to user {target_user_id}")


# ============================================================================
# Transaction History
# ============================================================================

@router.get("/transactions", response_model=TransactionHistoryResponse)
async def get_transaction_history(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """Get credit transaction history for the current user."""
    offset = (page - 1) * per_page
    result = await db.execute(
        select(CreditTransaction)
        .where(CreditTransaction.user_id == current_user.id)
        .order_by(desc(CreditTransaction.created_at))
        .offset(offset)
        .limit(per_page)
    )
    transactions = result.scalars().all()

    items = [
        TransactionHistoryItem(
            id=str(t.id),
            amount_tokens=t.amount_tokens,
            transaction_type=t.transaction_type,
            description=t.description,
            created_at=t.created_at,
        )
        for t in transactions
    ]

    return TransactionHistoryResponse(transactions=items, page=page, per_page=per_page)


# ============================================================================
# Purchase History
# ============================================================================

@router.get("/purchases", response_model=PurchaseHistoryResponse)
async def get_purchase_history(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """Get credit purchase history for the current user."""
    offset = (page - 1) * per_page
    result = await db.execute(
        select(CreditPurchase)
        .where(CreditPurchase.user_id == current_user.id)
        .order_by(desc(CreditPurchase.created_at))
        .offset(offset)
        .limit(per_page)
    )
    purchases = result.scalars().all()

    items = [
        PurchaseHistoryItem(
            id=str(p.id),
            package_id=p.package_id,
            tokens_purchased=p.tokens_purchased,
            amount_paid=p.amount_paid,
            currency=p.currency,
            status=p.status,
            created_at=p.created_at,
        )
        for p in purchases
    ]

    return PurchaseHistoryResponse(purchases=items, page=page, per_page=per_page)
