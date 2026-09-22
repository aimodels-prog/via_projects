import "@tanstack/react-start/server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ExtractedReport } from "./report.types";
import { monthKey, reportDate } from "./report-dates";
import { schematicSvg } from "./project-schematic";
import { photoPresentation } from "./image-fit";
import { bindRaysutDocument } from "./raysut-bindings.server";

// Only trusted template markup is emitted raw. All imported strings are escaped.
const esc = (value: unknown) =>
  String(
    typeof value === "string" && /^(?:not provided|n\/?a|unknown|[-—])?$/i.test(value.trim())
      ? "Not reported"
      : (value ?? ""),
  ).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
const num = (value: number | null, digits = 2) => (value == null ? "—" : value.toFixed(digits));
const signed = (value: number | null) =>
  value == null ? "—" : `${value > 0 ? "+" : ""}${num(value)}`;
const color = (value: number | null) =>
  value == null || Math.abs(value) < 0.005
    ? "var(--ink-500)"
    : value > 0
      ? "var(--via-green)"
      : "var(--via-red)";
const clamp = (value: number) => Math.max(0, Math.min(100, value));
const empty = '<span class="muted">Not reported</span>';
function imageUrl(value: string) {
  // Disallow executable schemes, CSS delimiters, and untrusted SVG data.
  return /^(data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+|https?:\/\/[^\s"'<>\\()]+)$/i.test(
    value,
  )
    ? value
    : "";
}
const img = (url: string, alt: string, style: string) =>
  imageUrl(url)
    ? `<img src="${esc(imageUrl(url))}" alt="${esc(alt)}" style="${style}">`
    : `<span class="muted">${esc(alt)} — image required</span>`;
const money = (value: number | null) =>
  value == null ? "Not reported" : value.toLocaleString("en-US", { maximumFractionDigits: 3 });

async function brandCss() {
  const root = resolve(process.cwd(), "Dashboard/via");
  let css = await readFile(resolve(root, "colors_and_type.css"), "utf8");
  // Embed locally supplied fonts so private srcdoc dashboards also work on Linux.
  const faces = [...css.matchAll(/@font-face\s*\{[^}]*\}/g)];
  for (const face of faces) {
    const name = face[0].match(/url\("fonts\/([^"]+)"\)/)?.[1];
    if (!name || !/^Sansation-[A-Za-z]+\.ttf$/.test(name)) continue;
    try {
      const bytes = await readFile(resolve(root, "fonts", name));
      css = css.replace(
        face[0],
        face[0].replace(`fonts/${name}`, `data:font/ttf;base64,${bytes.toString("base64")}`),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      // The reference folder has no LightItalic/BoldItalic files.
      css = css.replace(face[0], "");
    }
  }
  return css;
}

function chart(report: ExtractedReport, monthly: boolean) {
  const rows = report.schedule;
  if (rows.length < 2) return empty;
  const planned = rows.map((r) => (monthly ? r.plannedMonthly : r.plannedCumulative));
  const actual = rows.map((r) => (monthly ? r.actualMonthly : r.actualCumulative));
  const ymax = monthly
    ? Math.max(5, Math.ceil(Math.max(...planned, ...actual.filter((v): v is number => v != null))))
    : 100;
  const x = (i: number) => 44 + (i * 734) / (rows.length - 1);
  const y = (v: number) => 182 - (v * 164) / ymax;
  const point = (i: number, v: number) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  let svg = `<svg id="sc-${monthly ? "mon" : "cum"}" viewBox="0 0 800 220" preserveAspectRatio="none"${monthly ? ' style="display:none"' : ""}>`;
  const ticks = monthly
    ? Array.from({ length: 6 }, (_, i) => (i * ymax) / 5)
    : [0, 25, 50, 75, 100];
  for (const t of ticks)
    svg += `<line x1="44" x2="778" y1="${y(t)}" y2="${y(t)}" stroke="var(--ink-200)" ${t ? 'stroke-dasharray="2 3"' : ""}/><text x="39" y="${y(t) + 3}" text-anchor="end" class="ax">${Number(t.toFixed(2))}%</text>`;
  const years = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const year = monthKey(r.month)?.slice(0, 4) ?? "";
    years.set(year, [...(years.get(year) ?? []), i]);
  });
  for (const [year, indices] of years) {
    const first = indices[0]!,
      last = indices[indices.length - 1]!;
    if (first > 0)
      svg += `<line x1="${(x(first - 1) + x(first)) / 2}" x2="${(x(first - 1) + x(first)) / 2}" y1="18" y2="182" stroke="var(--ink-200)"/>`;
    svg += `<text x="${(x(first) + x(last)) / 2}" y="12" text-anchor="middle" class="yr">${esc(year)}</text>`;
  }
  // Draw separate segments for missing values; never bridge unreported months.
  for (const [values, stroke, fill, opacity, width, dash] of [
    [planned, "var(--ink-700)", "var(--ink-300)", 0.28, 1.2, ' stroke-dasharray="4 3"'],
    [actual, "var(--via-blue)", "var(--via-blue)", 0.1, 2.2, ""],
  ] as const) {
    let segment: { i: number; v: number }[] = [];
    const flush = () => {
      if (!segment.length) return;
      const points = segment.map((p) => point(p.i, p.v)).join(" ");
      svg += `<polygon points="${x(segment[0]!.i)},182 ${points} ${x(segment[segment.length - 1]!.i)},182" fill="${fill}" opacity="${opacity}"/><polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="${width}"${dash}${dash ? ' opacity="0.75"' : ""}/>`;
      if (segment.length === 1)
        svg += `<circle cx="${x(segment[0]!.i)}" cy="${y(segment[0]!.v)}" r="2.8" fill="${stroke}"/>`;
      segment = [];
    };
    values.forEach((v, i) => {
      if (v == null) flush();
      else segment.push({ i, v });
    });
    flush();
  }
  const current = rows.findIndex((r) => monthKey(r.month) === monthKey(report.reportMonth));
  if (current >= 0) {
    svg += `<line x1="${x(current)}" x2="${x(current)}" y1="18" y2="182" stroke="var(--via-red)" stroke-dasharray="2 3"/>`;
    for (const [v, c] of [
      [planned[current], "var(--ink-800)"],
      [actual[current], "var(--via-blue)"],
    ] as const)
      if (v != null)
        svg += `<circle cx="${x(current)}" cy="${y(v)}" r="${c === "var(--via-blue)" ? 4 : 2.8}" fill="${c === "var(--via-blue)" ? "var(--white)" : c}"${c === "var(--via-blue)" ? ' stroke="var(--via-blue)" stroke-width="2"' : ""}/>`;
  }
  rows.forEach((r, i) => {
    if (
      i % Math.max(1, Math.ceil(rows.length / 16)) === 0 ||
      i === current ||
      i === rows.length - 1
    )
      svg += `<text x="${x(i)}" y="194" text-anchor="middle" class="ax${i === current ? " axnow" : ""}">${esc(r.month)}</text>`;
  });
  return svg + "</svg>";
}

export async function buildExactDashboardHtml(report: ExtractedReport) {
  const templatePath =
    process.env["DASHBOARD_TEMPLATE_FILE"] ??
    resolve(process.cwd(), "Dashboard/Raysut dashboard.html");
  const html = await readFile(templatePath, "utf8");
  if (!html.includes('id="stage"') || !html.includes('id="sc-cum"'))
    throw new Error("Use the original Raysut dashboard.html document as the dashboard template.");
  const p = report;
  const variance = Number((p.actualProgress - p.plannedProgress).toFixed(2));
  const monthlyDiff =
    p.monthActualProgress == null || p.monthPlannedProgress == null
      ? null
      : p.monthActualProgress - p.monthPlannedProgress;
  const elapsed = (p.elapsedDays / Math.max(1, p.constructionDays)) * 100;
  const percentPosition = (date: string) => {
    const award = reportDate(p.awardDate),
      end = reportDate(p.completionDate),
      value = reportDate(date);
    return award == null || end == null || value == null
      ? 0
      : clamp(((value - award) / Math.max(1, end - award)) * 100);
  };
  const status =
    variance < -0.005 ? "BEHIND SCHEDULE" : variance > 0.005 ? "AHEAD OF SCHEDULE" : "ON SCHEDULE";
  const state = variance < -0.005 ? "danger" : "success";
  const stateColor = variance < -0.005 ? "var(--via-red)" : "var(--via-green)";
  const bar = (v: number) => `<div class="prog"><i style="width:${clamp(v)}%"></i></div>`;
  const kpi = (label: string, value: string, body: string, tint = "", adornment = "") =>
    `<div class="kpi"><div class="over" style="font-size:9.5px;color:var(--ink-600)">${label}</div><div style="display:flex;align-items:flex-end;justify-content:space-between;gap:8px"><div class="big"${tint ? ` style="color:${tint}"` : ""}>${value}</div>${adornment}</div><div>${body}</div></div>`;
  const pct = (v: number | null) =>
    v == null
      ? '<span style="font-size:14px">Not reported</span>'
      : `${num(v)}<span class="suf">%</span>`;
  const ring = `<svg class="ring" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" fill="none" stroke="var(--ink-200)" stroke-width="2"/>${[
    [14, p.plannedProgress, "var(--ink-300)"],
    [11, p.actualProgress, "var(--via-blue)"],
  ]
    .map(
      ([r, v, c]) =>
        `<circle cx="18" cy="18" r="${r}" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="${2 * Math.PI * Number(r)}" stroke-dashoffset="${2 * Math.PI * Number(r) * (1 - Number(v) / 100)}" transform="rotate(-90 18 18)"/>`,
    )
    .join("")}</svg>`;
  const trend = (value: number | null) =>
    value == null || Math.abs(value) < 0.005
      ? ""
      : `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${value < 0 ? "M3 7l6 6 4-4 8 8" : "M3 17l6-6 4 4 8-8"}"/><path d="${value < 0 ? "M17 17h4v-4" : "M17 7h4v4"}"/></svg>`;
  const resource = (label: string, unit: string, planned: number, actual: number) => {
    const max = Math.max(1, planned, actual) / 0.9;
    return `<div class="res"><div class="rl">${label}</div><div class="rs">${unit}</div><div class="rv">${actual}</div><div class="track"><span class="p" style="width:${(planned / max) * 100}%"></span><span class="a" style="width:${(actual / max) * 100}%"></span><span class="mark" style="left:${(planned / max) * 100}%"></span></div><div class="rf"><span>Plan ${planned}</span><span style="color:${color(actual - planned)}">${trend(actual - planned)} ${actual - planned > 0 ? "+" : ""}${actual - planned}</span></div></div>`;
  };
  const party = (role: string, name: string, sub: string, title = "") =>
    `<div class="party" title="${esc(title)}"><div class="r">${role}</div><div class="n">${esc(name)}</div><div class="sub">${esc(sub)}</div></div>`;
  const totalThickness = p.layers.reduce((s, l) => s + l.thickness, 0);
  const tokens: Record<string, string> = {
    TITLE: esc(`${p.projectName} · ${p.reportMonth}`),
    BRAND_CSS: await brandCss(),
    REVISION: esc(p.revision),
    AS_OF: esc(p.dataAsOf),
    REPORT_MONTH: esc(p.reportMonth),
    HEADER: `<div style="display:flex;gap:14px;align-items:center"><div class="logo-ph" style="border:none;background:transparent">${img(p.logoImage, "Dashboard logo", "height:34px;max-width:132px;width:auto;object-fit:contain;display:block")}</div><div class="client"><div class="over muted" style="font-size:8.5px">Client</div><div style="font-size:11.5px;font-weight:700;line-height:1.15">${esc(p.clientName)}</div><div class="muted" style="font-size:9.5px;line-height:1.2">${esc(p.clientDepartment)}</div></div></div>
      <div class="center" title="${esc(p.brief)}"><div class="over blue" style="font-size:9px;margin-bottom:2px">Project Nº ${esc(p.projectNumber)} &nbsp;·&nbsp; ${esc(p.projectType)}</div><h1>${esc(p.projectName)}</h1><div class="muted" style="font-size:11.5px;margin-top:2px">${esc(p.region)}</div></div>
      <div style="display:flex;align-items:center;gap:16px"><div style="text-align:right"><div class="over muted" style="font-size:8.5px">Monthly Progress Report</div><div class="mono" style="font-size:16px;font-weight:600;line-height:1.2;color:var(--ink-900)">Nº ${esc(p.reportNumber)} · ${esc(p.reportMonth)}</div><div class="over muted" style="font-size:8px">data as of ${esc(p.dataAsOf)}</div></div><div class="pill" style="border-color:var(--${state}-border);background:var(--${state}-bg)"><div class="row"><span class="led" style="background:${stateColor}"></span><span class="over" style="font-size:11px;color:${stateColor}">${status}</span></div><span class="mono" style="font-size:16px;font-weight:600;color:var(--ink-900)">${signed(variance)}% vs plan</span></div></div>`,
    KPIS: [
      kpi(
        "Physical progress",
        pct(p.actualProgress),
        `<div class="ref">Planned ${num(p.plannedProgress)}%</div>${bar(p.actualProgress)}`,
        "",
        ring,
      ),
      kpi(
        "Schedule variance",
        pct(variance),
        `<div class="ref">${variance < 0 ? "Behind plan" : variance > 0 ? "Ahead of plan" : "On plan"}</div><div class="delta" style="color:${color(monthlyDiff)}">${trend(monthlyDiff)}${monthlyDiff == null ? "Monthly difference not reported" : `${signed(monthlyDiff)}% this month`}</div>`,
        color(variance),
      ),
      kpi(
        "Time elapsed",
        pct(elapsed),
        `<div class="ref">${p.elapsedDays} of ${p.constructionDays} days</div>${bar(elapsed)}`,
      ),
      kpi(
        "Financial progress",
        pct(p.financialProgress),
        `<div class="ref">${money(p.paidAmount)} / ${money(Number(p.contractValue.replace(/,/g, "")))} ${esc(p.currency)}</div>${bar(p.financialProgress)}`,
      ),
      kpi(
        "This month",
        pct(p.monthActualProgress),
        `<div class="ref">Planned ${p.monthPlannedProgress == null ? "Not reported" : `${num(p.monthPlannedProgress)}%`}</div>`,
        "",
        p.monthActualProgress == null || p.monthPlannedProgress == null
          ? ""
          : `<div class="cmp">${[p.monthPlannedProgress, p.monthActualProgress].map((v, i) => `<div><b style="height:${(v / Math.max(1, p.monthPlannedProgress!, p.monthActualProgress!)) * 17}px;background:var(--${i ? "via-blue" : "ink-300"})"></b><span class="lbl">${i ? "A" : "P"}</span></div>`).join("")}</div>`,
      ),
    ].join(""),
    READOUTS: [
      ["Achieved", p.actualProgress, "var(--via-blue)"],
      ["Planned", p.plannedProgress, "var(--ink-500)"],
      ["Variance", variance, color(variance)],
    ]
      .map(
        ([label, v, c]) =>
          `<div class="ro"><div class="ro-l">${label}</div><div class="ro-v" style="color:${c}">${label === "Variance" ? signed(Number(v)) : num(Number(v))}%</div></div>`,
      )
      .join(""),
    CHARTS: chart(p, false) + chart(p, true),
    LEGEND: `<span><i style="border-top:1.2px dashed var(--ink-700)"></i>Planned</span><span><i style="border-top:2.2px solid var(--via-blue)"></i>Achieved</span><span><i style="border-top:1px dashed var(--via-red);width:14px"></i>Reporting date (${esc(p.reportMonth)})</span>`,
    ACTIVITIES:
      p.activities
        .map(
          (a) =>
            `<div class="act-row"><div class="act-name" title="${esc(a.name)}">${esc(a.name)}</div><div class="act-bar">${[0, 25, 50, 75, 100].map((v) => `<span class="tick" style="left:${v}%"></span>`).join("")}${a.planned == null ? "" : `<span class="bar-plan" style="width:${clamp(a.planned)}%"></span>`}${a.actual == null ? "" : `<span class="bar-actual" style="width:${clamp(a.actual)}%"></span>`}</div><div class="mono num muted">${num(a.planned)}</div><div class="mono num strong">${num(a.actual)}</div><div class="mono num" style="color:${color(a.diff)};font-weight:700">${signed(a.diff)}</div></div>`,
        )
        .join("") || empty,
    LAYOUT:
      p.layoutImageSource === "original" && p.layoutImage
        ? `<button type="button" aria-label="Enlarge project layout" onclick="document.getElementById('layout-dialog').showModal()" style="position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;background:#f4f7fa;cursor:zoom-in">${img(p.layoutImage, "Project layout", "width:100%;height:100%;object-fit:contain")}</button><dialog id="layout-dialog" aria-label="Project layout" style="width:90vw;height:85vh;max-width:1400px;border:1px solid #ccd6df;border-radius:10px;padding:16px"><div style="height:40px;display:flex;justify-content:flex-end"><button onclick="document.getElementById('layout-dialog').close()" style="padding:8px">Close layout</button></div>${img(p.layoutImage, "Project layout enlarged", "width:100%;height:calc(100% - 40px);object-fit:contain")}</dialog>`
        : p.schematic?.segments.length
          ? `<button type="button" aria-label="Enlarge project schematic" onclick="document.getElementById('layout-dialog').showModal()" style="position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;background:transparent;cursor:zoom-in">${schematicSvg(p.schematic)}</button><dialog id="layout-dialog" style="width:90vw;height:85vh;max-width:1400px;border:1px solid #ccd6df;border-radius:10px;padding:16px"><div style="height:40px;display:flex;justify-content:flex-end"><button onclick="document.getElementById('layout-dialog').close()" style="padding:8px;position:relative;z-index:1">Close layout</button></div><div style="height:calc(100% - 40px)">${schematicSvg(p.schematic)}</div></dialog>`
          : empty,
    PHOTOS: p.photos
      .map(
        (photo, i) =>
          `<button class="photo" onclick="openLightbox(${i})"><div class="photo-ph" style="border-color:transparent;overflow:hidden;background:#eef1f4">${img(photo.dataUrl, photo.caption, `position:absolute;inset:0;width:100%;height:100%;object-fit:${photoPresentation(photo).fit};object-position:${photoPresentation(photo).x}% ${photoPresentation(photo).y}%`)}</div><div class="photo-cap"><span class="mono photo-idx">P0${i + 1}</span><span class="photo-title" title="${esc(photo.caption)}">${esc(photo.caption)}</span></div></button>`,
      )
      .join(""),
    TIMELINE: `<div class="tl" title="Mobilization: ${p.mobilizationDays} days; expected completion: ${esc(p.expectedCompletionDate)}"><div class="line"></div><div class="done" style="width:${percentPosition(p.dataAsOf)}%"></div><div class="node" style="left:0;background:var(--via-blue)"></div><div class="node" style="left:${percentPosition(p.startDate)}%;background:var(--via-blue)"></div><div class="node" style="left:${percentPosition(p.dataAsOf)}%;background:var(--via-red)"></div><div class="node" style="left:calc(100% - 10px);background:var(--white);border:1.5px solid var(--ink-300)"></div></div><div class="tl-labels">${[
      [p.awardDate, "Awarded"],
      [p.startDate, "Start"],
      [p.dataAsOf, "Reported"],
      [p.completionDate, "Completion"],
    ]
      .map(
        ([date, label], i) =>
          `<div style="text-align:${i === 0 ? "left" : i === 3 ? "right" : "center"}"><div class="d">${esc(date)}</div><div class="l">${label}</div></div>`,
      )
      .join("")}</div><div class="tl-stats">${[
      ["Elapsed", p.elapsedDays],
      ["Remaining", p.remainingDays],
      ["Total", p.constructionDays],
    ]
      .map(
        ([label, v]) =>
          `<div><div class="sl">${label}</div><div class="sv">${v}<span class="u">d</span></div></div>`,
      )
      .join("")}</div>`,
    RESOURCES:
      resource("Manpower", "persons", p.plannedManpower, p.actualManpower) +
      resource("Machinery", "units", p.plannedMachinery, p.actualMachinery),
    SCOPE:
      p.scope
        .map(
          (s, i) =>
            `<div class="scope-item"${i === 4 ? ' style="grid-column:1 / -1"' : ""}><span class="mono scope-v">${esc(s.value)}<span class="scope-u">${esc(s.unit)}</span></span><span class="scope-l">${esc(s.label)}</span></div>`,
        )
        .join("") || empty,
    LAYERS:
      p.layers
        .map(
          (l, i) =>
            `<div class="pav" style="flex:${l.thickness / totalThickness};background:${["#0F1B26", "#33414F", "#94A0AC", "#BDC6CE", "#6B7886", "#4D5C6B"][i % 6]};border-bottom:1px solid var(--white)"><span class="pav-code">${esc(l.code)}</span><span class="pav-name">${esc(l.name)}</span><span class="mono">${l.thickness}mm</span></div>`,
        )
        .join("") || empty,
    TRADES:
      p.trades
        .map(
          (t) =>
            `<div class="trade" title="${esc(t.status)}"><span class="dot" style="background:${{ complete: "var(--via-green)", active: "var(--via-blue)", behind: "var(--via-red)", notstarted: "var(--ink-300)", unknown: "transparent" }[t.status]};${t.status === "unknown" ? "border:1px solid var(--ink-500)" : ""}"></span><span>${esc(t.name)}${t.status === "unknown" ? " (unknown)" : ""}</span></div>`,
        )
        .join("") || empty,
    PARTIES:
      party("Client rep.", p.engineerName, p.engineerPhone) +
      party(
        "Contractor",
        p.contractorName,
        [p.contractorRepresentative, p.contractorPhone]
          .map((v) =>
            /^(?:not provided|n\/?a|unknown|[-—])?$/i.test(v.trim()) ? "Not reported" : v,
          )
          .join(" · "),
        p.contractorRole,
      ) +
      party(
        "Consultant",
        p.consultantName,
        [p.consultantRepresentative, p.consultantPhone]
          .map((v) =>
            /^(?:not provided|n\/?a|unknown|[-—])?$/i.test(v.trim()) ? "Not reported" : v,
          )
          .join(" · "),
        p.consultantRole,
      ),
    FOOTER: `<div class="mono">MPR-${esc(p.reportNumber)} / ${esc(p.reportMonth)} / ${esc(p.footerCode)} / ${esc(p.revision)}</div><div>Prepared by ${esc(p.consultantName)} · for ${esc(p.clientName)}</div><div class="brand"><span class="dots"><i style="background:var(--via-green)"></i><i style="background:var(--via-red)"></i></span><span class="txt">${esc(p.consultantName)}</span></div>`,
    PHOTOS_JSON: JSON.stringify(p.photos.map((ph) => [ph.caption, ph.sub, imageUrl(ph.dataUrl)]))
      .replace(/</g, "\\u003c")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029"),
  };
  if (reportDate(p.dataAsOf) == null) {
    tokens["TIMELINE"] = tokens["TIMELINE"]!.replace(/<div class="done"[^>]*><\/div>/, "")
      .replace(/<div class="node" style="left:[^;]*;background:var\(--via-red\)"><\/div>/, "")
      .replace(
        `<div class="d">${esc(p.dataAsOf)}</div>`,
        `<div class="d">${esc(p.reportMonth)}</div>`,
      );
  }
  return bindRaysutDocument(html, tokens, p);
}
