/**
 * Before/after figures for the final comparison: one SVG per scenario,
 * the baseline layout beside the final one, north at the top, a 1 m grid,
 * the viewer's edge marked, ring weight for height (thin under 50 cm,
 * medium to 1 m, thick 1 m and over), dashed ring for a windbreak plant.
 *
 * Run: node --experimental-strip-types scripts/final-figures.ts BEFORE.json AFTER.json OUTDIR
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Layout = {
  id: string; style: string; wind: string; viewingEdge: string; widthM: number; lengthM: number;
  status: string; z: number | null; cover: number | null; largestEmptyPatch: number | null; quadrantCV: number | null;
  circles: { id: string; x: number; y: number; r: number; heightCm: number | null; windbreak: boolean }[];
};
type Dump = { rulebook: string; layouts: Layout[] };

const [beforePath, afterPath, outDir] = process.argv.slice(2);
const before = JSON.parse(readFileSync(beforePath, "utf8")) as Dump;
const after = JSON.parse(readFileSync(afterPath, "utf8")) as Dump;
mkdirSync(outDir, { recursive: true });

const PALETTE = ["#6d7f3a", "#9c6b3f", "#4f7a8a", "#a2496b", "#7b6aa8", "#b08d2c", "#3f6e4f", "#8a4f3a", "#5a8f7b", "#c07a52", "#6b5b95", "#8f9a3c"];
const ring = (h: number | null) => (h === null ? 0.8 : h >= 100 ? 3 : h >= 50 ? 1.8 : 0.8);
const fmt = (v: number | null, dp = 2) => (v === null ? "-" : v.toFixed(dp));

for (const b of before.layouts) {
  const a = after.layouts.find((l) => l.id === b.id);
  if (!a) continue;
  const W = b.widthM;
  const L = b.lengthM;
  const scale = Math.min(330 / W, 260 / L);
  const pw = W * scale;
  const ph = L * scale;
  const ids = [...new Set([...b.circles, ...a.circles].map((c) => c.id))].sort();
  const colour = (id: string) => PALETTE[ids.indexOf(id) % PALETTE.length];
  const panel = (layout: Layout, ox: number, title: string) => {
    const oy = 60;
    const grid: string[] = [];
    for (let x = 1; x < W; x += 1) grid.push(`<line x1="${ox + x * scale}" y1="${oy}" x2="${ox + x * scale}" y2="${oy + ph}"/>`);
    for (let y = 1; y < L; y += 1) grid.push(`<line x1="${ox}" y1="${oy + y * scale}" x2="${ox + pw}" y2="${oy + y * scale}"/>`);
    const v = layout.viewingEdge;
    const mark = v === "north" ? [ox + pw / 2, oy - 8] : v === "south" ? [ox + pw / 2, oy + ph + 16] : v === "west" ? [ox - 14, oy + ph / 2] : [ox + pw + 14, oy + ph / 2];
    return [
      `<text x="${ox}" y="${oy - 26}" font-size="13" font-weight="bold">${title}</text>`,
      `<rect x="${ox}" y="${oy}" width="${pw}" height="${ph}" fill="#efe6cf" stroke="#2f3a1e"/>`,
      `<g stroke="#d9d2bd" stroke-width="0.6">${grid.join("")}</g>`,
      ...layout.circles.map(
        (c) =>
          `<circle cx="${(ox + c.x * scale).toFixed(1)}" cy="${(oy + c.y * scale).toFixed(1)}" r="${(c.r * scale).toFixed(1)}" fill="${colour(c.id)}" fill-opacity="0.72" stroke="#2f3a1e" stroke-width="${ring(c.heightCm)}"${c.windbreak ? ' stroke-dasharray="4 2"' : ""}/>`,
      ),
      `<text x="${mark[0]}" y="${mark[1]}" font-size="11" text-anchor="middle">viewer</text>`,
      `<text x="${ox}" y="${oy + ph + 34}" font-size="11">cover ${fmt(layout.cover)} · largest gap ${fmt(layout.largestEmptyPatch)} · CV ${fmt(layout.quadrantCV)} · Z ${fmt(layout.z, 4)} · ${layout.circles.length} plants</text>`,
    ].join("\n");
  };
  const gap = 60;
  const width = Math.max(2 * pw + 3 * gap, 1060);
  const height = ph + 120;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(0)}" height="${height.toFixed(0)}" viewBox="0 0 ${width.toFixed(0)} ${height.toFixed(0)}" font-family="Helvetica, Arial, sans-serif">
<rect width="100%" height="100%" fill="#fbf8ef"/>
<text x="${gap}" y="18" font-size="13">${b.id}: ${b.style}, ${W} x ${L} m, wind ${b.wind}, viewed from the ${b.viewingEdge}. Option 1, same seed. North at the top; ring weight = height; dashed = windbreak.</text>
${panel(b, gap, `Before (rulebook ${before.rulebook})`)}
${panel(a, 2 * gap + pw, `After (rulebook ${after.rulebook})`)}
</svg>
`;
  writeFileSync(join(outDir, `${b.id}.svg`), svg, "utf8");
  console.log(`wrote ${b.id}.svg`);
}
