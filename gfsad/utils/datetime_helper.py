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