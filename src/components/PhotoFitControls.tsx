import type { ExtractedReport } from "@/lib/report.types";
import { photoPresentation } from "@/lib/image-fit";

type Photo = ExtractedReport["photos"][number];
export function PhotoFitControls({
  photo,
  index,
  onChange,
}: {
  photo: Photo;
  index: number;
  onChange: (photo: Photo) => void;
}) {
  const { fit, x, y } = photoPresentation(photo);
  return (
    <fieldset className="mt-3 space-y-2 rounded border border-border bg-slate-50 p-3 text-xs">
      <legend className="px-1 font-semibold">Photo {index + 1} framing</legend>
      <label className="block">
        Image fit
        <select
          aria-label={`Image fit for photo ${index + 1}`}
          className="mt-1 block w-full rounded border p-2"
          value={fit}
          onChange={(e) => onChange({ ...photo, fit: e.target.value as Photo["fit"] })}
        >
          <option value="cover">Fill frame — crops edges, no stretching</option>
          <option value="contain">Show whole image — no cropping</option>
        </select>
      </label>
      {fit === "cover" && (
        <>
          <p className="text-muted-foreground">
            Move the subject into view. Changes apply to the PDF and dashboard; their frame shapes
            differ, so review both previews.
          </p>
          {(
            [
              ["Horizontal", "focalX", x],
              ["Vertical", "focalY", y],
            ] as const
          ).map(([label, key, v]) => (
            <label key={key} className="flex items-center gap-2">
              <span className="w-16">{label}</span>
              <input
                className="min-w-0 flex-1 accent-blue-700"
                type="range"
                min="0"
                max="100"
                step="1"
                aria-label={`${label} position for photo ${index + 1}`}
                value={v}
                onChange={(e) => onChange({ ...photo, [key]: Number(e.target.value) })}
              />
              <output className="w-8 text-right tabular-nums">{v}%</output>
            </label>
          ))}
          <button
            type="button"
            className="rounded border bg-white px-2 py-1"
            onClick={() => onChange({ ...photo, focalX: 50, focalY: 50 })}
          >
            Centre photo
          </button>
        </>
      )}
      {photo.width > 0 && (photo.width < 800 || photo.height < 600) && (
        <p className="text-amber-800">
          Low-resolution original: framing cannot restore missing detail. Upload a sharper original
          if available.
        </p>
      )}
    </fieldset>
  );
}
