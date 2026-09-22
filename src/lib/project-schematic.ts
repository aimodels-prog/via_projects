import { z } from "zod";

const point = z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) });
export const schematicSchema = z
  .object({
    approved: z.boolean().default(false),
    segments: z
      .array(
        z.object({
          id: z
            .string()
            .regex(/^[a-zA-Z0-9_-]{1,80}$/)
            .optional(),
          name: z.string().min(1).max(120),
          startLabel: z.string().max(120).default(""),
          endLabel: z.string().max(120).default(""),
          chainage: z.string().max(120).default(""),
          status: z.enum(["unknown", "complete", "construction", "existing"]),
          points: z
            .array(point)
            .min(2)
            .max(100)
            .refine(
              (points) => points.some((p) => p.x !== points[0]?.x || p.y !== points[0]?.y),
              "A route needs two distinct points.",
            ),
        }),
      )
      .max(50)
      .default([]),
    landmarks: z
      .array(
        z.object({
          label: z.string().min(1).max(120),
          kind: z.enum(["label", "bridge", "junction"]),
          x: z.number().min(0).max(100),
          y: z.number().min(0).max(100),
        }),
      )
      .max(50)
      .default([]),
  })
  .default({ approved: false, segments: [], landmarks: [] });
export type ProjectSchematic = z.infer<typeof schematicSchema>;
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
export const sectionColors = {
  unknown: "#8795a3",
  complete: "#005a9c",
  construction: "#e32420",
  existing: "#172532",
};

/** Only validated geometry and escaped labels are emitted; never accepts imported SVG. */
export function schematicSvg(input: ProjectSchematic): string {
  const parsed = schematicSchema.safeParse(input);
  if (!parsed.success)
    return "<p>Complete each route with at least two valid points to preview.</p>";
  const data = parsed.data;
  const label = (x: number, y: number, text: string) =>
    `<text x="${x * 8}" y="${y * 4 - 9}" text-anchor="${x > 80 ? "end" : x < 20 ? "start" : "middle"}" font-size="11" fill="#172532">${esc(text)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" role="img" aria-label="Project schematic — not to scale" style="width:100%;height:100%;font-family:Arial,sans-serif"><rect width="800" height="400" fill="#f0f5f9"/>
  ${data.segments.map((s) => `<g><title>${esc([s.name, s.chainage, s.status].filter(Boolean).join(" · "))}</title><polyline points="${s.points.map((p) => `${p.x * 8},${p.y * 4}`).join(" ")}" fill="none" stroke="${sectionColors[s.status]}" stroke-width="4" ${s.status === "construction" || s.status === "unknown" ? 'stroke-dasharray="7 5"' : ""}/>${[s.points[0]!, s.points.at(-1)!].map((p) => `<circle cx="${p.x * 8}" cy="${p.y * 4}" r="4" fill="#172532"/>`).join("")}${label(s.points[0]!.x, s.points[0]!.y, s.startLabel)}${label(s.points.at(-1)!.x, s.points.at(-1)!.y, s.endLabel)}</g>`).join("")}
  ${data.landmarks.map((l) => `<g><title>${esc(l.kind)}</title>${l.kind === "bridge" ? `<rect x="${l.x * 8 - 7}" y="${l.y * 4 - 4}" width="14" height="8" fill="white" stroke="#172532"/>` : l.kind === "junction" ? `<circle cx="${l.x * 8}" cy="${l.y * 4}" r="6" fill="white" stroke="#005a9c" stroke-width="2"/>` : ""}${label(l.x, l.y, l.label)}</g>`).join("")}
  <rect x="8" y="8" width="157" height="82" rx="4" fill="white" stroke="#d8e1e8"/>
  ${(
    [
      ["complete", "Completed"],
      ["construction", "Under construction"],
      ["existing", "Existing road"],
      ["unknown", "Not reported"],
    ] as const
  )
    .map(
      ([key, text], i) =>
        `<line x1="16" x2="34" y1="${23 + i * 18}" y2="${23 + i * 18}" stroke="${sectionColors[key]}" stroke-width="3"/><text x="40" y="${27 + i * 18}" font-size="10">${text}</text>`,
    )
    .join("")}
  <text x="790" y="390" text-anchor="end" font-size="10" fill="#687a8b">SCHEMATIC · NOT TO SCALE</text></svg>`;
}
