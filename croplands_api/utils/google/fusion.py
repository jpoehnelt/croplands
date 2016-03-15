from googleapiclient.http import MediaIoBaseUpload, HttpError
from croplands_api.utils.google import build_service


def replace_rows(table_id, fd, startLine=None):
    """
    Replaces all rows in a fusion table with the fd of a csv.
    :param table_id: string
    :param fd: file descriptor
    :return: None
    """

    media_body = MediaIoBaseUpload(fd, mimetype='application/octet-stream')

    service = build_service("fusiontables", "v2")
    table = service.table()
    command = table.replaceRows(tableId=table_id,
                                media_body=media_body,
                                startLine=startLine)
    try:
        command.execute()
    except HttpError as e:
        print(e)