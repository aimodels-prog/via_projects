"""Compare fixed design pixels, excluding variable content. Not a full-report accuracy check."""
import argparse,json
from pathlib import Path
import pymupdf as pdf
p=argparse.ArgumentParser();p.add_argument("source");p.add_argument("generated");args=p.parse_args()
g=json.loads(Path("templates/salalah/geometry.json").read_text())
source=pdf.open(args.source);generated=pdf.open(args.generated)
assert len(generated)==1 and abs(generated[0].rect.width-source[0].rect.width)<.01
scale=1.4
a=source[0].get_pixmap(matrix=pdf.Matrix(scale,scale),alpha=False)
b=generated[0].get_pixmap(matrix=pdf.Matrix(scale,scale),alpha=False)
assert (a.width,a.height,a.n)==(b.width,b.height,b.n)
boxes=list(g["boxes"].values())+[[10,638,196,777]]
for group in g["cells"].values():
    for c in group:boxes.append([c["x"]-1,c["baseline"]-c["size"]*1.2,c["right"]+1,c["baseline"]+c["size"]*.4])
mask=bytearray(a.width*a.height)
for x0,y0,x1,y1 in boxes:
    for y in range(max(0,int(y0*scale)-2),min(a.height,int(y1*scale)+3)):
        left=max(0,int(x0*scale)-2);right=min(a.width,int(x1*scale)+3)
        mask[y*a.width+left:y*a.width+right]=b"\1"*(right-left)
raw_a=a.samples;raw_b=b.samples;checked=changed=0
for i,skip in enumerate(mask):
    if skip:continue
    checked+=1
    if any(raw_a[i*3+j]!=raw_b[i*3+j] for j in range(3)):changed+=1
result={"fixed_design_pixels_checked":checked,"different_pixels":changed,"matching_percent":round(100*(1-changed/checked),4),"note":"Variable content, charts and text fit require separate review. This is NOT a claim of an identical whole report."}
Path("deliverables/salalah-design-comparison.json").write_text(json.dumps(result,indent=2))
print(json.dumps(result))
