"""add role column to users

Revision ID: add_role_to_users_001
Revises: cbeea5b11d1f
Create Date: 2026-03-06

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_role_to_users_001'
down_revision = 'cbeea5b11d1f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add role column with default 'user'
    op.add_column('users', sa.Column('role', sa.String(20), server_default='user', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'role')
