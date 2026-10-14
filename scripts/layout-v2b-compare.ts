/**
 * layout-v2b: the comparison tables, from reports/layout_v2b/v2b_*.csv and
 * .json (written by scripts/layout-v2b-run.ts).
 *
 * Run: node --experimental-strip-types scripts/layout-v2b-compare.ts
 * Prints markdown (main table, dominance table, layering detail) and
 * writes reports/layout_v2b/summary.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join("reports", "layout_v2b");
export const CONFIGS: [string, string][] = [
  ["ap", "engine-final, new rulebook"],
  ["b", "D29 (from history)"],
  ["m", "D29b: gradient + tree rule + fill"],
  ["n", "(m) + curve"],
  ["o", "(n) + placement order"],
  ["p", "(o) + drift split"],
  ["q", "(p) + D32"],
  ["qo", "(o) + D32"],
];
export const label = (k: string) => (k === "ap" ? "(a′)" : k === "qo" ? "(q′)" : `(${k})`);

type Row = Record<string, string>;
type Meta = {
  rulebook: string; dataset: string; configLine: string;
  twelve: { pass: number; total: number; failures: string[] }; d24b: string; b1223b1172: string[];
};

function readCsv(path: string): Row[] {
  const [head, ...lines] = readFileSync(path, "utf8").trim().split(/\r?\n/);
  const keys = head.split(",");
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
        else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    return Object.fromEntries(keys.map((k, i) => [k, cells[i] ?? ""]));
  });
}

const median = (v: number[]) => {
  if (!v.length) return NaN;
  const s = [...v].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const mean = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN);
const nums = (rows: Row[], key: string) => rows.map((r) => r[key]).filter((x) => x !== "").map(Number);
const sum = (rows: Row[], key: string) => nums(rows, key).reduce((s, x) => s + x, 0);

/** "north: B1223 0.53, B1172 0.71; short 0.20" per edge -> how many edges
 * have both tall plants behind the short ones, and none in the front 0.35. */
function b12Summary(lines: string[], edge: number): string {
  let behind = 0;
  let notFront = 0;
  for (const line of lines) {
    const t = [...line.matchAll(/B1(?:223|172) ([\d.]+|unplaced)/g)].map((m) => m[1]);
    const short = Number(/short ([\d.]+)/.exec(line)?.[1] ?? NaN);
    const depths = t.map(Number);
    if (depths.every((d) => Number.isFinite(d) && d > short)) behind += 1;
    if (depths.every((d) => Number.isFinite(d) && d >= edge)) notFront += 1;
  }
  return `behind ${behind}/${lines.length}, out of front ${notFront}/${lines.length}`;
}

function main() {
  const data = new Map<string, Row[]>();
  const meta = new Map<string, Meta>();
  for (const [key] of CONFIGS) {
    data.set(key, readCsv(join(DIR, `v2b_${key}.csv`)));
    meta.set(key, JSON.parse(readFileSync(join(DIR, `v2b_${key}.json`), "utf8")));
  }
  const edge = (meta.get("ap") as unknown as { bands: { edgeFrontMid: number } }).bands.edgeFrontMid;
  const feasibleSet = (rows: Row[]) => new Set(rows.filter((r) => r.feasible === "true").map((r) => r.scenario));
  const base = feasibleSet(data.get("ap")!);

  const out: Record<string, Record<string, number | string>> = {};
  for (const [key] of CONFIGS) {
    const rows = data.get(key)!;
    const feas = rows.filter((r) => r.feasible === "true");
    const fs = feasibleSet(rows);
    const m = meta.get(key)!;
    out[key] = {
      rulebook: m.rulebook,
      briefsFeasible: `${fs.size}/${new Set(rows.map((r) => r.scenario)).size}`,
      optionsFeasible: `${feas.length}/${rows.length}`,
      clean: rows.filter((r) => r.success === "true").length / rows.length,
      medianZ: median(nums(feas, "z")),
      meanA4: mean(nums(feas, "A4")),
      twelve: `${m.twelve.pass}/${m.twelve.total}`,
      d24b: m.d24b.split(" ")[0],
      b12: b12Summary(m.b1223b1172, edge),
      patch: median(nums(feas, "largest_empty_patch")),
      cv: median(nums(feas, "quadrant_cv")),
      nineMin: median(nums(feas, "nine_cell_min")),
      nineMed: median(nums(feas, "nine_cell_median")),
      tallFront: sum(feas, "tall_in_front"),
      treesFront: sum(feas, "trees_in_front"),
      treesFrontEff: nums(feas, "trees_in_front_eff").length ? sum(feas, "trees_in_front_eff") : "-",
      hardFail: feas.filter((r) => r.hard_failures !== "").length,
      lost: [...base].filter((s) => !fs.has(s)).length,
      gained: [...fs].filter((s) => !base.has(s)).length,
      dropped: sum(rows, "engine_dropped"),
      selectedArea: median(nums(feas, "selected_area")),
      fillers: median(nums(feas, "filler_plants")),
      d32Short: rows.some((r) => r.d32_moves !== "0") ? `${feas.filter((r) => r.d32_short === "cover").length} cover / ${feas.filter((r) => r.d32_short === "filler").length} filler` : "-",
      d32Moves: rows.some((r) => r.d32_moves !== "0") ? sum(rows, "d32_moves") : "-",
    };
  }

  const f = (v: number | string, dp = 3) => (typeof v === "number" ? (Number.isNaN(v) ? "-" : v.toFixed(dp)) : v);
  const ROWS: [string, string, number?][] = [
    ["Briefs feasible (of 101)", "briefsFeasible"],
    ["Options feasible", "optionsFeasible"],
    ["Clean-result share (options)", "clean"],
    ["Median Z", "medianZ", 4],
    ["Mean A4", "meanA4"],
    ["12-case layering test", "twelve"],
    ["D24 (b) east, option 1", "d24b"],
    ["B1223 / B1172 (4 edges)", "b12"],
    ["Largest empty patch (median)", "patch"],
    ["Quadrant CV (median)", "cv"],
    ["9-cell cover, min (median)", "nineMin"],
    ["9-cell cover, median (median)", "nineMed"],
    ["Tall (≥ 80 cm) centred in front (report)", "tallFront", 0],
    ["**Trees centred in front, straight edge**", "treesFront", 0],
    ["**Trees centred in front, rule's d_eff (must be 0)**", "treesFrontEff", 0],
    ["Options with a hard failure", "hardFail", 0],
    ["Briefs lost / gained vs (a′)", "lost", 0],
    ["Species dropped by the fail rule", "dropped", 0],
    ["Selected area / bed (median)", "selectedArea"],
    ["Filler plants per option (median)", "fillers", 1],
    ["D32 moves (raise or add)", "d32Moves", 0],
    ["Options where D32 missed a target (cover / filler)", "d32Short", 0],
  ];
  const lines = [
    `| Metric | ${CONFIGS.map(([k]) => label(k)).join(" | ")} |`,
    `|---|${CONFIGS.map(() => "---:").join("|")}|`,
    ...ROWS.map(([name, key, dp]) =>
      `| ${name} | ${CONFIGS.map(([k]) => (key === "lost" ? `${out[k].lost} / ${out[k].gained}` : f(out[k][key], dp ?? 3))).join(" | ")} |`),
  ];
  console.log(lines.join("\n"));

  // Dominance: the 10 species in the most options, per config.
  console.log("\nTop-10 species by number of feasible options they appear in (of the feasible options):\n");
  const tops = CONFIGS.map(([k]) => {
    const feas = data.get(k)!.filter((r) => r.feasible === "true");
    const count = new Map<string, number>();
    for (const r of feas) for (const s of new Set(r.species.split(" ").filter(Boolean).map((x) => x.split("x")[0]))) count.set(s, (count.get(s) ?? 0) + 1);
    return { k, n: feas.length, top: [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10) };
  });
  console.log(`| Rank | ${tops.map((t) => label(t.k)).join(" | ")} |`);
  console.log(`|---:|${tops.map(() => "---").join("|")}|`);
  for (let i = 0; i < 10; i += 1) {
    console.log(`| ${i + 1} | ${tops.map((t) => (t.top[i] ? `${t.top[i][0]} (${t.top[i][1]})` : "-")).join(" | ")} |`);
  }
  console.log(`| Top-10 share | ${tops.map((t) => `${(t.top.reduce((s, x) => s + x[1], 0) / Math.max(1, t.n)).toFixed(2)} per option`).join(" | ")} |`);

  console.log("\nLayering detail:\n");
  for (const [k, d] of CONFIGS) {
    const m = meta.get(k)!;
    console.log(`- ${label(k)} ${d}: ${m.configLine}`);
    console.log(`  - D24 (b) east 1: ${m.d24b}`);
    if (m.twelve.failures.length) console.log(`  - 12-case fails: ${m.twelve.failures.join("; ")}`);
    console.log(`  - B1223 / B1172 depth (fraction from viewer): ${m.b1223b1172.join(" | ")}`);
  }
  writeFileSync(join(DIR, "summary.json"), JSON.stringify({ out, tops }, null, 1));
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("scripts/layout-v2b-compare.ts")) main();
