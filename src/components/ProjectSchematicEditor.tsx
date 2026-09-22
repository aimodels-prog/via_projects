import { UploadField } from "./UploadField";
import { useState } from "react";
import { schematicSchema, schematicSvg, type ProjectSchematic } from "@/lib/project-schematic";

export function ProjectSchematicEditor({
  value,
  onChange,
}: {
  value: ProjectSchematic;
  onChange: (value: ProjectSchematic) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState("");
  const patch = (next: Partial<ProjectSchematic>) =>
    onChange({ ...value, ...next, approved: false });
  const section = value.segments[selected];
  const setSection = (next: Partial<ProjectSchematic["segments"][number]>) =>
    patch({
      segments: value.segments.map((s, i) => (i === selected ? { ...s, ...next } : s)),
    });
  // Incomplete sections remain editable; preview only completed geometry.
  const preview = { ...value, segments: value.segments.filter((s) => s.points.length >= 2) };
  const ready = value.segments.length > 0 && schematicSchema.safeParse(value).success;
  return (
    <section className="mt-8 space-y-3 border p-4">
      <h3 className="font-bold">Project schematic editor</h3>
      <p className="text-sm">
        Set up routes once and reuse them in report revisions. Add a section, then click Draw points
        and click its alignment in order (at least two points). Create separate sections for
        different statuses or branches. This is not a geographic map.
      </p>
      <p className="text-xs">
        Overall progress never colours route length automatically. Only mark sections complete when
        location/chainage evidence supports it. Changes require approval again.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="border p-2"
          disabled={!ready}
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "project-schematic.json";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Download reusable layout
        </button>
        <div className="w-full min-w-0">
          Reuse saved layout
          <UploadField
            aria-label="Reuse saved layout"

            accept="application/json,.json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                if (file.size > 1_000_000) throw new Error("Layout file is too large.");
                const parsed = schematicSchema.parse(JSON.parse(await file.text()));
                onChange({ ...parsed, approved: false });
                setSelected(0);
                setDrawing(false);
                setError("");
              } catch {
                setError("Invalid layout file. Use a layout downloaded from this editor.");
              }
            }}
          />
        </div>
        <button
          type="button"
          className="border p-2"
          disabled={value.segments.length >= 50}
          onClick={() => {
            setSelected(value.segments.length);
            setDrawing(true);
            patch({
              segments: [
                ...value.segments,
                {
                  name: `Section ${value.segments.length + 1}`,
                  startLabel: "",
                  endLabel: "",
                  chainage: "",
                  status: "unknown",
                  points: [],
                },
              ],
            });
          }}
        >
          Add route section
        </button>
        {section && (
          <>
            <select
              aria-label="Selected route section"
              value={selected}
              onChange={(e) => {
                setSelected(Number(e.target.value));
                setDrawing(false);
              }}
            >
              {value.segments.map((s, i) => (
                <option key={i} value={i}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="border p-2"
              aria-pressed={drawing}
              onClick={() => setDrawing(!drawing)}
            >
              {drawing ? "Stop drawing" : "Draw points"}
            </button>
            <button
              type="button"
              className="border p-2"
              disabled={!section.points.length}
              onClick={() => setSection({ points: section.points.slice(0, -1) })}
            >
              Undo last point
            </button>
            <button
              type="button"
              className="border p-2"
              onClick={() => {
                patch({ segments: value.segments.filter((_, i) => i !== selected) });
                setSelected(0);
                setDrawing(false);
              }}
            >
              Remove section
            </button>
          </>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      <div
        className="relative aspect-[2/1] border bg-slate-50"
        aria-label="Schematic drawing canvas"
        onClick={(e) => {
          if (!drawing || !section || section.points.length >= 100) return;
          const box = e.currentTarget.getBoundingClientRect();
          const point = {
            x:
              Math.round(
                Math.max(0, Math.min(100, ((e.clientX - box.left) / box.width) * 100)) * 10,
              ) / 10,
            y:
              Math.round(
                Math.max(0, Math.min(100, ((e.clientY - box.top) / box.height) * 100)) * 10,
              ) / 10,
          };
          setSection({ points: [...section.points, point] });
        }}
      >
        <div
          className="absolute inset-0"
          dangerouslySetInnerHTML={{ __html: schematicSvg(preview) }}
        />
        <svg
          viewBox="0 0 800 400"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {section?.points.map((p, i) => (
            <circle key={i} cx={p.x * 8} cy={p.y * 4} r="5" fill="#f59e0b" />
          ))}
        </svg>
      </div>
      {section && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["name", "Section name"],
              ["startLabel", "Start location"],
              ["endLabel", "End location"],
              ["chainage", "Verified chainage / section limits"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-sm">
              {label}
              <input
                className="block w-full border p-2"
                value={section[key]}
                maxLength={120}
                onChange={(e) => setSection({ [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="text-sm">
            Section status
            <select
              className="block w-full border p-2"
              aria-label="Section status"
              value={section.status}
              onChange={(e) => setSection({ status: e.target.value as typeof section.status })}
            >
              <option value="unknown">Not reported</option>
              <option value="complete">Completed</option>
              <option value="construction">Under construction</option>
              <option value="existing">Existing road</option>
            </select>
          </label>
          <details className="sm:col-span-2">
            <summary>Edit route points (percent across/down canvas)</summary>
            {section.points.map((p, i) => (
              <div className="flex gap-2" key={i}>
                {(["x", "y"] as const).map((axis) => (
                  <label key={axis}>
                    Point {i + 1} {axis}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={p[axis]}
                      className="border p-1"
                      onChange={(e) =>
                        setSection({
                          points: section.points.map((v, j) =>
                            j === i ? { ...v, [axis]: Number(e.target.value) } : v,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            ))}
          </details>
        </div>
      )}
      <button
        type="button"
        className="border p-2"
        disabled={value.landmarks.length >= 50}
        onClick={() =>
          patch({
            landmarks: [...value.landmarks, { label: "New landmark", kind: "label", x: 50, y: 50 }],
          })
        }
      >
        Add label / bridge / junction
      </button>
      {value.landmarks.map((l, i) => (
        <div className="flex flex-wrap gap-2" key={i}>
          <input
            aria-label={`Landmark ${i + 1} label`}
            maxLength={120}
            className="border p-2"
            value={l.label}
            onChange={(e) =>
              patch({
                landmarks: value.landmarks.map((v, j) =>
                  j === i ? { ...v, label: e.target.value } : v,
                ),
              })
            }
          />
          <select
            aria-label={`Landmark ${i + 1} type`}
            value={l.kind}
            onChange={(e) =>
              patch({
                landmarks: value.landmarks.map((v, j) =>
                  j === i ? { ...v, kind: e.target.value as typeof l.kind } : v,
                ),
              })
            }
          >
            <option value="label">Label</option>
            <option value="bridge">Bridge</option>
            <option value="junction">Junction</option>
          </select>
          {(["x", "y"] as const).map((axis) => (
            <label key={axis}>
              {axis} %
              <input
                aria-label={`Landmark ${i + 1} ${axis}`}
                type="number"
                min={0}
                max={100}
                step={0.1}
                className="w-20 border p-2"
                value={l[axis]}
                onChange={(e) =>
                  patch({
                    landmarks: value.landmarks.map((v, j) =>
                      j === i ? { ...v, [axis]: Number(e.target.value) } : v,
                    ),
                  })
                }
              />
            </label>
          ))}
          <button
            type="button"
            onClick={() => patch({ landmarks: value.landmarks.filter((_, j) => j !== i) })}
          >
            Remove landmark
          </button>
        </div>
      ))}
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.approved}
          disabled={!ready}
          onChange={(e) => onChange({ ...value, approved: e.target.checked })}
        />
        I verified this schematic, labels and section statuses against the project source.
      </label>
    </section>
  );
}
