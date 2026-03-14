# Adding Payment Integration

The credit purchase flow in InferXSpace is a blank slate by design — you choose your
payment provider. This document shows how to add **Stripe** (the most common
choice) in under 30 minutes.

---

## Option A: Stripe Checkout (recommended)

### 1. Install Stripe

```bash
cd backend
pip install stripe
echo "stripe" >> requirements.txt
```

### 2. Add environment variables

```bash
# .env
STRIPE_SECRET_KEY=sk_live_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-signing-secret
```

### 3. Update `backend/app/core/config.py`

```python
STRIPE_SECRET_KEY: str = ""
STRIPE_WEBHOOK_SECRET: str = ""
```

### 4. Implement `POST /api/credits/purchase`

In `backend/app/api/routes/credits.py`, replace the placeholder with:

```python
import stripe
from app.core.config import settings

@router.post("/purchase")
async def purchase_credits(request: Request, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    package_id = body.get("package_id")

    # Look up package
    pkg = next((p for p in CREDIT_PACKAGES if p["id"] == package_id), None)
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")

    stripe.api_key = settings.STRIPE_SECRET_KEY
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "usd",
                "unit_amount": int(pkg["price_usd"] * 100),  # cents
                "product_data": {"name": pkg["name"]},
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=f"{settings.FRONTEND_URL}/dashboard?purchase=success",
        cancel_url=f"{settings.FRONTEND_URL}/credits",
        metadata={"user_id": str(current_user.id), "package_id": package_id},
    )

    return {"checkout_url": session.url}
```

### 5. Implement webhook `POST /api/credits/webhook`

```python
@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session["metadata"]["user_id"]
        package_id = session["metadata"]["package_id"]
        pkg = next((p for p in CREDIT_PACKAGES if p["id"] == package_id), None)

        if pkg:
            # Credit the user
            result = await db.execute(select(UserCredit).where(UserCredit.user_id == user_id))
            credits = result.scalar_one_or_none()
            if not credits:
                credits = UserCredit(user_id=user_id, balance_tokens=0)
                db.add(credits)
            credits.balance_tokens += pkg["tokens"] + pkg.get("bonus_tokens", 0)
            credits.total_purchased += pkg["tokens"]
            await db.commit()

    return {"received": True}
```

### 6. Test locally with Stripe CLI

```bash
stripe listen --forward-to localhost:8000/api/credits/webhook
```

---

## Option B: LemonSqueezy

LemonSqueezy has a simple REST API and webhooks. No SDK needed — just `httpx`.

1. Create a product + variant in your LemonSqueezy store
2. Use their [Checkout API](https://docs.lemonsqueezy.com/api/checkouts) to create a checkout link
3. Verify payments via their webhook (similar pattern to above)

---

## Development: grant credits manually

During development, skip payment entirely:

```bash
curl -X POST http://localhost:8000/api/credits/admin/grant \
  -H "Authorization: Bearer ix-your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"tokens": 10000000, "note": "dev"}'
```
