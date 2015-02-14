from gfsad.models import db
from gfsad.exceptions import FieldError


class TimeSeries(db.Model):
    """
    Stores a data point in time for the location referenced.
    """
    __tablename__ = 'timeseries'

    SERIES = ['modis_ndvi', 'landsat_ndvi']

    id = db.Column(db.Integer, primary_key=True)
    series = db.Column(db.String, index=True)
    value = db.Column(db.Float, nullable=False)
    date_acquired = db.Column(db.Date, index=True)
    date_updated = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())
    location_id = db.Column(db.ForeignKey('location.id'), nullable=False)

    def __init__(self, **kwargs):
        if kwargs['series'] not in TimeSeries.SERIES:
            raise FieldError(description="Invalid series name.")
        super(TimeSeries, self).__init__(**kwargs)
