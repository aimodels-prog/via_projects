import { useState } from "react";
import { UploadField } from "./UploadField";
import { MAX_HEADER_LOGOS, headerLogoLayout, type HeaderLogo } from "@/lib/header-logos";

export function HeaderLogosEditor({
  logos,
  onChange,
}: {
  logos: HeaderLogo[];
  onChange: (logos: HeaderLogo[]) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const layout = headerLogoLayout(logos.length);
  const move = (index: number, direction: number) => {
    const next = [...logos];
    [next[index], next[index + direction]] = [next[index + direction]!, next[index]!];
    onChange(next);
  };
  return (
    <section className="mt-6 rounded-xl border bg-white p-4">
      <h3 className="font-semibold text-brand">Logos above the PDF report</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Add client, consultant, contractor or partner logos. They are saved with the project and
        reused next month. Up to 12 fit in centred rows on an A4 page. The report scales
        proportionally below them; its internal design stays unchanged.
      </p>
      <UploadField
        aria-label="Add report header logos"
        multiple
        accept="image/png,image/jpeg,image/webp"
        disabled={busy || logos.length >= MAX_HEADER_LOGOS}
        helpText="Select several PNG, JPG or WebP files · up to 2 MB each · 12 MB total. Transparent PNG works best."
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (!files.length) return;
          setError("");
          setBusy(true);
          try {
            if (logos.length + files.length > MAX_HEADER_LOGOS)
              throw new Error("Choose up to 12 logos in total so the report stays readable on A4.");
            const added: HeaderLogo[] = [];
            for (const file of files) {
              if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024)
                throw new Error(`${file.name}: use PNG, JPG or WebP under 2 MB.`);
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(new Error(`Cannot read ${file.name}`));
                reader.readAsDataURL(file);
              });
              await new Promise<void>((resolve, reject) => {
                const image = new Image();
                image.onload = () =>
                  image.naturalWidth * image.naturalHeight > 50_000_000
                    ? reject(new Error(`${file.name}: image is too large.`))
                    : resolve();
                image.onerror = () => reject(new Error(`${file.name}: unreadable image.`));
                image.src = dataUrl;
              });
              added.push({ name: file.name.slice(0, 200), dataUrl });
            }
            const next = [...logos, ...added];
            if (
              next.reduce((sum, logo) => sum + logo.dataUrl.split(",")[1]!.length * 0.75, 0) >
              12 * 1024 * 1024
            )
              throw new Error(
                "Header logos must be under 12 MB combined. Use smaller image files.",
              );
            onChange(next);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not upload logos.");
          } finally {
            setBusy(false);
          }
        }}
      />
      {busy && (
        <p role="status" className="text-sm">
          Checking logo files…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {logos.length > 0 && (
        <>
          <p className="mb-2 text-sm">Header preview · {logos.length} / 12 logos</p>
          <div
            aria-label="Report header logos preview"
            className="relative w-full border bg-white"
            style={{ aspectRatio: 595.32 / layout.height }}
          >
            {logos.map((logo, i) => {
              const box = layout.boxes[i]!;
              return (
                <img
                  key={i}
                  src={logo.dataUrl}
                  alt={`Header logo ${i + 1}: ${logo.name}`}
                  className="absolute object-contain"
                  style={{
                    left: `${(box.x / 595.32) * 100}%`,
                    top: `${(box.top / layout.height) * 100}%`,
                    width: `${(box.width / 595.32) * 100}%`,
                    height: `${(box.height / layout.height) * 100}%`,
                  }}
                />
              );
            })}
          </div>
          <ol className="mt-3 space-y-2">
            {logos.map((logo, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded border p-2 text-sm">
                <span className="min-w-0 flex-1 break-words">
                  {i + 1}. {logo.name}
                </span>
                <button
                  type="button"
                  className="rounded border px-2 py-1 disabled:opacity-30"
                  disabled={busy || i === 0}
                  aria-label={`Move logo ${i + 1} earlier`}
                  onClick={() => move(i, -1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1 disabled:opacity-30"
                  disabled={busy || i === logos.length - 1}
                  aria-label={`Move logo ${i + 1} later`}
                  onClick={() => move(i, 1)}
                >
                  →
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1"
                  disabled={busy}
                  aria-label={`Remove header logo ${i + 1}`}
                  onClick={() => onChange(logos.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">
            These logos are separate from the ministry logo inside the report. No cropping or
            stretching. Review the final PDF before downloading.
          </p>
        </>
      )}
    </section>
  );
}
