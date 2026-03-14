"""
Usage analytics and request logs API routes
"""

from datetime import datetime, date, timedelta, timezone
from typing import Optional, List
from uuid import UUID
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, Integer

from app.core.database import get_db
from app.models.models import UsageLog, UsageAggregation
from app.schemas.usage import (
    UsageQueryParams,
    RequestLogsQueryParams,
    DailyUsageItem,
    UsageAnalyticsResponse,
    ModelUsageBreakdown,
    UsageBreakdownResponse,
    RequestLogItem,
    RequestLogsResponse,
    RequestLogDetailResponse,
    UsageStatsResponse,
    UsageChartDataPoint,
    UsageChartResponse,
)
from app.api.deps import CurrentUser
from app.core.config import settings


router = APIRouter(prefix="/usage", tags=["Usage & Analytics"])


# ============================================================================
# Usage Statistics (Dashboard)
# ============================================================================

@router.get("/stats", response_model=UsageStatsResponse)
async def get_usage_stats(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Get usage statistics for dashboard
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    async def get_period_stats(start_date: datetime):
        result = await db.execute(
            select(
                func.count(UsageLog.id).label("requests"),
                func.coalesce(func.sum(UsageLog.input_tokens + UsageLog.output_tokens), 0).label("tokens"),
                func.coalesce(func.sum(UsageLog.input_cost + UsageLog.output_cost), 0).label("cost"),
            ).where(
                UsageLog.user_id == current_user.id,
                UsageLog.created_at >= start_date
            )
        )
        row = result.one()
        return {
            "requests": row.requests or 0,
            "tokens": row.tokens or 0,
            "cost": float(row.cost or 0),
        }
    
    today = await get_period_stats(today_start)
    week = await get_period_stats(week_start)
    month = await get_period_stats(month_start)
    
    return UsageStatsResponse(
        today_requests=today["requests"],
        today_tokens=today["tokens"],
        today_cost=today["cost"],
        this_week_requests=week["requests"],
        this_week_tokens=week["tokens"],
        this_week_cost=week["cost"],
        this_month_requests=month["requests"],
        this_month_tokens=month["tokens"],
        this_month_cost=month["cost"],
    )


# ============================================================================
# Usage Analytics
# ============================================================================

@router.get("/analytics", response_model=UsageAnalyticsResponse)
async def get_usage_analytics(
    current_user: CurrentUser,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    model_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed usage analytics
    """
    # Default to last 30 days
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=30)
    
    start_datetime = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_datetime = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)
    
    # Build query
    query = select(
        func.date(UsageLog.created_at).label("date"),
        UsageLog.model_id,
        func.count(UsageLog.id).label("total_requests"),
        func.sum(UsageLog.input_tokens).label("total_input_tokens"),
        func.sum(UsageLog.output_tokens).label("total_output_tokens"),
        func.sum(UsageLog.input_cost + UsageLog.output_cost).label("total_cost"),
        func.avg(UsageLog.latency_ms).label("avg_latency_ms"),
        func.sum(func.cast(UsageLog.status != "success", Integer)).label("error_count"),
    ).where(
        UsageLog.user_id == current_user.id,
        UsageLog.created_at >= start_datetime,
        UsageLog.created_at <= end_datetime,
    )
    
    if model_id:
        query = query.where(UsageLog.model_id == model_id)
    
    query = query.group_by(
        func.date(UsageLog.created_at),
        UsageLog.model_id
    ).order_by(desc(func.date(UsageLog.created_at)))
    
    result = await db.execute(query)
    rows = result.all()
    
    usage_items = []
    total_requests = 0
    total_tokens = 0
    total_cost = 0.0
    
    for row in rows:
        input_tokens = row.total_input_tokens or 0
        output_tokens = row.total_output_tokens or 0
        requests = row.total_requests or 0
        errors = row.error_count or 0
        
        total_requests += requests
        total_tokens += input_tokens + output_tokens
        total_cost += float(row.total_cost or 0)
        
        usage_items.append(DailyUsageItem(
            date=row.date,
            model_id=row.model_id,
            total_requests=requests,
            total_input_tokens=input_tokens,
            total_output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            total_cost=float(row.total_cost or 0),
            avg_latency_ms=int(row.avg_latency_ms) if row.avg_latency_ms else None,
            error_count=errors,
            success_rate=((requests - errors) / requests * 100) if requests > 0 else 100.0,
        ))
    
    return UsageAnalyticsResponse(
        usage=usage_items,
        summary={
            "total_requests": total_requests,
            "total_tokens": total_tokens,
            "total_cost": total_cost,
            "avg_tokens_per_request": total_tokens // total_requests if total_requests > 0 else 0,
        },
        period_start=start_date,
        period_end=end_date,
        total_requests=total_requests,
        total_tokens=total_tokens,
        total_cost=total_cost,
    )


# ============================================================================
# Usage Breakdown by Model
# ============================================================================

@router.get("/breakdown", response_model=UsageBreakdownResponse)
async def get_usage_breakdown(
    current_user: CurrentUser,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    model_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Get usage breakdown by model
    """
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=30)
    
    start_datetime = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_datetime = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)
    
    # Build where conditions
    where_conditions = [
        UsageLog.user_id == current_user.id,
        UsageLog.created_at >= start_datetime,
        UsageLog.created_at <= end_datetime,
    ]
    
    if model_id:
        where_conditions.append(UsageLog.model_id == model_id)
    
    result = await db.execute(
        select(
            UsageLog.model_id,
            func.count(UsageLog.id).label("total_requests"),
            func.sum(UsageLog.input_tokens).label("total_input_tokens"),
            func.sum(UsageLog.output_tokens).label("total_output_tokens"),
            func.sum(UsageLog.input_cost + UsageLog.output_cost).label("total_cost"),
        ).where(*where_conditions)
        .group_by(UsageLog.model_id)
    )
    rows = result.all()
    
    # Calculate total for percentages
    total_all = sum(float(r.total_cost or 0) for r in rows)
    
    # Model name mapping
    model_names = {
        "llama-3.1-8b-instruct": "Llama 3.1 8B Instruct",
        "llama-3.1-70b-instruct": "Llama 3.1 70B Instruct",
        "mistral-7b-instruct": "Mistral 7B Instruct",
        "mixtral-8x7b-instruct": "Mixtral 8x7B Instruct",
        "qwen-2.5-7b-instruct": "Qwen 2.5 7B Instruct",
        "bge-large-en-v1.5": "BGE Large Embeddings",
    }
    
    breakdown = []
    for row in rows:
        cost = float(row.total_cost or 0)
        breakdown.append(ModelUsageBreakdown(
            model_id=row.model_id,
            model_name=model_names.get(row.model_id, row.model_id),
            total_requests=row.total_requests or 0,
            total_input_tokens=row.total_input_tokens or 0,
            total_output_tokens=row.total_output_tokens or 0,
            total_cost=cost,
            percentage=(cost / total_all * 100) if total_all > 0 else 0,
        ))
    
    return UsageBreakdownResponse(
        by_model=sorted(breakdown, key=lambda x: x.total_cost, reverse=True),
        period_start=start_date,
        period_end=end_date,
    )


# ============================================================================
# Request Logs
# ============================================================================

@router.get("/logs", response_model=RequestLogsResponse)
async def get_request_logs(
    current_user: CurrentUser,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    model_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    api_key_id: Optional[UUID] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed request logs
    """
    offset = (page - 1) * per_page
    
    # Build query
    query = select(UsageLog).where(UsageLog.user_id == current_user.id)
    count_query = select(func.count(UsageLog.id)).where(UsageLog.user_id == current_user.id)
    
    if start_date:
        query = query.where(UsageLog.created_at >= start_date)
        count_query = count_query.where(UsageLog.created_at >= start_date)
    
    if end_date:
        query = query.where(UsageLog.created_at <= end_date)
        count_query = count_query.where(UsageLog.created_at <= end_date)
    
    if model_id:
        query = query.where(UsageLog.model_id == model_id)
        count_query = count_query.where(UsageLog.model_id == model_id)
    
    if status:
        query = query.where(UsageLog.status == status)
        count_query = count_query.where(UsageLog.status == status)
    
    if api_key_id:
        query = query.where(UsageLog.api_key_id == api_key_id)
        count_query = count_query.where(UsageLog.api_key_id == api_key_id)
    
    # Get count
    result = await db.execute(count_query)
    total = result.scalar() or 0
    
    # Get logs
    result = await db.execute(
        query.order_by(desc(UsageLog.created_at))
        .offset(offset)
        .limit(per_page)
    )
    logs = result.scalars().all()
    
    log_items = []
    for log in logs:
        log_items.append(RequestLogItem(
            id=log.id,
            request_id=log.request_id,
            model_id=log.model_id,
            endpoint=log.endpoint,
            input_tokens=log.input_tokens,
            output_tokens=log.output_tokens,
            total_tokens=log.input_tokens + log.output_tokens,
            input_cost=float(log.input_cost),
            output_cost=float(log.output_cost),
            total_cost=float(log.input_cost + log.output_cost),
            latency_ms=log.latency_ms,
            ttft_ms=log.ttft_ms,
            status=log.status,
            error_message=log.error_message,
            ip_address=log.ip_address,
            created_at=log.created_at,
        ))
    
    return RequestLogsResponse(
        logs=log_items,
        total=total,
        page=page,
        per_page=per_page,
    )


# ============================================================================
# Request Log Detail
# ============================================================================

@router.get("/logs/{log_id}", response_model=RequestLogDetailResponse)
async def get_request_log_detail(
    log_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed information for a specific request log
    """
    result = await db.execute(
        select(UsageLog).where(
            UsageLog.id == log_id,
            UsageLog.user_id == current_user.id
        )
    )
    log = result.scalar_one_or_none()
    
    if not log:
        raise HTTPException(status_code=404, detail="Request log not found")
    
    return RequestLogDetailResponse(
        id=log.id,
        request_id=log.request_id,
        model_id=log.model_id,
        endpoint=log.endpoint,
        input_tokens=log.input_tokens,
        output_tokens=log.output_tokens,
        input_cost=float(log.input_cost),
        output_cost=float(log.output_cost),
        latency_ms=log.latency_ms,
        ttft_ms=log.ttft_ms,
        throughput_tokens_per_sec=float(log.throughput_tokens_per_sec) if log.throughput_tokens_per_sec else None,
        status=log.status,
        error_message=log.error_message,
        user_agent=log.user_agent,
        ip_address=log.ip_address,
        request_payload=log.request_payload,
        response_payload=log.response_payload,
        created_at=log.created_at,
    )


# ============================================================================
# Usage Chart Data
# ============================================================================

@router.get("/chart", response_model=UsageChartResponse)
async def get_usage_chart(
    current_user: CurrentUser,
    metric: str = Query("tokens", pattern="^(tokens|requests|cost)$"),
    interval: str = Query("day", pattern="^(hour|day|week)$"),
    days: int = Query(30, ge=1, le=90),
    model_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Get usage data for charts
    """
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    
    # Determine grouping (Postgres uses date_trunc; SQLite uses strftime)
    is_sqlite = settings.DATABASE_URL.startswith("sqlite")
    if is_sqlite:
        if interval == "hour":
            date_format = func.strftime('%Y-%m-%d %H:00:00', UsageLog.created_at)
        elif interval == "week":
            # Group by year-week
            date_format = func.strftime('%Y-%W', UsageLog.created_at)
        else:
            date_format = func.strftime('%Y-%m-%d', UsageLog.created_at)
    else:
        if interval == "hour":
            date_format = func.date_trunc("hour", UsageLog.created_at)
        elif interval == "week":
            date_format = func.date_trunc("week", UsageLog.created_at)
        else:
            date_format = func.date_trunc("day", UsageLog.created_at)
    
    # Determine metric
    if metric == "tokens":
        metric_col = func.sum(UsageLog.input_tokens + UsageLog.output_tokens)
    elif metric == "cost":
        metric_col = func.sum(UsageLog.input_cost + UsageLog.output_cost)
    else:
        metric_col = func.count(UsageLog.id)
    
    # Build where conditions
    where_conditions = [
        UsageLog.user_id == current_user.id,
        UsageLog.created_at >= start
    ]
    
    if model_id:
        where_conditions.append(UsageLog.model_id == model_id)
    
    result = await db.execute(
        select(
            date_format.label("timestamp"),
            metric_col.label("value")
        ).where(*where_conditions)
        .group_by(date_format)
        .order_by(date_format)
    )
    rows = result.all()
    
    data_points = []
    for row in rows:
        ts = row.timestamp
        # If SQLite, timestamp may be returned as string; parse accordingly
        if is_sqlite and isinstance(ts, str):
            if interval == 'hour':
                ts_dt = datetime.strptime(ts, '%Y-%m-%d %H:00:00').replace(tzinfo=timezone.utc)
                label = ts_dt.strftime('%b %d')
            elif interval == 'day':
                ts_dt = datetime.strptime(ts, '%Y-%m-%d').replace(tzinfo=timezone.utc)
                label = ts_dt.strftime('%b %d')
            else:  # week
                # ts is 'YYYY-WW'
                year, week = ts.split('-')
                ts_dt = datetime.strptime(f"{year} {week} 1", '%Y %W %w').replace(tzinfo=timezone.utc)
                label = ts_dt.strftime('%b %d')
        else:
            ts_dt = ts
            label = ts_dt.strftime('%b %d')

        data_points.append(UsageChartDataPoint(
            timestamp=ts_dt,
            value=float(row.value or 0),
            label=label,
        ))
    
    return UsageChartResponse(
        data=data_points,
        metric=metric,
        interval=interval,
    )


# ============================================================================
# CSV Export
# ============================================================================

@router.get("/export/csv")
async def export_usage_csv(
    current_user: CurrentUser,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    model_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Export usage data as CSV
    """
    from fastapi.responses import StreamingResponse
    import csv
    import io
    
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=30)
    
    start_datetime = datetime.combine(start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_datetime = datetime.combine(end_date, datetime.max.time()).replace(tzinfo=timezone.utc)
    
    # Build where conditions
    where_conditions = [
        UsageLog.user_id == current_user.id,
        UsageLog.created_at >= start_datetime,
        UsageLog.created_at <= end_datetime,
    ]
    
    if model_id:
        where_conditions.append(UsageLog.model_id == model_id)
    
    result = await db.execute(
        select(
            UsageLog.created_at,
            UsageLog.model_id,
            UsageLog.input_tokens,
            UsageLog.output_tokens,
            UsageLog.input_cost,
            UsageLog.output_cost,
            UsageLog.endpoint,
            UsageLog.request_id,
        ).where(*where_conditions)
        .order_by(desc(UsageLog.created_at))
    )
    rows = result.all()
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        'Date',
        'Model',
        'Input Tokens',
        'Output Tokens',
        'Total Tokens',
        'Input Cost (₹)',
        'Output Cost (₹)',
        'Total Cost (₹)',
        'Endpoint',
        'Request ID'
    ])
    
    # Write data
    for row in rows:
        total_tokens = (row.input_tokens or 0) + (row.output_tokens or 0)
        total_cost = (float(row.input_cost or 0) + float(row.output_cost or 0))
        
        writer.writerow([
            row.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            row.model_id,
            row.input_tokens or 0,
            row.output_tokens or 0,
            total_tokens,
            f"{float(row.input_cost or 0):.6f}",
            f"{float(row.output_cost or 0):.6f}",
            f"{total_cost:.6f}",
            row.endpoint,
            row.request_id
        ])
    
    output.seek(0)
    
    # Generate filename
    filename = f"usage_export_{start_date}_{end_date}"
    if model_id:
        filename += f"_{model_id.replace('/', '_')}"
    filename += ".csv"
    
    return StreamingResponse(
        io.StringIO(output.getvalue()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
