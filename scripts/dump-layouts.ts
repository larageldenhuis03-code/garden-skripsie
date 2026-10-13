/**
 * Option 1's layout for a few batch scenarios, as JSON, for the
 * before/after figures. Kept free of anything newer than the baseline
 * commit so it runs unchanged on old and new code.
 *
 * Run: node --experimental-strip-types scripts/dump-layouts.ts OUT.json S081 S001 S004
 */
import { writeFileSync } from "node:fs";

import { plants } from "../app/data/plants.ts";
import { buildGardenPlanVariants, RULES_VERSION } from "../app/lib/planning/index.ts";
import { buildScenarios } from "./batch-test/scenarios.ts";
import { spreadMetrics } from "./batch-test/metrics.ts";

const [out, ...ids] = process.argv.slice(2);
const byId = new Map(plants.map((p) => [p.id, p]));
const scenarios = buildScenarios().filter((s) => ids.includes(s.id));
const result = scenarios.map((scenario) => {
  const plan = buildGardenPlanVariants(plants, scenario.brief)[0];
  const layout = plan.layout;
  const metrics = layout ? spreadMetrics(layout.placements, layout.bedWidthM, layout.bedLengthM) : null;
  return {
    id: scenario.id,
    style: scenario.brief.style,
    wind: scenario.brief.wind,
    viewingEdge: scenario.brief.viewingEdge ?? "north",
    widthM: scenario.brief.bedWidthM,
    lengthM: scenario.brief.bedLengthM,
    status: plan.status,
    z: plan.engine?.z ?? null,
    cover: plan.status === "provisional-plan" ? 1 - plan.openSpaceRatio : null,
    largestEmptyPatch: metrics?.largestEmptyPatch ?? null,
    quadrantCV: metrics?.quadrantCV ?? null,
    circles: (layout?.placements ?? []).map((p) => ({
      id: p.plantId,
      x: p.xM,
      y: p.yM,
      r: p.radiusM,
      heightCm: byId.get(p.plantId)?.heightCm ?? null,
      windbreak: Boolean((p as { windbreakRow?: boolean }).windbreakRow),
    })),
  };
});
writeFileSync(out, JSON.stringify({ rulebook: RULES_VERSION, layouts: result }, null, 1), "utf8");
console.log(`${result.length} layouts on rulebook ${RULES_VERSION} -> ${out}`);
