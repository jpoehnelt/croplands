"""empty message

Revision ID: 31a2abb8b714
Revises: 54a207900d7a
Create Date: 2015-02-12 13:23:19.849699

"""

# revision identifiers, used by Alembic.
revision = '31a2abb8b714'
down_revision = '54a207900d7a'

from alembic import op
import sqlalchemy as sa


def upgrade():
    ### commands auto generated by Alembic - please adjust! ###
    op.create_table('timeseries',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('series', sa.String(), nullable=True),
    sa.Column('value', sa.Float(), nullable=False),
    sa.Column('date_acquired', sa.Date(), nullable=True),
    sa.Column('date_updated', sa.DateTime(), nullable=True),
    sa.Column('location_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['location_id'], ['location.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_timeseries_date_acquired'), 'timeseries', ['date_acquired'], unique=False)
    op.create_index(op.f('ix_timeseries_series'), 'timeseries', ['series'], unique=False)
    op.add_column(u'record', sa.Column('date_created', sa.DateTime(), nullable=True))
    op.add_column(u'record', sa.Column('date_updated', sa.DateTime(), nullable=True))
    ### end Alembic commands ###


def downgrade():
    ### commands auto generated by Alembic - please adjust! ###
    op.drop_column(u'record', 'date_updated')
    op.drop_column(u'record', 'date_created')
    op.drop_index(op.f('ix_timeseries_series'), table_name='timeseries')
    op.drop_index(op.f('ix_timeseries_date_acquired'), table_name='timeseries')
    op.drop_table('timeseries')
    ### end Alembic commands ###
