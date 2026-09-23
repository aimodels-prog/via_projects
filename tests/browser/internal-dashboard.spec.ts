import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { internalFixture } from "../internal-fixture";

test.skip(process.env.E2E_SSO !== "1", "Run separately in portal mode");
let server: Server;
let portalAdmin = false;
const token = "d".repeat(64);
test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    if (req.url?.startsWith("/sso/projects?")) {
      const state = new URL(req.url, "http://localhost").searchParams.get("state");
      res
        .writeHead(302, {
          location: `http://127.0.0.1:${process.env.E2E_PORT}/auth/portal/callback?code=${"a".repeat(64)}&state=${state}`,
        })
        .end();
      return;
    }
    if (req.headers.authorization !== "Bearer test-integration-key-not-for-production-0123456789") {
      res.writeHead(401).end();
      return;
    }
    let body = "";
    for await (const c of req) body += c;
    const input = JSON.parse(body);
    const result = req.url?.endsWith("exchange")
      ? { authorized: true, session: token, expires: Date.now() + 3600000 }
      : { authorized: input.session === token, email: "test-admin@via-int.com", portalAdmin };
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result));
  });
  await new Promise<void>((resolve) =>
    server.listen(Number(process.env.E2E_PORT) + 1, "127.0.0.1", resolve),
  );
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("only portal admins can import, approve, export and view internal snapshots", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto("/admin-login");
  await expect(page).toHaveURL(/admin-projects$/);
  await expect(page.getByRole("link", { name: "Internal dashboard", exact: true })).toHaveCount(0);
  await page.goto("/internal");
  await expect(page.getByRole("heading", { name: "Restricted internal workspace" })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByRole("button", { name: "Upload monthly Excel" })).toHaveCount(0);
  portalAdmin = true;
  await page.reload();
  await page.getByRole("button", { name: "Upload monthly Excel", exact: true }).click();
  await page.getByLabel("Reporting date", { exact: false }).fill("2026-06-30");
  const bytes = await internalFixture();
  await page.getByLabel("Internal Excel workbook", { exact: true }).setInputFiles({
    name: "internal-test.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: bytes,
  });
  await page.getByRole("button", { name: "Review workbook", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "internal-test.xlsx", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Draft · not approved", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve internal snapshot", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText(/Dashboard 300.000000 differs from invoice rows/)).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Approve internal snapshot", exact: true }).click();
  await expect(page.getByText("Approved internal snapshot", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Monthly invoicing", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Invoiced · OMR/ })).toContainText("350.000");
  await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible();
  await page.screenshot({ path: "test-results/internal-overview-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/internal-overview-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page
    .getByRole("button", { name: "View details", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const downloadEvent = page.waitForEvent("download");
  const exportRequest = page.waitForRequest((r) => r.method() === "POST");
  await page.getByRole("button", { name: "Export overview", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("via-internal-2026-06-30.csv");
  const captured = await exportRequest;
  await page.getByRole("button", { name: "Upload monthly Excel", exact: true }).click();
  await page.getByRole("button", { name: "Review workbook", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("No duplicate was created");
  await expect(
    page.getByLabel("Reporting snapshot", { exact: true }).locator("option"),
  ).toHaveCount(2);
  // Replay a real protected export call with a still-valid Projects session but no portal-admin role.
  portalAdmin = false;
  const headers = { ...captured.headers() };
  delete headers["content-length"];
  const denied = await page
    .context()
    .request.post(captured.url(), { headers, data: captured.postData()! });
  const body = await denied.text();
  expect(body).toContain("restricted to VIA Portal administrators");
  expect(body).not.toContain("Nakheel");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Restricted internal workspace" })).toBeVisible();
  await expect(page.getByText("350.000", { exact: true })).toHaveCount(0);
  const anonymous = await browser.newContext({ baseURL });
  const anonHeaders = { ...headers };
  delete anonHeaders["cookie"];
  const anon = await anonymous.request.post(captured.url(), {
    headers: anonHeaders,
    data: captured.postData()!,
  });
  expect(await anon.text()).toContain("restricted to VIA Portal administrators");
  const client = await anonymous.newPage();
  await client.goto("/");
  await expect(client.getByRole("link", { name: "Internal dashboard", exact: true })).toHaveCount(
    0,
  );
  await anonymous.close();
});
