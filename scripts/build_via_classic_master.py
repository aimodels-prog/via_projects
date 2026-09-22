"""Derive VIA Classic from the sanitized master, retaining its A4 geometry.

Design-time only: python scripts/build_via_classic_master.py
The original master, uploaded pictures and report data are never modified.
"""
from pathlib import Path
import re
import pymupdf as pdf

ROOT = Path(__file__).resolve().parents[1] / "templates" / "salalah"
doc = pdf.open(ROOT / "master.pdf")
page = doc[0]
original_text = page.get_text()
BLUE = (5 / 255, 83 / 255, 143 / 255)
PALE = (232 / 255, 242 / 255, 250 / 255)
RULE = (0.76, 0.82, 0.87)
INK = (15 / 255, 27 / 255, 38 / 255)

def color_text(c):
    return " ".join(f"{v:.6f}" for v in c)

def recolor(match):
    values = tuple(float(match[i]) for i in range(1, 4))
    op = match[4]
    # Borders become restrained blue-grey; semantic legend swatches stay intact.
    if op == "RG":
        return color_text(RULE) + " RG"
    rounded = tuple(round(v * 255) for v in values)
    replacement = {
        (33, 89, 104): BLUE,       # outer frame
        (128, 0, 0): (1, 1, 1),   # dark red gutters
        (155, 187, 89): PALE,     # project heading
        (247, 150, 70): PALE,     # report date heading
        (217, 217, 217): PALE,
        (230, 224, 236): PALE,
        (242, 220, 219): PALE,
        (218, 150, 148): PALE,
        (250, 191, 143): PALE,
        (219, 238, 244): PALE,
        (221, 217, 195): PALE,
        (0, 32, 96): BLUE,
        (0, 0, 0): INK,
    }.get(rounded, values)
    return color_text(replacement) + " rg"

# This controlled master uses RGB paint operators and tiled table fills.
# Work only on page streams, never embedded images or font programs.
for xref in page.get_contents():
    stream = doc.xref_stream(xref).decode("latin1")
    stream = re.sub(r"/Pattern\s+cs\s+/Pattern\d+\s+scn", "1 1 1 rg", stream)
    stream = re.sub(r"([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+(rg|RG)\b", recolor, stream)
    doc.update_stream(xref, stream.encode("latin1"))

# The engineer's empty footer panel shares a yellow fill with a semantic legend
# swatch. Restyle only this panel; do not globally replace that legend colour.
page.draw_rect(pdf.Rect(203.64, 780.96, 298.92, 810.48),
               color=RULE, fill=PALE, width=0.75, overlay=True)

# Section bands keep the source's exact heading baselines and font sizes.
bands = [
    (10, 86, 198, 104), (203, 86, 584, 104),
    (10, 242, 198, 261), (203, 294, 356, 313),
    (361, 293, 584, 313), (203, 422, 356, 441),
    (201, 545.7, 452, 564), (455, 545, 584, 561),
    (10, 604, 198, 621),
]
spans = [s for b in page.get_text("dict")["blocks"] if "lines" in b
         for line in b["lines"] for s in line["spans"]]
headings = []
for coords in bands:
    rect = pdf.Rect(coords)
    for s in spans:
        if rect.contains(pdf.Point(s["origin"])):
            headings.append(s)
            page.add_redact_annot(s["bbox"], fill=False)
page.apply_redactions(images=0, graphics=0)
for coords in bands:
    page.draw_rect(pdf.Rect(coords), color=None, fill=BLUE, overlay=True)

font_files = {"Calibri-Bold": "F3", "TimesNewRomanPS-BoldMT": "F2",
              "Calibri": "F5", "TimesNewRomanPSMT": "F4", "Verdana-Bold": "F1"}
for s in headings:
    font = font_files.get(s["font"]) or (s["font"].split("+")[-1] if s["font"].startswith("CIDFont+F") else None)
    if not font:
        raise RuntimeError(f"Unmapped heading font: {s['font']}")
    page.insert_text(s["origin"], s["text"], fontsize=s["size"],
                     fontname="Classic" + font, fontfile=str(ROOT / (font + ".ttf")),
                     color=(1, 1, 1), overlay=True)

# No labels may disappear while styling the master (extraction order can change).
assert sorted(original_text.split()) == sorted(page.get_text().split()), "Static text changed"
doc.set_metadata({"title": "VIA Classic — sanitized report master", "producer": "VIA report design"})
doc.save(ROOT / "master-classic.pdf", garbage=4, deflate=True)
print("Built VIA Classic master; all static labels and original page dimensions retained.")
