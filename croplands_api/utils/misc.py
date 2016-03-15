import time


def split_list(l, parts=1):
    """
    Splits a list into even pieces.
    :param l: list
    :param parts: number of parts
    :return: list of lists
    """
    length = len(l)
    return [l[i * length // parts: (i + 1) * length // parts]
            for i in range(parts)]


def strftime(dt, fmt="%Y-%m-%d"):
    """
    Simple helper function for return a string from a datetime.
    Basically catches when datetime is none and returns an empty
    string instead of throwing the error.
    :param dt: Datetime
    :param fmt: String
    :return: String
    """
    try:
        return dt.strftime(fmt)
    except AttributeError:
        return ''


current_milli_time = lambda: int(round(time.time() * 1000))
