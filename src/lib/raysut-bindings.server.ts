import "@tanstack/react-start/server-only";
import { load } from "cheerio";
import type { ExtractedReport } from "./report.types";

/** Bind into the supplied document. Its stylesheet, panel structure and fixed canvas stay intact. */
export function bindRaysutDocument(
  source: string,
  tokens: Record<string, string>,
  report: ExtractedReport,
) {
  const $ = load(source);
  const fragment = (key: string) => load(tokens[key] ?? "", {}, false);
  $("title").text(`${report.projectName} · ${report.reportMonth}`);
  $("#lb-title,#lb-sub").empty();
  $('link[href="via/colors_and_type.css"]').replaceWith(`<style>${tokens["BRAND_CSS"]}</style>`);
  const header = fragment("HEADER");
  for (const selector of [".client", ".center", ".pill"]) {
    const target = $(".head").find(selector);
    const data = header(selector);
    // Preserve whitespace and original wrapper styles (including inline line boxes).
    target
      .find("div,span,h1")
      .filter((_, el) => !$(el).children().length)
      .each((i, el) => {
        const values = data
          .find("div,span,h1")
          .filter((_, child) => !header(child).children().length);
        $(el).text(values.eq(i).text());
      });
  }
  $(".head .logo-ph").html(header(".logo-ph").html() ?? "");
  $(".head .center").attr("title", report.brief);
  const reportMeta = $(".head > div").last().children().first();
  const meta = header.root().children().last().children().first();
  reportMeta.children().each((i, el) => {
    $(el).text(meta.children().eq(i).text());
  });
  $(".head .pill").attr("style", header(".pill").attr("style") ?? "");
  $(".head .pill .over").attr("style", header(".pill .over").attr("style") ?? "");
  $(".head .led").attr(
    "style",
    `${header(".led").attr("style")};box-shadow:0 0 0 3px color-mix(in srgb, ${header(".led").css("background")} 15%, transparent)`,
  );
  const kpis = fragment("KPIS");
  $(".kpi").each((i, el) => {
    const target = $(el),
      data = kpis(".kpi").eq(i);
    // Keep the original five different card structures, not a common rebuilt card.
    target.find(".big").html(data.find(".big").html() ?? "");
    const tint = data.find(".big").attr("style");
    if (tint) target.find(".big").attr("style", tint);
    target.find(".ref").html(data.find(".ref").html() ?? "");
    for (const selector of [".prog", ".ring", ".delta", ".cmp"]) {
      const value = data.find(selector);
      if (value.length) target.find(selector).replaceWith(value.toString());
      else target.find(selector).remove();
    }
  });
  $(".sc-readouts").html(tokens["READOUTS"]!);
  $(".sc-wrap").html(tokens["CHARTS"]!);
  $(".sc-legend").html(tokens["LEGEND"]!);
  $(".act-rows").html(tokens["ACTIVITIES"]!);
  // Original version has an unnamed activity-row container immediately following .act-head.
  if (!$(".act-rows").length) $(".act-head").next().html(tokens["ACTIVITIES"]!);
  if (report.useRaysutReferenceLayout && report.layoutImageSource !== "original") {
    // Explicit opt-in: original geometry describes this specific route, not an arbitrary project.
    $(".map-legend .lr")
      .first()
      .contents()
      .filter((_, node) => node.type === "text")
      .remove();
    $(".map-legend .lr")
      .first()
      .append(`Completed ${report.actualProgress.toFixed(2)}%`);
  } else $(".map").html(tokens["LAYOUT"]!);
  if (report.layoutImageSource === "original")
    $(".col.b .panel").first().find(".panel-head .s").text("project layout · click to enlarge");
  // Preserve the original photo button/caption markup and inject only its live content.
  const photos = fragment("PHOTOS");
  $(".photo").each((i, el) => {
    const data = photos(".photo").eq(i);
    $(el)
      .find(".photo-ph")
      .attr("style", data.find(".photo-ph").attr("style") ?? "");
    $(el)
      .find(".photo-ph")
      .html(data.find(".photo-ph").html() ?? "");
    $(el)
      .find(".photo-cap")
      .html(data.find(".photo-cap").html() ?? "");
  });
  $(".tl").parent().html(tokens["TIMELINE"]!);
  $(".res").first().parent().html(tokens["RESOURCES"]!);
  $(".scope-grid").html(tokens["SCOPE"]!);
  $(".pav-stack").html(tokens["LAYERS"]!);
  $(".trade").first().parent().html(tokens["TRADES"]!);
  $(".party").first().parent().html(tokens["PARTIES"]!);
  $(".foot").html(tokens["FOOTER"]!);
  $(".col.a .panel")
    .eq(0)
    .find(".panel-head .s")
    .text(`planned vs achieved · ${report.revision.toLowerCase()} programme`);
  $(".col.a .panel").eq(1).find(".panel-head .s").text(`cumulative as of ${report.dataAsOf}`);
  $(".col.b .panel").eq(1).find(".panel-head .s").text(`captured ${report.reportMonth}`);
  $("script").each((_, el) => {
    let script = $(el).html() ?? "";
    script = script.replace(
      /var PHOTOS = [\s\S]*?;/,
      () => `var PHOTOS = ${tokens["PHOTOS_JSON"]};`,
    );
    script = script.replace(
      /document\.getElementById\('lb-view'\)\.style\.backgroundImage = [^;]+;/,
      `document.getElementById('lb-view').style.backgroundImage = 'url("' + PHOTOS[lbIndex][2] + '")';`,
    );
    script = script.replace(
      "function setMode(mode){",
      "function setMode(mode){ if(!document.getElementById('sc-cum')) return;",
    );
    $(el).text(script);
  });
  // Only the modal adapts to short embedded previews; the 1920px reference view is unchanged.
  $("head").append(
    `<style>@media(max-width:1280px){.lb-inner{width:min(86vw,calc((100vh - 140px)*16/9));max-height:94vh;overflow:auto}.lb-bar{gap:12px;flex-wrap:wrap}.lb-bar button.primary{position:fixed;right:12px;top:12px}}</style>`,
  );
  return $.html();
}
