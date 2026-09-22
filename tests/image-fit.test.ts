import test from "node:test";
import assert from "node:assert/strict";
import { coverCrop, photoPresentation, PDF_PHOTO_RATIOS } from "../src/lib/image-fit";
import { readFile } from "node:fs/promises";
import { reportSchema } from "../src/lib/report.types";
import { fixture } from "./fixture";
import { draftReportSchema } from "../src/lib/report-draft";

test("image crops stay inside portrait, landscape, square and panorama sources", () => {
  for (const [width, height] of [
    [4000, 3000],
    [800, 2400],
    [900, 900],
    [8000, 600],
  ]) {
    for (const ratio of [4 / 3, 1.2, 16 / 9]) {
      for (const position of [0, 50, 100]) {
        const c = coverCrop(width!, height!, ratio, position, position);
        assert.ok(c.left >= 0 && c.top >= 0);
        assert.ok(c.left + c.width <= width! && c.top + c.height <= height!);
        assert.ok(Math.abs(c.width / c.height - ratio) < 0.01);
      }
    }
  }
  assert.deepEqual(coverCrop(1600, 900, 4 / 3, 100, 50), {
    left: 400,
    top: 0,
    width: 1200,
    height: 900,
  });
  assert.deepEqual(coverCrop(900, 1600, 4 / 3, 50, 100), {
    left: 0,
    top: 925,
    width: 900,
    height: 675,
  });
});

test("editor preview ratios match the four actual PDF photo panels", async () => {
  const geometry = JSON.parse(await readFile("templates/salalah/geometry.json", "utf8"));
  PDF_PHOTO_RATIOS.forEach((ratio, i) => {
    const [x0, y0, x1, y1] = geometry.boxes[`photo${i + 1}`];
    assert.ok(Math.abs(ratio - (x1 - x0) / (y1 - y0)) < 0.000001);
  });
});

test("whole-image mode is centered and saved framing survives draft validation", () => {
  assert.deepEqual(photoPresentation({ fit: "contain", focalX: 10, focalY: 90 }), {
    fit: "contain",
    x: 50,
    y: 50,
  });
  const r = fixture().report;
  r.photos[0] = { ...r.photos[0]!, fit: "cover", focalX: 15, focalY: 80 };
  const restored = draftReportSchema.parse(JSON.parse(JSON.stringify(r)));
  assert.deepEqual(photoPresentation(restored.photos[0]!), { fit: "cover", x: 15, y: 80 });
  r.photos[0]!.focalX = 101;
  assert.equal(reportSchema.safeParse(r).success, false);
});
