# Fixed Salalah A4 report

The reference is the supplied one-page `July - Salalah Road.pdf`. The app uses a
dedicated 595.32 × 841.92 point PDF master, not a screenshot of the web dashboard.
The master retains the source's static borders, colours, headings and table geometry.
Project-specific text and images were removed with actual PDF redaction, not covered
with white overlays. Native text, numbers, photographs and an uploaded or generated S-curve are inserted.

## Use

### One-time project layout setup

In Photos & layout, open the interactive route drawing, draw/import the geometry,
and approve it. **Save drawing once & download linked template** stores an immutable
layout in `PROJECT_DATA_DIR/_layouts` and downloads the six-column template containing
its ID, the project URL slug, and stable section IDs. Persist this directory on the VPS
alongside project reports. It is administrator-only and must be backed up.

Fill all `layout_section` statuses each month: complete, construction, existing or unknown.
Importing Excel/CSV loads the saved geometry, rejects mismatched projects, unknown IDs,
missing sections and duplicate IDs, and clears approval for review. Select **Use this
dashboard layout in the PDF too** to render the same geometry into the PDF map frame.
It does not infer geometry or section completion from overall progress.

The regenerated demo explicitly sets `layout,template,raysut-reference,,,` to select
the original fixed Raysut drawing. This is a demo-specific illustration, not automatically
updated roadwork geometry; it cannot receive section updates. Other projects must save
their own drawing. Logos, four photos and the separate PDF activity-status drawing still
need manual uploads. Reference-map PDF rendering uses the same route SVG; browser-only
overlays and typography may differ in the rasterized print view.

### Excel or CSV entry (no NotebookLM)

The two main download buttons provide filled SAMPLE data in Excel and CSV formats.
Replace all sample information before real reporting. Separate Blank Excel/CSV links
remain available (`pdf-report-template-blank.xlsx` and `pdf-report-template-blank.csv`).
Optional and unused rows remain blank rather than presenting invented applicable values.

The six-column template now accepts `.xlsx` directly using **Upload Excel file**.
The downloadable Excel file groups these columns into one worksheet with labelled sections: project setup,
monthly update, contract values, activities, S-curve schedule, scope quantities,
pavement layers, trade statuses, photo captions and project layout. Upload the whole
workbook; the importer ignores presentation rows and validates duplicate fields.
The internal section column is hidden for easier editing. Existing single-sheet
six-column workbooks and CSV files remain supported.
Each section starts with a visible title, its purpose, filling instructions and
an input-colour guide, followed by section-specific human-readable column labels.
Row 1 holds hidden import headers. Project and monthly sections include labelled subgroups.
Blue cells are inputs and status cells have dropdowns. Import skips presentation rows
and retains the same six-column data contract. Do not delete the hidden headers.
The older twelve-sheet workbook is not the import format. Excel imports are normalized
to CSV for stored evidence. Formula cells are rejected: paste their values first.
Monthly `schedule` rows automatically select the generated PDF S-curve and populate
the dashboard's cumulative/monthly graphs from the same figures. Enter every programme
month from the beginning; future planned values are required and future actuals stay blank.
Without schedule data, image mode remains available for PDF-only reports; an overall
percentage alone cannot generate a historical graph.

Additional sections: `scope` uses field=description, value=quantity, planned=unit;
`layer` uses field=code, value=description, planned=thickness in mm; `trade` uses
field=name, value=complete/active/behind/notstarted/unknown. The per-row instructions
explain these mappings. Logos, map, status drawing and photos remain manual uploads.

Download **PDF CSV template** under **Fill from a CSV template** on `/upload`, or use
`public/templates/pdf-report-template.csv`. Open it in Excel, fill it yourself and save as
CSV UTF-8. Import or paste it into the app; incomplete files can be saved as drafts.

The six columns are `section,field,value,planned,actual,instructions`. Fill `value` for
project/monthly/contract/photo-caption rows. For activities, type the activity name in `field`
and percentages in `planned`/`actual`; leave `value` blank. Keep other field labels unchanged.
There are 13 optional activity rows and four caption rows. Blank numbers remain missing.
Dates use YYYY-MM-DD. Format phone cells as Text before entry to preserve leading zeros.
The importer calculates report month, physical/financial differences and remaining days
(unless remaining days are explicitly supplied). It does not derive financial % from payment.

Upload all pictures manually: client logo, project map, S-curve, activity-status drawing and
four photographs. No image URLs or embedded images belong in this CSV. The PDF uses the chart
picture; interactive dashboard schedules remain a separate optional entry. Legacy 11-column
dashboard CSVs are still readable, but the app no longer presents an extraction prompt.

The editor opens in simple four-step mode: Project setup, Monthly update,
Photos & layout, PDF & client access. Back/Next preserve your entries; Save draft persists
them before leaving. Show all fields is available for experienced users. CSV import
and client-dashboard publishing are expandable optional sections. Source-PDF upload, OCR
instructions and raw CSV evidence viewers have been removed from the editor. File uploads use
visible dashed boxes, native Choose File buttons, format guidance and selected-filename feedback.
PDF download comes first
in the final step and does not require publishing a client dashboard.

Project setup contains reusable identity, contract, dates, contacts and planned resources.
Monthly update contains only current reporting values and activity progress. Choosing the
as-of date sets the month. Editing physical/financial progress calculates actual-minus-planned
differences; editing elapsed days calculates remaining days from the construction duration.
Manual corrections remain under More monthly details. Financial percentage is not inferred
from paid amount (the two can have different accounting bases).

Starting next month opens Monthly update directly and shows prior progress/payment values as
read-only reference. Current-month values and pictures remain blank until entered. Dashboard
scope, route schematic and monthly schedule are optional expandable sections for PDF-only work.

1. Open `/upload`, select **Start project manually — no CSV required**, or import CSV.
2. Enter project setup, parties, contract rows, dates, scope and baseline schedule.
   Incomplete setups can be saved as internal drafts. Empty numbers remain empty.
3. Enter monthly progress, finances, resources, photos and captions.
4. For this PDF upload the project map, activity-status drawing and separate client/ministry
   logo. Choose Original chart picture to upload the S-curve with its numeric table, excluding
   the yellow heading. Images retain their proportions without cropping or stretching.
   The dashboard VIA logo and its editable schematic are different assets.
5. In **Standard A4 PDF — Salalah master design**, optionally set title line breaks.
   Wording must still match the project name. Generate, review and download the PDF.
6. Load the saved draft and choose **Start next month from this project setup**.
   Static fields and schedule history are retained; monthly figures, photos, evidence and
   activity-status drawing and chart picture are cleared. Recheck schematic statuses and expected completion.

Editing any report field invalidates the current PDF download approval. Dashboard publication
keeps its separate authenticated preview/approval and immutable revision history.
PDF exports are downloaded files; they are not automatically published to client dashboards.

## Image framing

### Additional header logos

Under Photos & layout, use **Logos above the PDF report** to select multiple logos and
reorder/remove them. Up to 12 logos (2 MB each, 12 MB total) are supported on the single A4
page. Rows are automatically balanced and centred; images are contained, not cropped or
stretched. Their order is left-to-right, then top-to-bottom. Header logos are retained in
saved drafts and next-month setup, separately from the ministry logo inside the report.

With extra logos, the complete report is scaled down proportionally beneath the header.
Without extra logos, the original master geometry is unchanged. Review the generated PDF
for readability, especially with three rows; arbitrary numbers cannot fit legibly on A4.

- Construction photos default to filling their frames with proportional cropping, never stretching.
  Each photo has Fill frame / Show whole image and horizontal/vertical positioning controls.
  The original upload remains intact; dashboard lightbox still shows the original photograph.
- Framing is saved with drafts and applied to both outputs. PDF and dashboard panels have
  different aspect ratios, so check both final previews. Whole-image mode centres the image.
- Logos, S-curves and activity-status drawings retain their full image bounds.
- Maps default to filling their dedicated frame, without stretching or entering the heading
  or brief-description column. The PDF panel provides horizontal/vertical positioning and
  Show complete map mode. Review route endpoints and map legends before accepting a crop.
- PDF generation normalizes EXIF orientation before cropping. Low-resolution originals are
  flagged in the editor; fitting cannot recover missing detail.

## Exact-design constraints

- One A4 page, 13 activity rows, seven named contract rows, four photographs.
- At most 36 months in the compact chart table; long programmes need a separately approved design.
- Fixed R.O. currency headings and the reference's twelve-category road-work colour legend.
  A different currency or legend requires a template revision, not silent relabelling.
- Overlong text and unsupported characters block export. No automatic font shrinking or clipping.
- Missing activity cells stay blank like the source; other missing optional numbers are dashes,
  never fabricated zeroes. Approved contract total is not
  automatically labelled as original contract value; fill the seven source contract rows.
- Physical/financial/resource differences use actual minus planned. Conflicting supplied financial
  difference signs block export for review. Anticipated payment is never treated as paid amount.
- The printed S-curve can use the original picture without requiring schedule transcription.
  Alternatively generate it from verified monthly figures (not guaranteed visually identical).
  The interactive web dashboard still requires verified schedule numbers.

## Proof and verification

`deliverables/salalah-design-proof-SOURCE-CHART.pdf` uses the original July chart picture,
not illustrative schedule values. It supersedes the earlier DEMO-SCHEDULE proof. It is a
design proof, not an approved report. No claim of 100% whole-page identity is made before
content review and user sign-off.

Build-time tooling (not required on the VPS):

```powershell
python -m pip install pymupdf
python scripts/build_salalah_master.py "PATH_TO_REFERENCE.pdf" --proof-assets ".data/salalah-proof-assets"
npx tsx scripts/proof-salalah.ts
python scripts/check_salalah_design.py "PATH_TO_REFERENCE.pdf" "deliverables/salalah-design-proof-SOURCE-CHART.pdf"
```

The pixel comparison excludes variable content and is only a fixed-design regression check.
Unit and browser tests separately cover A4 size, field validation, overflow refusal, manual
drafts, authenticated PDF generation, download review and invalidation on edits.

## Deployment

Runtime is Node with `pdf-lib`, `@pdf-lib/fontkit`, Sharp and `templates/salalah/`.
No Python or headless Chrome is needed for PDF generation on the VPS. Docker already copies
`templates/`. The matching Verdana/Times New Roman/Calibri font files were obtained from the
local Windows installation because embedded source subsets lack characters for new projects.
Keep assets private. Verify font licensing for the target deployment and redistribution;
provide matching licensed fonts via `--fonts-dir` when preparing production assets.
