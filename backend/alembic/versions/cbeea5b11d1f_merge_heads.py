"""merge_heads

Revision ID: cbeea5b11d1f
Revises: 20a3ac3752f9, free_tier_001
Create Date: 2026-02-18 22:45:14.548937

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cbeea5b11d1f'
down_revision: Union[str, None] = ('20a3ac3752f9', 'free_tier_001')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
