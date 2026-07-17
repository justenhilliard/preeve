from io import BytesIO

from PIL import Image

import background_removal


def make_png_with_transparency() -> bytes:
    image = Image.new("RGBA", (2, 2), (0, 0, 0, 0))
    image.putpixel((0, 0), (255, 0, 0, 255))

    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def test_remove_background_returns_original_on_failure(monkeypatch) -> None:
    original_image = b"original image"

    def fail_prediction(_token, _image_bytes):
        raise RuntimeError("Replicate unavailable.")

    monkeypatch.setattr(background_removal, "get_replicate_token", lambda: "token")
    monkeypatch.setattr(
        background_removal,
        "create_background_removal_prediction",
        fail_prediction,
    )

    assert background_removal.remove_background(original_image) == original_image


def test_remove_background_composites_transparent_output_to_jpeg(monkeypatch) -> None:
    original_image = b"original image"

    monkeypatch.setattr(background_removal, "get_replicate_token", lambda: "token")
    monkeypatch.setattr(
        background_removal,
        "create_background_removal_prediction",
        lambda _token, _image_bytes: "https://example.com/output.png",
    )
    monkeypatch.setattr(
        background_removal,
        "download_output_image",
        lambda _url: make_png_with_transparency(),
    )

    processed_image = background_removal.remove_background(original_image)

    with Image.open(BytesIO(processed_image)) as image:
        assert image.format == "JPEG"
        assert image.mode == "RGB"
        assert image.size == (2, 2)
