from PIL import Image


def append_to_file_name(filename, append_str='-new', file_extension='jpg'):
    return filename.rsplit(".", 1)[0] + append_str + '.' + file_extension


def scale_image(filename, new_filename=None, append_filename='-small'):
    img = Image.open(filename)

    img.convert("RGB")
    img.thumbnail((600, 600))

    if new_filename is None:
        filename_save = append_to_file_name(filename, append_filename, 'jpg')
    else:
        filename_save = new_filename
    print filename_save
    img.save(filename_save, 'JPEG', quality=60)


if __name__ == "__main__":
    scale_image("test.JPG", "asdf.a.new.jpg")