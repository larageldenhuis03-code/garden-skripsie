/**
 * Does the emptiest-block preference help at any weight?
 *
 * V3 at 0.25 came out worse than V2 on the largest empty patch. This runs
 * the same 100 scenarios across a range of weights, so the answer is
 * "the weight was wrong" or "the idea is wrong" rather than a guess.
 *
 * Measurement only; the seams are restored to their shipped values at the
 * end. Medians over every scenario that produced a layout.
 *
 * Run: node --experimental-strip-types scripts/block-weight-sweep.ts
 */
import { plants } from "../app/data/plants.ts";
import { buildGardenPlan, PLACEMENT } from "../app/lib/planning/index.ts";
import { buildScenarios } from "./batch-test/scenarios.ts";
import { spreadMetrics } from "./batch-test/metrics.ts";

const scenarios = buildScenarios();
const settings = PLACEMENT as unknown as Record<string, number>;
const contact0 = settings.contactBonus;
const block0 = settings.emptiestBlockWeight;
const median = (values: number[]) => {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted.length === 0 ? NaN : sorted[Math.floor((sorted.length - 1) / 2)];
};

const CASES: [string, number, number][] = [
  ["V0  contact 0.05, block 0   ", 0.05, 0],
  ["V2  contact 0,    block 0   ", 0, 0],
  ["    contact 0,    block 0.10", 0, 0.1],
  ["V3  contact 0,    block 0.25", 0, 0.25],
  ["    contact 0,    block 0.50", 0, 0.5],
  ["    contact 0.05, block 0.25", 0.05, 0.25],
];

try {
  console.log("weight      n   cover  empty  patch     CV");
  for (const [label, contact, block] of CASES) {
    settings.contactBonus = contact;
    settings.emptiestBlockWeight = block;
    const cover: number[] = [];
    const empty: number[] = [];
    const patch: number[] = [];
    const cv: number[] = [];
    for (const scenario of scenarios) {
      const plan = buildGardenPlan(plants, scenario.brief);
      const layout = plan.layout;
      if (!layout) continue;
      const m = spreadMetrics(layout.placements, layout.bedWidthM, layout.bedLengthM);
      cover.push(1 - plan.openSpaceRatio);
      empty.push(m.emptyCellShare);
      patch.push(m.largestEmptyPatch);
      cv.push(m.quadrantCV);
    }
    console.log(
      `${label}  ${String(cover.length).padStart(3)}  ${median(cover).toFixed(3)}  ${median(empty).toFixed(3)}  ${median(patch).toFixed(3)}  ${median(cv).toFixed(3)}`,
    );
  }
} finally {
  settings.contactBonus = contact0;
  settings.emptiestBlockWeight = block0;
}
