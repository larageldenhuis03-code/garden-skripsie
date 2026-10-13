/**
 * Stage 1 (plant score) configuration. Every value is read from the
 * rulebook (Algorithm_rulebook.xlsx, tabs 1_Parameters, 2_Style_Rules and
 * 4_Stage1_Score) through RULES - nothing here is typed in by hand, so
 * changing the workbook changes the engine on the next sync.
 *
 *   raw_i    = w_style  * style_i
 *            + w_colour * colour_i
 *            + w_extras * extras_i
 *            + b_saved  * saved_i
 *            + b_wind   * W_site * windres_i
 *
 * There is no shade term: the shade bonus is future work.
 *   score_i  = raw_i / raw_max      (raw_max = sum of ACTIVE terms' weights)
 */

import type { Wind } from "./brief.ts";
import type {
  ColourScheme,
  ExtraPreference,
  GardenStyle,
} from "./preferences.ts";
import { RULES, type StyleKey } from "./rules.ts";
import { ROW_PITCH_M } from "./engineConfig.ts";

/** 1_Parameters: w_style, w_colour, w_extras, b_saved, b_wind (all
 * AGREED). */
export const STAGE1_WEIGHTS = RULES.stage1.weights;

/** 1_Parameters colour_unknown_score (D25, ASSUMPTION): an unrecorded
 * flower colour is neither rewarded nor penalised. */
export const COLOUR_UNKNOWN_SCORE = RULES.stage1.colourUnknownScore;

/** 1_Parameters: W_site per wind answer (AGREED, R012). */
export const WIND_SITE_FACTOR: Record<Wind, number> = RULES.stage1.windSiteFactor;

/** 4_Stage1_Score colour schemes (violet and grey removed). */
export const COLOUR_SCHEMES: Record<ColourScheme, string[]> =
  RULES.stage1.colourSchemes;

/** 4_Stage1_Score extras tag map. */
export const EXTRA_TAGS: Record<ExtraPreference, string[]> = RULES.stage1.extraTags;

/** The rulebook style a brief's answer maps to; "undecided" is Generic. */
export function styleKeyFor(style: GardenStyle): StyleKey {
  return style === "undecided" ? "generic" : style;
}

/** 2_Style_Rules column B/C: the style_fit rule for each chosen style. */
export const STYLE_FIT: Record<
  Exclude<GardenStyle, "undecided">,
  { plantTypes?: string[]; biomes?: string[] }
> = {
  fynbos: fitFor("fynbos"),
  mediterranean: fitFor("mediterranean"),
  cottage: fitFor("cottage"),
};

function fitFor(key: StyleKey): { plantTypes?: string[]; biomes?: string[] } {
  const { plantTypes, biomes } = RULES.styles[key].fit;
  return {
    ...(plantTypes ? { plantTypes } : {}),
    ...(biomes ? { biomes } : {}),
  };
}

/** 4_Stage1_Score wind-resistance classification (R010). "Grass /
 * graminoid" and "Restio" are expressed through the plant types the
 * dataset uses for them: grass, graminoid and restio. */
export const WIND_RESILIENT_PLANT_TYPES = [
  "ground cover",
  "grass",
  "graminoid",
  "restio",
];

/** 4_Stage1_Score: any plant tagged Hedge/screen is wind-resistant (R013). */
export const WIND_RESILIENT_TAG = "Hedge/screen";

/** 1_Parameters h_lowshrub_max: a low shrub is a shrub no taller than
 * this (resolved at 100 cm in 10_Open_Items). */
export const LOW_SHRUB_MAX_HEIGHT_CM = RULES.stage1.lowShrubMaxHeightCm;

/** rows_available = FLOOR(L / row_pitch) (13_Definitions); the pitch is
 * set in engineConfig (ROW_PITCH_M). */
export function rowsAvailable(bedDepthM: number): number {
  return Math.floor(bedDepthM / ROW_PITCH_M + 1e-9);
}

