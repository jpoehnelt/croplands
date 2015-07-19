"""empty message

Revision ID: 57eb6804d74
Revises: 43326aa692eb
Create Date: 2015-05-13 10:35:39.712205

"""

# revision identifiers, used by Alembic.
revision = '57eb6804d74'
down_revision = '43326aa692eb'

from alembic import op
import sqlalchemy as sa


def upgrade():
    ### commands auto generated by Alembic - please adjust! ###
    op.add_column('image', sa.Column('classifications_priority', sa.Integer(), nullable=True))
    ### end Alembic commands ###


def downgrade():
    ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('image', 'classifications_priority')
    ### end Alembic commands ###