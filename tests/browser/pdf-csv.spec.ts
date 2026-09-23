import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDF_REPORT_CSV_TEMPLATE } from "../../src/lib/pdf-report-csv";

test("upload the populated Excel template and automatically select generated PDF chart", async ({
  page,
}) => {
  await page.goto("/upload");
  await page.locator('input[type="password"]').fill("test-admin-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Upload Excel / CSV", exact: true }).click();
  await page
    .getByLabel("Upload Excel file", { exact: true })
    .setInputFiles("public/templates/pdf-report-template.xlsx");
  await expect(
    page.getByRole("button", { name: "3. Photos & layout", exact: true }),
  ).toHaveAttribute("aria-current", "step");
  await page.getByRole("button", { name: "4. Review & publish", exact: true }).click();
  await expect(page.getByLabel("PDF S-curve source", { exact: true })).toHaveValue("generated");
});

test("download the PDF data-entry CSV, import an incomplete report and save for manual images", async ({
  page,
}) => {
  await page.goto("/upload");
  await page.locator('input[type="password"]').fill("test-admin-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("Source document and extraction evidence", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Upload Excel / CSV", exact: true }).click();
  const event = page.waitForEvent("download");
  await page.getByRole("link", { name: "Blank CSV template", exact: true }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe("pdf-report-template-blank.csv");
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv.replace(/^\uFEFF/, "")).toBe(PDF_REPORT_CSV_TEMPLATE);
  const completed = csv
    .replace("project,Project name,,,", "project,Project name,CSV Road Project,,")
    .replace("monthly,Data as of,,,", "monthly,Data as of,2026-07-31,,")
    .replace("photo,photo_1,,,", "photo,photo_1,Bridge foundation,,");
  await page
    .locator('input[accept="text/csv,.csv"]')
    .setInputFiles({ name: "report.csv", mimeType: "text/csv", buffer: Buffer.from(completed) });
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue("CSV Road Project");
  await expect(
    page.getByRole("button", { name: "3. Photos & layout", exact: true }),
  ).toHaveAttribute("aria-current", "step");
  await expect(page.getByLabel("Project name", { exact: true })).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Report steps" })).toBeFocused();
  await page.getByRole("button", { name: "2. Monthly figures", exact: true }).click();
  await expect(page.getByLabel("Data as of", { exact: true })).toHaveValue("2026-07-31");
  await expect(
    page.getByLabel("Cumulative actual physical progress %", { exact: true }),
  ).toHaveValue("");
  await page.getByRole("button", { name: "Continue: Photos & layout", exact: true }).click();
  await expect(page.getByLabel("Project map image", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Upload photograph 1", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Activity-status drawing", { exact: true })).toBeVisible();
  await expect(
    page.getByText("View source PDF / imported CSV (optional)", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Project map image", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/visible-uploads.png" });
  await expect(page.getByLabel("Caption for photo 1", { exact: true })).toHaveValue(
    "Bridge foundation",
  );
  // Four photographs plus the dashboard logo and project map are all still manual uploads.
  await expect(page.getByText("Awaiting original", { exact: true })).toHaveCount(6);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Draft saved");
});

test("pasted CSV also opens Photos & layout; invalid CSV stays at import", async ({ page }) => {
  await page.goto("/upload");
  await page.locator('input[type="password"]').fill("test-admin-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Upload Excel / CSV", exact: true }).click();
  const input = page.getByPlaceholder("Paste your completed PDF report CSV here");
  await page.getByText("Or paste CSV text instead", { exact: true }).click();
  await input.fill("incorrect header");
  await page.getByRole("button", { name: "Validate pasted CSV", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("CSV header");
  await expect(page.getByRole("navigation", { name: "Report steps" })).toHaveCount(0);
  await input.fill(PDF_REPORT_CSV_TEMPLATE);
  await page.getByRole("button", { name: "Validate pasted CSV", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "3. Photos & layout", exact: true }),
  ).toHaveAttribute("aria-current", "step");
  await expect(page.getByLabel("Upload photograph 1", { exact: true })).toBeVisible();
});
