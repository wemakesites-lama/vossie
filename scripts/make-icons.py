"""Generate Vossie's app icons from the cleaned crest artwork.

Run from the project root:  python3 scripts/make-icons.py
Re-run when Eduvos supplies the official crest (point CREST at the new file).
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
CREST = ROOT / "docs/reference/brand/crest-white.png"
NAVY = (21, 48, 93, 255)


def icon(size: int, crest_height: float, corner: float = 0.0) -> Image.Image:
    """A navy square (optionally rounded) with the white crest centred at `crest_height` of the size."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=round(size * corner), fill=255)
    canvas.paste(Image.new("RGBA", (size, size), NAVY), (0, 0), mask)

    crest = Image.open(CREST).convert("RGBA")
    height = round(size * crest_height)
    width = round(crest.width * height / crest.height)
    crest = crest.resize((width, height), Image.LANCZOS)
    canvas.alpha_composite(crest, ((size - width) // 2, (size - height) // 2))
    return canvas


def main() -> None:
    icons = ROOT / "public/icons"
    icons.mkdir(parents=True, exist_ok=True)
    icon(192, 0.62).save(icons / "icon-192.png", optimize=True)
    icon(512, 0.62).save(icons / "icon-512.png", optimize=True)
    # Maskable: the crest stays inside the central 80% safe zone.
    icon(512, 0.46).save(icons / "icon-maskable-512.png", optimize=True)
    # iOS rounds the corners itself.
    icon(180, 0.6).save(ROOT / "app/apple-icon.png", optimize=True)
    icon(64, 0.7, corner=0.18).save(ROOT / "app/icon.png", optimize=True)
    icon(48, 0.72, corner=0.18).save(ROOT / "app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("Icons written to public/icons and app/.")


if __name__ == "__main__":
    main()
