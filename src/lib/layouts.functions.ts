import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { requireAdmin } from "./admin-auth.server";
import { schematicSchema } from "./project-schematic";
const schema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(100),
  schematic: schematicSchema,
});
const root = () => resolve(process.env["PROJECT_DATA_DIR"] || ".data/projects", "_layouts");
export const saveProjectLayout = createServerFn({ method: "POST" })
  .validator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    requireAdmin();
    if (!data.schematic.approved || !data.schematic.segments.length)
      throw new Error("Review and approve the drawing before saving its layout template.");
    const schematic = {
      ...data.schematic,
      segments: data.schematic.segments.map((s) => ({
        ...s,
        id: s.id ?? `section-${randomUUID()}`,
      })),
    };
    if (new Set(schematic.segments.map((s) => s.id)).size !== schematic.segments.length)
      throw new Error("Duplicate layout section IDs.");
    const id = randomUUID();
    await mkdir(root(), { recursive: true, mode: 0o700 });
    await writeFile(join(root(), `${id}.json`), JSON.stringify({ ...data, schematic }), {
      flag: "wx",
      mode: 0o600,
    });
    return { id, schematic };
  });
export const loadProjectLayout = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    requireAdmin();
    setResponseHeader("Cache-Control", "private, no-store");
    try {
      return schema.parse(JSON.parse(await readFile(join(root(), `${data.id}.json`), "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new Error("Saved layout not found. Save the drawing once on this server first.");
      throw error;
    }
  });
