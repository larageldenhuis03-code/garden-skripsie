/**
 * Engine configuration - the single place to look up every engine value.
 *
 * Since rulebook version f378049c487c (test run 1 written back into
 * Algorithm_rulebook.xlsx) almost every value here is READ from the
 * rulebook through RULES, so the workbook stays the one place to change
 * it. Each entry names its rulebook cell. Values marked IMPLEMENTATION are
 * not in the rulebook: they bound the code rather than define the design.
 */

import { RULES } from "./rules.ts";

// ---------------------------------------------------------------------------
// Stage 0 - 11_Stage0_Filter
// ---------------------------------------------------------------------------

/** N_min (1_Parameters C13) - the Stage 0 relaxation trigger
 * (11_Stage0_Filter A15): below this, relax soil, then water, then sun;
 * biome is never relaxed. */
export const MINIMUM_VIABLE_POOL = RULES.stage2.nMin;

/**
 * H3b (owner decision, 2026-09-30). A bed may hold at most
 *
 *   n1 <= MIN( k_band , FLOOR( (1 - min_grouped_share) x S ) )
 *
 * single-plant groups, where k_band is by BED AREA band and the feature
 * plant counts towards n1. Band 1 keeps n = 1 for the feature plant only,
 * which speciesInfo already enforces when it builds allowedN.
 *
 * It exists because widening H3 let the optimiser fill a bed with lone
 * specimens: singletons maximise species count, which lifts the variety
 * and colour goals, so 28 of 96 batch plans came back with every group a
 * single plant. This caps that without forbidding the single specimens
 * the rulebook does want.
 *
 * The values live in the rulebook once 1_Parameters carries
 * k_singleton_band_1..3 and min_grouped_share; until then these are the
 * agreed numbers.
 */
export const SINGLETON_K_BY_BAND: readonly number[] =
  RULES.stage2.singletonKByBand ?? [1, 2, 4];
export const MIN_GROUPED_SHARE = RULES.stage2.minGroupedShare ?? 0.6;

/** F4 NEMBA exclusion (11_Stage0_Filter F4): the list is read from this
 * data file, empty until the lists are supplied. */
export const NEMBA_EXCLUSION_FILE = "app/data/nemba_exclusions.json";

/** IMPLEMENTATION data guard: spread records below this diameter are not
 * trusted for geometry and the plant is marked for review. */
export const MIN_LAYOUT_CANOPY_DIAMETER_M = 0.15;

// ---------------------------------------------------------------------------
// Stage 1 - 4_Stage1_Score
// ---------------------------------------------------------------------------

/* The shade bonus (a Stage 1 term and the P14 shade footprints in
 * Stage 4) is FUTURE WORK (owner, 12-13 October 2026) and is not in the
 * engine at all. */

// ---------------------------------------------------------------------------
// Stage 2 - 5_Stage2_Constraints
// ---------------------------------------------------------------------------

/** feature_threshold (1_Parameters C93) for H3 / H4. */
export const FEATURE_MIN_HEIGHT_CM = RULES.stage2.featureThreshold.minHeightCm;
export const FEATURE_MIN_SPREAD_CM = RULES.stage2.featureThreshold.minSpreadCm;
/** OWNER (test run 1 question): a feature plant must ALSO be on
 * feature_list (revised) (1_Parameters C94), species entries only. The
 * rulebook's H4 now reads "defined by SIZE" alone - see docs/NOW.md; set
 * this to false to follow the rulebook's size-only reading. */
export const FEATURE_REQUIRES_LIST = true;

/** k_headroom (revised) (1_Parameters C95): H5 cap = MAX(r_max, k / S). */
export const K_HEADROOM = RULES.stage2.kHeadroom;

/** size_var_min / D_min (1_Parameters C96): distinct group sizes needed
 * for G3's size-variety third to score 1. */
export const SIZE_VAR_MIN = RULES.stage2.sizeVarMin;

// ---------------------------------------------------------------------------
// Stage 3 - 6_Stage3_4_Rules rows 6-10
// ---------------------------------------------------------------------------

/** Greedy start (6_Stage3_4_Rules B6, H3): smallest allowed group only
 * until S_min, then every allowed size. */
export const GREEDY_SMALLEST_UNTIL_SMIN = true;

/** T0 (1_Parameters C24, "tune in code"): a move making Z this much worse
 * is accepted about half the time at the start. */
export const T0_WORSE_FRACTION = 0.05;

/** Fail rule (6_Stage3_4_Rules B10 / C19): placement_fail_limit
 * (1_Parameters C87) failures leave a species out, ... */
export const FAIL_RULE_EXCLUDE_AFTER = RULES.failRule.placementFailLimit;
/** ... and each retry asks for retry_cover_factor (C88) of the cover that
 * failed. */
export const FAIL_RULE_PACKING_CAP_STEP = RULES.failRule.retryCoverFactor;
/** IMPLEMENTATION bound: retries before a brief is reported as no plan. */
export const FAIL_RULE_MAX_RETRIES = 12;

/** IMPLEMENTATION (owner: top 3 distinct results by Z): seeded runs tried. */
export const MAX_RESULT_SEEDS = 6;

// ---------------------------------------------------------------------------
// Stage 4 - 6_Stage3_4_Rules rows 13-66
// ---------------------------------------------------------------------------

/** delta (canopy overlap) (1_Parameters C92) for P2: centres at least
 * r_i + r_j - delta * MIN(r_i, r_j) apart - placement and overlap checker
 * alike. Revised 2026-10-05: delta is a share of the SMALLER radius, so a
 * large neighbour can no longer claim much of a small plant's spread. */
/** H7 footprint cap phi (1_Parameters row 103, ASSUMPTION, 2026-10-05):
 * an L1 species is ineligible when pi (s_i / 2)^2 > phi * W * L. Equivalent
 * maximum spread: s_i <= 2 * sqrt(phi * W * L / pi) - 2.76 m on a 6 x 4 m
 * bed. L1 only: it exists to stop one canopy swallowing a small bed, and
 * the lower layers are already held by H1 and H5.
 *
 * `null` when the workbook carries no value, which the engine reads as
 * "no cap" rather than inventing a limit. */
export const H7_FOOTPRINT_CAP: number | null =
  RULES.stage2.footprintCap ?? null;

/** C1 (layout review, 2026-10-05): small plants could not fill a big bed.
 * Their spread band tops out at 15, and most ground cover sits in a band
 * whose ladder stops at 7, so a 30 m2 bed got the same drift as a 6 m2 one
 * and the rest of the space stayed open.
 *
 * A species narrower than SMALL_SPREAD_MAX_CM may form larger groups on
 * larger beds: n_max = MIN(SMALL_GROUP_MAX, MAX(band max,
 * FLOOR(SMALL_GROUP_PER_M2 x W x L))). The ladder continues in the same
 * odd steps the rulebook already uses. The cap never falls below what the
 * band already allowed, so this can only add sizes, never remove one.
 *
 * ASSUMPTION - proposed for the rulebook, not yet an agreed parameter. */
export const SMALL_SPREAD_MAX_CM = 30;
export const SMALL_GROUP_PER_M2 = 1;
export const SMALL_GROUP_MAX = 25;
/** The sizes a bed-scaled small-plant group may take, continuing the
 * rulebook's own odd ladder past 15. */
export const SMALL_GROUP_LADDER = [3, 5, 7, 9, 11, 15, 19, 25];

/** C2 (layout review, 2026-10-05): f(p) had no term for spreading plants
 * across the bed's width, so drifts clumped into corners. Weight of the
 * lateral balance term, which favours the third of the viewer-facing width
 * currently holding the least of that layer's canopy area. Sits between
 * the contact bonus (0.05) and the drift-cohesion term (3), so it steers
 * where a new drift starts without pulling an existing drift apart.
 *
 * ASSUMPTION - proposed for the rulebook, not yet an agreed parameter. */
export const P17_BALANCE_WEIGHT = 0.5;

export const P2_OVERLAP_TOLERANCE = RULES.stage4.overlapDelta;

/** row_pitch (1_Parameters C89): rows_available = FLOOR(L / row_pitch). */
export const ROW_PITCH_M = RULES.stage4.rowPitchM;

/** P11 (6_Stage3_4_Rules C32): windward = the south and east edges; the
 * angle test is removed, the length test kept. */
export const WINDWARD_EDGES = ["south", "east"] as const;
export const P11_ANGLE_TEST = false;

/** P15 (6_Stage3_4_Rules A94): climbers only chosen when an L1 plant
 * exists for them to climb. */
export const CLIMBERS_NEED_L1_HOST = true;

/** Placement retry budget (6_Stage3_4_Rules step 8). */
export const PLACEMENT = {
  /**
   * random_draws_per_plant (1_Parameters C91). The number of random
   * candidate positions drawn for each plant on each restart - used as
   * given, with no division (B1, 2026-09-30). Tangency contact points are
   * added on top of these, so the candidate set is larger than this.
   */
  randomDraws:
    RULES.stage4.randomDrawsPerPlant ??
    // Pre-rename rules file: the old budget, quartered as Stage 4 used to.
    Math.round((RULES.stage4.randomTriesPerPlant ?? 240) / 4),
  /** placement_restarts (1_Parameters C90). */
  restarts: RULES.stage4.placementRestarts,
  /** IMPLEMENTATION: extra preference noise on each restart. */
  noiseStep: 0.15,
  /** IMPLEMENTATION: share of random draws inside the depth band. */
  inBandShare: 0.6,
} as const;

/**
 * layout-v2b (owner prompt, 14 Oct 2026). Config flags, one per part, so
 * each can be measured on its own. Rulebook values (band_edge_front_mid,
 * band_curve_k, band_curve_asym_max, depth_tol) are read from RULES; the
 * flags only switch the parts on.
 *
 *   d29b        D29b part 1: relative height gradient. Each species'
 *               target depth is d* = (r - 0.5) / n, r its mean height rank
 *               among the plan's plants (climbers excluded), n their count.
 *               Soft, through the existing depth scoring with depth_tol.
 *               Replaces the layer depth targets and the D28 band fallback.
 *   treeHard    D29b part 3: no plant typed "tree" centred at a depth
 *               (d_eff when the curve is on) less than band_edge_front_mid.
 *               The only hard depth rule.
 *   curve       D29b part 2: depth compared as d_eff = d + k u^2, with the
 *               D30 asymmetry (one per plan seed).
 *   order       D29b part 4: groups placed back -> front by d*, larger
 *               spread first; each group's first plant takes the earliest
 *               zone of the sweep back corners -> sides -> back centre ->
 *               middle -> front centre near its target depth.
 *   fill        D29b part 5: each group's first plant starts in the
 *               emptiest of 9 cells near its target depth. All selected
 *               plants are eligible; nothing is added (H3/H5 unchanged).
 *   driftSplit  D29b part 6 (config-only test): an H3 group of more than 3
 *               plants is placed as 2 drifts.
 *
 * Defaults are config (o) - parts 1-5 - the configuration that passed the
 * time box (reports/layout_v2b_comparison.md). driftSplit stays off: it
 * breaks the 12-case layering test.
 */
export const LAYOUT_V2B = {
  d29b: true,
  treeHard: true,
  curve: true,
  order: true,
  fill: true,
  driftSplit: false,
};

/**
 * D33 final relaxation pass (owner prompt, 14 Oct 2026; relax.ts). Config
 * only, no rulebook value: `on` is the owner's relax_on flag, and
 * maxIterations (200), minMoveM (1 cm) and sameGroupFactor (0.5) are the
 * owner's numbers. maxStepFraction caps one iteration's move at that share
 * of the plant's radius (IMPLEMENTATION: keeps the pass stable); grid is
 * the 20 x 20 sample the largest empty patch is measured on (the batch
 * metric's own grid).
 *
 * On by default on layout-v2c: with D29b config (o) it is the best
 * configuration that passes every test (reports/layout_v2c_comparison.md).
 */
export const RELAX = {
  on: true,
  maxIterations: 200,
  minMoveM: 0.01,
  sameGroupFactor: 0.5,
  maxStepFraction: 0.5,
  grid: 20,
  /**
   * D33b (owner prompt, 14 Oct 2026), config only, each part a flag:
   *   method      "force" (D33) or "lloyd" (v1: power-diagram Lloyd steps,
   *               each plant towards the centroid of its radius-weighted
   *               cell, sampled on about lloydSamples points)
   *   edgeGuard   v1+: a move that crosses a bed edge is projected back
   *               inside (so the plant slides along the wall) before the
   *               other clamps; a move that still breaks one is shortened
   *   swaps       v2: two plants within swapHeightCm of each other swap
   *               places when the larger-spread one stands in the fuller
   *               1 m cell; kept only if the 1 m-cell cover variance drops
   *   shortClamp  v3: depth clamp +-shortDepthTol for plants under
   *               shortHeightCm (others +-depth_tol)
   *   gapFill     v4: in each of the gapFillCount largest gaps, one more
   *               plant of a species already selected (n + 1 <= its H3
   *               maximum, H5 cap held, no new species)
   * The 20 cm, 0.15, 50 cm and 3 are the owner's numbers; lloydSamples
   * and maxSwapTries are IMPLEMENTATION bounds. Defaults on layout-v2e:
   * v6 - Lloyd, edge guard, swaps, gap fill and group cohesion, without
   * the short-plant clamp (v3 breaks the B1223/B1172 layering test) or the
   * drift split (breaks the 12-case) - the best variant that passes every
   * test (reports/layout_v2d_comparison.md, layout_v2e_comparison.md).
   */
  method: "lloyd" as "force" | "lloyd",
  edgeGuard: true,
  lloydSamples: 3000,
  swaps: true,
  swapHeightCm: 20,
  maxSwapTries: 60,
  shortClamp: false,
  shortHeightCm: 50,
  shortDepthTol: 0.15,
  gapFill: true,
  gapFillCount: 3,
  /**
   * v6 (layout-v2e, after the D33b report showed drifts loosening): keep
   * groups together. No plant may end up further from its nearest plant
   * of the same species than cohesionMaxGapM edge to edge, or than it
   * already was if Stage 4 left it further; checked for the plant moved
   * and for every group-mate, on every move and swap.
   * ASSUMPTION - 10 cm is a proposal, not an agreed value.
   */
  cohesion: true,
  cohesionMaxGapM: 0.1,
};
