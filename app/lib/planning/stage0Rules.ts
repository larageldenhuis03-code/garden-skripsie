/**
 * Named Stage 0 exclusions from the rulebook tab 11_Stage0_Filter. These
 * are taxon lists stated in words in the rulebook, so they live here with
 * their source rather than in the numeric parameter register.
 *
 * F1-F3 (sun, water, soil) are the existing site filters. F7 (wind never
 * filters) and F8 (style never filters) are negative rules, honoured by
 * there being no wind or style constraint in Stage 0 at all.
 */

import nemba from "../../data/nemba_exclusions.json" with { type: "json" };

/** F4 (R-FYNB-002): NEMBA alien and invasive species are never planted.
 * The list is read from app/data/nemba_exclusions.json (engineConfig
 * NEMBA_EXCLUSION_FILE), built by data/scripts/build_nemba_exclusions.py
 * from the same alien-taxa list that removed invasives when the catalogue
 * was built. That removal happens upstream and is never re-run, so this is
 * the check that a listed species cannot reach a plan - it should never
 * fire on the current catalogue, and a test asserts it does not. The
 * gazetted NEMBA notice remains the legal authority and still needs
 * transcribing; see data/sources.json. */
export const F4_NEMBA_SPECIES: readonly string[] = nemba.species as string[];

/** True if a scientific name is on an exclusion list - the listed name
 * itself or any subspecies / variety of it. */
export function onExclusionList(scientificName: string, list: readonly string[]): boolean {
  const name = scientificName.trim();
  return list.some((entry) => name === entry || name.startsWith(`${entry} `));
}

/** F5 (R-COAS-012): thirsty exotic ornamentals - roses, hydrangeas,
 * azaleas "and equivalents" - are excluded on low-water sites. The
 * rulebook's trigger also named wind; by owner decision (2026-09-21) wind
 * is dropped from it so wind never filters (F7). Azaleas are Rhododendron.
 * None of these genera is in the current dataset, so the rule is ready for
 * a future catalogue rather than active today. */
export const F5_THIRSTY_EXOTIC_GENERA = ["Rosa", "Hydrangea", "Rhododendron"];

/** F6 (R-COAS-013): species with an off-site habitat requirement. The
 * rulebook's example is Agathosma betulina (dry high mountains); the
 * engine has no "coastal plain" input, so a listed species is excluded
 * everywhere. Not in the current dataset. */
export const F6_NAMED_EXCLUSIONS = ["Agathosma betulina"];

/** F9: parasitic species need a specific host a randomised layout cannot
 * guarantee - hard exclude (owner decision). */
export const F9_EXCLUDED_PLANT_TYPES = ["parasitic"];

/** Aquatic species are excluded at Stage 0 (rulebook, 2026-09-30): they
 * need standing water, which a planting bed does not provide, so they are
 * removed before scoring rather than given a layer. They used to sit in
 * L7 Specialist, which is why Aquatic no longer appears in the placement
 * layers at all. */
export const AQUATIC_PLANT_TYPES = ["aquatic"];
