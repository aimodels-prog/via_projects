import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { fixture } from "./fixture";
import { applyLayoutTemplate } from "../src/lib/layout-template";
import { layoutImageForPdf } from "../src/lib/layout-image.server";
import { parsePdfReportCsv, PDF_REPORT_CSV_TEMPLATE } from "../src/lib/pdf-report-csv";

test("saved layout applies complete status rows without changing geometry or trusting approval", async () => {
  const r = fixture().report;
  const schematic = {
    ...r.schematic,
    segments: r.schematic.segments.map((s) => ({ ...s, id: "ROAD-01" })),
  };
  r.layoutUpdates = [{ id: "ROAD-01", status: "complete" }];
  const result = applyLayoutTemplate(r, { slug: r.slug, schematic });
  assert.equal(result.schematic.approved, false);
  assert.equal(result.schematic.segments[0]!.status, "complete");
  assert.deepEqual(result.schematic.segments[0]!.points, schematic.segments[0]!.points);
  await assert.rejects(layoutImageForPdf(result), /approve/);
  result.schematic.approved = true;
  const data = await layoutImageForPdf(result);
  assert.equal((await sharp(Buffer.from(data.split(",")[1]!, "base64")).metadata()).width, 1600);
  assert.throws(
    () => applyLayoutTemplate(r, { slug: "other-project", schematic }),
    /different project/,
  );
  assert.throws(
    () => applyLayoutTemplate({ ...r, layoutUpdates: [] }, { slug: r.slug, schematic }),
    /every saved/,
  );
  assert.throws(
    () =>
      applyLayoutTemplate(
        { ...r, layoutUpdates: [{ id: "UNKNOWN", status: "complete" }] },
        { slug: r.slug, schematic },
      ),
    /Unknown layout/,
  );
});
test("template accepts fixed demo layout but cannot silently apply unrelated section updates", () => {
  const csv = PDF_REPORT_CSV_TEMPLATE + "\r\nlayout,template,raysut-reference,,,";
  const report = parsePdfReportCsv(csv);
  assert.equal(report.useRaysutReferenceLayout, true);
  assert.equal(report.printLayoutMode, "schematic");
  assert.throws(
    () => parsePdfReportCsv(csv + "\r\nlayout_section,ROAD-01,complete,,,"),
    /saved project layout/,
  );
});
