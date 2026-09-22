import "@tanstack/react-start/server-only";
import { mkdir, access, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function target(slug: string) {
  if (!slugPattern.test(slug) || slug.length > 100) throw new Error("Invalid project URL.");
  return join(
    resolve(process.env["PROJECT_DATA_DIR"] || ".data/projects", "_deleted"),
    `${slug}.json`,
  );
}
export async function isProjectDeleted(slug: string) {
  const file = target(slug);
  try {
    await access(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
export async function requireActiveProject(slug: string) {
  if (await isProjectDeleted(slug))
    throw new Error(
      "This project was deleted. Its URL is reserved; restore it through server administration before reusing it.",
    );
}
/** Recoverable deletion marker; report history and uploads are never erased. */
export async function markProjectDeleted(project: { id: string; slug: string; name: string }) {
  const file = target(project.slug);
  await mkdir(resolve(file, ".."), { recursive: true, mode: 0o700 });
  await writeFile(file, JSON.stringify({ ...project, deletedAt: new Date().toISOString() }), {
    flag: "wx",
    mode: 0o600,
  });
}
