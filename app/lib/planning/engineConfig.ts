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

/** b_shade / shade_term_active (1_Parameters A79:H84) and P14
 * (6_Stage3_4_Rules A35): ON HOLD in the rulebook - no shade term in
 * Stage 1 and no P14 in Stage 4 while the status reads ON HOLD. */
// Off unless the rulebook carries b_shade AND does not mark it ON HOLD.
// The workbook dropped b_shade on 2026-09-30; an absent parameter must
// mean the feature stays off, not that it silently switches back on.
export const SHADE_ENABLED =
  RULES.status["b_shade"] !== undefined && RULES.status["b_shade"] !== "ON HOLD";

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
/**
 * STUDY SEAMS for the coverage test, both off in the shipped engine.
 *
 * `coverMinHard` makes the style's cover_min a hard lower bound on a
 * finished selection instead of only the denominator of goal A4. When no
 * selection reaches it, Stage 3 returns the highest-cover selection it
 * saw and says so, rather than failing.
 *
 * `gapFill` runs a pass after Stage 4 that tops up the emptiest square
 * metres with more of a ground-cover or matrix species already in the
 * plan. It never introduces a species and never breaks H1, H5, P1 or P2.
 *
 * See scripts/coverage-test.ts (V5 and V6), which set them in memory.
 */
export const SEARCH = {
  coverMinHard: false,
  /** The floor applies only to beds at least this big, in m2. 0 means
   * every bed, which is what V5 measured; V7 sets 6, so small beds - where
   * V5 made the spread clearly worse - have no floor. */
  coverMinHardFromM2: 0,
  gapFill: false,
  /**
   * Whether gap fill keeps the filler inside its layer's depth band.
   *
   * True is the brief as written. It is also very restrictive: a ground
   * cover's band is depth_tol either side of its target, which on a 4 m
   * bed is 0.40-1.20 m - a fifth of the depth - so the pass can only
   * reach a strip at the front. False lets it fill any square metre that
   * P1 and P2 allow. Measured both ways; see reports/coverage_test.md.
   */
  gapFillRespectBand: true,
  /** A square metre counts as filled at this much canopy. */
  cellFullAt: 0.5,
  /**
   * Ground-cover fill (V9, owner 13 October 2026): after placement, plant
   * the plan's ground cover - or its matrix species - into the biggest
   * gaps anywhere in the bed, until the bed's real cover reaches
   * fillTargetCover or nothing more fits. This is what lets a bed pass the
   * ~69% the packer reaches on its own, without the fail rule's cut-back.
   */
  groundCoverFill: false,
  fillTargetCover: 0.9,
  /** Candidate rule changes, measured one at a time. Each exempts the base
   * layer (ground cover L6 and matrix L3) - the plants a designer uses in
   * large drifts to close a bed - from one Stage 2 rule: H5, the cap on
   * any one species' share of the plants; H3, the ladder of allowed group
   * sizes. Feature plants already have an H5 exemption of the same kind. */
  fillExemptH5: false,
  fillExemptH3: false,
  /** If the plan has no ground cover or matrix species, add the best-
   * scoring ground cover from its own filtered pool - one that has passed
   * every survival check for this bed - provided H2 still allows one more
   * species. */
  fillAddSpecies: false,
  /** How far a ground-cover filler may tuck under the edge of a TALLER
   * plant, as P2's delta: 0.15 is P2 as it stands; 1.0 lets the filler's
   * centre reach the taller plant's canopy edge. Between two base-layer
   * plants P2 is unchanged. Real ground cover grows under shrub edges;
   * P2 as written treats it like any other plant. */
  fillUnderDelta: 0.15,
} as const;

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
  /**
   * IMPLEMENTATION: how much a candidate position is preferred for being
   * a tangency contact point - snug against the bed edge or an existing
   * plant - rather than a free random draw. It is what packs the bed, and
   * it is also what pulls plants into clumps.
   *
   * It was written into Stage 4 as a bare 0.05. Moved here because this
   * file is the single home for placement settings that are not rulebook
   * parameters, and because a coverage study needs to run with it at 0.
   * The value is unchanged.
   */
  contactBonus: 0.05,
  /**
   * STUDY SEAM, 0 in the shipped engine so none of it runs.
   *
   * Weight of the "emptiest block" preference: the bed is divided into
   * blocks the size of the median canopy in the selection (at least
   * 0.5 m) and a candidate position is preferred for sitting in a block
   * that is still empty. It is added only for the first plant of a group,
   * so a drift still clusters round its anchor, and only for candidates
   * already inside the layer's depth band, so it can never pull a plant
   * out of its band. Hard rules are a filter, not a score, so no weight
   * here can breach one.
   *
   * See scripts/coverage-test.ts (V3), which sets it in memory.
   */
  emptiestBlockWeight: 0,
} as const;
