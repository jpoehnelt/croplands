from gfsad import celery
from gfsad.models import db, Image


@celery.task
def compute_image_classification_statistics(image_id):
    image = Image.query.get(image_id)

    classification_count = [0 for i in range(0, 10)]

    for record in image.classifications:
        classification_count[record.classification] += 1

    image.classifications_majority_class = 0
    for i, count in enumerate(classification_count):
        if count > classification_count[image.classifications_majority_class]:
            image.classifications_majority_class = i

    image.classifications_count = sum(classification_count)
    image.classifications_majority_agreement = 100 * classification_count[
        image.classifications_majority_class] / image.classifications_count

    image.classifications_count = sum(classification_count)

    db.session.commit()
