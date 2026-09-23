import { test, expect } from "@playwright/test";
import { PDF_REPORT_CSV_TEMPLATE } from "../../src/lib/pdf-report-csv";

test("one layout upload replaces road controls and is shown in the PDF preview", async ({
  page,
}) => {
  await page.goto("/upload");
  await page.locator('input[type="password"]').fill("test-admin-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Upload Excel / CSV", exact: true }).click();
  await page.getByText("Or paste CSV text instead", { exact: true }).click();
  await page
    .getByPlaceholder("Paste your completed PDF report CSV here")
    .fill(
      PDF_REPORT_CSV_TEMPLATE.replace(
        "project,Project name,,,",
        "project,Project name,Building Test,,",
      ),
    );
  await page.getByRole("button", { name: "Validate pasted CSV", exact: true }).click();
  await expect(page.getByText("Road drawing options (optional)", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Use the Raysut drawing", { exact: true })).toHaveCount(0);
  await page.getByLabel("Project map image", { exact: true }).setInputFiles("Dashboard/Photo1.jpg");
  const layout = page.getByAltText("Project layout", { exact: true });
  await expect(layout).toBeVisible();
  const src = await layout.getAttribute("src");
  await page.getByRole("button", { name: "4. Review & publish", exact: true }).click();
  await expect(page.getByAltText("PDF project map framing preview")).toHaveAttribute("src", src!);
  await expect(page.getByLabel("PDF map image fit", { exact: true })).toHaveValue("contain");
});
