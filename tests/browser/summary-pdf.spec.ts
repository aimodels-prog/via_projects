import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

test("PDF-summary CSV keeps the fixed Raysut dashboard and editable missing fields", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/upload");
  await page.locator('input[type="password"]').fill("test-admin-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Upload Excel / CSV", exact: true }).click();
  await page.locator('input[accept="text/csv,.csv"]').setInputFiles({
    name: "mughsayl.csv",
    mimeType: "text/csv",
    buffer: await readFile("tests/fixtures/mughsayl-summary.csv"),
  });
  await page.getByRole("button", { name: "Show all fields", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Project financial progress", exact: true }),
  ).toBeVisible();
  await page
    .getByText("Supplementary financial information (not dashboard KPIs)", { exact: true })
    .click();
  await expect(page.getByLabel("Total payment anticipated", { exact: true })).toHaveValue("400000");
  await expect(page.getByLabel("Financial difference % (as printed)", { exact: true })).toHaveValue(
    "4.39",
  );
  for (const name of [
    "Project number",
    "Project type",
    "Report number",
    "Data as of",
    "Footer code",
    "Revision",
    "Actually paid amount",
  ])
    await expect(page.getByLabel(name, { exact: true })).toBeVisible();
  await expect(page.getByText("Pavement layers", { exact: true })).toBeVisible();
  await expect(page.getByText("Independent trade statuses", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Secondary description for photo 1", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByText("Additional source contacts — assign dashboard roles below only when verified", {
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Contact 4 name", { exact: true })).toHaveValue("Eng. Kamaladasan");
  await expect(page.getByLabel("Calculated physical difference")).toHaveAttribute("readonly", "");
  await page.getByLabel("Cumulative actual physical progress %", { exact: true }).fill("99");
  await expect(page.getByLabel("Calculated physical difference")).toHaveValue("4");
  await page.getByLabel("Cumulative actual physical progress %", { exact: true }).fill("98.45");
  const buffer = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: "#dfe8ec" },
  })
    .png()
    .toBuffer();
  const images = page.locator('input[type="file"][accept*="image"]');
  // Logo, optional reference, 4 photographs, optional status drawing.
  for (let i = 0; i < 7; i++)
    await images.nth(i).setInputFiles({ name: `source-${i}.png`, mimeType: "image/png", buffer });
  await expect(
    page.getByText("Before sharing the client dashboard", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add route section", exact: true }).click();
  const canvas = page.getByLabel("Schematic drawing canvas", { exact: true });
  await canvas.click({ position: { x: 100, y: 180 } });
  await canvas.click({ position: { x: 350, y: 180 } });
  await page
    .getByLabel(
      "I verified this schematic, labels and section statuses against the project source.",
      { exact: true },
    )
    .check();
  await page.getByLabel("Section status", { exact: true }).selectOption("construction");
  const schematicApproval = page.getByLabel(
    "I verified this schematic, labels and section statuses against the project source.",
    { exact: true },
  );
  await expect(schematicApproval).not.toBeChecked();
  await schematicApproval.check();
  for (const [i, month, plan, actual, cumPlan, cumActual] of [
    [1, "Jun-26", "90", "95", "90", "95"],
    [2, "Jul-26", "5", "3.45", "95", "98.45"],
  ] as const) {
    await page.getByRole("button", { name: "Add schedule month", exact: true }).click();
    for (const [label, value] of [
      ["Month (Mon-YY)", month],
      ["Monthly plan", plan],
      ["Monthly actual", actual],
      ["Cumulative plan", cumPlan],
      ["Cumulative actual", cumActual],
    ])
      await page.getByLabel(`Schedule ${i} ${label}`, { exact: true }).fill(value);
  }
  await expect(page.getByText("Publication blocked", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Generate exact dashboard preview", exact: true }).click();
  const frame = page.frameLocator('iframe[title="Exact dashboard approval preview"]');
  await expect(frame.locator("h1")).toHaveText("CONSTRUCTION WORKS OF MUGHSAYL ROAD AND BRIDGE");
  await expect(frame.locator(".kpis")).not.toContainText("400,000");
  await expect(frame.locator(".kpis")).toContainText("81.52");
  await expect(frame.locator(".kpis")).toContainText("This month");
  await expect(frame.locator(".kpis")).toContainText("Not reported");
  await expect(frame.locator(".col.c")).toContainText("Scope & build-up");
  await expect(frame.locator(".col.c")).toContainText("Pavement");
  await expect(frame.locator(".col.c")).toContainText("Trade status");
  await expect(frame.locator(".col.c")).toContainText("Project parties");
  await expect(frame.locator(".party")).toHaveCount(3);
  await expect(frame.locator("#sc-cum")).toBeVisible();
  await frame.getByRole("button", { name: "Mo.", exact: true }).click();
  await expect(frame.locator("#sc-mon")).toBeVisible();
  await frame.getByRole("button", { name: "Enlarge project schematic" }).click();
  await expect(frame.locator("#layout-dialog")).toBeVisible();
  await frame.getByRole("button", { name: "Close layout" }).click();
  await expect(frame.locator(".col.c")).not.toContainText("Contract value details");
  await page.screenshot({ path: info.outputPath("source-summary-ingestion.png") });
  const html = await page.locator("iframe").getAttribute("srcdoc");
  const standalone = await page.context().newPage();
  await standalone.setViewportSize({ width: 1920, height: 1080 });
  await standalone.setContent(html!);
  await standalone.screenshot({ path: info.outputPath("source-summary-dashboard.png") });
  await standalone.close();
  await page.getByLabel("Client dashboard password", { exact: true }).fill("client-source-test");
  await page.getByRole("checkbox").last().check();
  await page.getByRole("button", { name: "Approve and create project", exact: true }).click();
  await expect(page).toHaveURL(/construction-works-of-mughsayl-road-and-bridge/, {
    timeout: 30000,
  });
  expect(errors).toEqual([]);
});
