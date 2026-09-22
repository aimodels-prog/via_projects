import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fixture } from "../fixture";

test("internal approval, exact preview, client gate and private report", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/upload");
  await expect(page).toHaveURL(/admin-login/);
  await page.locator('input[type="password"]').fill("test-admin-password");
  await page.getByRole("button", { name: /sign in|log in|unlock/i }).click();
  await expect(page).toHaveURL(/\/upload$/);
  await page.getByText("Fill from a CSV template", { exact: true }).click();
  await page.locator('input[accept="text/csv,.csv"]').setInputFiles({
    name: "report.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("incorrect CSV header"),
  });
  await expect(page.getByRole("alert")).toContainText("CSV header");
  await expect(page.getByPlaceholder("Paste your completed PDF report CSV here")).toHaveValue(
    "incorrect CSV header",
  );
  await page.locator('input[accept="text/csv,.csv"]').setInputFiles({
    name: "report.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(fixture().csv),
  });
  await page.getByRole("button", { name: "Show all fields", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Report steps" })).toBeVisible();
  const image = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 180, g: 130, b: 60 } },
  })
    .png()
    .toBuffer();
  // Six mandatory original-image upload controls appear before supplemental inputs.
  const inputs = page.locator('input[type="file"][accept*="image"]');
  for (let i = 0; i < 6; i++)
    await inputs.nth(i).setInputFiles(
      i < 2
        ? { name: `original-${i}.png`, mimeType: "image/png", buffer: image }
        : {
            name: `Photo${i - 1}.jpg`,
            mimeType: "image/jpeg",
            buffer: await readFile(`Dashboard/Photo${i - 1}.jpg`),
          },
    );
  await expect(page.getByText(/Photo 1 is 553 × 456 pixels/)).toBeVisible();
  await page.getByLabel("Image fit for photo 1", { exact: true }).selectOption("contain");
  await expect(page.getByLabel("Horizontal position for photo 1", { exact: true })).toHaveCount(0);
  await page.getByLabel("Image fit for photo 2", { exact: true }).selectOption("cover");
  await page.getByLabel("Horizontal position for photo 2", { exact: true }).fill("80");
  await page.getByLabel("Reuse saved layout", { exact: true }).setInputFiles({
    name: "layout.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture().report.schematic)),
  });
  await page
    .getByLabel(
      "I verified this schematic, labels and section statuses against the project source.",
      { exact: true },
    )
    .check();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Draft saved");
  const previewRequest = page.waitForRequest((request) => request.method() === "POST");
  await page.getByRole("button", { name: "Generate exact dashboard preview" }).click();
  const captured = await previewRequest;
  const frame = page.frameLocator('iframe[title="Exact dashboard approval preview"]');
  await expect(frame.locator(".photo-ph img").nth(0)).toHaveCSS("object-fit", "contain");
  await expect(frame.locator(".photo-ph img").nth(1)).toHaveCSS("object-position", "80% 50%");
  await expect(frame.getByText("Test bridge project", { exact: false }).first()).toBeVisible({
    timeout: 30000,
  });
  await expect(frame.locator("body")).not.toContainText("Mar '26 (now)");
  await frame.getByRole("button").filter({ hasText: "Caption" }).first().click();
  await expect(frame.getByText("Photo 01 of 4")).toBeVisible();
  await frame.getByRole("button", { name: "Close (Esc)" }).click({ timeout: 10000 });
  // A direct server-function call without an admin cookie must fail too.
  const anonymous = await browser.newContext();
  const replayHeaders = { ...captured.headers() };
  delete replayHeaders["cookie"];
  delete replayHeaders["content-length"];
  const denied = await anonymous.request.post(captured.url(), {
    data: captured.postData()!,
    headers: replayHeaders,
  });
  expect(await denied.text()).toContain("Administrator session required");
  await anonymous.close();
  await page
    .getByLabel("Activity-status drawing", { exact: true })
    .setInputFiles({ name: "status.png", mimeType: "image/png", buffer: image });
  await page
    .getByLabel("Client / ministry logo for PDF header", { exact: true })
    .setInputFiles({ name: "ministry.png", mimeType: "image/png", buffer: image });
  const logo = await readFile("Dashboard/via/logo-color.png");
  await page.getByLabel("Add report header logos", { exact: true }).setInputFiles(
    ["client.png", "consultant.png", "contractor.png"].map((name) => ({
      name,
      mimeType: "image/png",
      buffer: logo,
    })),
  );
  await expect(page.getByLabel("Report header logos preview").locator("img")).toHaveCount(3);
  await page.getByRole("button", { name: "Move logo 2 earlier", exact: true }).click();
  await expect(
    page.getByLabel("Report header logos preview").locator("img").first(),
  ).toHaveAttribute("alt", "Header logo 1: consultant.png");
  await page.getByRole("button", { name: "Remove header logo 3", exact: true }).click();
  await expect(page.getByLabel("Report header logos preview").locator("img")).toHaveCount(2);
  await page.getByLabel("PDF S-curve source", { exact: true }).selectOption("image");
  await expect(page.getByAltText("PDF project map framing preview", { exact: true })).toHaveCSS(
    "object-fit",
    "cover",
  );
  await page.getByLabel("Horizontal PDF map position", { exact: true }).fill("75");
  await expect(page.getByAltText("PDF project map framing preview", { exact: true })).toHaveCSS(
    "object-position",
    "75% 50%",
  );
  await page.getByLabel("PDF map image fit", { exact: true }).selectOption("contain");
  await expect(page.getByAltText("PDF project map framing preview", { exact: true })).toHaveCSS(
    "object-fit",
    "contain",
  );
  await page.getByLabel("PDF map image fit", { exact: true }).selectOption("cover");
  await page
    .getByLabel("Original S-curve picture", { exact: true })
    .setInputFiles({ name: "chart.png", mimeType: "image/png", buffer: image });
  await expect(page.getByAltText("Original PDF S-curve", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Generate A4 PDF preview", exact: true }).click();
  await expect(page.locator('iframe[title="Salalah A4 PDF preview"]')).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByRole("link", { name: "Download reviewed PDF" })).toHaveCount(0);
  await page
    .getByLabel(
      "I checked the PDF figures, images, source-drawing legend and page fit against the approved report.",
      { exact: true },
    )
    .check();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download reviewed PDF" }).click();
  const download = await downloadEvent;
  await download.saveAs("test-results/header-logos-preview.pdf");
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  // Editing after preview invalidates approval immediately.
  await page.getByLabel("Revision", { exact: true }).fill("Reviewed revision");
  await expect(page.getByRole("checkbox").last()).toBeDisabled();
  await expect(page.getByRole("link", { name: "Download reviewed PDF" })).toHaveCount(0);
  await page.getByRole("button", { name: "Generate exact dashboard preview" }).click();
  await expect(page.getByRole("checkbox").last()).toBeEnabled();
  await page.getByLabel("Client dashboard password", { exact: true }).fill("client-test-password");
  await page.getByRole("checkbox").last().check();
  await page.getByRole("button", { name: "Approve and create project" }).click();
  await expect(page).toHaveURL(/test-bridge-project/, { timeout: 30000 });
  const context = await browser.newContext();
  const client = await context.newPage();
  await client.goto("/");
  await expect(client.getByRole("link", { name: /Test bridge project/ }).first()).toBeVisible();
  await client.goto("/test-bridge-project");
  await expect(client.locator('input[type="password"]')).toBeVisible();
  await client.locator('input[type="password"]').fill("client-test-password");
  await client.getByRole("button", { name: /open dashboard|unlock|access/i }).click();
  await expect(client.locator("iframe")).toBeVisible({ timeout: 30000 });
  await context.close();
  expect(errors).toEqual([]);
});

test("manual project setup can be saved and restored before monthly values exist", async ({
  page,
}) => {
  await page.goto("/upload");
  await page.locator('input[type="password"]').fill("test-admin-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Start project manually — no CSV required", exact: true })
    .click();
  await page.getByLabel("Project name", { exact: true }).fill("Manual setup only");
  await page.screenshot({ path: "test-results/simple-report-steps.png" });
  await expect(page.getByLabel("Caption for photo 1", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Next: Monthly update", exact: true }).click();
  await expect(page.getByLabel("Project name", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Next: Photos & layout", exact: true }).click();
  await expect(page.getByLabel("Caption for photo 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next: PDF & client access", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Generate A4 PDF preview", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Client dashboard password", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Edit project details", exact: true }).click();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue("Manual setup only");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Draft saved");
  await page.reload();
  await page.getByRole("button", { name: "Load saved internal drafts", exact: true }).click();
  const option = page.getByRole("option", { name: /Manual setup only/ });
  const id = await option.getAttribute("value");
  await page.getByLabel("Saved draft", { exact: true }).selectOption(id!);
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue("Manual setup only");
  await expect(
    page.getByLabel("Cumulative actual physical progress %", { exact: true }),
  ).toHaveValue("");
  await page.getByLabel("Construction period (days)", { exact: true }).fill("912");
  await page.getByRole("button", { name: "Next: Monthly update", exact: true }).click();
  await page.getByLabel("Data as of", { exact: true }).fill("2026-07-31");
  await expect(page.getByText("July 2026", { exact: true })).toBeVisible();
  await page.getByLabel("Cumulative planned physical progress %", { exact: true }).fill("47.95");
  await page.getByLabel("Cumulative actual physical progress %", { exact: true }).fill("40.94");
  await expect(page.getByText("Difference (calculated): -7.01%", { exact: true })).toBeVisible();
  await page.getByLabel("Elapsed time (days)", { exact: true }).fill("517");
  await expect(page.getByText("Remaining days (calculated): 395", { exact: true })).toBeVisible();
  await page.getByLabel("Planned financial progress %", { exact: true }).fill("46.539");
  await page.getByLabel("Actual financial progress %", { exact: true }).fill("33.38");
  await expect(page.getByText("Difference (calculated): -13.159", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "2. Monthly update", exact: true }).click();
  await page.screenshot({ path: "test-results/monthly-update.png" });
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Start next month from this project setup", exact: true })
    .click();
  await expect(page.getByText("Previous report: July 2026", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Cumulative actual physical progress %", { exact: true }),
  ).toHaveValue("");
});
