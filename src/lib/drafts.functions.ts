import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAdmin } from "./admin-auth.server";
import { draftReportSchema } from "./report-draft";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
const root = () => resolve(process.env["PROJECT_DATA_DIR"] || ".data/projects", "_drafts");
const schema = z.object({
  report: draftReportSchema,
  csv: z.string().max(2_000_000),
  fileName: z.string().max(200),
});
export const saveReportDraft = createServerFn({ method: "POST" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    requireAdmin();
    const id = randomUUID();
    await mkdir(root(), { recursive: true, mode: 0o700 });
    await writeFile(
      join(root(), `${id}.json`),
      JSON.stringify({ ...data, id, savedAt: new Date().toISOString() }),
      { flag: "wx", mode: 0o600 },
    );
    return { id };
  });
export const listReportDrafts = createServerFn({ method: "GET" }).handler(async () => {
  requireAdmin();
  setResponseHeader("Cache-Control", "private, no-store");
  let files: string[];
  try {
    files = await readdir(root());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const items = await Promise.all(
    files
      .filter((f) => /^[a-f0-9-]+\.json$/.test(f))
      .map(async (file) => {
        const saved = JSON.parse(await readFile(join(root(), file), "utf8"));
        return {
          id: saved.id as string,
          name: saved.report.projectName as string,
          savedAt: saved.savedAt as string,
        };
      }),
  );
  return items.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
});
export const loadReportDraft = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    requireAdmin();
    setResponseHeader("Cache-Control", "private, no-store");
    return schema.parse(JSON.parse(await readFile(join(root(), `${data.id}.json`), "utf8")));
  });
