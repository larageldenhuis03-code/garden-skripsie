import type { Plant } from "../../data/plants.ts";
import { RULES, type LayerId } from "./rules.ts";
import {
  FEATURE_MIN_HEIGHT_CM,
  FEATURE_MIN_SPREAD_CM,
  FEATURE_REQUIRES_LIST,
  SMALL_GROUP_LADDER,
  SMALL_GROUP_MAX,
  SMALL_GROUP_PER_M2,
  SMALL_SPREAD_MAX_CM,
} from "./engineConfig.ts";
import { isWindResilient } from "./windRules.ts";
import { toleratesShade } from "./stage1.ts";

/**
 * Data-derived inputs the engine needs, all recalculated from the dataset
 * on load rather than hard-coded (3_Height_Tiers: "P30 and P60 are
 * recalculated by the code, never hardcoded").
 */

// ---------------------------------------------------------------------------
// Seeded randomness: the run is reproducible from its inputs (Stage 3 seed).
// ---------------------------------------------------------------------------

export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** mulberry32: small, fast, and identical on every platform. */
export function createRng(seed: string): () => number {
  let state = hashString(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

// ---------------------------------------------------------------------------
// Percentiles (inclusive method, as Excel PERCENTILE.INC)
// ---------------------------------------------------------------------------

export function percentileInc(values: readonly number[], fraction: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = fraction * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

export type HeightTier = "short" | "medium" | "tall";

/** 3_Height_Tiers: Short h < P30, Medium P30 <= h < P60, Tall h >= P60
 * (open-ended). One pair used for G1, the tier shares, height ordering and
 * the L1/L4/L6 split. */
export type HeightTiers = { p30: number; p60: number; n: number };

export function computeHeightTiers(plants: readonly Plant[]): HeightTiers {
  const heights = plants.flatMap((plant) =>
    plant.heightCm === null ? [] : [plant.heightCm],
  );
  return {
    p30: percentileInc(heights, 0.3),
    p60: percentileInc(heights, 0.6),
    n: heights.length,
  };
}

export function tierOf(heightCm: number | null, tiers: HeightTiers): HeightTier {
  const height = heightCm ?? 0;
  if (height >= tiers.p60) return "tall";
  if (height >= tiers.p30) return "medium";
  return "short";
}

/** Spread bands for H3's allowed group sizes. The rulebook gives the sizes
 * per band but not the band edges; by owner decision (2026-09-21) they are
 * the dataset's own terciles of spread_cm, recalculated on load like
 * P30/P60. Band 1 is the narrowest spread (largest drifts). */
export type SpreadBands = { p33: number; p67: number; n: number };

export function computeSpreadBands(plants: readonly Plant[]): SpreadBands {
  const spreads = plants.flatMap((plant) =>
    plant.spreadCm === null ? [] : [plant.spreadCm],
  );
  return {
    p33: percentileInc(spreads, 1 / 3),
    p67: percentileInc(spreads, 2 / 3),
    n: spreads.length,
  };
}

export function spreadBandOf(spreadCm: number, bands: SpreadBands): 0 | 1 | 2 {
  // Inclusive boundaries (2026-09-30 trial): a plant exactly on a tercile
  // joins the LOWER band. Spreads cluster hard on round numbers - 40 and
  // 100 cm are both tercile values and common values - so the choice of
  // < or <= moves a large block of species between bands.
  if (spreadCm <= bands.p33) return 0;
  if (spreadCm <= bands.p67) return 1;
  return 2;
}

// ---------------------------------------------------------------------------
// Feature plants (H3, H4) - 1_Parameters feature_list
// ---------------------------------------------------------------------------

/** On feature_list (revised) (1_Parameters C94): named species only -
 * family and group qualification was removed in the rulebook (H4). */
export function onFeatureList(plant: Plant): boolean {
  const name = plant.scientificName.trim();
  return RULES.stage2.featureList.species.some(
    (entry) => name === entry || name.startsWith(`${entry} `),
  );
}

/** A feature plant (H3, H4) passes feature_threshold (1_Parameters C93):
 * height > 150 cm OR spread > 100 cm - and, while engineConfig
 * FEATURE_REQUIRES_LIST is on (owner choice), is also on the list. */
export function isFeaturePlant(plant: Plant): boolean {
  const bigEnough =
    (plant.heightCm ?? 0) > FEATURE_MIN_HEIGHT_CM ||
    (plant.spreadCm ?? 0) > FEATURE_MIN_SPREAD_CM;
  return bigEnough && (!FEATURE_REQUIRES_LIST || onFeatureList(plant));
}

// ---------------------------------------------------------------------------
// Placement layers L1..L7 (6_Stage3_4_Rules rows 41-47)
// ---------------------------------------------------------------------------

// Aquatic left this list on 2026-09-30: it is now a Stage 0 exclusion, so
// no aquatic plant ever reaches a layer. Epiphyte moved to VERTICAL - it
// grows on a host rather than on the ground.
const SPECIALIST_TYPES = ["carnivorous", "orchid"];
const VERTICAL_TYPES = ["climber", "scrambler", "liana", "epiphyte"];
const MATRIX_TYPES = ["restio", "graminoid", "grass"];
const SEASONAL_TYPES = ["bulb", "geophyte", "bi/annual"];
const CARPET_TYPES = ["ground cover", "moss"];

/** The plant type a species was placed FOR - the single type that decided
 * its layer. A species can carry several types (e.g. shrub + succulent);
 * this is the one the engine used, so it is also the symbol drawn for it in
 * the sketchbook layout. Order: tree (or the feature plant's own first
 * type), specialist, vertical, matrix, seasonal, carpet, fern, then the
 * shrub / succulent / perennial split by height tier. Within a group the
 * plant's first-listed type wins. */
export function roleTypeOf(plant: Plant, feature: boolean): string | null {
  const types = plant.plantType ?? [];
  const first = (list: string[]) => types.find((type) => list.includes(type)) ?? null;
  if (types.includes("tree")) return "tree";
  if (feature) return types[0] ?? null;
  // Epiphyte outranks the specialist types (2026-09-30). Most epiphytes in
  // the catalogue are also tagged orchid, and orchid would otherwise win
  // and put them in L7 - on the ground. Growing on a host is the stronger
  // fact, and L2 is the layer that requires an L1 plant to grow on.
  if (types.includes("epiphyte")) return "epiphyte";
  return (
    first(SPECIALIST_TYPES) ??
    first(VERTICAL_TYPES) ??
    first(MATRIX_TYPES) ??
    first(SEASONAL_TYPES) ??
    first(CARPET_TYPES) ??
    first(["fern"]) ??
    first(["shrub", "succulent", "perennial"]) ??
    types[0] ??
    null
  );
}

/** A species belongs to exactly one layer. The rulebook assigns layers by
 * plant type, and for shrubs, succulents and perennials by height tier.
 * Where a species carries several types, the more specific role wins, in
 * this order: feature/tree, specialist, vertical, matrix, seasonal,
 * carpet, fern, then the tier split. */
export function layerOf(plant: Plant, tier: HeightTier, feature: boolean): LayerId {
  const type = roleTypeOf(plant, feature);
  if (feature || type === "tree") return "L1";
  if (type && SPECIALIST_TYPES.includes(type)) return "L7";
  if (type && VERTICAL_TYPES.includes(type)) return "L2";
  if (type && MATRIX_TYPES.includes(type)) return "L3";
  if (type && SEASONAL_TYPES.includes(type)) return "L5";
  if (type && CARPET_TYPES.includes(type)) return "L6";
  if (type === "fern") return "L4";
  // Shrub / succulent / perennial (and anything untyped) by height tier.
  if (tier === "tall") return "L1";
  if (tier === "medium") return "L4";
  return "L6";
}

// ---------------------------------------------------------------------------
// Flowering seasons (G5)
// ---------------------------------------------------------------------------

export type Season = "spring" | "summer" | "autumn" | "winter";
const ALL_SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

const MONTH_SEASON: Record<string, Season> = {
  Sep: "spring", Oct: "spring", Nov: "spring",
  Dec: "summer", Jan: "summer", Feb: "summer",
  Mar: "autumn", Apr: "autumn", May: "autumn",
  Jun: "winter", Jul: "winter", Aug: "winter",
};
const MONTHS = Object.keys(MONTH_SEASON);

/** Seasons from PlantZAfrica's season text ("Spring, Early Summer"),
 * falling back to the recorded start-end months (southern hemisphere). */
export function floweringSeasons(plant: Plant): Season[] {
  const text = plant.floweringSeason ?? "";
  if (text) {
    if (/all year|sporadic/i.test(text)) return [...ALL_SEASONS];
    return ALL_SEASONS.filter((season) => new RegExp(season, "i").test(text));
  }
  const start = MONTHS.indexOf(plant.flowerStart);
  const end = MONTHS.indexOf(plant.flowerEnd);
  if (start < 0 || end < 0) return [];
  const seasons = new Set<Season>();
  for (let step = 0; step < 12; step += 1) {
    const month = MONTHS[(start + step) % 12];
    seasons.add(MONTH_SEASON[month]);
    if ((start + step) % 12 === end) break;
  }
  return [...seasons];
}

// ---------------------------------------------------------------------------
// The per-species record Stages 2-4 work on
// ---------------------------------------------------------------------------

export type SpeciesInfo = {
  id: string;
  /** Stage 1 score_i. */
  score: number;
  diameterM: number;
  /** a_i = pi (s_i / 2)^2, in m2. */
  areaM2: number;
  heightCm: number;
  tier: HeightTier;
  layer: LayerId;
  types: string[];
  colours: string[];
  seasons: Season[];
  feature: boolean;
  /** H3: allowed n_i for this species. */
  allowedN: number[];
  windres: boolean;
  shade: boolean;
  hedge: boolean;
  genus: string;
};

/** C1: the bed areas at which this band gains each extra group size.
 *
 * A size s is offered once FLOOR(SMALL_GROUP_PER_M2 x area) >= s, so the
 * threshold is s / SMALL_GROUP_PER_M2 - derived here rather than written
 * down, so a change to the parameters moves the thresholds and the test
 * that pins them. Only sizes above the band's own maximum and at or below
 * SMALL_GROUP_MAX can ever be added. */
export function c1Thresholds(
  bandSizes: readonly number[],
): { bedAreaM2: number; size: number }[] {
  const bandMax = Math.max(...bandSizes);
  return SMALL_GROUP_LADDER.filter((n) => n > bandMax && n <= SMALL_GROUP_MAX).map(
    (size) => ({ bedAreaM2: size / SMALL_GROUP_PER_M2, size }),
  );
}

/** C1: the group sizes a small-spread species may take on a bed of this
 * area. Returns null when the species is not small enough to qualify or
 * the bed area is unknown, in which case the band's own ladder stands.
 *
 * Exported so the threshold test can drive it directly rather than
 * reaching for a species that happens to sit in the right band. */
export function bedScaledGroupSizes(
  spreadCm: number,
  bandSizes: number[],
  bedAreaM2: number | null,
): number[] | null {
  if (bedAreaM2 === null || spreadCm >= SMALL_SPREAD_MAX_CM) return null;
  const bandMax = Math.max(...bandSizes);
  const nMax = Math.min(
    SMALL_GROUP_MAX,
    Math.max(bandMax, Math.floor(SMALL_GROUP_PER_M2 * bedAreaM2)),
  );
  if (nMax <= bandMax) return null;
  // Only ever adds sizes: the band's own ladder is kept and extended.
  const extra = SMALL_GROUP_LADDER.filter((n) => n > bandMax && n <= nMax);
  return extra.length ? [...bandSizes, ...extra] : null;
}

export function speciesInfo(
  plant: Plant,
  score: number,
  tiers: HeightTiers,
  bands: SpreadBands,
  /** C1 (2026-10-05): the bed this pool is being built for, so a small
   * plant's group can scale with it. Omitted by studies that build a
   * catalogue-wide pool, which then get the unscaled ladder. */
  bedAreaM2: number | null = null,
): SpeciesInfo | null {
  if (plant.spreadCm === null || plant.heightCm === null) return null;
  const feature = isFeaturePlant(plant);
  const tier = tierOf(plant.heightCm, tiers);
  const band = spreadBandOf(plant.spreadCm, bands);
  const bandSizes = RULES.stage2.groupSizes[band];
  const diameterM = plant.spreadCm / 100;
  const layer = layerOf(plant, tier, feature);

  /**
   * H3, as revised on 2026-09-30 (rulebook 5_Stage2_Constraints C7:D7).
   * A group of one is allowed when:
   *
   *   - the plant is the feature plant (any band), or
   *   - it is a wider plant, in spread band 2 or 3, AND its layer is not
   *     Matrix (L3) or Fill (L4) - those two still need at least 3, since
   *     their job is to read as a drift rather than a single specimen.
   *
   * Band 1 (the narrowest spreads) is unchanged: 1 stays feature-only.
   * So a lone plant can only appear in L1, L2, L5, L6 or L7. The band
   * lists in 1_Parameters already contain 1; this is the rule that says
   * who may use it.
   */
  const SINGLE_FORBIDDEN_LAYERS: LayerId[] = ["L3", "L4"];
  const singleAllowed =
    feature || (band >= 1 && !SINGLE_FORBIDDEN_LAYERS.includes(layer));
  const scaled = bedScaledGroupSizes(plant.spreadCm, bandSizes, bedAreaM2);
  const groupSizes = (scaled ?? bandSizes).filter((size) => size >= 3);
  const allowedN = singleAllowed ? [1, ...groupSizes] : groupSizes;
  return {
    id: plant.id,
    score,
    diameterM,
    areaM2: Math.PI * (diameterM / 2) ** 2,
    heightCm: plant.heightCm,
    tier,
    layer,
    types: plant.plantType ?? [],
    colours: plant.flowerColour ?? [],
    seasons: floweringSeasons(plant),
    feature,
    allowedN,
    windres: isWindResilient(plant),
    shade: toleratesShade(plant),
    hedge: (plant.specialFeatures ?? []).includes("Hedge/screen"),
    genus: plant.scientificName.split(/\s+/)[0],
  };
}
