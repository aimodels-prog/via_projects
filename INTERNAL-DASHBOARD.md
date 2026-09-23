# Internal company reporting

This workspace is separate from client reports. No internal workbook data is written to a public project or client PDF.

## Access

Only a signed-in **main VIA Portal administrator** with Projects access can enter `/internal`. Being a Projects administrator alone is insufficient. Each financial read, import, approval and export rechecks the role server-side. Missing role information and unavailable Portal authorization fail closed.

The Portal adapter must return `portalAdmin: isPortalAdmin(email)` from its access endpoint. This uses the Portal's existing administrator configuration; the Projects app does not maintain another administrator password or financial email list. Public navigation has no internal-workspace link.

## Monthly workflow

1. Open Projects from the VIA Portal, then choose **Internal dashboard**.
2. Upload the supervision and pending-invoicing `.xlsx` workbook and explicitly choose its reporting date.
3. Review project mappings, source warnings, invoice rows, teams and differences from the previous approved snapshot.
4. Correct errors in Excel and re-upload when necessary. Acknowledge the review before approving.
5. Approved snapshots appear in the overview and can be exported. Earlier snapshots remain available. Re-uploading an identical file for the same date does not duplicate it.

Nothing is automatically published from the sample workbook. Staff names and financial exports are confidential.

## Financial interpretation

- Detailed IPC rows are the invoicing source; saved Dashboard totals are comparisons, not an additional amount to add. Amendments such as IPC 06A remain separate.
- Monetary arithmetic uses integer millionths, stored as decimal strings and displayed to three OMR decimals. Missing values stay unknown; totals of known values may be partial.
- Invoice periods after the selected reporting month, or without a period, are excluded from dated totals. The reporting cutoff is monthly, not an exact-day invoice ledger.
- International records with unconfirmed currency are excluded from OMR financial totals.
- Retention is preserved exactly as source text and marked **unconfirmed**. It is not added to VIA receivables until finance confirms ownership and calculation basis.
- Invoice period charts are **not cash-flow charts**. The workbook lacks reliable payment dates and due dates, so the app does not claim overdue aging, profit or recognized revenue.
- Monthly contract inputs are displayed separately. They are not assumed to equal unbilled revenue or unpaid invoices; proration/tax basis needs confirmation.
- Active staffing counts are dated assignments, not deduplicated employees. Omanization uses classified active assignments only.
- Excel formulas are not executed and external workbook links are never opened. Saved results and source-cell references are preserved with warnings where applicable.
- Additional ledger notes are available in Review & sources. The importer supports this supervision-workbook structure, not arbitrary spreadsheets.

## Storage and deployment

Production requires PostgreSQL. Apply `database/002-internal-dashboard.sql` after migration 001; the Contabo Compose migration service now runs both. Dedicated snapshot and audit tables hold drafts, approvals, actor/time records, original workbook bytes and normalized data. Ordinary read APIs never return original workbook bytes.

Deploy the updated `scripts/portal-integration/projects-sso.ts` adapter to the Portal before enabling the new Projects release. Back up existing databases and app versions first; do not reset a database or change unrelated VPS applications. These local changes do not themselves deploy the Portal adapter or run production migrations.

Local development may use private filesystem storage. The explicit `PROJECT_INTERNAL_DEV_ACCESS=true` switch only works outside production, alongside authenticated local administrator access. Never enable it as a production access mechanism.

## Verification

`npm test` covers data normalization, missing values, duplicate IPCs, column alignment, conflicting balances, unknown sheets, file bounds and decimal arithmetic.

Run the browser access/import/approval/export checks with `E2E_SSO=1` and an unused `E2E_PORT`:

```powershell
$env:E2E_SSO='1'
$env:E2E_PORT='8250'
npx playwright test tests/browser/internal-dashboard.spec.ts
```

The browser test uses synthetic data and a local mock Portal, not company financial records or live Portal accounts. Production PostgreSQL and Portal integration still need deployment verification.
