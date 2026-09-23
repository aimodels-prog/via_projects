import { test, expect } from "@playwright/test";

test("report workspace offers clear starting choices on desktop and mobile", async ({ page }) => {
  await page.goto("/upload");
  await page.locator('input[type="password"]').fill("test-admin-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create a project report." })).toBeVisible();
  const upload = page.getByRole("button", { name: "Upload Excel / CSV", exact: true });
  await expect(upload).toBeVisible();
  await expect(page.getByRole("heading", { name: "Continue a saved draft" })).toBeVisible();
  await page.screenshot({ path: "test-results/report-workspace-desktop.png", fullPage: true });
  await upload.click();
  await expect(page.locator("#report-import-panel")).toBeFocused();
  await expect(page.getByLabel("Upload Excel file", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Upload CSV file", { exact: true })).toBeVisible();
  await expect(page.getByText("JSON file · choose your saved layout")).toHaveCount(0);
  await expect(page.getByLabel("Completed report CSV", { exact: true })).toBeHidden();
  await page
    .locator("#report-import-panel")
    .screenshot({ path: "test-results/report-import-desktop.png" });
  await page.getByText("Or paste CSV text instead", { exact: true }).click();
  await expect(page.getByLabel("Completed report CSV", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByText("Or paste CSV text instead", { exact: true }).click();
  await page
    .locator("#report-import-panel")
    .screenshot({ path: "test-results/report-import-mobile.png" });
  await upload.click();
  await expect(page.locator("#report-import-panel")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/report-workspace-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Enter details manually", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "1. Project details", exact: true }),
  ).toHaveAttribute("aria-current", "step");
  await expect(page.getByLabel("Project name", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/report-editor-mobile.png", fullPage: true });
});
