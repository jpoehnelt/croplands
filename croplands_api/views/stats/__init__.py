from flask import Blueprint, jsonify
from croplands_api.models import db
from sqlalchemy import text
import datetime


stats_blueprint = Blueprint('stats', __name__, url_prefix='/stats')


def get_leaders(since='2015-01-01', source='ground', limit=30):
    kwargs = locals().copy()

    cmd = text("""
          SELECT record.count, initcap(u.first) AS first, upper(substring(u.last from 1 for 1)) AS last, u.organization FROM (SELECT record.user_id AS user_id, count(*) AS count
          FROM record
          LEFT JOIN location
          ON location.id = record.location_id
          WHERE location.use_deleted IS FALSE
          AND record.user_id IS NOT NULL
          AND record.source_type = :source
          AND record.date_created > DATE (:since)
          GROUP BY record.user_id) AS record
          LEFT JOIN users AS u ON u.id = record.user_id
          ORDER BY record.count DESC
          LIMIT :limit
          """)

    result = db.engine.execute(cmd, kwargs)

    return [dict(row) for row in result]


@stats_blueprint.route("/leaders")
def leader_view():
    month_ago = (datetime.date.today() - datetime.timedelta(days=30)).isoformat()
    week_ago = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
    day_ago = (datetime.datetime.today() - datetime.timedelta(hours=24)).isoformat()

    r = {
        'leaders': {
            'all_time': get_leaders(),
            'monthly': get_leaders(since=month_ago),
            'weekly': get_leaders(since=week_ago),
            'daily': get_leaders(since=day_ago),
        }
    }

    return jsonify(r)


