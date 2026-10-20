/**
 * Cover-bar test figures (owner, 20 Oct 2026): option 1 of S001, S006 and
 * the fixed case, FINAL-BOOK (book cover values, in memory) beside FINAL
 * (cover 0.90-1.0), same seed, same drawing code and scale as the layout
 * comparisons (copied from scripts/layout-v2d-figures.ts).
 *
 * Run: node --experimental-strip-types scripts/cover-bar-figures.ts
 * Reads reports/cover_bar/{final_book,final}.json; writes
 * reports/figures/cover_bar/{S001,S006,FIX}.svg and .png.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";


type Circle = { id: string; x: number; y: number; r: number; heightCm: number | null; windbreak: boolean; tree?: boolean };
type Layout = {
  id: string; style: string; wind: string; viewingEdge: string; widthM: number; lengthM: number;
  status: string; z: number | null; cover: number | null; largestEmptyPatch: number | null; quadrantCV: number | null;
  circles: Circle[];
};
type Dump = { config: string; rulebook: string; bands: { edgeFrontMid: number; edgeMidBack: number }; layouts: Layout[] };

const IN = join("reports", "cover_bar");
const OUT = join("reports", "figures", "cover_bar");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
mkdirSync(OUT, { recursive: true });

const PALETTE = ["#6d7f3a", "#9c6b3f", "#4f7a8a", "#a2496b", "#7b6aa8", "#b08d2c", "#3f6e4f", "#8a4f3a", "#5a8f7b", "#c07a52", "#6b5b95", "#8f9a3c"];
const ring = (h: number | null) => (h === null ? 0.8 : h >= 100 ? 3 : h >= 50 ? 1.8 : 0.8);
const fmt = (v: number | null, dp = 2) => (v === null ? "-" : v.toFixed(dp));
const PANEL_W = 460;
const PANEL_H = 330;

function panel(layout: Layout, ox: number, oy: number, title: string, edges: number[], colour: (id: string) => string): string {
  const W = layout.widthM;
  const L = layout.lengthM;
  const scale = Math.min(PANEL_W / W, (PANEL_H - 82) / L);
  const pw = W * scale;
  const ph = L * scale;
  const top = oy + 52;
  const grid: string[] = [];
  for (let x = 1; x < W; x += 1) grid.push(`<line x1="${ox + x * scale}" y1="${top}" x2="${ox + x * scale}" y2="${top + ph}"/>`);
  for (let y = 1; y < L; y += 1) grid.push(`<line x1="${ox}" y1="${top + y * scale}" x2="${ox + pw}" y2="${top + y * scale}"/>`);
  const v = layout.viewingEdge;
  const bandLines = edges.map((f) => {
    if (v === "north") return `<line x1="${ox}" y1="${top + f * ph}" x2="${ox + pw}" y2="${top + f * ph}"/>`;
    if (v === "south") return `<line x1="${ox}" y1="${top + (1 - f) * ph}" x2="${ox + pw}" y2="${top + (1 - f) * ph}"/>`;
    if (v === "west") return `<line x1="${ox + f * pw}" y1="${top}" x2="${ox + f * pw}" y2="${top + ph}"/>`;
    return `<line x1="${ox + (1 - f) * pw}" y1="${top}" x2="${ox + (1 - f) * pw}" y2="${top + ph}"/>`;
  });
  const mark = v === "north" ? [ox + pw / 2, top - 6] : v === "south" ? [ox + pw / 2, top + ph + 14] : v === "west" ? [ox - 4, top + ph / 2] : [ox + pw + 4, top + ph / 2];
  const anchor = v === "west" ? "end" : v === "east" ? "start" : "middle";
  return [
    `<text x="${ox}" y="${oy + 12}" font-size="13" font-weight="bold">${title}</text>`,
    `<text x="${ox}" y="${oy + 28}" font-size="11">cover ${fmt(layout.cover)} · largest gap ${fmt(layout.largestEmptyPatch, 3)} · CV ${fmt(layout.quadrantCV, 3)} · Z ${fmt(layout.z, 4)} · ${layout.circles.length} plants</text>`,
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

const rules = JSON.parse(readFileSync(join("app", "data", "engine_rules.generated.json"), "utf8"));
const edges = [rules.stage4.heightBands.edgeFrontMid, rules.stage4.heightBands.edgeMidBack];
const book = JSON.parse(readFileSync(join(IN, "final_book.json"), "utf8")) as Dump;
const final = JSON.parse(readFileSync(join(IN, "final.json"), "utf8")) as Dump;
for (const id of ["S001", "S006", "FIX"]) {
  const b = book.layouts.find((l) => l.id === id);
  const a = final.layouts.find((l) => l.id === id);
  if (!b || !a) continue;
  const ids = [...new Set([...b.circles, ...a.circles].map((c) => c.id))].sort();
  const colour = (cid: string) => PALETTE[ids.indexOf(cid) % PALETTE.length];
  const gap = 50;
  const width = 2 * PANEL_W + 3 * gap;
  const height = PANEL_H + 100;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Helvetica, Arial, sans-serif">
<rect width="100%" height="100%" fill="#fbf8ef"/>
<text x="${gap}" y="22" font-size="14" font-weight="bold">Cover-bar test · ${id}: ${b.style}, ${b.widthM} x ${b.lengthM} m, wind ${b.wind}, view ${b.viewingEdge} · option 1 · rulebook ${final.rulebook}</text>
<text x="${gap}" y="40" font-size="11">Same brief, seed and final algorithm; only the style cover values differ. North at the top, 1 m grid. Dashed brown lines: straight band edges (${edges.join(" / ")} of the depth from the viewer).</text>
<text x="${gap}" y="55" font-size="11">Ring weight = height (thin &lt; 50 cm, medium &lt; 1 m, thick ≥ 1 m); dashed ring = windbreak; T = tree.</text>
${panel(b, gap, 70, "FINAL-BOOK (book cover values)", edges, colour)}
${panel(a, 2 * gap + PANEL_W, 70, "FINAL (cover 0.90–1.0)", edges, colour)}
</svg>
`;
  const svgPath = join(OUT, `${id}.svg`);
  writeFileSync(svgPath, svg, "utf8");
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
    `--window-size=${width},${height}`, `--screenshot=${resolve(OUT, `${id}.png`)}`,
    `file:///${resolve(svgPath).replaceAll("\\", "/")}`,
  ], { stdio: "ignore" });
  console.log(`wrote ${id}.svg / .png`);
}
