import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { missingReviewCells, serializeReviewRows } from "@/lib/csv-import-review";

export function CsvImportReview({
  initialRows,
  initialError,
  onContinue,
  onSave,
  onClose,
}: {
  initialRows: string[][];
  initialError: string;
  onContinue: (text: string) => void;
  onSave: (text: string) => Promise<void>;
  onClose: () => void;
}) {
  const [rows, setRows] = useState(initialRows);
  const [message, setMessage] = useState(initialError);
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(
    Boolean(initialError) || !initialRows.slice(1).some((row) => missingReviewCells(row).length),
  );
  const missing = rows.slice(1).filter((row) => missingReviewCells(row).length).length;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="csv-review-dialog">
        <DialogTitle>Review imported data</DialogTitle>
        <DialogDescription>
          Missing values stay blank. Fill them from an approved source, or save an unfinished draft
          and return later. Optional details may stay blank; incomplete table rows and invalid
          figures must be resolved before continuing.
        </DialogDescription>
        {message && (
          <p role="alert" className="csv-review-message">
            {message}
          </p>
        )}
        <div className="csv-review-toolbar">
          <strong>{missing} rows have missing information</strong>
          <label>
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />{" "}
            Show all populated rows
          </label>
        </div>
        <div className="csv-review-scroll">
          {rows.slice(1).map((row, offset) => {
            const index = offset + 1;
            const absent = missingReviewCells(row);
            if (!row[1] && !row[2] && !row[3] && !row[4]) return null;
            if (!showAll && !absent.length) return null;
            const labels =
              row[0] === "layer"
                ? ["Layer code", "Description", "Thickness (mm)", "Actual (leave blank)"]
                : row[0] === "scope"
                  ? ["Description", "Quantity", "Unit", "Actual (leave blank)"]
                  : [
                      "Field / name",
                      "Value",
                      "Planned (monthly % for schedule)",
                      "Actual (monthly % for schedule)",
                    ];
            return (
              <section key={index} className="csv-review-row">
                <h3>
                  CSV row {index + 1} · {row[0]} · {row[1] || "Missing name"}
                </h3>
                <div className="csv-review-cells">
                  {[1, 2, 3, 4].map((col) => (
                    <label key={col}>
                      {labels[col - 1]}
                      <input
                        aria-label={`CSV row ${index + 1} ${labels[col - 1]}`}
                        value={row[col]}
                        readOnly={
                          col === 1 && ["project", "monthly", "contract", "photo"].includes(row[0]!)
                        }
                        className={absent.includes(col) ? "csv-review-missing" : ""}
                        onChange={(e) => {
                          setRows((current) =>
                            current.map((r, i) =>
                              i === index ? r.map((v, c) => (c === col ? e.target.value : v)) : r,
                            ),
                          );
                          setMessage("");
                        }}
                      />
                    </label>
                  ))}
                </div>
                <p>{row[5]}</p>
              </section>
            );
          })}
        </div>
        <div className="csv-review-actions">
          <button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(serializeReviewRows(rows));
                setMessage(
                  "Draft saved. Your blank cells and manual edits are preserved. Nothing was published.",
                );
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Could not save draft.");
              } finally {
                setSaving(false);
              }
            }}
          >
            Save unfinished draft
          </button>
          <button
            disabled={saving}
            onClick={() => {
              try {
                onContinue(serializeReviewRows(rows));
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Check the entered values.");
                setShowAll(true);
              }
            }}
          >
            Check and continue
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
