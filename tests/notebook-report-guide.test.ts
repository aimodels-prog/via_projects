import test from "node:test";
import assert from "node:assert/strict";
import { NOTEBOOK_REPORT_PROMPT } from "../src/lib/notebook-report-prompt";
test("NotebookLM report prompt matches the reviewable blank six-column template", () => {
  assert.ok(
    NOTEBOOK_REPORT_PROMPT.includes('"section","field","value","planned","actual","instructions"'),
  );
  assert.ok(
    NOTEBOOK_REPORT_PROMPT.includes("Keep template fields and partially completed table rows"),
  );
  assert.ok(NOTEBOOK_REPORT_PROMPT.includes("Keep missing thickness blank"));
  assert.ok(!NOTEBOOK_REPORT_PROMPT.includes("MPR-02"));
  assert.ok(NOTEBOOK_REPORT_PROMPT.length < 5000);
});
