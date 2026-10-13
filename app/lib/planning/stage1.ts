import type { Plant } from "../../data/plants.ts";
import type { GardenBrief } from "./brief.ts";
import type { ColourPreference } from "./preferences.ts";
import {
  COLOUR_SCHEMES,
  EXTRA_TAGS,
  STAGE1_WEIGHTS,
  COLOUR_UNKNOWN_SCORE,
  STYLE_FIT,
} from "./stage1Config.ts";
import { isWindResilient, windSiteFactor } from "./windRules.ts";

/**
 * Stage 1 - plant score. Gives every plant in the Stage 0 candidate pool a
 * score in [0, 1]:
 *
 *   raw_i   = 0.637 style_i + 0.105 colour_i + 0.258 extras_i
 *           + 0.105 saved_i + 0.637 W_site windres_i
 *   score_i = raw_i / raw_max
 *
 * (weights from the rulebook; the shade bonus is future work and has no
 * term.)
 *
 * raw_max counts ONLY the terms the user activated, so a preference nobody
 * expressed neither helps nor dilutes anyone. Stage 1 ranks; it never
 * removes a plant, and it never runs on a plant Stage 0 has already
 * removed - saved plants and wind cannot resurrect one.
 *
 * Every term is binary per plant except colour_i and extras_i, which are
 * the fraction of the user's picks the plant satisfies. No term is ever
 * negative, and missing data scores 0, never an error.
 */

export type Stage1Inputs = {
  brief: GardenBrief;
  savedPlantIds: readonly string[];
};

export type Stage1Term = {
  /** The plant's value for this term, in [0, 1]. */
  value: number;
  /** The term's full weight (for wind, 0.637 x W_site). */
  weight: number;
  /** Whether the user activated this term. Inactive terms add nothing to
   * raw_i and nothing to raw_max. */
  active: boolean;
  /** weight x value when active, else 0. */
  contribution: number;
};

export type Stage1Score = {
  plantId: string;
  score: number;
  raw: number;
  rawMax: number;
  terms: {
    style: Stage1Term;
    colour: Stage1Term;
    extras: Stage1Term;
    saved: Stage1Term;
    wind: Stage1Term & { siteFactor: number };
  };
};

/** The atomic colours a preference asks for: a scheme is expanded first,
 * a custom pick is already atomic, and "none" asks for nothing. */
export function pickedColours(preference: ColourPreference): string[] {
  if (preference.mode === "scheme") return COLOUR_SCHEMES[preference.scheme];
  if (preference.mode === "custom") return [...new Set(preference.colours)];
  return [];
}

export function styleFits(plant: Plant, brief: GardenBrief): boolean {
  if (brief.style === "undecided") return false;
  const rule = STYLE_FIT[brief.style];
  const typeMatch = (plant.plantType ?? []).some((type) =>
    rule.plantTypes?.includes(type),
  );
  const biomeMatch = (plant.biome ?? []).some((biome) =>
    rule.biomes?.includes(biome),
  );
  return typeMatch || biomeMatch;
}

/** shade_i: 1 if the plant tolerates part or full shade - its recorded
 * light includes "part" or "sheltered" (4_Stage1_Score). */
export function toleratesShade(plant: Plant): boolean {
  return (plant.sun ?? []).some((sun) => sun === "part" || sun === "sheltered");
}

/** matches / colours picked. D25: a plant with no recorded colour scores
 * colour_unknown_score (0.5), so known match > unknown > known mismatch. */
export function colourTerm(plant: Plant, picked: readonly string[]): number {
  if (picked.length === 0) return 0;
  const plantColours = plant.flowerColour ?? [];
  if (plantColours.length === 0) return COLOUR_UNKNOWN_SCORE;
  const matches = picked.filter((colour) => plantColours.includes(colour));
  return matches.length / picked.length;
}

/** matches / extras picked. A blank special_features scores 0. */
export function extrasTerm(
  plant: Plant,
  extras: GardenBrief["extras"],
): number {
  if (extras.length === 0) return 0;
  const features = plant.specialFeatures ?? [];
  const matches = extras.filter((extra) =>
    EXTRA_TAGS[extra].some((tag) => features.includes(tag)),
  );
  return matches.length / extras.length;
}

function term(value: number, weight: number, active: boolean): Stage1Term {
  return {
    value,
    weight,
    active,
    contribution: active ? weight * value : 0,
  };
}

/** raw_max: the sum of the weights of the ACTIVE terms only. */
export function stage1RawMax({ brief, savedPlantIds }: Stage1Inputs): number {
  const siteFactor = windSiteFactor(brief.wind);
  return (
    (brief.style !== "undecided" ? STAGE1_WEIGHTS.style : 0) +
    (pickedColours(brief.colour).length > 0 ? STAGE1_WEIGHTS.colour : 0) +
    (brief.extras.length > 0 ? STAGE1_WEIGHTS.extras : 0) +
    (savedPlantIds.length > 0 ? STAGE1_WEIGHTS.saved : 0) +
    STAGE1_WEIGHTS.wind * siteFactor
  );
}

export function scorePlantStage1(
  plant: Plant,
  inputs: Stage1Inputs,
): Stage1Score {
  const { brief, savedPlantIds } = inputs;
  const picked = pickedColours(brief.colour);
  const siteFactor = windSiteFactor(brief.wind);

  const terms = {
    style: term(
      styleFits(plant, brief) ? 1 : 0,
      STAGE1_WEIGHTS.style,
      brief.style !== "undecided",
    ),
    colour: term(colourTerm(plant, picked), STAGE1_WEIGHTS.colour, picked.length > 0),
    extras: term(
      extrasTerm(plant, brief.extras),
      STAGE1_WEIGHTS.extras,
      brief.extras.length > 0,
    ),
    saved: term(
      savedPlantIds.includes(plant.id) ? 1 : 0,
      STAGE1_WEIGHTS.saved,
      savedPlantIds.length > 0,
    ),
    wind: {
      ...term(
        isWindResilient(plant) ? 1 : 0,
        STAGE1_WEIGHTS.wind * siteFactor,
        siteFactor > 0,
      ),
      siteFactor,
    },
  };

  const raw =
    terms.style.contribution +
    terms.colour.contribution +
    terms.extras.contribution +
    terms.saved.contribution +
    terms.wind.contribution;
  const rawMax = stage1RawMax(inputs);

  return {
    plantId: plant.id,
    // Nothing chosen means nothing to rank on - never divide by zero.
    score: rawMax > 0 ? raw / rawMax : 0,
    raw,
    rawMax,
    terms,
  };
}

/** Scores a Stage 0 pool. Returns exactly one entry per plant passed in:
 * Stage 1 can reorder the pool but never add to or remove from it. */
export function scorePoolStage1(
  pool: readonly Plant[],
  inputs: Stage1Inputs,
): Stage1Score[] {
  return pool.map((plant) => scorePlantStage1(plant, inputs));
}
