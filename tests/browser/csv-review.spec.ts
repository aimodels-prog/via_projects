import { test, expect } from "@playwright/test";

test("incomplete import can be edited, saved, restored and checked without invented zeros", async ({
  page,
}) => {
  await page.goto("/upload");
  await page.locator('input[type="password"]').fill("test-admin-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Upload Excel / CSV", exact: true }).click();
  const csv =
    "section,field,value,planned,actual,instructions\nproject,Project name,Review Test,,,\nlayer,BBC,Base course,,,Missing thickness";
  await page
    .getByLabel("Upload CSV file", { exact: true })
    .setInputFiles({ name: "review.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByRole("dialog")).toBeVisible();
  const thickness = page.getByLabel("CSV row 3 Thickness (mm)", { exact: true });
  await expect(thickness).toHaveValue("");
  await page.screenshot({ path: "test-results/csv-review-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => {
      const box = await page.getByRole("dialog").boundingBox();
      return Boolean(box && box.x >= 0 && box.x + box.width <= 390);
    })
    .toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/csv-review-mobile.png" });
  await page.getByRole("button", { name: "Save unfinished draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Draft saved");
  await page.reload();
  await page.getByRole("button", { name: "Load saved internal drafts", exact: true }).click();
  await page.getByLabel("Saved draft", { exact: true }).selectOption({ index: 1 });
  await expect(thickness).toHaveValue("");
  await page.getByRole("button", { name: "Check and continue", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("thickness");
  await thickness.fill("70");
  await page.getByRole("button", { name: "Save unfinished draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Draft saved");
  await page.reload();
  await page.getByRole("button", { name: "Load saved internal drafts", exact: true }).click();
  await page.getByLabel("Saved draft", { exact: true }).selectOption({ index: 1 });
  await expect(thickness).toHaveValue("70");
  await page.getByRole("button", { name: "Check and continue", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "3. Photos & layout", exact: true }),
  ).toHaveAttribute("aria-current", "step");
});
