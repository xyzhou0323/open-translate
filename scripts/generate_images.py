"""Generate simple, clean store listing images."""
from PIL import Image, ImageDraw, ImageFont
import os
import shutil

WHITE = "#ffffff"
PRIMARY = "#2a588f"
CONTRAST = "#f09b9c"
LIGHT_BG = "#f5f7fa"

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(os.path.dirname(OUT_DIR), "assets")
ICONS_DIR = os.path.join(ASSETS_DIR, "icons")
STORE_DIR = os.path.join(ASSETS_DIR, "store")
os.makedirs(STORE_DIR, exist_ok=True)


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def load_icon(size):
    p = os.path.join(ICONS_DIR, "icon300.png")
    return Image.open(p).convert("RGBA").resize((size, size), Image.LANCZOS)


def get_font(size, bold=False):
    paths = [
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/msyhbd.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for fp in paths:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                continue
    return ImageFont.load_default()


def small_tile():
    w, h = 440, 280
    img = Image.new("RGBA", (w, h), hex_to_rgb(WHITE))
    draw = ImageDraw.Draw(img)

    # Bottom accent bar
    draw.rectangle([0, h - 4, w, h], fill=hex_to_rgb(CONTRAST))

    # Left accent stripe
    draw.rectangle([0, 0, 6, h], fill=hex_to_rgb(PRIMARY))

    # Icon
    icon = load_icon(96)
    img.paste(icon, (50, (h - 96) // 2), icon)

    # Title
    title_font = get_font(34, bold=True)
    draw.text((170, 85), "ND Translate", fill=hex_to_rgb(PRIMARY), font=title_font)

    # Tagline
    tag_font = get_font(15)
    draw.text((172, 136), "神经多样性友好的网页翻译扩展", fill="#555555", font=tag_font)

    # Description
    desc_font = get_font(12)
    draw.text((174, 172), "内置术语表  ·  阅读辅助  ·  多引擎  ·  双语对照",
              fill=hex_to_rgb(CONTRAST), font=desc_font)

    img.save(os.path.join(STORE_DIR, "store-small-tile.png"), "PNG")
    print(f"  store-small-tile.png ({w}x{h})")


def large_tile():
    w, h = 1280, 800
    img = Image.new("RGBA", (w, h), hex_to_rgb(WHITE))
    draw = ImageDraw.Draw(img)

    # Bottom accent bar
    draw.rectangle([0, h - 6, w, h], fill=hex_to_rgb(CONTRAST))
    # Left accent stripe
    draw.rectangle([0, 0, 10, h], fill=hex_to_rgb(PRIMARY))
    # Top thin accent
    draw.rectangle([0, 0, w, 3], fill=hex_to_rgb(CONTRAST))

    # Icon
    icon = load_icon(180)
    img.paste(icon, (100, (h - 180) // 2), icon)

    # Title
    title_font = get_font(72, bold=True)
    draw.text((320, 240), "ND Translate", fill=hex_to_rgb(PRIMARY), font=title_font)

    # Tagline
    tag_font = get_font(30)
    draw.text((326, 340), "神经多样性友好的网页翻译扩展", fill="#555555", font=tag_font)

    # Divider line
    draw.rectangle([326, 410, 700, 416], fill=hex_to_rgb(CONTRAST))

    # Description
    desc_font = get_font(22)
    draw.text((326, 460),
              "内置神经多样性术语表，确保 ND 术语翻译准确一致。",
              fill="#444444", font=desc_font)
    draw.text((326, 500),
              "提供阅读辅助功能：OpenDyslexic 字体、Bionic Reading、每句换行与间距调整。",
              fill="#444444", font=desc_font)
    draw.text((326, 540),
              "支持免费翻译与 LLM API 双引擎，替换 / 双语 / 手动三种模式灵活切换。",
              fill="#444444", font=desc_font)

    # Footer text
    foot_font = get_font(16)
    draw.text((326, 640), "Chrome / Edge  ·  开源免费",
              fill=hex_to_rgb(CONTRAST), font=foot_font)

    img.save(os.path.join(STORE_DIR, "store-large-tile.png"), "PNG")
    print(f"  store-large-tile.png ({w}x{h})")


def marquee():
    large_tile()
    shutil.copy(os.path.join(STORE_DIR, "store-large-tile.png"),
                os.path.join(STORE_DIR, "store-marquee.png"))
    print("  store-marquee.png (1280x800)")


if __name__ == "__main__":
    print("Generating store images...")
    small_tile()
    large_tile()
    marquee()
    print("Done!")
