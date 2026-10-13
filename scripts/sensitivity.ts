/**
 * Do the Stage 1 weights and lambda actually change the answer?
 *
 * Each weight is moved +/- 20% on its own, and the ranking recomputed. The
 * scores are NOT re-implemented here: `scorePlantStage1` already returns
 * every term's value and weight separately, so a perturbed score is
 *
 *   raw'    = sum over active terms of value * weight'
 *   score'  = raw' / rawMax'      (rawMax' = sum of active weights')
 *
 * which is exactly what the engine computes, with one weight replaced.
 * b_wind is tied to w_style in the rulebook, so moving style moves wind
 * with it - that pairing is tested as its own case.
 *
 * lambda is Stage 2, not Stage 1: Z = lambda * S_bar + (1 - lambda) *
 * sum(w_r A_r). It is reported separately, as the share of Z that moves.
 *
 * Run: npm run study:sensitivity
 */

import { plants } from "../app/data/plants.ts";
import {
  RULES,
  scorePlantStage1,
  survivesHardFilters,
  type GardenBrief,
  type Stage1Score,
} from "../app/lib/planning/index.ts";
import { STAGE1_WEIGHTS } from "../app/lib/planning/stage1Config.ts";

type TermName = keyof Stage1Score["terms"];
const TERMS: TermName[] = ["style", "colour", "extras", "saved", "wind"];
const TOP_N = 20;

const base: GardenBrief = {
  biomes: ["Fynbos"], bioregion: "Southwest Fynbos Bioregion", soil: "sandy",
  wind: "affected", viewingEdge: "north", sun: "full", water: "moderate",
  bedWidthM: 6, bedLengthM: 4, style: "fynbos",
  colour: { mode: "scheme", scheme: "warm" }, extras: ["pollinators", "fragrance"],
};

const BRIEFS: [string, GardenBrief][] = [
  ["fynbos, warm, wind", base],
  ["mediterranean, no colour", { ...base, style: "mediterranean", colour: { mode: "none" }, extras: [] }],
  ["cottage, cool, calm", { ...base, style: "cottage", wind: "none", colour: { mode: "scheme", scheme: "cool" }, extras: ["wildlife"] }],
];

/** Rank the pool under a weight multiplier applied to one term. */
function ranked(brief: GardenBrief, scores: Stage1Score[], term: TermName | null, factor: number): string[] {
  return scores
    .map((s) => {
      let raw = 0;
      let rawMax = 0;
      for (const name of TERMS) {
        const t = s.terms[name];
        if (!t.active) continue;
        // Wind moves with style: they share w_style in the rulebook.
        const scaled = term !== null && (name === term || (term === "style" && name === "wind"));
        const weight = scaled ? t.weight * factor : t.weight;
        raw += t.value * weight;
        rawMax += weight;
      }
      return { id: s.plantId, score: rawMax > 0 ? raw / rawMax : 0 };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((x) => x.id);
}

const overlap = (a: string[], b: string[]) => {
  const top = new Set(a.slice(0, TOP_N));
  return b.slice(0, TOP_N).filter((id) => top.has(id)).length / TOP_N;
};

function main(): void {
  console.log("Stage 1 weight sensitivity: does +/- 20% change who ranks top?\n");
  console.log("  Weights: " + JSON.stringify(STAGE1_WEIGHTS));
  console.log(`  Comparison: overlap of the top ${TOP_N}, and whether the single top plant changes.\n`);

  for (const [label, brief] of BRIEFS) {
    const pool = plants.filter((p) => p.layoutEligible && survivesHardFilters(p, brief));
    const scores = pool.map((p) => scorePlantStage1(p, { brief, savedPlantIds: [] }));
    const baseline = ranked(brief, scores, null, 1);
    const active = TERMS.filter((t) => scores.some((s) => s.terms[t].active));

    // Ties matter for reading the overlap: if hundreds of plants share the
    // top score, the top 20 is decided by the id tiebreak and an unchanged
    // overlap says nothing about the weights.
    const values = scores.map((s) => s.score);
    const distinct = new Set(values.map((v) => v.toFixed(6))).size;
    const sorted = [...values].sort((a, b) => b - a);
    const tiedTop = values.filter((v) => Math.abs(v - sorted[0]) < 1e-9).length;
    const tiedCut = values.filter((v) => Math.abs(v - sorted[Math.min(TOP_N - 1, sorted.length - 1)]) < 1e-9).length;
    console.log(`  ${label}  (pool ${pool.length}, active terms: ${active.join(", ") || "none"})`);
    console.log(`    distinct scores ${distinct} | ${tiedTop} plants tie at the top score ${sorted[0].toFixed(4)} | ${tiedCut} tie at the top-${TOP_N} cut`);
    console.log("    term        -20% overlap  top changed   +20% overlap  top changed");
    for (const term of TERMS) {
      if (!active.includes(term)) {
        console.log(`    ${term.padEnd(12)}inactive for this brief`);
        continue;
      }
      const down = ranked(brief, scores, term, 0.8);
      const up = ranked(brief, scores, term, 1.2);
      const note = term === "style" ? "  (with wind, they share w_style)" : "";
      console.log(
        `    ${term.padEnd(12)}${(overlap(baseline, down) * 100).toFixed(0).padStart(8)}%` +
          `${(down[0] === baseline[0] ? "  no" : "  YES").padEnd(14)}` +
          `${(overlap(baseline, up) * 100).toFixed(0).padStart(8)}%` +
          `${(up[0] === baseline[0] ? "  no" : "  YES")}${note}`,
      );
    }
    console.log("");
  }

  // lambda: Stage 2's balance between the plant scores and the goals.
  const lambda = RULES.stage2.lambda;
  console.log("  lambda (Stage 2, Z = lambda*S_bar + (1-lambda)*sum w_r A_r)");
  console.log(`    rulebook lambda ${lambda}; at +/- 20% it is ${(lambda * 0.8).toFixed(2)} and ${(lambda * 1.2).toFixed(2)}.`);
  console.log("    lambda cannot reorder PLANTS - it never enters Stage 1. It reweights whole");
  console.log("    selections, so its effect is on which mix wins, measured below as the change");
  console.log("    in Z for a bed scoring S_bar and the goal sum G.");
  console.log("");
  console.log("      S_bar  G      Z(0.40)  Z(0.50)  Z(0.60)  spread");
  for (const [sBar, g] of [[0.9, 0.6], [0.7, 0.8], [0.6, 0.95], [0.8, 0.8]] as [number, number][]) {
    const z = (l: number) => l * sBar + (1 - l) * g;
    const spread = Math.abs(z(lambda * 1.2) - z(lambda * 0.8));
    console.log(
      `      ${sBar.toFixed(2)}   ${g.toFixed(2)}   ${z(0.4).toFixed(4)}   ${z(0.5).toFixed(4)}   ${z(0.6).toFixed(4)}   ${spread.toFixed(4)}`,
    );
  }
  console.log("");
  console.log("    Z moves by |S_bar - G| * 0.2 when lambda moves 20%, so lambda only matters");
  console.log("    where a selection's plant scores and its goal scores disagree.");
}

main();
