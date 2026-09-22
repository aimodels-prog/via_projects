import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixture } from "./fixture";
test("publishing preserves identity and immutable history; old months do not replace latest", async () => {
  process.env["PROJECT_DATA_DIR"] = await mkdtemp(join(tmpdir(), "via-store-test-"));
  process.env["DATABASE_URL"] = "";
  process.env["NODE_ENV"] = "test";
  const { saveRevision, listReportHistory, revisionReport } =
    await import("../src/lib/revision-store.server");
  const { getLocalProject, getLocalSecret } = await import("../src/lib/local-project-store");
  const { report } = fixture();
  const project = {
    id: "e9aeaa3d-256d-4caa-9d43-206530d08938",
    slug: report.slug,
    name: report.projectName,
    domain: `/${report.slug}`,
    region: report.region,
    status: "active",
    summary: null,
    brief: null,
    metric_1_label: null,
    metric_1_value: null,
    metric_2_label: null,
    metric_2_value: null,
  };
  const input = {
    project,
    report,
    passwordHash: "first",
    source: Buffer.from("source"),
    sourceFileName: "report.csv",
    replaceExisting: false,
  };
  await saveRevision(input);
  await assert.rejects(() => saveRevision(input), /already exists/);
  await saveRevision({
    ...input,
    project: { ...project, id: "b23ab173-93f2-4b5d-a441-ced173966e75" },
    report: { ...report, reportMonth: "June 2026" },
    replaceExisting: true,
    passwordHash: "second",
  });
  assert.equal((await getLocalProject(report.slug))?.id, project.id);
  assert.equal((await revisionReport(report.slug))?.reportMonth, "July 2026");
  assert.equal(await getLocalSecret(report.slug), "second");
  const history = await listReportHistory(report.slug);
  assert.equal(history.length, 2);
  assert.equal((await revisionReport(report.slug, history[1]!.revision))?.reportMonth, "June 2026");
  await assert.rejects(() => getLocalProject("../escape"), /Invalid project/);
});
