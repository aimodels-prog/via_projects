import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isProjectDeleted,
  markProjectDeleted,
  requireActiveProject,
} from "../src/lib/project-deletion.server";
test("deletion is persistent, recoverable and rejects unsafe paths", async () => {
  const previous = process.env.PROJECT_DATA_DIR;
  const root = await mkdtemp(join(tmpdir(), "via-delete-test-"));
  process.env.PROJECT_DATA_DIR = root;
  try {
    assert.equal(await isProjectDeleted("example-road"), false);
    await markProjectDeleted({ id: "test-id", slug: "example-road", name: "Example road" });
    assert.equal(await isProjectDeleted("example-road"), true);
    await assert.rejects(requireActiveProject("example-road"), /deleted/);
    const saved = JSON.parse(await readFile(join(root, "_deleted", "example-road.json"), "utf8"));
    assert.equal(saved.name, "Example road");
    assert.ok(saved.deletedAt);
    await assert.rejects(
      markProjectDeleted({ id: "test", slug: "../escape", name: "Unsafe" }),
      /Invalid/,
    );
    await assert.rejects(
      markProjectDeleted({ id: "test", slug: "example-road", name: "Overwrite" }),
      /EEXIST/,
    );
  } finally {
    if (previous === undefined) delete process.env.PROJECT_DATA_DIR;
    else process.env.PROJECT_DATA_DIR = previous;
  }
});
