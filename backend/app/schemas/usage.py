"""
Pydantic schemas for usage analytics and logs
"""

from datetime import datetime, date
from typing import Optional, List, Dict, Any
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


# ============================================================================
# Request Schemas
# ============================================================================

class UsageQueryParams(BaseModel):
    """Query parameters for usage analytics"""
    model_config = ConfigDict(protected_namespaces=())
    
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    model_id: Optional[str] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=100)


class RequestLogsQueryParams(BaseModel):
    """Query parameters for request logs"""
    model_config = ConfigDict(protected_namespaces=())
    
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    model_id: Optional[str] = None
    status: Optional[str] = None  # success, error, timeout
    api_key_id: Optional[UUID] = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=100)


# ============================================================================
# Response Schemas
# ============================================================================

class DailyUsageItem(BaseModel):
    """Daily usage aggregation"""
    date: date
    model_id: Optional[str]
    total_requests: int
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    total_cost: float
    avg_latency_ms: Optional[int]
    error_count: int
    success_rate: float


class UsageAnalyticsResponse(BaseModel):
    """Usage analytics response"""
    usage: List[DailyUsageItem]
    summary: Dict[str, Any]
    period_start: date
    period_end: date
    total_requests: int
    total_tokens: int
    total_cost: float


class ModelUsageBreakdown(BaseModel):
    """Usage breakdown by model"""
    model_id: str
    model_name: str
    total_requests: int
    total_input_tokens: int
    total_output_tokens: int
    total_cost: float
    percentage: float


class UsageBreakdownResponse(BaseModel):
    """Usage breakdown response"""
    by_model: List[ModelUsageBreakdown]
    period_start: date
    period_end: date


class RequestLogItem(BaseModel):
    """Single request log item"""
    id: UUID
    request_id: str
    model_id: str
    endpoint: Optional[str]
    input_tokens: int
    output_tokens: int
    total_tokens: int
    input_cost: float
    output_cost: float
    total_cost: float
    latency_ms: Optional[int]
    ttft_ms: Optional[int]
    status: str
    error_message: Optional[str]
    ip_address: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class RequestLogsResponse(BaseModel):
    """Request logs response"""
    logs: List[RequestLogItem]
    total: int
    page: int
    per_page: int


class RequestLogDetailResponse(BaseModel):
    """Detailed request log response"""
    id: UUID
    request_id: str
    model_id: str
    endpoint: Optional[str]
    input_tokens: int
    output_tokens: int
    input_cost: float
    output_cost: float
    latency_ms: Optional[int]
    ttft_ms: Optional[int]
    throughput_tokens_per_sec: Optional[float]
    status: str
    error_message: Optional[str]
    user_agent: Optional[str]
    ip_address: Optional[str]
    request_payload: Optional[Dict[str, Any]]
    response_payload: Optional[Dict[str, Any]]
    created_at: datetime
    
    class Config:
        from_attributes = True


class UsageStatsResponse(BaseModel):
    """Quick usage stats for dashboard"""
    today_requests: int
    today_tokens: int
    today_cost: float
    this_week_requests: int
    this_week_tokens: int
    this_week_cost: float
    this_month_requests: int
    this_month_tokens: int
    this_month_cost: float


class UsageChartDataPoint(BaseModel):
    """Data point for usage chart"""
    timestamp: datetime
    value: float
    label: str


class UsageChartResponse(BaseModel):
    """Usage chart data response"""
    data: List[UsageChartDataPoint]
    metric: str  # tokens, requests, cost
    interval: str  # hour, day, week
