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