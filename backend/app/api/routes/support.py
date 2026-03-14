"""
Support and AI Assistant API routes for InferXSpace
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.models import User
from app.models.support import (
    SupportTicket, TicketMessage,
    TicketStatus, TicketPriority, TicketCategory
)
from app.schemas.support import (
    SupportTicketCreate, SupportTicketResponse, TicketMessageCreate,
    TicketMessageResponse
)

router = APIRouter()


# ============================================================================
# Support Ticket Routes
# ============================================================================

@router.post("/tickets", response_model=SupportTicketResponse)
async def create_support_ticket(
    ticket_data: SupportTicketCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new support ticket"""
    ticket = SupportTicket(
        user_id=current_user.id,
        subject=ticket_data.subject,
        description=ticket_data.description,
        priority=ticket_data.priority or TicketPriority.MEDIUM,
        category=ticket_data.category or TicketCategory.GENERAL,
        ticket_metadata=ticket_data.metadata
    )

    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    return SupportTicketResponse.from_orm(ticket)


@router.get("/tickets", response_model=List[SupportTicketResponse])
async def get_user_tickets(
    status_filter: Optional[TicketStatus] = None,
    category_filter: Optional[TicketCategory] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all support tickets for the current user"""
    query = select(SupportTicket).where(SupportTicket.user_id == current_user.id)

    if status_filter:
        query = query.where(SupportTicket.status == status_filter)
    if category_filter:
        query = query.where(SupportTicket.category == category_filter)

    query = query.order_by(desc(SupportTicket.created_at))

    result = await db.execute(query)
    tickets = result.scalars().all()

    return [SupportTicketResponse.from_orm(ticket) for ticket in tickets]


@router.get("/tickets/{ticket_id}", response_model=SupportTicketResponse)
async def get_ticket_details(
    ticket_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get detailed information about a specific ticket"""
    query = select(SupportTicket).where(
        SupportTicket.id == ticket_id,
        SupportTicket.user_id == current_user.id
    )
    result = await db.execute(query)
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    return SupportTicketResponse.from_orm(ticket)


@router.post("/tickets/{ticket_id}/messages", response_model=TicketMessageResponse)
async def add_ticket_message(
    ticket_id: UUID,
    message_data: TicketMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add a message to an existing ticket"""
    # Verify ticket exists and belongs to user
    query = select(SupportTicket).where(
        SupportTicket.id == ticket_id,
        SupportTicket.user_id == current_user.id
    )
    result = await db.execute(query)
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Create message
    message = TicketMessage(
        ticket_id=ticket_id,
        sender_id=current_user.id,
        message=message_data.message,
        attachments=message_data.attachments
    )

    db.add(message)
    await db.commit()
    await db.refresh(message)

    return TicketMessageResponse.from_orm(message)


@router.get("/tickets/{ticket_id}/messages", response_model=List[TicketMessageResponse])
async def get_ticket_messages(
    ticket_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all messages for a specific ticket"""
    # Verify ticket exists and belongs to user
    query = select(SupportTicket).where(
        SupportTicket.id == ticket_id,
        SupportTicket.user_id == current_user.id
    )
    result = await db.execute(query)
    ticket = result.scalar_one_or_none()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )

    # Get messages
    query = select(TicketMessage).where(
        TicketMessage.ticket_id == ticket_id
    ).order_by(TicketMessage.created_at)

    result = await db.execute(query)
    messages = result.scalars().all()

    return [TicketMessageResponse.from_orm(message) for message in messages]