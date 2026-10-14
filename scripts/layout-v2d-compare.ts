/**
 * layout-v2d (D33b): the comparison table, from reports/layout_v2d/v2d_*.csv
 * and .json (scripts/layout-v2d-run.ts), plus the tree checks: overlapping
 * tree canopies, and every tree species with spread under 1 m.
 *
 * Run: node --experimental-strip-types scripts/layout-v2d-compare.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { plants } from "../app/data/plants.ts";

const DIR = join("reports", process.env.V2D_DIR ?? "layout_v2d");
const ALL_CONFIGS: [string, string][] = [
  ["o", "(o), no relaxation"],
  ["d33", "(o) + D33 (current)"],
  ["v1", "(o) + v1 power-diagram Lloyd"],
  ["v2", "v1 + size swaps"],
  ["v3", "v2 + short-plant clamp ±0.15"],
  ["v4", "v3 + gap fill"],
  ["v4b", "v4′: v2 + gap fill (v4 without the short clamp)"],
  ["v5", "v4 + drift split"],
  ["v6", "v4′ + group cohesion (10 cm)"],
  ["v7", "v6 + gap fill beside its own group"],
];
/** V2D_CONFIGS="o,d33,v4b,v6" picks and orders the columns. */
export const CONFIGS: [string, string][] = process.env.V2D_CONFIGS
  ? process.env.V2D_CONFIGS.split(",").map((k) => ALL_CONFIGS.find(([c]) => c === k) as [string, string])
  : ALL_CONFIGS.filter(([k]) => k !== "v6" && k !== "v7");
export const label = (k: string) => (k === "o" ? "(o)" : k === "d33" ? "(o)+D33" : k === "v4b" ? "v4′" : k);

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
    const rows = readCsv(join(DIR, `v2d_${key}.csv`));
    data.set(key, rows);
    const meta = JSON.parse(readFileSync(join(DIR, `v2d_${key}.json`), "utf8"));
    const feas = rows.filter((r) => r.feasible === "true");
    const relaxed = feas.filter((r) => r.relax !== "");
    out[key] = {
      briefs: `${new Set(feas.map((r) => r.scenario)).size}/${new Set(rows.map((r) => r.scenario)).size}`,
      options: `${feas.length}/${rows.length}`,
      medianZ: median(nums(feas, "z")),
      cover: median(nums(feas, "cover")),
      patch: median(nums(feas, "largest_empty_patch")),
      p95: median(nums(feas, "gap_p95_cm")),
      var1m: median(nums(feas, "cell1m_var")),
      cv: median(nums(feas, "quadrant_cv")),
      nineMin: median(nums(feas, "nine_cell_min")),
      twelve: `${meta.twelve.pass}/${meta.twelve.total}`,
      d24b: meta.d24b.split(" ")[0],
      hardFail: feas.filter((r) => r.hard_failures !== "").length,
      atEdge: median(nums(feas, "at_edge")),
      driftGap: nums(feas, "drift_gap_cm").length ? median(nums(feas, "drift_gap_cm")) : "-",
      driftLoose: nums(feas, "drift_loose_share").length ? median(nums(feas, "drift_loose_share")) : "-",
      outside: sum(feas, "outside_bed"),
      removed: nums(feas, "d33_removed").length ? sum(feas, "d33_removed") : "-",
      added: nums(feas, "d33_added").length ? `${sum(feas, "d33_added")} in ${feas.filter((r) => Number(r.d33_added) > 0).length} options` : "-",
      accepted: relaxed.length ? `${feas.filter((r) => r.relax === "accepted").length}/${relaxed.length}` : "-",
      swaps: nums(feas, "relax_swaps").length ? sum(feas, "relax_swaps") : "-",
      treeSame: sum(feas, "tree_overlap_same"),
      treeDiff: sum(feas, "tree_overlap_diff"),
      tallFront: sum(feas, "tall_in_front"),
      treesFront: sum(feas, "trees_in_front"),
    };
  }
  const f = (v: number | string, dp = 3) => (typeof v === "number" ? (Number.isNaN(v) ? "-" : v.toFixed(dp)) : v);
  const ROWS: [string, string, number?][] = [
    ["Briefs feasible (of 101)", "briefs"],
    ["Options feasible", "options"],
    ["Median Z", "medianZ", 4],
    ["Cover (median)", "cover"],
    ["**Largest gap (median)**", "patch"],
    ["95th-pct gap, cm (median)", "p95", 1],
    ["1 m-cell cover variance (median)", "var1m", 4],
    ["Quadrant CV (median)", "cv"],
    ["9-cell cover, min (median)", "nineMin"],
    ["12-case layering test", "twelve"],
    ["D24 (b) east, option 1", "d24b"],
    ["Options with a hard failure", "hardFail", 0],
    ["Plants touching a bed edge (median per option)", "atEdge", 0],
    ["Drift gap: grouped plant to nearest group-mate, cm (median)", "driftGap", 1],
    ["Share of grouped plants > 10 cm from any group-mate (median)", "driftLoose"],
    ["**Plants outside the bed (must be 0)**", "outside", 0],
    ["**Plants removed by D33 (must be 0)**", "removed", 0],
    ["Plants added (v4)", "added"],
    ["Relaxation accepted", "accepted"],
    ["Size swaps kept", "swaps", 0],
    ["Tree canopies overlapping: same species / different", "treeSame", 0],
    ["Tall (≥ 80 cm) centred in front", "tallFront", 0],
    ["Trees centred in front (straight edge)", "treesFront", 0],
  ];
  console.log(`| Metric | ${CONFIGS.map(([k]) => label(k)).join(" | ")} |`);
  console.log(`|---|${CONFIGS.map(() => "---:").join("|")}|`);
  for (const [name, key, dp] of ROWS) {
    const cell = (k: string) => (key === "treeSame" ? `${out[k].treeSame} / ${out[k].treeDiff}` : f(out[k][key], dp ?? 3));
    console.log(`| ${name} | ${CONFIGS.map(([k]) => cell(k)).join(" | ")} |`);
  }
  const same = (a: string, b: string) => {
    const l = data.get(a)!;
    const r = data.get(b)!;
    return l.length === r.length && l.every((x, i) => x.scenario === r[i].scenario && x.z === r[i].z) ? "identical" : "differ";
  };
  console.log(`\nZ per option vs (o): ${CONFIGS.slice(1).map(([k]) => `${label(k)} ${same("o", k)}`).join("; ")}.`);

  // Trees with spread under 1 m, and how often each is chosen.
  const chosen = new Map<string, number>();
  for (const r of (data.get("d33") ?? data.get(CONFIGS[0][0])!).filter((x) => x.feasible === "true")) {
    for (const id of new Set(r.species.split(" ").filter(Boolean).map((s) => s.split("x")[0]))) chosen.set(id, (chosen.get(id) ?? 0) + 1);
  }
  const small = plants
    .filter((p) => (p.plantType ?? []).includes("tree") && p.spreadCm !== null && p.spreadCm < 100)
    .sort((a, b) => (a.spreadCm ?? 0) - (b.spreadCm ?? 0) || a.id.localeCompare(b.id));
  console.log(`\nTree species with spread < 1 m: ${small.length}\n`);
  console.log("| ID | Species | Height (cm) | Spread (cm) | Spread source | Imputed? | Flag | Options in (o)+D33 |");
  console.log("|---|---|---:|---:|---|---|---|---:|");
  for (const p of small) {
    const flag = (p as { spreadOutlierFlag?: string | null }).spreadOutlierFlag ?? "";
    console.log(`| ${p.id} | ${p.scientificName} | ${p.heightCm} | ${p.spreadCm} | ${p.spreadSource ?? "-"} | ${p.spreadConfidence === "imputed" ? "yes" : p.spreadConfidence ?? "unknown"} | ${flag} | ${chosen.get(p.id) ?? 0} |`);
  }
  writeFileSync(join(DIR, "summary.json"), JSON.stringify(out, null, 1));
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("scripts/layout-v2d-compare.ts")) main();
