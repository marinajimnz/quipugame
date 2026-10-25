"""Procedural tileable backgrounds + film grain (no AI: they tile by construction).

Writes to public/patterns/:
  estrellas.png  white rounded four-point stars and dots on transparent (recolor the page, not the file)
  ondas.png      black rounded wavy regions on transparent, shown at low opacity for the tone-on-tone bands
  grano.png      mid-grey film grain, meant for mix-blend-mode: overlay

Usage: python scripts/build_patterns.py   (needs numpy, scipy, pillow)
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter

OUT = Path(__file__).parent.parent / "public/patterns"
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 1024  # shown at 512 css px (2x for retina)
SS = 3  # supersampling for the star/dot layer
rng = np.random.default_rng(20261025)


# ───────── estrellas redondeadas y puntos ─────────
def star_points(cx, cy, r, steps=24):
    """Four-point star with concave sides; rounded afterwards with a stroke."""
    pts = []
    k = 0.30  # how far the sides pinch in (0 = very thin, 1 = square)
    for q in range(4):
        a0, a1 = q * np.pi / 2, (q + 1) * np.pi / 2
        p0 = np.array([np.cos(a0), np.sin(a0)]) * r
        p1 = np.array([np.cos(a1), np.sin(a1)]) * r
        c = np.array([np.cos((a0 + a1) / 2), np.sin((a0 + a1) / 2)]) * r * k
        for t in np.linspace(0, 1, steps, endpoint=False):
            pts.append((1 - t) ** 2 * p0 + 2 * (1 - t) * t * c + t**2 * p1)
    return [(cx + x, cy + y) for x, y in pts]


def place(n, rmin, rmax, gap, taken):
    """Poisson-ish placement on a torus so the tile repeats seamlessly."""
    items = []
    tries = 0
    while len(items) < n and tries < 20000:
        tries += 1
        x, y, r = rng.uniform(0, SIZE), rng.uniform(0, SIZE), rng.uniform(rmin, rmax)
        ok = True
        for ox, oy, orad in taken + items:
            dx, dy = abs(x - ox), abs(y - oy)
            dx, dy = min(dx, SIZE - dx), min(dy, SIZE - dy)
            if (dx * dx + dy * dy) ** 0.5 < r + orad + gap:
                ok = False
                break
        if ok:
            items.append((x, y, r))
    return items


stars = place(24, 14, 30, 56, [])
dots = place(36, 6, 12, 40, stars)
specks = place(26, 3.5, 6, 30, stars + dots)

big = Image.new("L", (SIZE * SS, SIZE * SS), 0)
d = ImageDraw.Draw(big)


def wrap(x, y, r):
    for ox in (-SIZE, 0, SIZE):
        for oy in (-SIZE, 0, SIZE):
            if -r < x + ox < SIZE + r and -r < y + oy < SIZE + r:
                yield x + ox, y + oy


for x, y, r in stars:
    for px, py in wrap(x, y, r * 1.4):
        pts = [(a * SS, b * SS) for a, b in star_points(px, py, r * 0.86)]
        d.polygon(pts, fill=255)
        # a round join on every tip: stroke the outline with a disc-capped line
        w = r * 0.30 * SS
        d.line(pts + [pts[0]], fill=255, width=int(w), joint="curve")
for x, y, r in dots + specks:
    for px, py in wrap(x, y, r):
        d.ellipse([(px - r) * SS, (py - r) * SS, (px + r) * SS, (py + r) * SS], fill=255)

alpha = np.asarray(big.resize((SIZE, SIZE), Image.LANCZOS))
img = np.zeros((SIZE, SIZE, 4), np.uint8)
img[..., :3] = 255
img[..., 3] = alpha
Image.fromarray(img).save(OUT / "estrellas.png")


# ───────── ondas: regiones redondeadas, periódicas ─────────
yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32) / SIZE
field = np.zeros((SIZE, SIZE), np.float32)
for _ in range(7):
    m, n = rng.integers(1, 4), rng.integers(-3, 4)
    if m == 0 and n == 0:
        continue
    field += rng.uniform(0.5, 1.0) * np.cos(2 * np.pi * (m * xx + n * yy) + rng.uniform(0, 2 * np.pi))
field = gaussian_filter(field, 6, mode="wrap")
field = (field - field.mean()) / field.std()
gy, gx = np.gradient(field)
grad = np.sqrt(gx**2 + gy**2) + 1e-6
alpha = np.clip((field - 0.15) / (grad * 1.6) + 0.5, 0, 1)  # antialiased threshold
img = np.zeros((SIZE, SIZE, 4), np.uint8)
img[..., 3] = (alpha * 255).astype(np.uint8)
Image.fromarray(img).save(OUT / "ondas.png")


# ───────── grano: ruido gris medio, sin costura ─────────
G = 512
noise = rng.normal(0, 1, (G, G)).astype(np.float32)
noise = gaussian_filter(noise, 0.55, mode="wrap")
noise = noise / noise.std()
grey = np.clip(128 + noise * 30, 0, 255).astype(np.uint8)
Image.fromarray(np.dstack([grey, grey, grey])).save(OUT / "grano.png")

print("ok:", [p.name for p in sorted(OUT.glob("*.png"))])
