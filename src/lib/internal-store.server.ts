import "@tanstack/react-start/server-only";
import { mkdir, readFile, readdir, writeFile, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { database, usesPostgres } from "./postgres.server";
import type { InternalReport, InternalSnapshot } from "./internal.types";

const root = () => resolve(process.env["PROJECT_DATA_DIR"] || ".data/projects", "_internal");
function assertLocal() {
  if (process.env["NODE_ENV"] === "production")
    throw new Error("Internal reporting requires PostgreSQL in production.");
}
type SnapshotRow = {
  id: string;
  as_of: string | Date;
  file_name: string;
  source_sha: string;
  state: "draft" | "approved";
  created_at: string | Date;
  created_by: string;
  approved_at: string | Date | null;
  approved_by: string | null;
  payload: InternalReport;
};
function fromRow(row: SnapshotRow): InternalSnapshot {
  return {
    id: row["id"],
    asOf:
      row["as_of"] instanceof Date
        ? row["as_of"].toISOString().slice(0, 10)
        : String(row["as_of"]).slice(0, 10),
    fileName: row["file_name"],
    sha256: row["source_sha"],
    state: row["state"],
    createdAt: new Date(row["created_at"]).toISOString(),
    createdBy: row["created_by"],
    approvedAt: row["approved_at"] ? new Date(row["approved_at"]).toISOString() : null,
    approvedBy: row["approved_by"],
    report: row["payload"],
  };
}
const columns =
  "id,as_of::text,file_name,source_sha,state,created_at,created_by,approved_at,approved_by,payload";
export async function listInternalSnapshots() {
  if (usesPostgres()) {
    const { rows } = await database().query(
      `SELECT id,as_of::text,file_name,state,created_at,approved_at FROM hub_internal_snapshots ORDER BY as_of DESC,created_at DESC LIMIT 200`,
    );
    return rows.map((r) => ({
      id: String(r["id"]),
      asOf: String(r["as_of"]),
      fileName: String(r["file_name"]),
      state: r["state"] as "draft" | "approved",
      createdAt: new Date(r["created_at"]).toISOString(),
    }));
  }
  assertLocal();
  await mkdir(root(), { recursive: true, mode: 0o700 });
  const files = (await readdir(root())).filter((f) => /^[a-f0-9-]{36}\.json$/.test(f));
  const records = await Promise.all(
    files.map(async (f) => JSON.parse(await readFile(join(root(), f), "utf8")) as InternalSnapshot),
  );
  return records
    .sort((a, b) => b.asOf.localeCompare(a.asOf) || b.createdAt.localeCompare(a.createdAt))
    .map(({ id, asOf, fileName, state, createdAt }) => ({ id, asOf, fileName, state, createdAt }));
}
export async function readInternalSnapshot(id: string): Promise<InternalSnapshot> {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid snapshot ID.");
  if (usesPostgres()) {
    const { rows } = await database().query(
      `SELECT ${columns} FROM hub_internal_snapshots WHERE id=$1`,
      [id],
    );
    if (!rows[0]) throw new Error("Internal snapshot not found.");
    return fromRow(rows[0]);
  }
  assertLocal();
  return JSON.parse(await readFile(join(root(), `${id}.json`), "utf8")) as InternalSnapshot;
}
export async function saveInternalDraft(
  report: InternalReport,
  fileName: string,
  bytes: Buffer,
  actor: string,
) {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (usesPostgres()) {
    const db = await database().connect();
    try {
      await db.query("BEGIN");
      const id = randomUUID();
      const result = await db.query(
        `INSERT INTO hub_internal_snapshots (id,as_of,file_name,source_sha,source_file,payload,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (as_of,source_sha) DO NOTHING RETURNING id`,
        [id, report.asOf, fileName, sha256, bytes, report, actor],
      );
      if (result.rowCount)
        await db.query(
          "INSERT INTO hub_internal_audit(snapshot_id,actor,action) VALUES ($1,$2,'import')",
          [id, actor],
        );
      const selected = await db.query(
        `SELECT ${columns} FROM hub_internal_snapshots WHERE as_of=$1 AND source_sha=$2`,
        [report.asOf, sha256],
      );
      await db.query("COMMIT");
      return fromRow(selected.rows[0]);
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    } finally {
      db.release();
    }
  }
  assertLocal();
  const hex = createHash("sha256")
    .update(report.asOf + sha256)
    .digest("hex")
    .slice(0, 32);
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
  const snapshot: InternalSnapshot = {
    id,
    asOf: report.asOf,
    fileName,
    sha256,
    state: "draft",
    createdAt: new Date().toISOString(),
    createdBy: actor,
    approvedAt: null,
    approvedBy: null,
    report,
  };
  await mkdir(root(), { recursive: true, mode: 0o700 });
  try {
    await writeFile(join(root(), `${id}.json`), JSON.stringify(snapshot), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    return readInternalSnapshot(id);
  }
  return snapshot;
}
export async function approveInternalSnapshot(id: string, actor: string, sha256: string) {
  if (usesPostgres()) {
    const db = await database().connect();
    try {
      await db.query("BEGIN");
      const result = await db.query(
        `UPDATE hub_internal_snapshots SET state='approved',approved_at=now(),approved_by=$2 WHERE id=$1 AND source_sha=$3 AND state='draft' RETURNING id`,
        [id, actor, sha256],
      );
      if (result.rowCount)
        await db.query(
          "INSERT INTO hub_internal_audit(snapshot_id,actor,action) VALUES ($1,$2,'approve_reviewed_snapshot')",
          [id, actor],
        );
      const selected = await db.query(
        `SELECT ${columns} FROM hub_internal_snapshots WHERE id=$1 AND source_sha=$2`,
        [id, sha256],
      );
      if (!selected.rows[0]) throw new Error("Snapshot changed or was not found. Review it again.");
      await db.query("COMMIT");
      return fromRow(selected.rows[0]);
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    } finally {
      db.release();
    }
  }
  assertLocal();
  const snapshot = await readInternalSnapshot(id);
  if (snapshot.sha256 !== sha256) throw new Error("Snapshot changed. Review it again.");
  if (snapshot.state === "approved") return snapshot;
  snapshot.state = "approved";
  snapshot.approvedAt = new Date().toISOString();
  snapshot.approvedBy = actor;
  const temp = join(root(), `${id}.${randomUUID()}.tmp`);
  await writeFile(temp, JSON.stringify(snapshot), { mode: 0o600 });
  await rename(temp, join(root(), `${id}.json`));
  return snapshot;
}
