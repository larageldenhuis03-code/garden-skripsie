/**
 * layout-v2c (D33 relaxation): the comparison table, from
 * reports/layout_v2c/v2c_*.csv and .json (scripts/layout-v2c-run.ts).
 *
 * Run: node --experimental-strip-types scripts/layout-v2c-compare.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join("reports", "layout_v2c");
export const CONFIGS: [string, string][] = [
  ["ap", "engine-final, new rulebook"],
  ["ap_relax", "(a′) + relax"],
  ["b", "D29 (from history)"],
  ["b_relax", "(b) + relax"],
  ["n", "D29b + curve"],
  ["n_relax", "(n) + relax"],
  ["o", "D29b config (o), the layout-v2b default"],
  ["o_relax", "(o) + relax"],
];
export const label = (k: string) =>
  k.replace("ap", "(a′)").replace(/^([bno])(?=_|$)/, "($1)").replace("_relax", " + relax");

type Row = Record<string, string>;

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
const nums = (rows: Row[], key: string) => rows.map((r) => r[key]).filter((x) => x !== "").map(Number).filter(Number.isFinite);
const sum = (rows: Row[], key: string) => nums(rows, key).reduce((s, x) => s + x, 0);

function main() {
  const out: Record<string, Record<string, number | string>> = {};
  const data = new Map<string, Row[]>();
  for (const [key] of CONFIGS) {
    const rows = readCsv(join(DIR, `v2c_${key}.csv`));
    data.set(key, rows);
    const meta = JSON.parse(readFileSync(join(DIR, `v2c_${key}.json`), "utf8"));
    const feas = rows.filter((r) => r.feasible === "true");
    const relaxed = feas.filter((r) => r.relax !== "");
    const accepted = feas.filter((r) => r.relax === "accepted");
    out[key] = {
      rulebook: meta.rulebook,
      briefs: `${new Set(feas.map((r) => r.scenario)).size}/${new Set(rows.map((r) => r.scenario)).size}`,
      options: `${feas.length}/${rows.length}`,
      medianZ: median(nums(feas, "z")),
      cover: median(nums(feas, "cover")),
      patch: median(nums(feas, "largest_empty_patch")),
      cv: median(nums(feas, "quadrant_cv")),
      nineMin: median(nums(feas, "nine_cell_min")),
      nineMed: median(nums(feas, "nine_cell_median")),
      twelve: `${meta.twelve.pass}/${meta.twelve.total}`,
      d24b: meta.d24b.split(" ")[0],
      hardFail: feas.filter((r) => r.hard_failures !== "").length,
      tallFront: sum(feas, "tall_in_front"),
      treesFront: sum(feas, "trees_in_front"),
      accepted: relaxed.length ? `${accepted.length}/${relaxed.length}` : "-",
      move: accepted.length ? median(nums(accepted, "relax_move_cm")) : "-",
      movedCount: accepted.length ? median(nums(accepted, "relax_moved")) : "-",
      movedCm: accepted.length ? median(nums(accepted, "relax_moved_cm")) : "-",
    };
  }
  // Same plans with and without relax: the selection must be identical.
  const sameSelection = (a: string, b: string) => {
    const left = data.get(a)!;
    const right = data.get(b)!;
    if (left.length !== right.length) return "row counts differ";
    const diff = left.filter((r, i) => r.scenario !== right[i].scenario || r.species !== right[i].species || r.z !== right[i].z).length;
    return diff === 0 ? "identical" : `${diff} rows differ`;
  };
  const f = (v: number | string, dp = 3) => (typeof v === "number" ? (Number.isNaN(v) ? "-" : v.toFixed(dp)) : v);
  const ROWS: [string, string, number?][] = [
    ["Briefs feasible (of 101)", "briefs"],
    ["Options feasible", "options"],
    ["Median Z", "medianZ", 4],
    ["Cover (median)", "cover"],
    ["**Largest empty patch (median)**", "patch"],
    ["Quadrant CV (median)", "cv"],
    ["9-cell cover, min (median)", "nineMin"],
    ["9-cell cover, median (median)", "nineMed"],
    ["12-case layering test", "twelve"],
    ["D24 (b) east, option 1", "d24b"],
    ["Options with a hard failure", "hardFail", 0],
    ["Tall (≥ 80 cm) centred in front", "tallFront", 0],
    ["Trees centred in front (straight edge)", "treesFront", 0],
    ["Relaxation accepted (feasible options)", "accepted"],
    ["Median move, all movable plants, accepted plans (cm)", "move", 1],
    ["Plants moved per accepted plan (median)", "movedCount", 0],
    ["Median move of the plants that moved (cm)", "movedCm", 1],
  ];
  console.log(`| Metric | ${CONFIGS.map(([k]) => label(k)).join(" | ")} |`);
  console.log(`|---|${CONFIGS.map(() => "---:").join("|")}|`);
  for (const [name, key, dp] of ROWS) console.log(`| ${name} | ${CONFIGS.map(([k]) => f(out[k][key], dp ?? 3)).join(" | ")} |`);
  console.log(`\nSelection and Z with vs without relax: (a′) ${sameSelection("ap", "ap_relax")}; (b) ${sameSelection("b", "b_relax")}; (n) ${sameSelection("n", "n_relax")}; (o) ${sameSelection("o", "o_relax")}.`);
  // Per-plan patch change where accepted.
  for (const base of ["ap", "b", "n", "o"]) {
    const before = data.get(base)!;
    const after = data.get(`${base}_relax`)!;
    const gains = after
      .map((r, i) => (r.relax === "accepted" ? Number(before[i].largest_empty_patch) - Number(r.largest_empty_patch) : null))
      .filter((x): x is number => x !== null);
    console.log(`${label(base)}: accepted plans' patch shrank by median ${f(median(gains))} (max ${f(gains.length ? Math.max(...gains) : NaN)})`);
  }
  writeFileSync(join(DIR, "summary.json"), JSON.stringify(out, null, 1));
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("scripts/layout-v2c-compare.ts")) main();
