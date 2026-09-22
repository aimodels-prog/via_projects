# Fixed Raysut dashboard ingestion

Every newly generated dashboard loads Dashboard/Raysut dashboard.html directly and binds
report data into its DOM. The original stylesheet and panel structure are preserved;
the reference file itself is not modified. CSV source format never changes the panels.
Existing published snapshots remain unchanged until the report is reviewed and published again.

## Workflow

1. Select only the project's PDF in NotebookLM. Copy the latest prompt from /upload.
2. Paste or upload the CSV. The prompt and blank CSV guide list the same Raysut fields.
3. Review the dashboard fields against the PDF. Optional missing values are editable and
   display Not reported; never fill them with sample values or invented zeroes.
4. Upload the logo and four photographs. A project drawing is an optional reference.
   Draw the schematic in the editor: add sections, click their route points, name endpoints,
   set verified section statuses and place bridge/junction markers. Approve the layout.
   Download the reusable layout JSON for future reports; importing it requires fresh approval.
   For this specific Raysut route, the explicit original-layout checkbox retains the source
   map exactly. Confirm its drawn section statuses still apply: the overall percentage alone
   cannot determine where roadwork is complete. Other projects must use their own approved layout.
5. The S-curve is always a numerical interactive graph, never an uploaded image. Use
   readable schedule rows or fill the monthly table manually from a verified programme.
   Missing, skipped or inconsistent monthly data blocks publication. Never estimate graph values.
6. Check completeness warnings and the full-screen preview. Set project URL/password,
   confirm source review and publish.

The prompt is tested against an internal 1,950-character budget, not a claimed universal
NotebookLM limit. AI extraction always needs human verification. Required numerical
values must be corrected from the source before import/publication, not guessed.

## Fixed panels

The five KPIs remain Physical progress, Schedule variance, Time elapsed, Financial
progress and This month. Other panels remain S-curve, Major activities, Project layout,
Construction progress photos, Timeline, Resources, Scope & build-up, Trade status and
Project parties. Header/footer and panel geometry follow Raysut; overflowing content
can be scrolled without changing panel sizes.

Financial progress uses actual financial percentage and actually paid amount.
Anticipated payment is not paid amount. This-month progress is not cumulative progress.
No dates, statuses, party assignments or quantities are inferred from missing data.

## CSV records

Keep the exact eleven-column header. Unused cells stay empty.

- field: key and value; see the downloadable CSV guide.
- activity: key=name, planned and actual percentages.
- schedule: key=Mon-YY, monthly planned/actual, planned_cumulative/actual_cumulative.
- scope: key=label, value=quantity, unit; up to five reported items.
- layer: key=code, value=name, thickness in mm.
- trade: key=name, status=complete/active/behind/notstarted/unknown.
- photo: key=photo_1 through photo_4, value=caption, description=optional subtitle.

Photo order is top-left, top-right, bottom-left, bottom-right. Repeated captions are valid.
Optional tables may be omitted rather than populated with invented rows.

Older summary CSVs still accept contract, contact and detail records and supplementary
financial information. These are retained for review, not substituted for dashboard panels.
Unassigned contacts need verified role assignments in the review form to populate Project
parties. The activity-status drawing is an optional review attachment, not a Trade status replacement.
Schematic geometry is independent of overall progress; never colour route length using the
physical progress percentage. Section statuses must be verified for the stated location/chainage.

## Existing publications

Published dashboards are immutable snapshots. These changes apply to newly generated
previews and approved revisions; they do not silently overwrite existing client dashboards.

## Verification and deployment

Ship templates/ and Dashboard/via/ (included by Dockerfile).
Run npm test, npm run typecheck, npm run build and npx playwright test.
Browser tests compare all panel bounds with the original reference, test chart toggles,
uploaded photographs, missing-data review and publication using isolated test storage.
