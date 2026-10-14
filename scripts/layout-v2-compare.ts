/**
 * layout-v2 Step 4: the comparison table, from reports/layout_v2/v2_*.csv
 * (one per configuration, written by scripts/layout-v2-run.ts).
 *
 * Run: node --experimental-strip-types scripts/layout-v2-compare.ts
 * Prints a markdown table (metrics as rows, configurations as columns) and
 * writes reports/layout_v2/summary.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join("reports", "layout_v2");
export const CONFIGS: [string, string][] = [
  ["a", "engine-final, archived rulebook"],
  ["ap", "engine-final, new rulebook"],
  ["b", "+D29"],
  ["bp", "+D29, no in-band gradient"],
  ["c", "+D29+D30, k 0.10"],
  ["d", "+D29+D30, k 0.15"],
  ["e", "+D29+D30, k 0.20"],
  ["f", "(d) no straddle"],
  ["g", "(d) no curve"],
  ["h", "(d) no shares"],
  ["j", "(d) no placement order"],
  ["i", "(d) contact_bonus 0"],
];
const LABEL: Record<string, string> = { a: "(a)", ap: "(a′)", b: "(b)", bp: "(b′)" };
const label = (k: string) => LABEL[k] ?? `(${k})`;

function readCsv(path: string): Record<string, string>[] {
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
const nums = (rows: Record<string, string>[], key: string) => rows.map((r) => r[key]).filter((x) => x !== "").map(Number);
const sum = (rows: Record<string, string>[], key: string) => nums(rows, key).reduce((s, x) => s + x, 0);

type Summary = Record<string, number | string>;

function main() {
const data = new Map<string, Record<string, string>[]>();
const meta = new Map<string, { rulebook: string; dataset: string; configLine: string; twelve: { pass: number; total: number; failures: string[] } }>();
for (const [key] of CONFIGS) {
  data.set(key, readCsv(join(DIR, `v2_${key}.csv`)));
  meta.set(key, JSON.parse(readFileSync(join(DIR, `v2_${key}.json`), "utf8")));
}

const feasibleSet = (rows: Record<string, string>[]) =>
  new Set(rows.filter((r) => r.feasible === "true").map((r) => r.scenario));
const baseFeasible = feasibleSet(data.get("a")!);
const v2 = (k: string) => k !== "a" && k !== "ap";

const out: Record<string, Summary> = {};
for (const [key] of CONFIGS) {
  const rows = data.get(key)!;
  const feas = rows.filter((r) => r.feasible === "true");
  const fs = feasibleSet(rows);
  const briefs = new Set(rows.map((r) => r.scenario));
  const m = meta.get(key)!;
  out[key] = {
    rulebook: m.rulebook,
    briefsFeasible: `${fs.size}/${briefs.size}`,
    optionsFeasible: `${feas.length}/${rows.length}`,
    success: feas.length ? rows.filter((r) => r.success === "true").length / rows.length : NaN,
    medianZ: median(nums(feas, "z")),
    meanA4: mean(nums(feas, "A4")),
    twelve: `${m.twelve.pass}/${m.twelve.total}`,
    patch: median(nums(feas, "largest_empty_patch")),
    cv: median(nums(feas, "quadrant_cv")),
    nineMin: median(nums(feas, "nine_cell_min")),
    nineMed: median(nums(feas, "nine_cell_median")),
    tallFront: sum(feas, "tall_in_front"),
    hardFail: feas.filter((r) => r.hard_failures !== "").length,
    lostVsA: [...baseFeasible].filter((s) => !fs.has(s)).length,
    gainedVsA: [...fs].filter((s) => !baseFeasible.has(s)).length,
    engineDropped: sum(rows, "engine_dropped"),
    straddling: v2(key) ? sum(feas, "straddling") : "-",
    fallbacks: v2(key) ? sum(feas, "fallbacks") : "-",
    tiebreaks: v2(key) ? sum(feas, "tiebreaks") : "-",
    shareViolations: v2(key) ? sum(feas, "share_violations") : "-",
    fillRanOut: v2(key) ? new Set(feas.filter((r) => r.fill_ran_out === "true").map((r) => r.scenario)).size : "-",
  };
}

const f = (v: number | string, dp = 3) => (typeof v === "number" ? (Number.isNaN(v) ? "-" : v.toFixed(dp)) : v);
const ROWS: [string, string, number?][] = [
  ["Rulebook", "rulebook"],
  ["Briefs feasible (of 101)", "briefsFeasible"],
  ["Options feasible", "optionsFeasible"],
  ["SUCCESS share (options, no drop/unplaced/hard fail)", "success"],
  ["Median Z", "medianZ", 4],
  ["Mean A4", "meanA4"],
  ["12-case layering test", "twelve"],
  ["Largest empty patch (median)", "patch"],
  ["Quadrant CV (median)", "cv"],
  ["9-cell cover, min (median)", "nineMin"],
  ["9-cell cover, median (median)", "nineMed"],
  ["**Tall plants centred in front (must be 0)**", "tallFront", 0],
  ["Options with a hard failure", "hardFail", 0],
  ["Briefs lost vs (a)", "lostVsA", 0],
  ["Briefs gained vs (a)", "gainedVsA", 0],
  ["Species dropped by the fail rule", "engineDropped", 0],
  ["Straddling plants", "straddling", 0],
  ["Fallbacks to skeleton (R15)", "fallbacks", 0],
  ["Tiebreaks (overlap zones)", "tiebreaks", 0],
  ["Share violations (R10)", "shareViolations", 0],
  ["Briefs where the front fill ran out", "fillRanOut", 0],
];
const lines = [
  `| Metric | ${CONFIGS.map(([k]) => label(k)).join(" | ")} |`,
  `|---|${CONFIGS.map(() => "---:").join("|")}|`,
  ...ROWS.map(([name, key, dp]) => `| ${name} | ${CONFIGS.map(([k]) => f(out[k][key], dp ?? 3)).join(" | ")} |`),
];
console.log(lines.join("\n"));
console.log();
for (const [k, d] of CONFIGS) console.log(`${label(k)} ${d}: ${meta.get(k)!.configLine}${meta.get(k)!.twelve.failures.length ? ` | 12-case fails: ${meta.get(k)!.twelve.failures.join("; ")}` : ""}`);
writeFileSync(join(DIR, "summary.json"), JSON.stringify(out, null, 1));
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("scripts/layout-v2-compare.ts")) main();
