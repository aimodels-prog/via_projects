import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";

test.skip(process.env.E2E_SSO !== "1", "Run separately with E2E_SSO=1");
let server: Server;
let active = true;
let consumed = false;
const session = "b".repeat(64);
test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    if (req.url?.startsWith("/sso/projects?")) {
      const state = new URL(req.url, "http://localhost").searchParams.get("state");
      res
        .writeHead(302, {
          location: `http://127.0.0.1:${Number(process.env.E2E_PORT || 8197)}/auth/portal/callback?code=${"a".repeat(64)}&state=${state}`,
        })
        .end();
      return;
    }
    if (req.headers.authorization !== "Bearer test-integration-key-not-for-production-0123456789") {
      res.writeHead(401).end();
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    const input = JSON.parse(body);
    let result: object = { authorized: false };
    if (req.url?.endsWith("/exchange") && input.code === "a".repeat(64) && !consumed) {
      consumed = true;
      result = { authorized: true, session, expires: Date.now() + 3600000 };
    }
    if (req.url?.endsWith("/access")) result = { authorized: active && input.session === session };
    if (req.url?.endsWith("/logout")) {
      active = false;
      result = { ok: true };
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result));
  });
  await new Promise<void>((resolve) =>
    server.listen(Number(process.env.E2E_PORT || 8197) + 1, "127.0.0.1", resolve),
  );
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("staff SSO, protected actions, revocation and public client view", async ({
  page,
  baseURL,
  browser,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(baseURL + "/");
  await page.goto("/auth/portal/callback?code=" + "a".repeat(64) + "&state=forged");
  await expect(page.locator("body")).toContainText("could not be verified");
  await page.goto("/admin-login");
  await expect(page).toHaveURL(/\/admin-projects$/);
  expect(
    (await page.context().cookies()).some(
      (cookie) => cookie.name === "via_projects_staff" && cookie.httpOnly,
    ),
  ).toBe(true);
  await page.goto("/upload");
  await page.getByRole("button", { name: "Enter details manually", exact: true }).click();
  await page.getByLabel("Project name", { exact: true }).fill("SSO test draft");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Draft saved");
  active = false;
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Administrator session required");
  const client = await browser.newContext({ baseURL });
  const clientPage = await client.newPage();
  await clientPage.goto("/");
  await expect(clientPage).toHaveURL(baseURL + "/");
  await client.close();
});
