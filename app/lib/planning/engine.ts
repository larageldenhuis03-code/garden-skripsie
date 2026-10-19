import type { GardenBrief } from "./brief.ts";
import { createRng, type SpeciesInfo } from "./engineData.ts";
import { RULES } from "./rules.ts";
import {
  FAIL_RULE_EXCLUDE_AFTER,
  FAIL_RULE_MAX_RETRIES,
  FAIL_RULE_PACKING_CAP_STEP,
  H7_FOOTPRINT_CAP,
} from "./engineConfig.ts";
import { pickedColours } from "./stage1.ts";
import { rowsAvailable, styleKeyFor, WIND_SITE_FACTOR } from "./stage1Config.ts";
import {
  bandFor,
  evaluateSelection,
  exceedsFootprintCap,
  footprintCapM2,
  stateFrom,
  type EngineSite,
  type Selection,
  type SelectionEvaluation,
} from "./stage2.ts";
import { searchSelection, type SearchTrace } from "./stage3.ts";
import { placeSelection, type PlacementResult } from "./stage4.ts";

/**
 * Runs Stages 2-4 for one seed: search (Stage 3) for the best feasible mix,
 * place it (Stage 4), and apply the rulebook's fail rule - "if placement
 * cannot succeed, go back to Stage 3: remove the lowest-scoring species
 * group and retry".
 */

// Fail-rule settings live in engineConfig (FAIL_RULE_*).

export type EngineRun = {
  status: "plan" | "no-plan";
  selection: Selection;
  evaluation: SelectionEvaluation | null;
  search: SearchTrace | null;
  placement: PlacementResult | null;
  /** Species the fail rule left out, in order. */
  dropped: string[];
  /** D33b v4: plants the gap fill added after placement, per species. */
  added: Selection;
  diagnostics: string[];
};

export function engineSite(brief: GardenBrief): EngineSite {
  const widthM = brief.bedWidthM;
  const depthM = brief.bedLengthM;
  const areaM2 = widthM * depthM;
  const windSite = WIND_SITE_FACTOR[brief.wind];
  const rows = rowsAvailable(depthM);
  const band = bandFor(areaM2);
  return {
    widthM,
    depthM,
    areaM2,
    style: RULES.styles[styleKeyFor(brief.style)],
    sMin: band.sMin,
    sMax: band.sMax,
    userColours: pickedColours(brief.colour),
    windSite,
    rowsAvailable: rows,
    windbreakRequired: windSite > 0 && rows <= 2,
    // Every option is laid out from the edge the gardener stands on
    // (owner decision, 12 October 2026). Until then only one of the three
    // was, and the other two assumed north, so a tall plant could land at
    // the viewer's feet in two plans out of three.
    frontEdge: brief.viewingEdge,
  };
}

export function runEngine(
  fullPool: readonly SpeciesInfo[],
  site: EngineSite,
  seed: string,
): EngineRun {
  const rng = createRng(seed);
  const diagnostics: string[] = [];

  // H7 (5_Stage2_Constraints row 11, 2026-10-05): y_i = 0 for an L1
  // species whose own canopy would cover more than phi of the bed. Applied
  // here, before any search, so Stage 3 is never offered the species at
  // all; withinLimits() enforces the same rule on any state, which makes
  // this a guarantee rather than an ordering assumption. Each exclusion is
  // logged by name - the whole point of the rule is that a gardener can
  // see why a plant they might expect is absent.
  const bedAreaM2 = site.areaM2;
  const oversized = fullPool.filter((info) => exceedsFootprintCap(info, bedAreaM2));
  const pool = oversized.length
    ? fullPool.filter((info) => !exceedsFootprintCap(info, bedAreaM2))
    : fullPool;
  if (oversized.length) {
    const capM2 = footprintCapM2(bedAreaM2) ?? 0;
    for (const info of oversized) {
      diagnostics.push(
        `${info.id} left out: footprint ${info.areaM2.toFixed(2)} m2 > ${capM2.toFixed(2)} m2 ` +
          `(${H7_FOOTPRINT_CAP} x bed area) - too big to be the only structural plant in a bed this size.`,
      );
    }
  }

  const infos = new Map(pool.map((info) => [info.id, info]));
  const dropped: string[] = [];
  let lastSearch: SearchTrace | null = null;
  let lastPlacement: PlacementResult | null = null;
  let selection: Selection | null = null;
  const failCounts = new Map<string, number>();
  let searchSite: EngineSite = site;

  const search = (): boolean => {
    // Species the fail rule has left out stay out of every later search.
    const available = pool.filter((info) => !dropped.includes(info.id));
    const result = searchSelection(available, searchSite, rng);
    if (result.status === "infeasible") {
      diagnostics.push(result.reason);
      return false;
    }
    lastSearch = result.trace;
    selection = new Map(result.selection);
    return true;
  };

  if (!search()) return noPlan();

  for (let attempt = 0; attempt < FAIL_RULE_MAX_RETRIES && selection; attempt += 1) {
    const current: Selection = selection;
    // D33b v4 needs the H5 cap of this selection for its gap fill.
    const h5Cap = stateFrom(current, infos, site).rMaxEffective();
    const placement = placeSelection(
      current,
      infos,
      {
        ...site,
        h5Cap,
        coverCapM2: site.style.coverMax * site.widthM * site.depthM,
        sMax: site.sMax,
        excluded: dropped,
        // v9 open fill: every Stage 2 limit except the H2 species ceiling.
        openFillOk: (counts: Selection) => stateFrom(counts, infos, { ...site, packingCap: undefined }).withinLimitsExceptH2(),
      },
      rng,
    );
    lastPlacement = placement;

    const state = stateFrom(placement.realised, infos, site);
    const evaluation = evaluateSelection(state);
    const hardPlacementOk = placement.checks
      .filter((check) => check.kind === "hard")
      .every((check) => check.pass);
    if (
      placement.status === "complete" &&
      evaluation.feasible &&
      state.complete() &&
      hardPlacementOk
    ) {
      diagnostics.push(...placement.layout.diagnostics);
      return {
        status: "plan",
        selection: placement.realised,
        evaluation,
        search: lastSearch,
        placement,
        dropped,
        added: placement.added ?? new Map(),
        diagnostics,
      };
    }

    // Fail rule (6_Stage3_4_Rules B10 / C19): a species that fails to
    // place placement_fail_limit times is left out; the layout is retried
    // at retry_cover_factor of the cover that failed; if placement still
    // cannot succeed, Stage 3 searches again (which is what the retry is).
    const failed = placement.failedSpeciesId;
    if (failed) {
      const count = (failCounts.get(failed) ?? 0) + 1;
      failCounts.set(failed, count);
      if (count >= FAIL_RULE_EXCLUDE_AFTER && !dropped.includes(failed)) {
        dropped.push(failed);
        diagnostics.push(`${failed} failed to place ${count} times, so it is left out.`);
      } else {
        diagnostics.push(`${failed} could not be placed (failure ${count}).`);
      }
    } else {
      diagnostics.push("The placed layout broke a hard rule.");
    }
    const failedFraction = stateFrom(current, infos, site).plantedAreaM2 / site.areaM2;
    searchSite = {
      ...site,
      // Read at run time, not the load-time constant, so an in-memory
      // override of RULES.failRule.retryCoverFactor (a study) takes effect.
      packingCap: (RULES.failRule.retryCoverFactor ?? FAIL_RULE_PACKING_CAP_STEP) * Math.min(failedFraction, searchSite.packingCap ?? 1),
    };
    diagnostics.push(
      `Retrying at no more than ${Math.round(searchSite.packingCap! * 100)}% cover.`,
    );
    if (!search()) break;
  }
  return noPlan();

  function noPlan(): EngineRun {
    return {
      status: "no-plan",
      selection: new Map(),
      evaluation: null,
      search: lastSearch,
      placement: lastPlacement,
      dropped,
      added: new Map(),
      diagnostics,
    };
  }
}
