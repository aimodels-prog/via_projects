import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fixture } from "../fixture";
import { buildExactDashboardHtml } from "../../src/lib/dashboard-html.server";

test("Raysut geometry, CSV data, chart toggles and four uploaded photographs", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pathToFileURL(resolve("Dashboard/Raysut dashboard.html")).href);
  await page.evaluate(() => document.fonts.ready);
  const boxes = () =>
    page
      .locator(".stage,.board,.kpis,.grid,.col,.col.a .panel,.col.b .panel,.col.c .panel")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const r = element.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        }),
      );
  const reference = await boxes();
  const referenceStyles = await page.locator("style").first().textContent();
  const referenceMap = await page
    .locator(".map svg")
    .first()
    .evaluate((el) => el.outerHTML);
  const { report } = fixture();
  Object.assign(report, {
    projectName: "Construction of Dualization for Raysut – Al Mughsayl Asphalt Road",
    projectNumber: "DGRLT/DHO/2024/47",
    projectType: "Highway dualization",
    region: "Governorate of Dhofar, Sultanate of Oman",
    reportMonth: "July 2026",
    reportNumber: "17",
    revision: "Rev-02",
    clientName: "Ministry of Transport & Communications",
    clientDepartment: "Directorate General of Roads & Land Transport",
    contractorName: "Oman Building & Contracting Co. LLC",
    contractorRepresentative: "Eng. Awadh Masan",
    contractorPhone: "97778855",
    consultantName: "VIA International — Engineering Consultancy",
    consultantRepresentative: "Habib Noor",
    consultantPhone: "98165272",
    engineerName: "Eng. Abdullah Salim Al Ibrahim",
    engineerPhone: "92766650",
    footerCode: "DGRLT-DHO",
    scope: [
      { label: "Asphalt road length", value: "28.090", unit: "km" },
      { label: "Salalah By-pass", value: "5.521", unit: "km" },
      { label: "Under-passes", value: "8", unit: "no." },
      { label: "Flyover", value: "1", unit: "no." },
      { label: "Box culverts", value: "82", unit: "no." },
    ],
    layers: [
      { code: "BWC", name: "Bituminous Wearing Course", thickness: 50 },
      { code: "BBC", name: "Bituminous Base Course", thickness: 60 },
      { code: "ABC", name: "Aggregate Base Course", thickness: 300 },
      { code: "GSB", name: "Granular Sub-Base", thickness: 200 },
    ],
  });
  report.logoImage =
    "data:image/png;base64," + (await readFile("Dashboard/via/logo-color.png")).toString("base64");
  for (let i = 0; i < 4; i++) {
    report.photos[i]!.dataUrl =
      "data:image/jpeg;base64," +
      (await readFile(`Dashboard/Photo${i + 1}.jpg`)).toString("base64");
    report.photos[i]!.caption = `Source caption ${i + 1}`;
  }
  // A separate uploaded image, never the sample Raysut schematic.
  report.layoutImage = report.photos[0]!.dataUrl;
  await page.setContent(await buildExactDashboardHtml(report));
  await page.evaluate(() => document.fonts.ready);
  const actual = await boxes();
  expect(await page.locator("style").nth(1).textContent()).toBe(referenceStyles);
  expect(actual.length).toBe(reference.length);
  for (let i = 0; i < actual.length; i++) {
    expect(Math.abs(actual[i]!.x - reference[i]!.x)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(actual[i]!.y - reference[i]!.y),
      JSON.stringify({ i, actual: actual[i], reference: reference[i] }),
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(actual[i]!.width - reference[i]!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(actual[i]!.height - reference[i]!.height)).toBeLessThanOrEqual(1);
  }
  await expect(page.locator("h1")).toHaveText(report.projectName);
  await expect(page.locator(".scope-grid")).toContainText("28.090");
  await expect(page.locator(".pav").first()).toContainText("BWC");
  // Original panel geometry is fixed, including the four pavement rows.
  await expect(page.locator(".pav")).toHaveCount(4);
  await expect(page.locator(".party")).toHaveCount(3);
  await expect(page.locator(".foot")).toContainText("Rev-02");
  await expect(page.locator(".head")).not.toContainText("June 2026");
  await page.getByRole("button", { name: "Mo.", exact: true }).click();
  await expect(page.locator("#sc-mon")).toBeVisible();
  await expect(page.locator("#sc-cum")).toBeHidden();
  await page.getByRole("button", { name: "Cum.", exact: true }).click();
  for (let i = 0; i < 4; i++) {
    await page.locator(".photo").nth(i).click();
    await expect(page.locator("#lb-title")).toHaveText(`Source caption ${i + 1}`);
    const bg = await page
      .locator("#lb-view")
      .evaluate((el) => (el as HTMLElement).style.backgroundImage);
    expect(bg).toContain(report.photos[i]!.dataUrl);
    await page.keyboard.press("Escape");
    await expect(page.locator("#lightbox")).toBeHidden();
  }
  await page.screenshot({ path: testInfo.outputPath("raysut-populated.png") });
  expect(errors).toEqual([]);
  await page.setViewportSize({ width: 960, height: 540 });
  await expect
    .poll(() => page.locator("#stage").evaluate((el) => el.getBoundingClientRect().width))
    .toBe(960);
  await page.locator(".photo").first().click();
  await page.getByRole("button", { name: "Close (Esc)" }).click();
  await expect(page.locator("#lightbox")).toBeHidden();
  report.useRaysutReferenceLayout = true;
  await page.setContent(await buildExactDashboardHtml(report));
  expect(
    await page
      .locator(".map svg")
      .first()
      .evaluate((el) => el.outerHTML),
  ).toBe(referenceMap);
  await expect(page.locator(".map-legend")).toContainText(
    `Completed ${report.actualProgress.toFixed(2)}%`,
  );
});
