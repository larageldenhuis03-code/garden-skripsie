/**
 * What stops a bed reaching 80% cover?
 *
 * Diagnostic only. V8 forces every style to an 80% floor, yet 76 of 93
 * plans fall short - and not because of group-size caps, packing, or the
 * plant pool. This switches candidate rules off one at a time, in memory,
 * on top of V8, and measures which one releases the cover. A rule that
 * releases it is the wall; nothing here is a proposal to remove it.
 *
 * Run: node --experimental-strip-types scripts/coverage-wall.ts
 */

import { plants } from "../app/data/plants.ts";
import { buildGardenPlan, PLACEMENT, RULES, SEARCH } from "../app/lib/planning/index.ts";
import { buildScenarios } from "./batch-test/scenarios.ts";
import { spreadMetrics } from "./batch-test/metrics.ts";

type Bag = Record<string, unknown>;
const setPath = (object: Bag, key: string, value: unknown) => {
  const before = object[key];
  object[key] = value;
  return () => {
    object[key] = before;
  };
};
const styles = RULES.styles as unknown as Record<string, Bag>;
const stage2 = RULES.stage2 as unknown as Bag;
const stage4 = RULES.stage4 as unknown as Bag;

/** V8: contact bonus 0, every style at an 80% floor, cover_max 1.0. */
function v8(): () => void {
  const undo = [
    setPath(PLACEMENT as unknown as Bag, "contactBonus", 0),
    setPath(SEARCH as unknown as Bag, "coverMinHard", true),
  ];
  for (const key of Object.keys(styles)) {
    undo.push(setPath(styles[key], "coverMin", 0.8));
    undo.push(setPath(styles[key], "coverMax", 1.0));
  }
  return () => undo.forEach((u) => u());
}

const CASES: { name: string; apply: () => () => void }[] = [
  { name: "V8 as is", apply: () => () => {} },
  {
    name: "V8, H5 off (any species may be any share of the plants)",
    apply: () => {
      const undo = Object.keys(styles).map((k) => setPath(styles[k], "rMax", 1.0));
      return () => undo.forEach((u) => u());
    },
  },
  {
    name: "V8, H2 doubled (twice as many species allowed)",
    apply: () => {
      const bands = stage2.speciesBands as Bag[];
      const undo = bands.map((band) => setPath(band, "sMax", (band.sMax as number) * 2));
      return () => undo.forEach((u) => u());
    },
  },
  {
    name: "V8, P2 overlap allowance 0.15 -> 0.30",
    apply: () => setPath(stage4, "overlapDelta", 0.3),
  },
  {
    name: "V8, packer tries 4x the spots per plant",
    apply: () => {
      const placement = PLACEMENT as unknown as Bag;
      return setPath(placement, "randomDraws", (placement.randomDraws as number) * 4);
    },
  },
  {
    name: "V8, packer 4x spots and 3x restarts",
    apply: () => {
      const placement = PLACEMENT as unknown as Bag;
      const undo = [
        setPath(placement, "randomDraws", (placement.randomDraws as number) * 4),
        setPath(placement, "restarts", (placement.restarts as number) * 3),
      ];
      return () => undo.forEach((u) => u());
    },
  },
];
const ONLY = process.env.WALL_ONLY;

const median = (values: number[]) => {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (s.length === 0) return NaN;
  const r = 0.5 * (s.length - 1);
  const lo = Math.floor(r);
  return s[lo] + (s[Math.ceil(r)] - s[lo]) * (r - lo);
};

const scenarios = buildScenarios();
console.log("case | plannable | median cover | median empty | cover >= 80% | empty <= 20% | fail-rule retries");
const undoV8 = v8();
try {
  for (const c of CASES) {
    if (ONLY && !c.name.includes(ONLY)) continue;
    const started = performance.now();
    const undo = c.apply();
    try {
      const cover: number[] = [];
      const empty: number[] = [];
      let retried = 0;
      for (const s of scenarios) {
        const plan = buildGardenPlan(plants, s.brief);
        const layout = plan.layout;
        if (!layout || plan.status !== "provisional-plan") continue;
        cover.push(1 - plan.openSpaceRatio);
        empty.push(spreadMetrics(layout.placements, layout.bedWidthM, layout.bedLengthM).emptyCellShare);
        if (plan.diagnostics.some((d) => d.startsWith("Retrying at no more than"))) retried += 1;
      }
      console.log(
        [
          c.name,
          cover.length,
          median(cover).toFixed(3),
          median(empty).toFixed(3),
          cover.filter((v) => v >= 0.8 - 1e-9).length,
          empty.filter((v) => v <= 0.2 + 1e-9).length,
          retried,
          `${Math.round((performance.now() - started) / 1000)}s`,
        ].join(" | "),
      );
    } finally {
      undo();
    }
  }
} finally {
  undoV8();
}
