import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { NOTEBOOK_REPORT_PROMPT } from "../../src/lib/notebook-report-prompt";
import { PDF_REPORT_CSV_TEMPLATE } from "../../src/lib/pdf-report-csv";

test("NotebookLM guide copies exact reusable prompt and downloads genuinely blank template", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/upload");
  await page.locator('input[type="password"]').fill("test-admin-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Upload Excel / CSV", exact: true }).click();
  await page.getByRole("button", { name: "Copy NotebookLM prompt", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Prompt copied");
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe(
    NOTEBOOK_REPORT_PROMPT.replace(/\r\n/g, "\n"),
  );
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download blank CSV for NotebookLM", exact: true }).click();
  const download = await downloadEvent;
  expect((await readFile((await download.path())!, "utf8")).replace(/^\uFEFF/, "")).toBe(
    PDF_REPORT_CSV_TEMPLATE,
  );
  await page.getByRole("button", { name: "Read the prompt", exact: true }).click();
  await expect(page.getByLabel("NotebookLM extraction prompt")).toHaveValue(NOTEBOOK_REPORT_PROMPT);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, "writeText", {
      value: async () => {
        throw new Error("denied");
      },
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "Copy NotebookLM prompt", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Automatic copying is unavailable");
  await expect(page.getByLabel("NotebookLM extraction prompt")).toBeFocused();
});
