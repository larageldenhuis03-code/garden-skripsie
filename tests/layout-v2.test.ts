// layout-v2 Step 3: the height-band tests (D29/D30), owner prompt 14 Oct 2026.
// The all-briefs tests run the 100 batch scenarios once (about 2.5 minutes)
// and share the result.
import assert from "node:assert/strict";
import test from "node:test";

import { plants } from "../app/data/plants.ts";
import {
  buildGardenPlanVariants,
  computeHeightTiers,
  computeSpreadBands,
  createRng,
  placeSelection,
  RULES,
  scorePlantStage1,
  speciesInfo,
  viewingAxis,
  type GardenBrief,
  type SpeciesInfo,
} from "../app/lib/planning/index.ts";
import { buildScenarios } from "../scripts/batch-test/scenarios.ts";

const hb = RULES.stage4.heightBands;
const heightOf = new Map(plants.map((p) => [p.id, p.heightCm]));
type Band = "front" | "middle" | "back";
const BANDS: Band[] = ["front", "middle", "back"];
const bandAt = (d: number): Band => (d < hb.edgeFrontMid ? "front" : d < hb.edgeMidBack ? "middle" : "back");

type Placed = { plantId: string; instanceId: string; band: Band; depth: number };
type Option = { brief: string; option: string; placed: Placed[]; hardFails: string[] };

function optionsFor(id: string, brief: GardenBrief): Option[] {
  return buildGardenPlanVariants(plants, brief).flatMap((plan) => {
    const layout = plan.layout;
    if (!layout) return [];
    const axis = viewingAxis(brief.viewingEdge, layout.bedWidthM, layout.bedLengthM);
    const placed = layout.placements.map((p) => {
      const depth = axis.depthOf(p.xM, p.yM) / axis.span;
      return { plantId: p.plantId, instanceId: p.instanceId, depth, band: bandAt(depth) };
    });
    const hardFails = (plan.engine?.placementChecks ?? [])
      .filter((c) => c.kind === "hard" && !c.pass)
      .map((c) => `${c.id}: ${c.detail}`);
    return [{ brief: id, option: plan.character, placed, hardFails }];
  });
}

let cache: Option[] | null = null;
function allOptions(): Option[] {
  if (!cache) cache = buildScenarios().flatMap((s) => optionsFor(s.id, s.brief));
  return cache;
}

/** Spearman's rho with average ranks for ties; null when either side is constant. */
function spearman(a: number[], b: number[]): number | null {
  const ranks = (v: number[]) => {
    const order = v.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
    const r = new Array<number>(v.length);
    for (let i = 0; i < order.length; ) {
      let j = i;
      while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j += 1;
      for (let k = i; k <= j; k += 1) r[order[k][1]] = (i + j) / 2;
      i = j + 1;
    }
    return r;
  };
  const ra = ranks(a);
  const rb = ranks(b);
  const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const ma = mean(ra);
  const mb = mean(rb);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i += 1) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : null;
}

function median(v: number[]): number {
  const s = [...v].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

// ---------------------------------------------------------------------------
// B1223 and B1172: the two type-based layer errors D29 was built to fix
// ---------------------------------------------------------------------------

test("B1223 (2 m bi/annual) and B1172 (1 m ground cover) are never centred in the front band", () => {
  // B1223 is never chosen in the batch, so both are placed directly, with
  // short plants competing for the front, from every viewing edge.
  const tiers = computeHeightTiers(plants);
  const spreads = computeSpreadBands(plants);
  const ids = ["B1223", "B1172"];
  const short = plants
    .filter((p) => p.heightCm !== null && p.heightCm < hb.hMiddleMin && p.spreadCm !== null && p.spreadCm >= 30 && p.spreadCm <= 60)
    .slice(0, 2)
    .map((p) => p.id);
  assert.equal(short.length, 2);
  for (const edge of ["north", "east", "south", "west"] as const) {
    const brief: GardenBrief = {
      biomes: ["Fynbos"],
      bioregion: "Southwest Fynbos Bioregion",
      soil: "sandy",
      wind: "none",
      viewingEdge: edge,
      sun: "full",
      water: "moist",
      bedWidthM: 8,
      bedLengthM: 6,
      style: "undecided",
      colour: { mode: "none" },
      extras: [],
    };
    const infos = new Map<string, SpeciesInfo>();
    for (const id of [...ids, ...short]) {
      const plant = plants.find((p) => p.id === id);
      assert.ok(plant, `${id} is not in the catalogue`);
      const info = speciesInfo(plant, scorePlantStage1(plant, { brief, savedPlantIds: [] }).score, tiers, spreads, 48);
      assert.ok(info, `${id}: no species info`);
      infos.set(id, info);
    }
    const selection = new Map<string, number>([["B1223", 3], ["B1172", 1], ...short.map((id) => [id, 3] as [string, number])]);
    const result = placeSelection(
      selection,
      infos,
      { widthM: 8, depthM: 6, windSite: 0, rowsAvailable: 0, frontEdge: edge },
      createRng(`b1223-${edge}`),
    );
    const axis = viewingAxis(edge, 8, 6);
    for (const id of ids) {
      const mine = result.layout.placements.filter((p) => p.plantId === id);
      assert.ok(mine.length > 0, `${edge}: ${id} was not placed`);
      for (const p of mine) {
        const d = axis.depthOf(p.xM, p.yM) / axis.span;
        assert.ok(d >= hb.edgeFrontMid, `${edge}: ${p.instanceId} centred in the front band (depth ${d.toFixed(2)})`);
      }
    }
  }
});

test("B1172 is never centred in the front band in any batch option it appears in", () => {
  const hits = allOptions().flatMap((o) =>
    o.placed.filter((p) => p.plantId === "B1172" || p.plantId === "B1223").map((p) => ({ o, p })),
  );
  assert.ok(hits.length > 0, "expected B1172 in at least one batch option");
  for (const { o, p } of hits) {
    assert.notEqual(p.band, "front", `${o.brief} ${o.option}: ${p.instanceId} at depth ${p.depth.toFixed(2)}`);
  }
});

// ---------------------------------------------------------------------------
// All 100 briefs, every option
// ---------------------------------------------------------------------------

test("no plant taller than h_back_min is centred in the front band (100 briefs, every option)", () => {
  const options = allOptions();
  assert.ok(options.length >= 250, `only ${options.length} options were laid out`);
  const bad: string[] = [];
  for (const o of options) {
    for (const p of o.placed) {
      const h = heightOf.get(p.plantId);
      if (h !== null && h !== undefined && h > hb.hBackMin && p.band === "front") {
        bad.push(`${o.brief} ${o.option} ${p.instanceId} (${h} cm, depth ${p.depth.toFixed(2)})`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test("every hard placement check passes in every option of the 100 briefs", () => {
  const bad = allOptions().flatMap((o) => o.hardFails.map((f) => `${o.brief} ${o.option} ${f}`));
  assert.deepEqual(bad, []);
});

test("in-band gradient: median Spearman rho(height, depth) > 0 within each band", () => {
  // Per option and band: rho over the plants centred there (3+ plants, 2+
  // heights). Per brief: the mean over its options. Then the median across
  // briefs, per band.
  const perBrief = new Map<string, Record<Band, number[]>>();
  for (const o of allOptions()) {
    const acc = perBrief.get(o.brief) ?? { front: [], middle: [], back: [] };
    perBrief.set(o.brief, acc);
    for (const band of BANDS) {
      const inBand = o.placed.filter((p) => p.band === band && heightOf.get(p.plantId) != null);
      if (inBand.length < 3) continue;
      const rho = spearman(
        inBand.map((p) => heightOf.get(p.plantId) as number),
        inBand.map((p) => p.depth),
      );
      if (rho !== null) acc[band].push(rho);
    }
  }
  for (const band of BANDS) {
    const values = [...perBrief.values()]
      .filter((a) => a[band].length > 0)
      .map((a) => a[band].reduce((s, x) => s + x, 0) / a[band].length);
    assert.ok(values.length >= 20, `${band}: only ${values.length} briefs have a measurable gradient`);
    const m = median(values);
    assert.ok(m > 0, `${band}: median rho ${m.toFixed(3)} over ${values.length} briefs`);
  }
});

// ---------------------------------------------------------------------------
// The fixed case: 6 x 2 m fynbos, south view, part sun, moist
// ---------------------------------------------------------------------------

test("fixed case 6 x 2 m fynbos, south view, part sun, moist: valid, banded, layered", () => {
  const brief: GardenBrief = {
    biomes: ["Fynbos"],
    bioregion: "Southwest Fynbos Bioregion",
    soil: "sandy",
    wind: "none",
    viewingEdge: "south",
    sun: "part",
    water: "moist",
    bedWidthM: 6,
    bedLengthM: 2,
    style: "fynbos",
    colour: { mode: "none" },
    extras: [],
  };
  const options = optionsFor("fixed", brief);
  assert.ok(options.length > 0, "no option was laid out");
  for (const o of options) {
    assert.deepEqual(o.hardFails, [], o.option);
    for (const p of o.placed) {
      const h = heightOf.get(p.plantId);
      if (h != null && h > hb.hBackMin) assert.notEqual(p.band, "front", `${o.option} ${p.instanceId} (${h} cm)`);
    }
    const mean = (pick: (h: number) => boolean) => {
      const xs = o.placed.filter((p) => {
        const h = heightOf.get(p.plantId);
        return h != null && pick(h);
      });
      return xs.length ? xs.reduce((s, p) => s + p.depth, 0) / xs.length : null;
    };
    const tall = mean((h) => h >= hb.hBackMin);
    const short = mean((h) => h <= hb.hFrontMax);
    if (tall !== null && short !== null) {
      assert.ok(tall > short, `${o.option}: tall ${tall.toFixed(2)}, short ${short.toFixed(2)}`);
    }
  }
});
