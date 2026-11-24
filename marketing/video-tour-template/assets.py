"""Prepare the non-page assets the stage expects in cap/.
Usage: python3 assets.py [logo_box]   logo_box = x0,y0,x1,y1 in cap/hero.png pixels (default fits the desk header)
Creates cap/grain.png (film grain tile) and cap/logo.png (brand mark cropped from the page header).
Photos are added by hand: cap/poster.jpg (cold open, 1080x1440), cap/moz.jpg (scene photo, 1080x1440),
cap/hl_card.jpg (official-video card) -- see README "Photos"."""
import sys
from PIL import Image
Image.effect_noise((512, 512), 60).convert("L").save("cap/grain.png")
box = tuple(int(v) for v in (sys.argv[1] if len(sys.argv) > 1 else "30,176,106,256").split(","))
Image.open("cap/hero.png").crop(box).save("cap/logo.png")
print("grain + logo ready")
