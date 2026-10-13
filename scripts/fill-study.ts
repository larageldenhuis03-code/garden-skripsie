/**
 * Ground-cover fill: how far does each rule change take the bed?
 *
 * Measurement only, in memory, on the 100 coverage-test gardens. Every
 * case uses the owner's target - cover_min 0.90 for every style, cover_max
 * 1.0 - and the contact bonus at 0, then adds one rule change at a time:
 *
 *   ref   no fill: what the packer reaches on its own
 *   F1    fill with the plan's ground cover, every rule as it stands
 *   F2    + ground cover and matrix exempt from H5 (share of the plants)
 *   F3    + exempt from H3 (the ladder of group sizes)
 *   F4    + ground cover may tuck under a taller plant's edge
 *   F5    + a ground cover is added when the plan has none
 *
 * "Bare" is the real share of the bed with no canopy over it, sampled on a
 * 20 x 20 grid, so overlapping circles are never counted twice.
 *
 * Run: node --experimental-strip-types scripts/fill-study.ts
 */

import { writeFileSync } from "node:fs";
import { plants } from "../app/data/plants.ts";
import { buildGardenPlan, PLACEMENT, RULES, RULES_VERSION, SEARCH } from "../app/lib/planning/index.ts";
import { buildScenarios } from "./batch-test/scenarios.ts";
import { spreadMetrics } from "./batch-test/metrics.ts";

type Bag = Record<string, unknown>;
const set = (o: Bag, k: string, v: unknown) => {
  const before = o[k];
  o[k] = v;
  return () => {
    o[k] = before;
  };
};
const styles = RULES.styles as unknown as Record<string, Bag>;

const BASE = (): (() => void)[] => {
  const undo = [set(PLACEMENT as unknown as Bag, "contactBonus", 0)];
  for (const k of Object.keys(styles)) {
    undo.push(set(styles[k], "coverMin", 0.9));
    undo.push(set(styles[k], "coverMax", 1.0));
  }
  return undo;
};

const CASES: [string, string, Record<string, unknown>][] = [
  ["ref", "no fill, target 90%", {}],
  ["F1", "+ ground-cover fill", { groundCoverFill: true }],
  ["F2", "+ base layer exempt from H5", { groundCoverFill: true, fillExemptH5: true }],
  ["F3", "+ exempt from H3", { groundCoverFill: true, fillExemptH5: true, fillExemptH3: true }],
  ["F4", "+ may tuck under taller plants", { groundCoverFill: true, fillExemptH5: true, fillExemptH3: true, fillUnderDelta: 1.0 }],
  ["F5", "+ add a ground cover if none", { groundCoverFill: true, fillExemptH5: true, fillExemptH3: true, fillUnderDelta: 1.0, fillAddSpecies: true }],
];

const median = (v: number[]) => {
  const s = v.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const r = 0.5 * (s.length - 1);
  const lo = Math.floor(r);
  return s[lo] + (s[Math.ceil(r)] - s[lo]) * (r - lo);
};
const pctile = (v: number[], q: number) => {
  const s = v.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const r = q * (s.length - 1);
  const lo = Math.floor(r);
  return s[lo] + (s[Math.ceil(r)] - s[lo]) * (r - lo);
};

const scenarios = buildScenarios();
const lines: string[] = [];
const header =
  "| case | change | gardens | median bare | worst 10% bare | bare <= 20% | bare <= 10% | hard-rule failures | median Z | median A1 | median plants | time |";
console.log(header);
lines.push(header, "|---|---|---|---|---|---|---|---|---|---|---|---|");

for (const [id, label, flags] of CASES) {
  const undo = BASE();
  for (const [k, v] of Object.entries(flags)) undo.push(set(SEARCH as unknown as Bag, k, v));
  const started = performance.now();
  const bare: number[] = [];
  const z: number[] = [];
  const a1: number[] = [];
  const count: number[] = [];
  let hardFails = 0;
  try {
    for (const s of scenarios) {
      const plan = buildGardenPlan(plants, s.brief);
      const layout = plan.layout;
      if (!layout || plan.status !== "provisional-plan") continue;
      bare.push(spreadMetrics(layout.placements, layout.bedWidthM, layout.bedLengthM).emptyCellShare);
      if (plan.engine) {
        z.push(plan.engine.z);
        a1.push(plan.engine.goals.A1);
        const failed =
          plan.engine.hard.some((h) => !h.pass) ||
          plan.engine.placementChecks.some((c) => c.kind === "hard" && !c.pass);
        if (failed) hardFails += 1;
      }
      count.push(layout.placements.length);
    }
  } finally {
    undo.forEach((u) => u());
  }
  const row =
    `| ${id} | ${label} | ${bare.length} | ${median(bare).toFixed(3)} | ${pctile(bare, 0.9).toFixed(3)} | ` +
    `${bare.filter((b) => b <= 0.2 + 1e-9).length} | ${bare.filter((b) => b <= 0.1 + 1e-9).length} | ${hardFails} | ` +
    `${median(z).toFixed(4)} | ${median(a1).toFixed(3)} | ${median(count).toFixed(0)} | ` +
    `${Math.round((performance.now() - started) / 1000)}s |`;
  console.log(row);
  lines.push(row);
}

writeFileSync(
  "reports/fill_study.md",
  [
    "# Ground-cover fill study",
    "",
    `Measurement only. Rulebook as imported (\`${RULES_VERSION}\`), with every style's`,
    "cover_min at 0.90 and cover_max at 1.0 in memory, and the contact bonus at 0.",
    "100 garden briefs; medians over those that produced a plan.",
    "",
    ...lines,
    "",
  ].join("\n"),
  "utf8",
);
