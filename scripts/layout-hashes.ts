/**
 * One hash per batch scenario over all its options' placements, to count
 * how many briefs a change moves. Run: node --experimental-strip-types
 * scripts/layout-hashes.ts OUT.json
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

import { plants } from "../app/data/plants.ts";
import { buildGardenPlanVariants, RULES_VERSION } from "../app/lib/planning/index.ts";
import { buildScenarios } from "./batch-test/scenarios.ts";

const out: Record<string, { hash: string; viewingEdge: string; wind: string; profile: string }> = {};
for (const s of buildScenarios()) {
  const variants = buildGardenPlanVariants(plants, s.brief);
  const shape = variants.map((v) => (v.layout?.placements ?? []).map((p) => `${p.plantId}@${p.xM.toFixed(4)},${p.yM.toFixed(4)}`));
  out[s.id] = {
    hash: createHash("sha256").update(JSON.stringify(shape)).digest("hex").slice(0, 16),
    viewingEdge: s.brief.viewingEdge ?? "north",
    wind: s.brief.wind,
    profile: variants[0]?.engine?.windProfile ?? "-",
  };
}
writeFileSync(process.argv[2], JSON.stringify({ rulebook: RULES_VERSION, scenarios: out }, null, 1), "utf8");
console.log(`${Object.keys(out).length} scenarios hashed on ${RULES_VERSION}`);
