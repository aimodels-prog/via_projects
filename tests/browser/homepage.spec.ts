import { test, expect } from "@playwright/test";

test("project directory filters public cards and keeps reports behind the password gate", async ({
  page,
  browser,
}) => {
  await page.goto("/admin-projects");
  await page.locator('input[type="password"]').fill("test-admin-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/upload$/);
  for (const [name, region, status] of [
    ["Directory Test School", "Muscat", "active"],
    ["Directory Test Hospital", "Dhofar", "completed"],
  ]) {
    await page.goto("/admin-projects");
    await page.getByRole("button", { name: "Add project", exact: true }).click();
    await page.getByLabel("Project name", { exact: false }).fill(name!);
    await page.getByLabel("Region", { exact: true }).fill(region!);
    await page.getByRole("combobox").selectOption(status!);
    await page.getByRole("button", { name: "Save project", exact: true }).click();
    await expect(page.getByRole("button", { name: `Delete ${name}`, exact: true })).toBeVisible();
  }
  const context = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: { width: 1280, height: 900 },
  });
  const client = await context.newPage();
  try {
    await client.goto("/");
    await expect(
      client.getByRole("heading", { name: "Every project. A clearer perspective." }),
    ).toBeVisible();
    await expect(client.locator("main img")).toHaveCount(0);
    const staffLinks =
      'a[href*="portal.via-int.com"], a[href^="/admin"], a[href^="/auth/portal"], a[href="/upload"]';
    await expect(client.locator(staffLinks)).toHaveCount(0);
    await expect(
      client
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Upload report" }),
    ).toHaveCount(0);
    await expect(
      client
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Company website" }),
    ).toHaveAttribute("href", "https://via-int.com");
    await client.getByLabel("Search projects").fill("  SCHOOL  ");
    await expect(client.locator("article")).toHaveCount(1);
    await expect(client.locator("article")).toContainText("Directory Test School");
    await client.getByRole("button", { name: "Clear filters" }).click();
    await client.getByLabel("Status", { exact: true }).selectOption("completed");
    await client.getByLabel("Location", { exact: true }).selectOption("Dhofar");
    await expect(client.locator("article")).toHaveCount(1);
    await expect(client.locator("article")).toContainText("Directory Test Hospital");
    await client.getByLabel("Search projects").fill("unmatched-project-12345");
    await expect(client.getByText("No matching projects", { exact: true })).toBeVisible();
    await client.getByRole("button", { name: "Clear filters" }).click();
    await client.screenshot({ path: "test-results/homepage-desktop.png", fullPage: true });
    await client.setViewportSize({ width: 375, height: 812 });
    await expect(
      client
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Staff sign in" }),
    ).toHaveCount(0);
    expect(
      await client.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await client.screenshot({ path: "test-results/homepage-mobile.png", fullPage: true });
    await client
      .getByRole("link", { name: "View project: Directory Test School", exact: true })
      .click();
    await expect(client).toHaveURL(/\/directory-test-school$/);
    await expect(client.locator('input[type="password"]')).toBeVisible();
    await expect(client.locator(staffLinks)).toHaveCount(0);
    await expect(client.getByRole("heading", { name: "Other VIA projects" })).toBeVisible();
    await expect(
      client.getByRole("link", { name: "View project: Directory Test Hospital", exact: true }),
    ).toBeVisible();
    await expect(
      client.getByRole("link", { name: "View project: Directory Test School", exact: true }),
    ).toHaveCount(0);
    await client.getByLabel("Project password", { exact: true }).fill("wrong-password-for-test");
    await client.getByRole("button", { name: "Show password", exact: true }).click();
    await expect(client.getByLabel("Project password", { exact: true })).toHaveAttribute(
      "type",
      "text",
    );
    await client.getByRole("button", { name: "Hide password", exact: true }).click();
    await client.getByRole("button", { name: "Open dashboard", exact: true }).click();
    await expect(client.getByRole("alert")).toBeVisible();
    await expect(client.locator("iframe")).toHaveCount(0);
    expect(
      await client.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await client.screenshot({ path: "test-results/project-access-mobile.png", fullPage: true });
    await client.setViewportSize({ width: 1440, height: 1000 });
    await client.screenshot({ path: "test-results/project-access-desktop.png", fullPage: true });
    await client.goto("/projects");
    await expect(
      client.getByRole("heading", { name: "Every project. A clearer perspective." }),
    ).toBeVisible();
    await expect(client.getByLabel("Search projects")).toBeVisible();
    await expect(client.locator(staffLinks)).toHaveCount(0);
  } finally {
    await context.close();
  }
});
