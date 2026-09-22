import { test, expect } from "@playwright/test";
test("admin can cancel or confirm recoverable deletion and the project disappears", async ({
  page,
  browser,
}) => {
  await page.goto("/admin-projects");
  await page.locator('input[type="password"]').fill("test-admin-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/upload$/);
  await page.goto("/admin-projects");
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project name", { exact: false }).fill("Delete Test Road");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  const del = page.getByRole("button", { name: "Delete Delete Test Road", exact: true });
  await expect(del).toBeVisible();
  await del.click();
  await expect(page.getByRole("button", { name: "Confirm deletion", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(del).toBeVisible();
  await del.click();
  await page.getByLabel("Confirm project URL slug").fill("delete-test-road");
  await page.getByRole("button", { name: "Confirm deletion", exact: true }).click();
  await expect(del).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("files are retained");
  const context = await browser.newContext();
  const client = await context.newPage();
  await client.goto("/delete-test-road");
  await expect(client.getByText("Delete Test Road", { exact: true })).toHaveCount(0);
  await client.goto("/projects");
  await expect(client.getByText("Delete Test Road", { exact: true })).toHaveCount(0);
  await context.close();
});
