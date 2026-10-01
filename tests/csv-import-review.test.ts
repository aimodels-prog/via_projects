import test from "node:test";
import assert from "node:assert/strict";
import {
  reviewCsvRows,
  serializeReviewRows,
  missingReviewCells,
} from "../src/lib/csv-import-review";

test("incomplete CSV review preserves blank cells, source notes and raw conflicting values", () => {
  const text =
    'section,field,value,planned,actual,instructions\nlayer,BBC,Base course,,,"Missing thickness, confirm"\nschedule,Jul-26,,1.99,,CONFLICT';
  const rows = reviewCsvRows(text)!;
  assert.deepEqual(missingReviewCells(rows[1]!), [3]);
  assert.deepEqual(reviewCsvRows(serializeReviewRows(rows)), rows);
  assert.equal(rows[1]![3], "");
  assert.equal(rows[2]![3], "1.99");
});
test("review refuses misaligned CSV and ignores unused table slots", () => {
  assert.equal(
    reviewCsvRows("section,field,value,planned,actual,instructions\nlayer,BBC,,70,,,extra"),
    null,
  );
  assert.deepEqual(missingReviewCells(["layer", "", "", "", "", "instructions"]), []);
  assert.deepEqual(missingReviewCells(["trade", "Utilities", "", "", "", ""]), [2]);
});
