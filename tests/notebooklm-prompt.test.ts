import test from "node:test";
import assert from "node:assert/strict";
import { DASHBOARD_CSV_TEMPLATE, NOTEBOOKLM_PROMPT } from "../src/lib/dashboard-csv";

test("NotebookLM prompt includes the exact CSV header and every field key once", () => {
  const lines = NOTEBOOKLM_PROMPT.split("\n");
  const template = DASHBOARD_CSV_TEMPLATE.split("\n");
  assert.ok(lines.includes(template[0]!));
  for (const row of template.filter((row) => row.startsWith("field,"))) {
    const key = row.split(",")[1]!;
    assert.equal(
      lines.flatMap((line) => line.split(",")).filter((cell) => cell === key).length,
      1,
      key,
    );
  }
});

test("app prompt stays compact while retaining source-mapping safeguards", () => {
  assert.ok(
    NOTEBOOKLM_PROMPT.length <= 1950,
    `Prompt too long: ${NOTEBOOKLM_PROMPT.length} characters`,
  );
  assert.ok(NOTEBOOKLM_PROMPT.includes("Omit if planned values unreadable"));
  assert.ok(NOTEBOOKLM_PROMPT.includes("paid_amount=paid, NOT anticipated"));
  assert.ok(NOTEBOOKLM_PROMPT.includes("Missing numbers blank"));
  assert.ok(NOTEBOOKLM_PROMPT.includes("Every row: 11 cells"));
  assert.ok(NOTEBOOKLM_PROMPT.includes("cumulative physical"));
  assert.ok(NOTEBOOKLM_PROMPT.includes("financial_progress=actual financial"));
  assert.ok(NOTEBOOKLM_PROMPT.includes("top-left,top-right,bottom-left,bottom-right"));
  assert.ok(NOTEBOOKLM_PROMPT.includes("CSV only;"));
  assert.ok(!NOTEBOOKLM_PROMPT.includes("activity,Activity name"));
});
