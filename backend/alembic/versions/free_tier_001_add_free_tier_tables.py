"""add free tier tables

Revision ID: free_tier_001
Revises: 
Create Date: 2026-02-14

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'free_tier_001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create user_provider_keys table (BYOK)
    op.create_table(
        'user_provider_keys',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(100), nullable=False, index=True),
        sa.Column('provider_id', sa.String(50), nullable=False),
        sa.Column('encrypted_key', sa.Text, nullable=False),
        sa.Column('key_prefix', sa.String(50), nullable=False, server_default='***'),
        sa.Column('label', sa.String(100), server_default=''),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('is_verified', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        'idx_user_provider_key',
        'user_provider_keys',
        ['user_id', 'provider_id'],
        unique=True,
    )

    # Create provider_health_logs table
    op.create_table(
        'provider_health_logs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('provider_id', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('latency_ms', sa.Integer),
        sa.Column('error_message', sa.Text),
        sa.Column('checked_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        'idx_provider_health_time',
        'provider_health_logs',
        ['provider_id', 'checked_at'],
    )


def downgrade() -> None:
    op.drop_table('provider_health_logs')
    op.drop_table('user_provider_keys')
