/**
 * layout-v2b figures: for each configuration, option 1 of the same
 * three briefs side by side (north at the top, 1 m grid, viewer's edge
 * marked, straight band edges dashed, ring weight = height, dashed ring =
 * windbreak). SVG, then PNG through headless Chrome so text uses system
 * fonts.
 *
 * Run: node --experimental-strip-types scripts/layout-v2b-figures.ts
 * Reads reports/layout_v2b/v2b_<config>.json; writes
 * reports/figures/layout_v2b/<config>.svg and .png.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { CONFIGS, label } from "./layout-v2b-compare.ts";

type Layout = {
  id: string; style: string; wind: string; viewingEdge: string; widthM: number; lengthM: number;
  status: string; z: number | null; cover: number | null; largestEmptyPatch: number | null; quadrantCV: number | null;
  circles: { id: string; x: number; y: number; r: number; heightCm: number | null; windbreak: boolean; tree?: boolean }[];
};
type Dump = { config: string; rulebook: string; configLine: string; bands: { edgeFrontMid: number; edgeMidBack: number }; layouts: Layout[] };
// Band edges come from the run itself (the rulebook it ran on), not the app.
let edgeFrontMid = 0;
let edgeMidBack = 0;

const IN = join("reports", "layout_v2b");
const OUT = join("reports", "figures", "layout_v2b");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
mkdirSync(OUT, { recursive: true });

const PALETTE = ["#6d7f3a", "#9c6b3f", "#4f7a8a", "#a2496b", "#7b6aa8", "#b08d2c", "#3f6e4f", "#8a4f3a", "#5a8f7b", "#c07a52", "#6b5b95", "#8f9a3c"];
const ring = (h: number | null) => (h === null ? 0.8 : h >= 100 ? 3 : h >= 50 ? 1.8 : 0.8);
const fmt = (v: number | null, dp = 2) => (v === null ? "-" : v.toFixed(dp));
const ORDER = ["S001", "S006", "FIX"];
const PANEL_W = 380;
const PANEL_H = 300;

function panel(layout: Layout, ox: number, oy: number): string {
  const W = layout.widthM;
  const L = layout.lengthM;
  const scale = Math.min(PANEL_W / W, (PANEL_H - 82) / L);
  const pw = W * scale;
  const ph = L * scale;
  const top = oy + 52;
  const ids = [...new Set(layout.circles.map((c) => c.id))].sort();
  const colour = (id: string) => PALETTE[ids.indexOf(id) % PALETTE.length];
  const grid: string[] = [];
  for (let x = 1; x < W; x += 1) grid.push(`<line x1="${ox + x * scale}" y1="${top}" x2="${ox + x * scale}" y2="${top + ph}"/>`);
  for (let y = 1; y < L; y += 1) grid.push(`<line x1="${ox}" y1="${top + y * scale}" x2="${ox + pw}" y2="${top + y * scale}"/>`);
  // Straight band edges at the rulebook's depth fractions from the viewer.
  const v = layout.viewingEdge;
  const bandLines = [edgeFrontMid, edgeMidBack].map((f) => {
    if (v === "north") return `<line x1="${ox}" y1="${top + f * ph}" x2="${ox + pw}" y2="${top + f * ph}"/>`;
    if (v === "south") return `<line x1="${ox}" y1="${top + (1 - f) * ph}" x2="${ox + pw}" y2="${top + (1 - f) * ph}"/>`;
    if (v === "west") return `<line x1="${ox + f * pw}" y1="${top}" x2="${ox + f * pw}" y2="${top + ph}"/>`;
    return `<line x1="${ox + (1 - f) * pw}" y1="${top}" x2="${ox + (1 - f) * pw}" y2="${top + ph}"/>`;
  });
  const mark = v === "north" ? [ox + pw / 2, top - 6] : v === "south" ? [ox + pw / 2, top + ph + 14] : v === "west" ? [ox - 4, top + ph / 2] : [ox + pw + 4, top + ph / 2];
  const anchor = v === "west" ? "end" : v === "east" ? "start" : "middle";
  return [
    `<text x="${ox}" y="${oy + 12}" font-size="12" font-weight="bold">${layout.id}: ${layout.style}, ${W} x ${L} m, wind ${layout.wind}, view ${v}</text>`,
    `<text x="${ox}" y="${oy + 27}" font-size="11">cover ${fmt(layout.cover)} · gap ${fmt(layout.largestEmptyPatch)} · CV ${fmt(layout.quadrantCV)} · Z ${fmt(layout.z, 3)} · ${layout.circles.length} plants</text>`,
    `<rect x="${ox}" y="${top}" width="${pw}" height="${ph}" fill="#efe6cf" stroke="#2f3a1e"/>`,
    `<g stroke="#d9d2bd" stroke-width="0.6">${grid.join("")}</g>`,
    `<g stroke="#8a6d3b" stroke-width="1" stroke-dasharray="5 3">${bandLines.join("")}</g>`,
    ...layout.circles.map(
      (c) =>
        `<circle cx="${(ox + c.x * scale).toFixed(1)}" cy="${(top + c.y * scale).toFixed(1)}" r="${(c.r * scale).toFixed(1)}" fill="${colour(c.id)}" fill-opacity="0.72" stroke="#2f3a1e" stroke-width="${ring(c.heightCm)}"${c.windbreak ? ' stroke-dasharray="4 2"' : ""}/>`,
    ),
    ...layout.circles.filter((c) => c.tree).map(
      (c) => `<text x="${(ox + c.x * scale).toFixed(1)}" y="${(top + c.y * scale + 4).toFixed(1)}" font-size="11" font-weight="bold" text-anchor="middle" fill="#fff">T</text>`,
    ),
    `<text x="${mark[0]}" y="${mark[1]}" font-size="10" text-anchor="${anchor}" font-weight="bold">viewer</text>`,
  ].join("\n");
}

for (const [key, description] of CONFIGS) {
  const dump = JSON.parse(readFileSync(join(IN, `v2b_${key}.json`), "utf8")) as Dump;
  ({ edgeFrontMid, edgeMidBack } = dump.bands);
  const layouts = ORDER.map((id) => dump.layouts.find((l) => l.id === id)).filter((l): l is Layout => Boolean(l));
  const gap = 50;
  const width = layouts.length * PANEL_W + (layouts.length + 1) * gap;
  const height = PANEL_H + 90;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Helvetica, Arial, sans-serif">
<rect width="100%" height="100%" fill="#fbf8ef"/>
<text x="${gap}" y="22" font-size="14" font-weight="bold">Config ${label(key)}: ${description}  ·  rulebook ${dump.rulebook}</text>
<text x="${gap}" y="40" font-size="11">Option 1, same seeds. North at the top, 1 m grid. Dashed brown lines: straight band edges (${edgeFrontMid} / ${edgeMidBack} of the depth from the viewer). Ring weight = height (thin &lt; 50 cm, medium &lt; 1 m, thick ≥ 1 m); dashed ring = windbreak; T = tree.</text>
${layouts.map((l, i) => panel(l, gap + i * (PANEL_W + gap), 60)).join("\n")}
</svg>
`;
  const svgPath = join(OUT, `${key}.svg`);
  writeFileSync(svgPath, svg, "utf8");
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
    `--window-size=${width},${height}`, `--screenshot=${resolve(OUT, `${key}.png`)}`,
    `file:///${resolve(svgPath).replace(/\\/g, "/")}`,
  ], { stdio: "ignore" });
  console.log(`wrote ${key}.svg / .png`);
}
