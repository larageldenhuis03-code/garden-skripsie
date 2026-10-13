/**
 * Why do Mediterranean beds have the biggest empty patches?
 *
 * Diagnostic only - no engine change. Runs the 100 coverage-test scenarios
 * on the engine as imported (V0) and compares the Mediterranean plans with
 * every other style on the things that could leave a hole: how close cover
 * gets to the style's own cover_min, which plant types are chosen, how big
 * they are, how many species against the H2 ceiling, whether a feature
 * plant is present, and where the largest empty patch sits.
 *
 * On this branch the first option is laid out from the north edge, so
 * "front", "middle" and "back" are thirds of the bed measured from north.
 *
 * Run: node --experimental-strip-types scripts/mediterranean-diagnostic.ts
 * Writes: reports/mediterranean_diagnostic.md
 */

import { writeFileSync } from "node:fs";

import { plants } from "../app/data/plants.ts";
import {
  bandFor,
  buildGardenPlan,
  isFeaturePlant,
  roleTypeOf,
  RULES,
  RULES_VERSION,
  type GardenPlan,
} from "../app/lib/planning/index.ts";
import { buildScenarios } from "./batch-test/scenarios.ts";
import { GRID, plantedCells } from "./batch-test/metrics.ts";

const byId = new Map(plants.map((plant) => [plant.id, plant]));
const styleRules = RULES.styles as unknown as Record<string, { coverMin: number; coverMax: number }>;

const median = (values: number[]) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return NaN;
  const rank = 0.5 * (sorted.length - 1);
  const low = Math.floor(rank);
  return sorted[low] + (sorted[Math.ceil(rank)] - sorted[low]) * (rank - low);
};
const f = (value: number, dp = 3) => (Number.isFinite(value) ? value.toFixed(dp) : "-");
const pct = (value: number) => `${(value * 100).toFixed(0)}%`;

type Stats = {
  plan: GardenPlan;
  style: string;
  cover: number;
  coverMin: number;
  species: number;
  sMax: number;
  diameters: number[];
  types: string[];
  feature: boolean;
  patchShare: number;
  patchBand: "front" | "middle" | "back";
  patchByFeature: boolean;
};

/** The largest edge-connected empty region, as cell indices. */
function largestPatch(cells: readonly boolean[]): number[] {
  const seen = new Array<boolean>(cells.length).fill(false);
  let best: number[] = [];
  for (let start = 0; start < cells.length; start += 1) {
    if (cells[start] || seen[start]) continue;
    const region: number[] = [];
    const stack = [start];
    seen[start] = true;
    while (stack.length > 0) {
      const index = stack.pop() as number;
      region.push(index);
      const row = Math.floor(index / GRID);
      const col = index % GRID;
      for (const n of [
        row > 0 ? index - GRID : -1,
        row < GRID - 1 ? index + GRID : -1,
        col > 0 ? index - 1 : -1,
        col < GRID - 1 ? index + 1 : -1,
      ]) {
        if (n >= 0 && !cells[n] && !seen[n]) {
          seen[n] = true;
          stack.push(n);
        }
      }
    }
    if (region.length > best.length) best = region;
  }
  return best;
}

function measure(plan: GardenPlan, style: string): Stats | null {
  const layout = plan.layout;
  const groups = plan.quantities?.quantities ?? [];
  if (!layout || groups.length === 0) return null;
  const W = layout.bedWidthM;
  const L = layout.bedLengthM;
  const placed = layout.placements.flatMap((p) => {
    const plant = byId.get(p.plantId);
    return plant ? [{ p, plant }] : [];
  });
  const cells = plantedCells(layout.placements, W, L);
  const patch = largestPatch(cells);

  // Where the patch sits: its centroid's distance from the north edge.
  const rowOf = (index: number) => Math.floor(index / GRID);
  const colOf = (index: number) => index % GRID;
  const centroidY =
    patch.length === 0 ? L / 2 : (patch.reduce((s, i) => s + rowOf(i) + 0.5, 0) / patch.length / GRID) * L;
  const third = centroidY / L;
  const patchBand = third < 1 / 3 ? "front" : third < 2 / 3 ? "middle" : "back";

  // Next to a feature plant: any patch cell within one cell of a feature
  // plant's canopy edge.
  const cellM = Math.max(W, L) / GRID;
  const features = placed.filter(({ plant }) => isFeaturePlant(plant));
  const patchByFeature = patch.some((index) => {
    const x = ((colOf(index) + 0.5) / GRID) * W;
    const y = ((rowOf(index) + 0.5) / GRID) * L;
    return features.some(({ p }) => Math.hypot(x - p.xM, y - p.yM) - p.radiusM <= cellM);
  });

  const key = style === "undecided" ? "generic" : style;
  return {
    plan,
    style,
    cover: 1 - plan.openSpaceRatio,
    coverMin: styleRules[key].coverMin,
    species: groups.length,
    sMax: bandFor(W * L).sMax,
    diameters: placed.map(({ plant }) => (plant.spreadCm ?? 0) / 100),
    types: placed.map(({ plant }) => roleTypeOf(plant, isFeaturePlant(plant)) ?? "untyped"),
    feature: features.length > 0,
    patchShare: patch.length / cells.length,
    patchBand,
    patchByFeature,
  };
}

function main(): void {
  const all: Stats[] = [];
  for (const scenario of buildScenarios()) {
    const stats = measure(buildGardenPlan(plants, scenario.brief), scenario.brief.style);
    if (stats) all.push(stats);
  }
  const med = all.filter((s) => s.style === "mediterranean");
  const rest = all.filter((s) => s.style !== "mediterranean");
  const groups: [string, Stats[]][] = [
    ["Mediterranean", med],
    ["Other styles", rest],
    ...["fynbos", "cottage", "undecided"].map(
      (style) => [style[0].toUpperCase() + style.slice(1), all.filter((s) => s.style === style)] as [string, Stats[]],
    ),
  ];

  const row = (name: string, g: Stats[]) => {
    const ratio = median(g.map((s) => s.cover / s.coverMin));
    const atCeiling = g.filter((s) => s.species >= s.sMax).length;
    return (
      `| ${name} (${g.length}) | ${f(median(g.map((s) => s.cover)))} | ${f(median(g.map((s) => s.coverMin)), 2)} | ` +
      `${f(ratio, 2)} | ${f(median(g.flatMap((s) => s.diameters)), 2)} m | ` +
      `${f(median(g.map((s) => s.species)), 1)} of ${f(median(g.map((s) => s.sMax)), 0)} | ${atCeiling} | ` +
      `${g.filter((s) => s.feature).length} | ${f(median(g.map((s) => s.patchShare)))} |`
    );
  };

  const typeShare = (g: Stats[]) => {
    const counts = new Map<string, number>();
    let total = 0;
    for (const s of g) for (const t of s.types) { counts.set(t, (counts.get(t) ?? 0) + 1); total += 1; }
    return { counts, total };
  };
  const medTypes = typeShare(med);
  const restTypes = typeShare(rest);
  const typeKeys = [...new Set([...medTypes.counts.keys(), ...restTypes.counts.keys()])].sort(
    (a, b) => (medTypes.counts.get(b) ?? 0) / medTypes.total - (medTypes.counts.get(a) ?? 0) / medTypes.total,
  );

  const where = (g: Stats[]) => {
    const n = g.length || 1;
    const band = (b: string) => g.filter((s) => s.patchBand === b).length;
    return (
      `${band("front")} front (${pct(band("front") / n)}), ${band("middle")} middle (${pct(band("middle") / n)}), ` +
      `${band("back")} back (${pct(band("back") / n)}); next to a feature plant in ` +
      `${g.filter((s) => s.patchByFeature).length} (${pct(g.filter((s) => s.patchByFeature).length / n)})`
    );
  };

  // The cause, read from the figures rather than written in advance.
  const medRatio = median(med.map((s) => s.cover / s.coverMin));
  const restRatio = median(rest.map((s) => s.cover / s.coverMin));
  const medCover = median(med.map((s) => s.cover));
  const restCover = median(rest.map((s) => s.cover));
  const medMin = median(med.map((s) => s.coverMin));
  const medDiam = median(med.flatMap((s) => s.diameters));
  const restDiam = median(rest.flatMap((s) => s.diameters));

  const otherMins = rest.map((s) => s.coverMin);
  const lowestTarget = medMin <= Math.min(...otherMins) + 1e-9;
  const stopsAtTarget = medRatio >= 0.9 && medRatio <= 1.2;
  const lowerCover = medCover < restCover - 0.02;
  const sizeNote =
    medDiam > restDiam * 1.1
      ? `Plant size is also a factor: the median canopy is ${f(medDiam, 2)} m against ${f(restDiam, 2)} m for the other styles.`
      : medDiam < restDiam * 0.9
        ? `Plant size points the other way: Mediterranean canopies are smaller (${f(medDiam, 2)} m against ${f(restDiam, 2)} m), which on its own would fill gaps more evenly, not less.`
        : `Plant size is not a factor: the median canopy is ${f(medDiam, 2)} m against ${f(restDiam, 2)} m for the other styles.`;
  const cause: string[] =
    lowestTarget && stopsAtTarget && lowerCover
      ? [
          `Mediterranean has the lowest cover_min of any style (${f(medMin, 2)}), and its plans stop`,
          `close to it: median cover ${f(medCover)}, ${f(medRatio, 2)}x its cover_min, against ${f(restCover)}`,
          `(${f(restRatio, 2)}x) for the other styles. Goal A4 is min(1, planted / (cover_min x bed)), so`,
          `once a Mediterranean bed reaches ${pct(medMin)} cover A4 is already at 1 and the search has`,
          "no reason to plant more. What is left bare collects into one large patch.",
          "",
          "This agrees with the coverage test: V1, which raised every style's target to",
          "0.95, was the best version for Mediterranean beds on the largest patch (0.180",
          "against 0.251 for V0) while making most other styles worse. Raising the target",
          "helps exactly the style whose target is lowest.",
          "",
          sizeNote,
          "",
          "If the hole is a problem rather than the style's intended openness, the targeted",
          "change is Mediterranean's cover_min, not a placement rule. That is a rulebook",
          "value and is left for the owner to decide.",
          "",
        ]
      : [
          "The low cover target does not explain it on these figures:",
          `Mediterranean's cover_min is ${f(medMin, 2)} (${lowestTarget ? "the lowest" : "not the lowest"} of the styles),`,
          `its plans reach ${f(medRatio, 2)}x that target, and its median cover is ${f(medCover)} against ${f(restCover)}.`,
          "",
          sizeNote,
          "",
          "Read the side-by-side table for the measure that differs most; no single cause",
          "is supported strongly enough to state.",
          "",
        ];

  const md = [
    "# Mediterranean diagnostic",
    "",
    "**Measurement only. No engine change.** The 100 coverage-test scenarios on",
    `the engine as imported (V0, rulebook \`${RULES_VERSION}\`), Mediterranean plans`,
    "against every other style. Medians over plans that produced a layout.",
    "",
    "## Side by side",
    "",
    "| | cover | its cover_min | cover / cover_min | canopy diameter | species of H2 max | at the H2 ceiling | with a feature plant | largest empty patch |",
    "|---|---|---|---|---|---|---|---|---|",
    ...groups.map(([name, g]) => row(name, g)),
    "",
    "## Plant types chosen (share of placed plants)",
    "",
    "| type | Mediterranean | other styles |",
    "|---|---|---|",
    ...typeKeys.map(
      (t) =>
        `| ${t} | ${pct((medTypes.counts.get(t) ?? 0) / medTypes.total)} | ${pct((restTypes.counts.get(t) ?? 0) / restTypes.total)} |`,
    ),
    "",
    "## Where the largest empty patch sits",
    "",
    "Thirds of the bed from the north edge, which this branch treats as the front.",
    "",
    `- **Mediterranean:** ${where(med)}.`,
    `- **Other styles:** ${where(rest)}.`,
    "",
    "## Most likely cause",
    "",
    ...cause,
  ].join("\n");

  writeFileSync("reports/mediterranean_diagnostic.md", md, "utf8");
  console.log(md);
}

main();
