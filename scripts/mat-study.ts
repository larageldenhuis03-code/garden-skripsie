/**
 * Ground cover as a mat: measured against V0 and V2 on the same 100
 * scenarios with the same seeds.
 *
 *   V0  the engine as imported.
 *   V2  contact-point preference 0 (the agreed base).
 *   M   V2, with true carpeters (L6 ground-cover / moss types) laid as a
 *       mat between the specimens: area x density, open_min left bare.
 *
 * MEASUREMENT ONLY, in memory: every override is undone after its run and
 * the rulebook is never re-imported. The mat spacing factor (0.6 x spread)
 * is an unsourced ASSUMPTION.
 *
 * Run: node --experimental-strip-types scripts/mat-study.ts
 * Writes: reports/mat_study.md, reports/mat_study.csv and
 *         reports/figures/mat_study/*.svg
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { plants } from "../app/data/plants.ts";
import {
  bandFor,
  buildGardenPlan,
  buildGardenPlanVariants,
  minCentreDistance,
  PLACEMENT,
  RULES,
  RULES_VERSION,
  SEARCH,
  type GardenPlan,
} from "../app/lib/planning/index.ts";
import { buildScenarios, type Scenario } from "./batch-test/scenarios.ts";
import { spreadMetrics } from "./batch-test/metrics.ts";

const OUT = "reports";
const FIG = join(OUT, "figures", "mat_study");

type Bag = Record<string, unknown>;
const setPath = (object: Bag, key: string, value: unknown) => {
  const before = object[key];
  object[key] = value;
  return () => {
    object[key] = before;
  };
};

type Version = { id: "V0" | "V2" | "M"; label: string; apply: () => () => void };
const VERSIONS: Version[] = [
  { id: "V0", label: "the engine as imported", apply: () => () => {} },
  {
    id: "V2",
    label: "contact-point preference 0",
    apply: () => setPath(PLACEMENT as unknown as Bag, "contactBonus", 0),
  },
  {
    id: "M",
    label: "V2 + ground cover laid as a mat (spacing 0.6 x spread, ASSUMPTION)",
    apply: () => {
      const undo = [
        setPath(PLACEMENT as unknown as Bag, "contactBonus", 0),
        setPath(SEARCH as unknown as Bag, "matModel", true),
      ];
      return () => undo.forEach((u) => u());
    },
  },
];

const styleRules = RULES.styles as unknown as Record<string, { openMin: number; openMax: number }>;
const styleKeyOf = (style: string) => (style === "undecided" ? "generic" : style);

/** Engine hard checks (Stage 2 on the selection, Stage 4 on placement),
 * plus an independent P1/P2 pass over the specimen circles. */
function violationsOf(plan: GardenPlan): string[] {
  const out: string[] = [];
  for (const check of plan.engine?.hard ?? []) if (!check.pass) out.push(check.id);
  for (const check of plan.engine?.placementChecks ?? []) {
    if (check.kind === "hard" && !check.pass) out.push(check.id);
  }
  const layout = plan.layout;
  if (layout) {
    const list = layout.placements;
    if (
      list.some(
        (p) =>
          p.xM - p.radiusM < -1e-6 ||
          p.yM - p.radiusM < -1e-6 ||
          p.xM + p.radiusM > layout.bedWidthM + 1e-6 ||
          p.yM + p.radiusM > layout.bedLengthM + 1e-6,
      )
    ) {
      out.push("P1*");
    }
    outer: for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (Math.hypot(a.xM - b.xM, a.yM - b.yM) < minCentreDistance(a.radiusM, b.radiusM) - 1e-6) {
          out.push("P2*");
          break outer;
        }
      }
    }
  }
  return [...new Set(out)];
}

type Row = {
  version: string;
  id: string;
  style: string;
  bed: string;
  bedAreaM2: number;
  feasible: boolean;
  violations: string;
  /** Engine's figure: summed canopy area / bed (counts overlaps twice). */
  nominalCover: number;
  /** Share of the bed with nothing over it, on a 60 x 60 grid. */
  bare: number;
  openMin: number;
  openMax: number;
  band: "below open_min" | "within" | "above open_max" | "-";
  largestEmptyPatch: number;
  quadrantCV: number;
  z: number | null;
  species: number;
  circles: number;
  carpeters: number;
  matAreaM2: number;
  matShare: number;
  matPlants: number;
  totalPlants: number;
  /** Mat species, ;-separated; shade patch area; whether the search had
   * picked a carpeter itself; carpeters the mat rules took out; whether the
   * plan now has more species than H2's s_max. */
  matSpecies: string;
  shadeAreaM2: number;
  searchCarpeter: boolean;
  removedFromPlan: number;
  overSMax: boolean;
  ms: number;
};

const r4 = (v: number) => Number(v.toFixed(4));

/** Bare share on a 60 x 60 grid of cell centres - the mat's own raster, so
 * a mat that leaves exactly open_min bare is measured as exactly that. */
const FINE = 60;
function bareFine(layout: NonNullable<GardenPlan["layout"]>): number {
  const W = layout.bedWidthM;
  const L = layout.bedLengthM;
  const mat = layout.mat && layout.mat.grid === FINE ? new Set(layout.mat.cells) : null;
  let bare = 0;
  for (let index = 0; index < FINE * FINE; index += 1) {
    if (mat?.has(index)) continue;
    const x = ((index % FINE) + 0.5) * (W / FINE);
    const y = (Math.floor(index / FINE) + 0.5) * (L / FINE);
    if (!layout.placements.some((p) => (x - p.xM) ** 2 + (y - p.yM) ** 2 <= p.radiusM * p.radiusM)) bare += 1;
  }
  return bare / (FINE * FINE);
}
/** Half a raster cell either way counts as on the boundary. */
const ON_EDGE = 0.5 / (FINE * FINE);

function runVersion(version: Version, scenarios: Scenario[], keep: Map<string, GardenPlan>): Row[] {
  const undo = version.apply();
  const rows: Row[] = [];
  try {
    for (const scenario of scenarios) {
      const { brief } = scenario;
      const started = performance.now();
      const plan = buildGardenPlan(plants, brief);
      const ms = performance.now() - started;
      keep.set(`${version.id}:${scenario.id}`, plan);
      const layout = plan.layout;
      const feasible = plan.status === "provisional-plan" && layout !== null;
      const { openMin, openMax } = styleRules[styleKeyOf(brief.style)];
      const metrics = layout
        ? spreadMetrics(layout.placements, layout.bedWidthM, layout.bedLengthM, layout.mat)
        : { emptyCellShare: 1, largestEmptyPatch: 1, quadrantCV: 0 };
      const quantities = plan.quantities?.quantities ?? [];
      const matRows = quantities.filter((q) => q.mat);
      const area = brief.bedWidthM * brief.bedLengthM;
      const bare = layout ? bareFine(layout) : 1;
      rows.push({
        version: version.id,
        id: scenario.id,
        style: brief.style,
        bed: `${brief.bedWidthM}x${brief.bedLengthM}`,
        bedAreaM2: r4(area),
        feasible,
        violations: feasible ? violationsOf(plan).join("+") : "",
        nominalCover: feasible ? r4(1 - plan.openSpaceRatio) : 0,
        bare: r4(bare),
        openMin,
        openMax,
        band: !feasible
          ? "-"
          : bare < openMin - ON_EDGE
            ? "below open_min"
            : bare > openMax + ON_EDGE
              ? "above open_max"
              : "within",
        largestEmptyPatch: r4(metrics.largestEmptyPatch),
        quadrantCV: r4(metrics.quadrantCV),
        z: plan.engine ? r4(plan.engine.z) : null,
        species: quantities.length,
        circles: layout?.placements.length ?? 0,
        carpeters: matRows.length,
        matAreaM2: r4(layout?.mat?.areaM2 ?? 0),
        matShare: r4((layout?.mat?.areaM2 ?? 0) / area),
        matPlants: matRows.reduce((sum, q) => sum + q.quantity, 0),
        totalPlants: quantities.reduce((sum, q) => sum + q.quantity, 0),
        matSpecies: (layout?.mat?.species ?? []).map((s) => s.plantId).join(";"),
        shadeAreaM2: r4(layout?.mat?.shadeAreaM2 ?? 0),
        searchCarpeter: (layout?.mat?.chosenBySearch.length ?? 0) > 0,
        removedFromPlan: layout?.mat?.removedFromPlan.length ?? 0,
        overSMax: feasible && quantities.length > bandFor(area).sMax,
        ms: Math.round(ms),
      });
    }
  } finally {
    undo();
  }
  return rows;
}

// ------------------------------------------------------------- statistics

function percentile(values: number[], fraction: number): number {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (s.length === 0) return NaN;
  const rank = fraction * (s.length - 1);
  const lo = Math.floor(rank);
  return s[lo] + (s[Math.ceil(rank)] - s[lo]) * (rank - lo);
}
const fmt = (v: number, dp = 3) => (Number.isFinite(v) ? v.toFixed(dp) : "-");
const spread = (values: number[], dp = 3) =>
  `${fmt(percentile(values, 0.5), dp)} (${fmt(percentile(values, 0.1), dp)}-${fmt(percentile(values, 0.9), dp)})`;
const pct = (n: number, d: number) => `${n} / ${d}`;

// ---------------------------------------------------------------- figures

const PALETTE = ["#6d7f3a", "#9c6b3f", "#4f7a8a", "#a2496b", "#7b6aa8", "#b08d2c", "#3f6e4f", "#8a4f3a"];

function figure(scenario: Scenario, before: GardenPlan, after: GardenPlan, label: string): string {
  const lb = before.layout!;
  const la = after.layout!;
  const W = lb.bedWidthM;
  const L = lb.bedLengthM;
  const scale = Math.min(360 / W, 300 / L);
  const pw = W * scale;
  const ph = L * scale;
  const carpeters = new Set((la.mat?.species ?? []).map((s) => s.plantId));
  const colourOf = (() => {
    const ids = [...new Set([...lb.placements, ...la.placements].map((p) => p.plantId))].sort();
    return (id: string) => (carpeters.has(id) ? "#c9d27a" : PALETTE[ids.indexOf(id) % PALETTE.length]);
  })();
  const grid = (ox: number) => {
    const lines: string[] = [];
    for (let x = 1; x < W; x += 1) lines.push(`<line x1="${ox + x * scale}" y1="${40}" x2="${ox + x * scale}" y2="${40 + ph}" />`);
    for (let y = 1; y < L; y += 1) lines.push(`<line x1="${ox}" y1="${40 + y * scale}" x2="${ox + pw}" y2="${40 + y * scale}" />`);
    return `<g stroke="#d9d2bd" stroke-width="0.6">${lines.join("")}</g>`;
  };
  const circles = (ox: number, list: typeof lb.placements) =>
    list
      .map(
        (p) =>
          `<circle cx="${(ox + p.xM * scale).toFixed(1)}" cy="${(40 + p.yM * scale).toFixed(1)}" r="${(p.radiusM * scale).toFixed(1)}" fill="${colourOf(p.plantId)}" fill-opacity="0.78" stroke="#2f3a1e" stroke-width="0.7" />`,
      )
      .join("");
  const mat = (ox: number) => {
    const m = la.mat;
    if (!m) return "";
    const cw = (W / m.grid) * scale;
    const ch = (L / m.grid) * scale;
    // Merge each row's runs into one rect so the texture has no seams.
    const rects: string[] = [];
    const inMat = new Map(m.cells.map((c, k) => [c, m.owners[k]]));
    for (let row = 0; row < m.grid; row += 1) {
      let col = 0;
      while (col < m.grid) {
        const owner = inMat.get(row * m.grid + col);
        if (owner === undefined) {
          col += 1;
          continue;
        }
        let end = col;
        while (end + 1 < m.grid && inMat.get(row * m.grid + end + 1) === owner) end += 1;
        rects.push(
          `<rect x="${(ox + col * cw).toFixed(2)}" y="${(40 + row * ch).toFixed(2)}" width="${((end - col + 1) * cw + 0.3).toFixed(2)}" height="${(ch + 0.3).toFixed(2)}" fill="url(#mat${owner % 3})" />`,
        );
        col = end + 1;
      }
    }
    return rects.join("");
  };
  const stats = (plan: GardenPlan, layout: typeof lb) => {
    const m = spreadMetrics(layout.placements, W, L, layout.mat);
    return `bare ${(bareFine(layout) * 100).toFixed(0)}% · largest gap ${(m.largestEmptyPatch * 100).toFixed(0)}% · ${plan.quantities?.totalPlants ?? 0} plants`;
  };
  const left = 20;
  const right = left + pw + 40;
  const { openMin, openMax } = styleRules[styleKeyOf(scenario.brief.style)];
  const matLine = (la.mat?.species ?? [])
    .map((s) => `${s.plantId}: ${s.count} plants over ${s.areaM2.toFixed(1)} m²${s.shadeAreaM2 > 0 ? ` (${s.shadeAreaM2.toFixed(1)} in shade)` : ""} at ${s.densityPerM2.toFixed(1)}/m²`)
    .join(" · ");
  const width = Math.max(right + pw + 20, 760);
  const height = 40 + ph + 70;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(0)}" height="${height.toFixed(0)}" viewBox="0 0 ${width.toFixed(0)} ${height.toFixed(0)}" font-family="Helvetica, Arial, sans-serif">
<defs>
<pattern id="mat0" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#c9d27a"/><path d="M1 6 L3 2 M4 6 L6 3" stroke="#7d8a3a" stroke-width="0.8"/></pattern>
<pattern id="mat2" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#d8cf8a"/><path d="M0 3.5 L7 3.5" stroke="#8a7d3a" stroke-width="0.8"/></pattern>
<pattern id="mat1" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#b7c98a"/><circle cx="2" cy="2" r="0.9" fill="#5f7a3a"/><circle cx="5.5" cy="5" r="0.9" fill="#5f7a3a"/></pattern>
</defs>
<rect width="100%" height="100%" fill="#fbf8ef"/>
<text x="${left}" y="16" font-size="12" font-weight="bold">${label} - ${scenario.id}: ${scenario.brief.style}, ${W} x ${L} m (open_min ${openMin}, open_max ${openMax})</text>
<text x="${left}" y="32" font-size="11">V2 (circles)</text>
<text x="${right}" y="32" font-size="11">M (ground cover as a mat)</text>
<rect x="${left}" y="40" width="${pw}" height="${ph}" fill="#efe6cf" stroke="#2f3a1e"/>
${grid(left)}${circles(left, lb.placements)}
<rect x="${right}" y="40" width="${pw}" height="${ph}" fill="#efe6cf" stroke="#2f3a1e"/>
${mat(right)}${grid(right)}${circles(right, la.placements)}
<text x="${left}" y="${40 + ph + 16}" font-size="10.5">${stats(before, lb)}</text>
<text x="${right}" y="${40 + ph + 16}" font-size="10.5">${stats(after, la)}</text>
<text x="${left}" y="${40 + ph + 34}" font-size="10">Mat: ${matLine || "none"}</text>
<text x="${left}" y="${40 + ph + 50}" font-size="9.5" fill="#555">Pale circles on the left are the carpeters the mat replaces. 1 m grid. Bare ground is the plain paper colour.</text>
</svg>
`;
}

// ------------------------------------------------------------------- main

function main(): void {
  const scenarios = buildScenarios();
  const plans = new Map<string, GardenPlan>();
  const byVersion = new Map<string, Row[]>();
  for (const version of VERSIONS) {
    process.stdout.write(`${version.id} ... `);
    const started = performance.now();
    byVersion.set(version.id, runVersion(version, scenarios, plans));
    process.stdout.write(`${Math.round((performance.now() - started) / 1000)}s\n`);
  }

  const all = [...byVersion.values()].flat();
  const keys = Object.keys(all[0]) as (keyof Row)[];
  writeFileSync(
    join(OUT, "mat_study.csv"),
    [keys.join(","), ...all.map((row) => keys.map((k) => String(row[k])).join(","))].join("\n"),
    "utf8",
  );

  const ok = (id: string) => byVersion.get(id)!.filter((r) => r.feasible);
  const col = (id: string, f: (r: Row) => number) => ok(id).map(f);
  const count = (id: string, f: (r: Row) => boolean) => ok(id).filter(f).length;

  const header = "| | V0 | V2 | M |\n|---|---|---|---|";
  const line = (name: string, f: (id: string) => string) =>
    `| ${name} | ${f("V0")} | ${f("V2")} | ${f("M")} |`;
  const n = (id: string) => ok(id).length;

  const mRows = ok("M");
  const withMat = mRows.filter((r) => r.matSpecies !== "");
  const v2ById = new Map(ok("V2").map((r) => [r.id, r]));
  const sameZ = mRows.filter((r) => v2ById.get(r.id)?.z === r.z).length;

  // Mat species diversity, option 1 (the plan buildGardenPlan returns).
  const usage = new Map<string, number>();
  for (const r of withMat) for (const id of r.matSpecies.split(";")) usage.set(id, (usage.get(id) ?? 0) + 1);
  const topUsage = [...usage].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [topId, topCount] = topUsage[0] ?? ["-", 0];
  const topShare = withMat.length ? topCount / withMat.length : 0;
  const nameOf = (id: string) => {
    const plant = plants.find((p) => p.id === id);
    return plant ? `${plant.scientificName} (${id})` : id;
  };

  const table = [
    header,
    line("plans produced", (id) => `${n(id)} / ${byVersion.get(id)!.length}`),
    line("bare ground", (id) => spread(col(id, (r) => r.bare))),
    line("real cover (1 - bare)", (id) => spread(col(id, (r) => 1 - r.bare))),
    line("engine cover (summed canopy)", (id) => spread(col(id, (r) => r.nominalCover))),
    line("bare below style open_min", (id) => pct(count(id, (r) => r.band === "below open_min"), n(id))),
    line("bare within open_min-open_max", (id) => pct(count(id, (r) => r.band === "within"), n(id))),
    line("bare above style open_max", (id) => pct(count(id, (r) => r.band === "above open_max"), n(id))),
    line("bare <= 20%", (id) => pct(count(id, (r) => r.bare <= 0.2 + ON_EDGE), n(id))),
    line("bare <= 10%", (id) => pct(count(id, (r) => r.bare <= 0.1 + ON_EDGE), n(id))),
    line("largest empty patch", (id) => spread(col(id, (r) => r.largestEmptyPatch))),
    line("quadrant CV", (id) => spread(col(id, (r) => r.quadrantCV))),
    line("Z (selection)", (id) => spread(col(id, (r) => r.z ?? NaN), 4)),
    line("plans with a hard violation (specimens)", (id) => pct(count(id, (r) => r.violations !== ""), n(id))),
    line("plans over H2's s_max (species)", (id) => pct(count(id, (r) => r.overSMax), n(id))),
    line("run time per plan, ms", (id) => spread(col(id, (r) => r.ms), 0)),
    line("plants to buy", (id) => spread(col(id, (r) => r.totalPlants), 0)),
  ].join("\n");

  const matTable = [
    "| | M |",
    "|---|---|",
    `| plans where the mat was laid | ${withMat.length} / ${n("M")} |`,
    `| ... where the search had picked a carpeter itself | ${withMat.filter((r) => r.searchCarpeter).length} |`,
    `| ... where the mat added a carpeter the search had not picked | ${withMat.filter((r) => !r.searchCarpeter).length} |`,
    `| search's carpeters the mat rules took out of the plan | ${withMat.reduce((s, r) => s + r.removedFromPlan, 0)} in ${withMat.filter((r) => r.removedFromPlan > 0).length} plans |`,
    `| mat species per plan: 1 / 2 / 3 | ${[1, 2, 3].map((k) => withMat.filter((r) => r.matSpecies.split(";").length === k).length).join(" / ")} |`,
    `| plans with a shade patch under L1 | ${withMat.filter((r) => r.shadeAreaM2 > 0).length} |`,
    `| shade patch, m2 (those plans) | ${spread(withMat.filter((r) => r.shadeAreaM2 > 0).map((r) => r.shadeAreaM2), 1)} |`,
    `| sun mat area, m2 | ${spread(withMat.map((r) => r.matAreaM2), 1)} |`,
    `| sun mat as a share of the bed | ${spread(withMat.map((r) => r.matShare))} |`,
    `| mat plants | ${spread(withMat.map((r) => r.matPlants), 0)}, most in one plan ${Math.max(...withMat.map((r) => r.matPlants))} |`,
    `| bare ground, these plans: V2 -> M | ${spread(withMat.map((r) => v2ById.get(r.id)?.bare ?? NaN))} -> ${spread(withMat.map((r) => r.bare))} |`,
    `| largest gap, these plans: V2 -> M | ${spread(withMat.map((r) => v2ById.get(r.id)?.largestEmptyPatch ?? NaN))} -> ${spread(withMat.map((r) => r.largestEmptyPatch))} |`,
    `| plants to buy, these plans: V2 -> M | ${spread(withMat.map((r) => v2ById.get(r.id)?.totalPlants ?? NaN), 0)} -> ${spread(withMat.map((r) => r.totalPlants), 0)} |`,
  ].join("\n");

  const diversity = [
    "| | option 1 |",
    "|---|---|",
    `| distinct mat species across the scenarios | ${usage.size} |`,
    `| most common | ${nameOf(topId)}: ${topCount} of ${withMat.length} plans with a mat (${(topShare * 100).toFixed(0)}%) |`,
    `| next most common | ${topUsage.slice(1, 4).map(([id, c]) => `${nameOf(id)} ${c}`).join("; ")} |`,
    "",
    topShare > 0.25
      ? `**FLAG: ${nameOf(topId)} is the mat in ${(topShare * 100).toFixed(0)}% of plans with a mat - over the 25% limit.**`
      : "No species is the mat in more than 25% of plans with a mat.",
  ].join("\n");

  // The three options: each scenario through buildGardenPlanVariants.
  process.stdout.write("M, three options ... ");
  const startedOptions = performance.now();
  const optionMats: string[][][] = [];
  {
    const undo = VERSIONS.find((v) => v.id === "M")!.apply();
    try {
      for (const scenario of scenarios) {
        const variants = buildGardenPlanVariants(plants, scenario.brief);
        optionMats.push(variants.map((plan) => (plan.layout?.mat?.species ?? []).map((s) => s.plantId)));
      }
    } finally {
      undo();
    }
  }
  process.stdout.write(`${Math.round((performance.now() - startedOptions) / 1000)}s\n`);
  const optionRows = [0, 1, 2].map((k) => {
    const mats = optionMats
      .map((options) => options[k])
      .filter((m): m is string[] => m !== undefined && m.length > 0);
    const use = new Map<string, number>();
    for (const m of mats) for (const id of m) use.set(id, (use.get(id) ?? 0) + 1);
    const [id, c] = [...use].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? ["-", 0];
    return `| option ${k + 1} | ${mats.length} | ${use.size} | ${nameOf(id)}: ${c} (${mats.length ? ((c / mats.length) * 100).toFixed(0) : 0}%) |`;
  });
  const multi = optionMats.filter((options) => options.filter((m) => m.length > 0).length >= 2);
  const allDifferent = multi.filter((options) => {
    const seen = new Set<string>();
    for (const m of options) {
      for (const id of m) {
        if (seen.has(id)) return false;
        seen.add(id);
      }
    }
    return true;
  });
  const optionTable = [
    "| | plans with a mat | distinct mat species | most common |",
    "|---|---|---|---|",
    ...optionRows,
    "",
    `Scenarios with a mat in two or more options: ${multi.length}. Of those, no mat species repeated across the options: ${allDifferent.length}.`,
    "A repeat happens only when the bed's pool holds too few eligible carpeters to give every option its own.",
  ].join("\n");

  // Three figures: the largest bare-ground drop among small, medium and
  // large beds that got a mat, leaving out beds longer than 2.5:1, which
  // draw too thin to read.
  mkdirSync(FIG, { recursive: true });
  const bandOf = (a: number) => (a < 10 ? "small" : a <= 50 ? "medium" : "large");
  const figures: string[] = [];
  for (const band of ["small", "medium", "large"]) {
    const pick = withMat
      .filter((r) => {
        const [w, l] = r.bed.split("x").map(Number);
        return bandOf(r.bedAreaM2) === band && Math.max(w, l) / Math.min(w, l) <= 2.5;
      })
      .sort((a, b) => (v2ById.get(b.id)!.bare - b.bare) - (v2ById.get(a.id)!.bare - a.bare))[0];
    if (!pick) continue;
    const scenario = scenarios.find((s) => s.id === pick.id)!;
    const file = `${band}-${pick.id}.svg`;
    writeFileSync(
      join(FIG, file),
      figure(scenario, plans.get(`V2:${pick.id}`)!, plans.get(`M:${pick.id}`)!, `${band} bed`),
      "utf8",
    );
    figures.push(`![${band} bed, ${pick.id}](figures/mat_study/${file})`);
  }

  const md = [
    "# Ground cover as a mat - V0 / V2 / M",
    "",
    "**Measurement only, in memory, on branch `coverage-test`. Nothing merged or deployed.**",
    "",
    `Rulebook as imported: \`${RULES_VERSION}\`. 100 seeded scenarios, the same for every version.`,
    "Figures are medians with the 10th-90th percentile in brackets, over the plans produced.",
    "",
    "| version | what it changes |",
    "|---|---|",
    ...VERSIONS.map((v) => `| **${v.id}** | ${v.label} |`),
    "",
    "## All scenarios",
    "",
    table,
    "",
    "Bare ground is read on a 60 x 60 grid of cell centres (the mat's own raster),",
    "so overlapping canopies count once and a mat cell counts as covered. Largest",
    "empty patch and quadrant CV use the 20 x 20 grid of the earlier coverage reports.",
    "Engine cover sums canopy areas and counts overlaps twice; it is shown",
    "only because it is the figure the app reports. Z is the selection's score:",
    `the mat runs after the selection is accepted (same Z as V2 in ${sameZ} of ${mRows.length}`,
    "plans), so Z does not score the mat species.",
    "",
    "## How the mat is laid (all ASSUMPTION, in memory)",
    "",
    "- Specimens stay circles, placed exactly as V2 places them; the mat runs after",
    "  the placement is accepted, so it cannot trigger the fail rule.",
    "- Zones on a 60 x 60 raster. Sun zone: ground under no specimen canopy, of which",
    "  the style's open_min is kept bare - taken from the narrowest gaps, so bare ground",
    "  is a thin margin round each specimen - and the rest is the sun mat. Shade zone:",
    "  ground under an L1 canopy and no other specimen.",
    "- Eligible: every true carpeter (L6, ground-cover or moss type) in the bed's",
    "  Stage 0 pool. Ranked: the search's own carpeters first, then Stage 1 score, ties",
    "  in a seeded random order (plan seed without wind). Options 2 and 3 take species",
    "  an earlier option used only when nothing else is eligible.",
    "- Count by the rulebook's H2 bands (small < 10 m2, medium 10-50, large > 50):",
    "  small 1 (shade patch only if that species is shade-tolerant); medium 1 sun + 1",
    "  shade if there is a shade zone; large 2 sun + 1 shade if there is a shade zone.",
    "  The shade species must be shade-tolerant (sun = part or sheltered) or the shade",
    "  patch is not laid.",
    "- Patches never mix: the sun mat is cut into equal bands across the long axis.",
    "- Quantity = area x 1 / (0.6 x spread)^2. Mat species sit outside H2, H3 and H5.",
    "",
    matTable,
    "",
    "## Which species form the mat",
    "",
    diversity,
    "",
    "## Across the three options",
    "",
    optionTable,
    "",
    "## Figures (V2 left, M right, same seed)",
    "",
    ...figures,
    "",
  ].join("\n");
  writeFileSync(join(OUT, "mat_study.md"), md, "utf8");
  console.log(table);
  console.log(matTable);
  console.log(diversity);
  console.log(optionTable);
  console.log(figures.join("\n"));
}

main();
