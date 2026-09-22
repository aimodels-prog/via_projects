"""One-time design preparation. Requires pymupdf; never used by the deployed app.
Removes project content, not just covers it, from the supplied reference PDF.
"""
import argparse
import json
from pathlib import Path
import pymupdf as pdf

parser = argparse.ArgumentParser()
parser.add_argument("source")
parser.add_argument("--fonts-dir", default="C:/Windows/Fonts", help="Licensed full fonts for new project names; PDF subsets omit unused characters.")
parser.add_argument("--proof-assets", help="Optional private directory for original report image crops used only in visual proof.")
args = parser.parse_args()
out = Path(__file__).resolve().parents[1] / "templates" / "salalah"
out.mkdir(parents=True, exist_ok=True)
doc = pdf.open(args.source)
page = doc[0]
spans = [s for b in page.get_text("dict")["blocks"] if "lines" in b for l in b["lines"] for s in l["spans"]]
for font in page.get_fonts():
    full = {"F1":"verdanab.ttf","F2":"timesbd.ttf","F3":"calibrib.ttf","F4":"times.ttf","F5":"calibri.ttf"}.get(font[4])
    path = Path(args.fonts_dir) / full if full else None
    if full and not path.exists():
        raise RuntimeError(f"A licensed full font is required: {path}. Source PDF subsets cannot render arbitrary project names.")
    (out / (font[4] + ".ttf")).write_bytes(path.read_bytes() if path else doc.extract_font(font[0])[3])

# Every rectangle uses PDF points measured from the top-left of the reference.
boxes = {
    "clientLogo": [5.28,30,47.16,77.04], "client": [47.4,32,208,55.8],
    "department": [47.4,55.8,208,73], "title": [218,30,426,76],
    "date": [438,52,583,73], "brief": [501.9,125.15,584,289],
    "map": [203.28,104.88,499.44,291.72],
    "chart": [9.84,471.48,198.36,602.64],
    "chartTitle": [14,455,194,469],
    "photo1": [363.84,321.72,471.84,402.72],
    "photo2": [475.8,315,581.28,402.12],
    "photo3": [362.28,423.6,472.56,509.16],
    "photo4": [474.48,424.2,581.28,510.72],
    "caption1": [363,407,473,420], "caption2": [475,407,583,420],
    "caption3": [363,514,473,527], "caption4": [475,514,583,527],
    "consultant": [12,782,194,809], "engineer": [205,782,300,809],
    "contractor": [306,782,447,809],
}

# Numeric cells: retain exact source font, colour and baseline; center new values in the cell.
groups = {
    "contract": (lambda s: 124 < s["bbox"][1] < 235 and 130 < s["bbox"][0] < 199, 130,196),
    "dates": (lambda s: 263 < s["bbox"][1] < 449 and 145 < s["bbox"][0] < 199, 146,196),
    "physical": (lambda s: 333 < s["bbox"][1] < 414 and 325 < s["bbox"][0] < 355, 322,355),
    "financial": (lambda s: 462 < s["bbox"][1] < 528 and 290 < s["bbox"][0] < 356, 291,356),
    "machinery": (lambda s: 579 < s["bbox"][1] < 627 and s["bbox"][0] > 545, 536,581),
    "manpower": (lambda s: 654 < s["bbox"][1] < 704 and s["bbox"][0] > 545, 536,581),
}
cells = {}
for i in range(1,5):
    key=f"caption{i}"
    rect=pdf.Rect(boxes[key])
    s=next(s for s in spans if rect.contains(pdf.Rect(s["bbox"])))
    cells[key]=[dict(x=rect.x0,right=rect.x1,baseline=s["origin"][1],size=s["size"],font=s["font"].split("+")[-1],color=s["color"])]
for key,(select,left,right) in groups.items():
    cells[key] = []
    for s in sorted(filter(select,spans),key=lambda s:s["bbox"][1]):
        cells[key].append(dict(x=left,right=right,baseline=s["origin"][1],size=s["size"],font=s["font"].split("+")[-1],color=s["color"]))
        page.add_redact_annot(pdf.Rect(s["bbox"]), fill=False)

activities = [s for s in spans if s["bbox"][0] < 100 and 639 < s["bbox"][1] < 776]
rows = [s["origin"][1] for s in sorted(activities,key=lambda s:s["bbox"][1])]
for s in spans:
    if s["bbox"][0] < 197 and 639 < s["bbox"][1] < 776:
        page.add_redact_annot(pdf.Rect(s["bbox"]),fill=False)
for rect in boxes.values():
    page.add_redact_annot(pdf.Rect(rect),fill=False)
page.apply_redactions(images=2,graphics=0,text=0)
# Remove the route drawing itself (including vector labels), but retain the adjacent legend.
status = [201,565,450,756]
page.add_redact_annot(pdf.Rect(status),fill=(1,1,1))
page.add_redact_annot(pdf.Rect(201,756,372,777),fill=(1,1,1))
page.apply_redactions(images=2,graphics=1,text=0)
boxes["status"] = [201,565,450,777]
if args.proof_assets:
    source_page=pdf.open(args.source)[0]
    asset_dir=Path(args.proof_assets)
    asset_dir.mkdir(parents=True,exist_ok=True)
    for key in ["clientLogo","map","status","chart","photo1","photo2","photo3","photo4"]:
        source_page.get_pixmap(matrix=pdf.Matrix(3,3),clip=pdf.Rect(boxes[key])).save(asset_dir/(key+".png"))
doc.set_metadata({})
# Fresh document, garbage collection: no old project values/images hidden behind overlays.
clean=pdf.open()
clean.insert_pdf(doc)
clean.save(out / "master.pdf",garbage=4,deflate=True)
(out / "geometry.json").write_text(json.dumps(dict(width=page.rect.width,height=page.rect.height,boxes=boxes,cells=cells,activities=rows),indent=2),encoding="utf-8")
print(json.dumps({"cells":{k:len(v) for k,v in cells.items()},"activities":len(rows),"output":str(out)}))
