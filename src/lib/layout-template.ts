import type { ProjectSchematic } from "./project-schematic";
import type { ExtractedReport } from "./report.types";
export function applyLayoutTemplate(
  report: ExtractedReport,
  saved: { slug: string; schematic: ProjectSchematic },
) {
  if (saved.slug !== report.slug)
    throw new Error("Saved layout belongs to a different project URL.");
  const updates = new Map((report.layoutUpdates ?? []).map((u) => [u.id, u.status]));
  if (updates.size !== (report.layoutUpdates ?? []).length)
    throw new Error("Duplicate layout section ID.");
  const ids = saved.schematic.segments.map((s) => s.id);
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
    throw new Error("Saved layout has invalid section IDs.");
  for (const id of updates.keys())
    if (!ids.includes(id)) throw new Error(`Unknown layout section: ${id}`);
  if (ids.some((id) => !updates.has(id!)))
    throw new Error("Enter this month's status for every saved layout section.");
  return {
    ...report,
    useRaysutReferenceLayout: false,
    printLayoutMode: "schematic" as const,
    schematic: {
      ...saved.schematic,
      approved: false,
      segments: saved.schematic.segments.map((s) => ({ ...s, status: updates.get(s.id!)! })),
    },
  };
}
