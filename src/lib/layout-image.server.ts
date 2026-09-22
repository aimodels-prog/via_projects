import "@tanstack/react-start/server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { load } from "cheerio";
import sharp from "sharp";
import type { ExtractedReport } from "./report.types";
import { schematicSvg } from "./project-schematic";
export async function layoutImageForPdf(report: ExtractedReport) {
  let svg: string;
  if (report.useRaysutReferenceLayout) {
    const $ = load(await readFile(resolve("Dashboard/Raysut dashboard.html"), "utf8"));
    const element = $(".map > svg")
      .first()
      .attr("xmlns", "http://www.w3.org/2000/svg")
      .attr("width", "800")
      .attr("height", "300");
    element.prepend('<rect width="800" height="300" fill="#f0f5f9"/>');
    const css = await readFile(resolve("Dashboard/via/colors_and_type.css"), "utf8");
    const vars = Object.fromEntries(
      [...css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)].map((m) => [m[1], m[2]]),
    );
    vars["--font-brand"] = "Arial";
    vars["--font-mono"] = "monospace";
    svg = element.toString().replace(/var\((--[\w-]+)\)/g, (_, key) => vars[key] ?? "#172532");
  } else {
    if (!report.schematic?.approved || !report.schematic.segments.length)
      throw new Error("Review and approve the project schematic before generating the PDF map.");
    svg = schematicSvg(report.schematic).replace("<svg ", '<svg width="800" height="400" ');
  }
  const image = await sharp(Buffer.from(svg)).resize(1600).png().toBuffer();
  return `data:image/png;base64,${image.toString("base64")}`;
}
