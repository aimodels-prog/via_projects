import "@tanstack/react-start/server-only";
import { readFile, readdir, mkdir, writeFile, rename } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { randomUUID } from "node:crypto";
import type { ProjectRow } from "./projects.functions";
import { reportSchema, type ExtractedReport } from "./report.types";
import { monthKey } from "./report-dates";
import { database, usesPostgres } from "./postgres.server";
import { requireActiveProject } from "./project-deletion.server";
const root = resolve(process.env["PROJECT_DATA_DIR"] || join(process.cwd(), ".data", "projects"));
function directory(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100)
    throw new Error("Invalid project URL.");
  return join(root, slug);
}
async function json<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
type Bundle = {
  project: ProjectRow;
  report: ExtractedReport;
  passwordHash: string;
  source: string;
  sourceFileName: string;
  approvedAt: string;
  revision: string;
};
async function current(slug: string): Promise<Bundle | null> {
  const dir = directory(slug);
  if (usesPostgres()) {
    const result = await database().query(
      "SELECT r.file_name FROM hub_reports r JOIN hub_projects p ON p.id=r.project_id WHERE p.slug=$1 ORDER BY r.period DESC, r.approved_at DESC LIMIT 1",
      [slug],
    );
    const file = result.rows[0]?.file_name;
    return file ? json<Bundle>(join(dir, basename(file))) : null;
  }
  const pointer = await json<{ file: string }>(join(dir, "current.json"));
  return pointer ? json<Bundle>(join(dir, basename(pointer.file))) : null;
}
export async function saveRevision(input: {
  project: ProjectRow;
  report: ExtractedReport;
  passwordHash: string;
  source: Buffer;
  sourceFileName: string;
  replaceExisting: boolean;
}) {
  if (process.env["NODE_ENV"] === "production" && !usesPostgres())
    throw new Error(
      "Production publishing requires DATABASE_URL. Local fallback is development-only.",
    );
  const dir = directory(input.project.slug);
  await requireActiveProject(input.project.slug);
  const { getLocalProject } = await import("./local-project-store");
  const existing = await getLocalProject(input.project.slug);
  if (existing && !input.replaceExisting)
    throw new Error("This project URL already exists. Confirm update-existing before publishing.");
  const project = { ...input.project, id: existing?.id ?? input.project.id };
  const revision = randomUUID(),
    approvedAt = new Date().toISOString();
  const period = monthKey(input.report.reportMonth);
  if (!period) throw new Error("Invalid report month.");
  const file = `${period}-${revision}.json`;
  const bundle: Bundle = {
    project,
    report: input.report,
    passwordHash: input.passwordHash,
    source: input.source.toString("base64"),
    sourceFileName: input.sourceFileName,
    approvedAt,
    revision,
  };
  await mkdir(dir, { recursive: true, mode: 0o700 });
  if (usesPostgres()) {
    const client = await database().connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [project.slug]);
      const check = await client.query("SELECT id FROM hub_projects WHERE slug=$1", [project.slug]);
      if (check.rowCount && !input.replaceExisting)
        throw new Error("This project URL already exists.");
      project.id = check.rows[0]?.id ?? project.id;
      await writeFile(join(dir, file), JSON.stringify(bundle), { flag: "wx", mode: 0o600 });
      await client.query(
        "INSERT INTO hub_projects(id,slug,payload,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(slug) DO UPDATE SET password_hash=EXCLUDED.password_hash",
        [project.id, project.slug, project, input.passwordHash],
      );
      await client.query(
        "INSERT INTO hub_reports(id,project_id,period,file_name,approved_at) VALUES($1,$2,$3,$4,$5)",
        [revision, project.id, period, file, approvedAt],
      );
      const latest = await client.query(
        "SELECT id FROM hub_reports WHERE project_id=$1 ORDER BY period DESC, approved_at DESC LIMIT 1",
        [project.id],
      );
      if (latest.rows[0]?.id === revision)
        await client.query("UPDATE hub_projects SET payload=$2 WHERE id=$1", [project.id, project]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } else {
    await writeFile(join(dir, file), JSON.stringify(bundle), { flag: "wx", mode: 0o600 });
    const previous = await current(project.slug);
    const latestFile =
      previous && monthKey(previous.report.reportMonth)! > period
        ? `${monthKey(previous.report.reportMonth)}-${previous.revision}.json`
        : file;
    const temp = join(dir, `current-${revision}.tmp`);
    await writeFile(temp, JSON.stringify({ file: latestFile, passwordHash: input.passwordHash }), {
      mode: 0o600,
    });
    await rename(temp, join(dir, "current.json"));
  }
}
export async function revisionProject(slug: string): Promise<ProjectRow | null> {
  directory(slug);
  if (usesPostgres()) {
    const result = await database().query("SELECT payload FROM hub_projects WHERE slug=$1", [slug]);
    return result.rows[0]?.payload ?? null;
  }
  return (await current(slug))?.project ?? null;
}
export async function postgresProjects(): Promise<ProjectRow[]> {
  const result = await database().query(
    "SELECT payload FROM hub_projects ORDER BY payload->>'name'",
  );
  return result.rows.map((row) => row.payload);
}
export async function revisionSecret(slug: string): Promise<string | null> {
  directory(slug);
  if (usesPostgres()) {
    const result = await database().query("SELECT password_hash FROM hub_projects WHERE slug=$1", [
      slug,
    ]);
    return result.rows[0]?.password_hash ?? null;
  }
  return (
    (await json<{ passwordHash: string }>(join(directory(slug), "current.json")))?.passwordHash ??
    null
  );
}
export async function listReportHistory(slug: string) {
  const dir = directory(slug);
  if (usesPostgres()) {
    const result = await database().query(
      'SELECT r.id AS revision, r.period, r.approved_at::text AS "approvedAt" FROM hub_reports r JOIN hub_projects p ON p.id=r.project_id WHERE p.slug=$1 ORDER BY r.period DESC,r.approved_at DESC',
      [slug],
    );
    return result.rows as Array<{ revision: string; period: string; approvedAt: string }>;
  }
  let files: string[];
  try {
    files = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const reports = await Promise.all(
    files
      .filter((f) => /^\d{4}-\d{2}-[a-f0-9-]+\.json$/.test(f))
      .map((f) => json<Bundle>(join(dir, f))),
  );
  return reports
    .filter((r): r is Bundle => Boolean(r))
    .map((r) => ({
      revision: r.revision,
      period: monthKey(r.report.reportMonth)!,
      approvedAt: r.approvedAt,
    }))
    .sort((a, b) => b.period.localeCompare(a.period) || b.approvedAt.localeCompare(a.approvedAt));
}
export async function revisionReport(
  slug: string,
  revision?: string,
): Promise<ExtractedReport | null> {
  if (revision) {
    const history = await listReportHistory(slug),
      entry = history.find((r) => r.revision === revision);
    if (!entry) return null;
    const bundle = await json<Bundle>(
      join(directory(slug), `${entry.period}-${entry.revision}.json`),
    );
    return bundle ? reportSchema.parse(bundle.report) : null;
  }
  const bundle = await current(slug);
  return bundle ? reportSchema.parse(bundle.report) : null;
}
