from gfsad import celery
from flask import current_app
from gfsad.models import db, Tile


@celery.task
def compute_tile_classification_statistics(tile_id):
    tile = Tile.query.get(tile_id)

    classification_count = [0 for i in range(0, 10)]

    for record in tile.classifications:
        classification_count[record.classification] += 1

    tile.classifications_majority_class = 0
    for i, count in enumerate(classification_count):
        if count > classification_count[tile.classifications_majority_class]:
            tile.classifications_majority_class = i

    tile.classifications_count = sum(classification_count)
    tile.classifications_majority_agreement = 100 * classification_count[
        tile.classifications_majority_class] / tile.classifications_count

    tile.classifications_count = sum(classification_count)

    db.session.commit()
