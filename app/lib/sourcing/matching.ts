import type { Plant } from "../../data/plants.ts";
import { cleanTitle } from "./sizes.ts";

/**
 * Match ladder (1_Sources note): exact / cultivar / hybrid ("related
 * plant") / unresolved (hidden). Ported from the retired scraper's rules:
 * a listing is tied to a species only when its name says so - never guess.
 *
 *   exact     the species' binomial, nothing else but size/pack words
 *   cultivar  the binomial plus a cultivar or form ('Jolly Joker', PBR, ...)
 *   hybrid    the species crossed with another ("x" / "×")  -> Related plant
 *   common    a common name that belongs to this species alone -> Found
 *   unresolved anything else: genus-only titles, other species, mixes,
 *              seed kits - hidden
 */

export type MatchRank = "exact" | "cultivar" | "hybrid" | "common" | "unresolved";

export const matchLabel = (rank: MatchRank): "Found" | "Related plant" | null =>
  rank === "hybrid" ? "Related plant" : rank === "unresolved" ? null : "Found";

export type NameIndex = {
  binomials: Set<string>;
  genera: Set<string>;
  /** common name (lowercase) -> binomials that carry it */
  commonNames: Map<string, Set<string>>;
};

const binomialOf = (scientificName: string) =>
  scientificName.trim().split(/\s+/).slice(0, 2).join(" ").toLowerCase();

/** Common names as recorded, split on ";" with language tags removed:
 * "coulter-bush (Eng.); koulterbos" -> ["coulter-bush", "koulterbos"]. */
export function commonNamesOf(plant: Pick<Plant, "commonName">): string[] {
  return plant.commonName
    .split(/[;,]/)
    .map((name) => name.replace(/\([^)]*\)/g, "").replace(/[–—-]/g, " ").replace(/\s+/g, " ").trim().toLowerCase())
    .filter((name) => name.length >= 4);
}

export function buildNameIndex(plants: readonly Pick<Plant, "scientificName" | "commonName">[]): NameIndex {
  const binomials = new Set<string>();
  const genera = new Set<string>();
  const commonNames = new Map<string, Set<string>>();
  for (const plant of plants) {
    const binomial = binomialOf(plant.scientificName);
    binomials.add(binomial);
    genera.add(binomial.split(" ")[0]);
    for (const name of commonNamesOf(plant)) {
      if (!commonNames.has(name)) commonNames.set(name, new Set());
      commonNames.get(name)!.add(binomial);
    }
  }
  return { binomials, genera, commonNames };
}

const NOT_A_PLANT = /\b(seeds?|seed kit|gift card|voucher|fertili[sz]er|planter|pot only|compost)\b/i;
const MIXED = /\b(mixed|mix|assorted|assortment|various|selection|our choice)\b/i;
const HYBRID = /(^|\s)(x|×)(\s|$)/i;
const CULTIVAR = /['‘’"“”]|\bpbr\b|®|™|\bcv\.?\s/i;
/** Words that say nothing about the plant's identity. */
const FILLER = new Set([
  "pot", "pots", "plant", "plants", "bag", "bags", "tree", "trees", "indigenous", "small", "medium",
  "large", "extra", "mini", "cm", "l", "lt", "litre", "litres", "kg", "pack", "pk", "tray", "of",
  "the", "and", "in", "a", "sp", "sp.", "spp", "spp.", "subsp", "subsp.", "var", "var.", "plug",
  "plugs", "seedling", "seedlings", "each", "per", "shrub", "groundcover", "ground", "cover",
]);

function words(title: string): string[] {
  return cleanTitle(title)
    .toLowerCase()
    .replace(/\d+(?:[.,]\d+)?\s*(?:cm|mm|m|l|lt|ltr|litres?|ℓ|kg|pk|pack)\b/g, " ")
    .replace(/[|()[\]{}:/\\–—-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function classifyListing(
  title: string,
  target: Pick<Plant, "scientificName" | "commonName">,
  index: NameIndex,
): MatchRank {
  const text = cleanTitle(title);
  if (NOT_A_PLANT.test(text)) return "unresolved";
  const tokens = words(text);
  const joined = ` ${tokens.join(" ")} `;
  const [genus, epithet] = binomialOf(target.scientificName).split(" ");
  if (!genus || !epithet) return "unresolved";

  const hasGenus = tokens.includes(genus);
  const hasEpithet = tokens.includes(epithet);
  const hybrid = HYBRID.test(joined) || text.includes("×");

  // Other species the title names (genus + epithet pairs in the catalogue).
  const named = new Set<string>();
  for (let i = 0; i + 1 < tokens.length; i += 1) {
    const pair = `${tokens[i]} ${tokens[i + 1]}`;
    if (index.binomials.has(pair)) named.add(pair);
  }
  const target2 = `${genus} ${epithet}`;

  if (hasGenus && hasEpithet) {
    if (hybrid) return "hybrid";
    if (joined.includes(` ${target2} `)) {
      if ([...named].some((other) => other !== target2)) return "unresolved";
      const rest = tokens.filter(
        (word) => word !== genus && word !== epithet && !FILLER.has(word) && !/^\d/.test(word),
      );
      const commonWords = new Set(commonNamesOf(target).flatMap((name) => name.split(/\s+/)));
      const extra = rest.filter((word) => !commonWords.has(word));
      return CULTIVAR.test(text) || extra.length > 0 ? "cultivar" : "exact";
    }
  }
  if (named.size > 0) return "unresolved"; // names a different species
  if (MIXED.test(text)) return "unresolved";
  // A genus without its species ("Leucadendron Jolly Joker") cannot be tied
  // to one species: hidden, never guessed.
  if (tokens.some((word) => index.genera.has(word))) return "unresolved";

  // A common name that belongs to this species alone. A one-word common
  // name ("pincushion") is often used for a whole genus, so it counts only
  // when it is the entire name in the title.
  const core = tokens.filter((word) => !FILLER.has(word) && !/^\d/.test(word)).join(" ");
  for (const name of commonNamesOf(target)) {
    const species = index.commonNames.get(name);
    if (!species || species.size !== 1) continue;
    if (name.includes(" ") ? joined.includes(` ${name} `) : core === name) return "common";
  }
  return "unresolved";
}
