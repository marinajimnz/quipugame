"""Build the Quipu wordmark data: Chango glyph outlines as SVG paths + a row of dots following each stroke.

Usage: python scripts/build_wordmark.py path/to/Chango-Regular.ttf
Needs: fonttools, pillow, numpy, scipy, scikit-image. Chango is SIL OFL (Google Fonts).
Writes components/brand/wordmarkData.ts (do not edit by hand): the word, its dots and the first letter alone
(used by scripts/generate_icons.mjs).
"""
import sys
from pathlib import Path

import numpy as np
from fontTools.pens.basePen import BasePen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt
from skimage.morphology import skeletonize

TEXT = "QUIPU"
SCALE = 0.1  # font units -> viewBox units
PAD = 12  # room around the word for the extrusion layers
RASTER = 4  # raster pixels per viewBox unit, for finding the stroke centerlines
SPACING = 21  # distance between dots (viewBox units)
DOT_MAX, DOT_MIN = 5.2, 2.2  # dot radius limits

font = TTFont(sys.argv[1])
gs = font.getGlyphSet()
cmap = font.getBestCmap()
upm = font["head"].unitsPerEm
asc = font["hhea"].ascent
desc = font["hhea"].descent


class Flatten(BasePen):
    """Collects each contour as a polyline (curves are flattened)."""

    def __init__(self, gs):
        super().__init__(gs)
        self.contours, self.cur = [], []

    def _moveTo(self, p): self.cur = [p]
    def _lineTo(self, p): self.cur.append(p)

    def _curveToOne(self, a, b, c):
        p0 = self.cur[-1]
        for t in np.linspace(0, 1, 13)[1:]:
            u = 1 - t
            self.cur.append(tuple(u**3 * np.array(p0) + 3 * u * u * t * np.array(a) + 3 * u * t * t * np.array(b) + t**3 * np.array(c)))

    def _qCurveToOne(self, a, b):
        p0 = self.cur[-1]
        for t in np.linspace(0, 1, 9)[1:]:
            u = 1 - t
            self.cur.append(tuple(u * u * np.array(p0) + 2 * u * t * np.array(a) + t * t * np.array(b)))

    def _closePath(self):
        if self.cur: self.contours.append(self.cur)
        self.cur = []

    _endPath = _closePath


x = 0
path_pen = SVGPathPen(gs, ntos=lambda v: f"{v:.1f}".rstrip("0").rstrip("."))
flat = Flatten(gs)
for ch in TEXT:
    name = cmap[ord(ch)]
    # font units (y up) -> viewBox units (y down), shifted by pad and the running advance
    t = (SCALE, 0, 0, -SCALE, PAD + x * SCALE, PAD + asc * SCALE)
    gs[name].draw(TransformPen(path_pen, t))
    gs[name].draw(TransformPen(flat, t))
    x += gs[name].width

W = round(PAD * 2 + x * SCALE)
H = round(PAD * 2 + (asc - desc) * SCALE)

# even-odd raster of the word
mask = np.zeros((H * RASTER, W * RASTER), bool)
for c in flat.contours:
    im = Image.new("1", mask.shape[::-1], 0)
    ImageDraw.Draw(im).polygon([(px * RASTER, py * RASTER) for px, py in c], fill=1)
    mask ^= np.asarray(im, bool)

dist = distance_transform_edt(mask) / RASTER  # distance to the edge, in viewBox units
skel = skeletonize(mask)
ys, xs = np.nonzero(skel)
order = np.lexsort((ys, xs))  # sweep left to right: stable, even spacing
pts = []
for i in order:
    px, py = xs[i] / RASTER, ys[i] / RASTER
    r = min(DOT_MAX, dist[ys[i], xs[i]] * 0.55)
    if r < DOT_MIN:
        continue
    if all((px - qx) ** 2 + (py - qy) ** 2 >= SPACING**2 for qx, qy, _ in pts):
        pts.append((px, py, r))

# The first letter on its own, for the app icons (origin at its top-left corner)
q_name = cmap[ord(TEXT[0])]
bp = BoundsPen(gs)
gs[q_name].draw(bp)
qx0, qy0, qx1, qy1 = bp.bounds
q_pen = SVGPathPen(gs, ntos=lambda v: f"{v:.1f}".rstrip("0").rstrip("."))
gs[q_name].draw(TransformPen(q_pen, (SCALE, 0, 0, -SCALE, -qx0 * SCALE, qy1 * SCALE)))
Q_W, Q_H = round((qx1 - qx0) * SCALE, 1), round((qy1 - qy0) * SCALE, 1)

dots = ",".join(f"[{px:.1f},{py:.1f},{r:.1f}]" for px, py, r in pts)
out = Path(__file__).parent.parent / "components/brand/wordmarkData.ts"
out.write_text(
    "// Generado por scripts/build_wordmark.py desde Chango (SIL OFL). No editar a mano.\n"
    f"export const WORDMARK_W = {W};\nexport const WORDMARK_H = {H};\n"
    f"export const WORDMARK_PATH = '{path_pen.getCommands()}';\n"
    f"export const WORDMARK_Q = {{ d: '{q_pen.getCommands()}', w: {Q_W}, h: {Q_H} }};\n"
    f"// [cx, cy, r] de cada punto, siguiendo el trazo de cada letra.\n"
    f"export const WORDMARK_DOTS: [number, number, number][] = [{dots}];\n"
)
print(W, H, len(pts), "dots")
