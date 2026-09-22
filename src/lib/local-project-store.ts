import "@tanstack/react-start/server-only";
import { readFile, readdir, mkdir, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { ProjectRow } from "@/lib/projects.functions";
import type { ExtractedReport } from "@/lib/report.types";
import { reportSchema } from "./report.types";
import { usesPostgres } from "./postgres.server";
import { isProjectDeleted, requireActiveProject } from "./project-deletion.server";
import {
  revisionProject,
  revisionReport,
  revisionSecret,
  postgresProjects,
} from "./revision-store.server";

const root = process.env["PROJECT_DATA_DIR"] || join(process.cwd(), ".data", "projects");
function checkSlug(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100)
    throw new Error("Invalid project URL.");
}

export async function getLocalProject(slug: string) {
  checkSlug(slug);
  if (await isProjectDeleted(slug)) return null;
  const saved = await revisionProject(slug);
  if (usesPostgres()) return saved;
  try {
    const { _reportFile, ...metadata } = JSON.parse(
      await readFile(join(root, slug, "metadata.json"), "utf8"),
    ) as ProjectRow & { _reportFile: string | null };
    let file: string | null = null;
    try {
      file = JSON.parse(await readFile(join(root, slug, "current.json"), "utf8")).file;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if ((_reportFile ?? null) === file) return { ...saved, ...metadata };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (saved) return saved;
  try {
    return JSON.parse(await readFile(join(root, slug, "project.json"), "utf8")) as ProjectRow;
  } catch {
    return null;
  }
}

export async function listLocalProjects() {
  if (usesPostgres()) return postgresProjects();
  try {
    const slugs = await readdir(root);
    return (
      await Promise.all(
        slugs.filter((slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)).map(getLocalProject),
      )
    ).filter((project): project is ProjectRow => Boolean(project));
  } catch {
    return [];
  }
}

export async function saveProjectMetadata(project: ProjectRow, creating: boolean) {
  checkSlug(project.slug);
  await requireActiveProject(project.slug);
  if (process.env["NODE_ENV"] === "production")
    throw new Error("Production project management requires PostgreSQL.");
  const current = await getLocalProject(project.slug);
  if (creating && current) throw new Error("This project URL already exists.");
  if (!creating && (!current || current.id !== project.id))
    throw new Error("Project not found. Published URLs cannot be renamed.");
  const directory = join(root, project.slug);
  await mkdir(directory, { recursive: true });
  const temp = join(directory, `metadata-${randomUUID()}.tmp`);
  let file: string | null = null;
  try {
    file = JSON.parse(await readFile(join(directory, "current.json"), "utf8")).file;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await writeFile(temp, JSON.stringify({ ...current, ...project, _reportFile: file }), {
    mode: 0o600,
  });
  await rename(temp, join(directory, "metadata.json"));
}

export async function getLocalSecret(slug: string) {
  checkSlug(slug);
  const saved = await revisionSecret(slug);
  if (saved || usesPostgres()) return saved;
  try {
    return await readFile(join(root, slug, "secret.txt"), "utf8");
  } catch {
    return null;
  }
}

export async function getLocalReport(slug: string) {
  checkSlug(slug);
  const saved = await revisionReport(slug);
  if (saved || usesPostgres()) return saved;
  try {
    const report = JSON.parse(await readFile(join(root, slug, "report.json"), "utf8")) as Omit<
      ExtractedReport,
      "photos"
    > & {
      layoutFilename?: string;
      logoFilename?: string;
      photos: Array<{
        caption: string;
        sub?: string;
        filename: string;
        source?: "pdf" | "original";
        width?: number;
        height?: number;
      }>;
    };
    const photos = await Promise.all(
      report.photos.map(async (photo) => ({
        ...photo,
        dataUrl: `data:image/${photo.filename.endsWith(".png") ? "png" : photo.filename.endsWith(".webp") ? "webp" : "jpeg"};base64,${(await readFile(join(root, slug, photo.filename))).toString("base64")}`,
      })),
    );
    const layoutImage = report.layoutFilename
      ? `data:image/${report.layoutFilename.endsWith(".png") ? "png" : report.layoutFilename.endsWith(".webp") ? "webp" : "jpeg"};base64,${(await readFile(join(root, slug, report.layoutFilename))).toString("base64")}`
      : (report as unknown as ExtractedReport).layoutImage;
    const logoImage = report.logoFilename
      ? `data:image/${report.logoFilename.endsWith(".png") ? "png" : report.logoFilename.endsWith(".webp") ? "webp" : "jpeg"};base64,${(await readFile(join(root, slug, report.logoFilename))).toString("base64")}`
      : ((report as unknown as ExtractedReport).logoImage ?? "");
    return reportSchema.parse({ ...report, logoImage, layoutImage, photos });
  } catch {
    return null;
  }
}
