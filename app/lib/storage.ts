import { parseGardenBrief, type GardenBrief } from "./planning/index.ts";

/** Versioned schema key. Bumping the version requires adding a step to
 * `migrate()` first - users lose their saved gardens otherwise. */
const STORAGE_KEY = "garden_tool_v1";
const SCHEMA_VERSION = 1;

/** Keys written before the schema was versioned. Read once, folded into
 * the new store, then left alone (removing them would strand anyone who
 * opens an older build). */
const LEGACY_SAVED_PLANTS_KEY = "silly-goose-saved";
const LEGACY_BRIEF_KEY = "silly-goose-brief";

export type SavedLayoutSpecies = {
  plantId: string;
  quantity: number;
};

/** Where each plant goes, so the gardener can plant it out later.
 * Metres from the bed's west (x) and north (y) edges. */
export type SavedPlacement = {
  plantId: string;
  xM: number;
  yM: number;
  radiusM: number;
};

/** The bed budget line as shown when the garden was saved. */
export type SavedBudget = {
  text: string;
  checkedAt: string;
  place: string | null;
};

export type SavedLayout = {
  id: string;
  /** What the layout optimised for, e.g. "Most colourful" - shown so the
   * user can tell saved gardens apart. */
  character: string;
  /** A name the gardener gave this garden, which replaces `character`
   * wherever the layout is listed. Null until they set one, so older
   * saves keep showing what they always showed. */
  label: string | null;
  /** ISO date. Displayed wherever saved layouts are listed. */
  createdAt: string;
  brief: GardenBrief;
  species: SavedLayoutSpecies[];
  /** Reproducibility inputs. A saved layout must regenerate identically,
   * so the seed and the variation counter travel with it. */
  seed: string | null;
  variationCounter: number;
  /** Fingerprint of the dataset the layout was made from (null for
   * layouts saved before versioning). If the dataset has since changed,
   * the same seed may no longer reproduce the same garden. */
  datasetVersion: string | null;
  /** Fingerprint of the algorithm rulebook the layout was made with. */
  rulesVersion: string | null;
  /** The planting plan itself (null for gardens saved before plans were
   * stored). */
  placements: SavedPlacement[] | null;
  /** The nursery budget line at the time of saving, if it had arrived. */
  budget: SavedBudget | null;
};

export type GardenStore = {
  version: number;
  savedPlantIds: string[];
  /** Plants the user has ruled out by hand. They are removed at Stage 0,
   * before anything is scored, so an excluded plant cannot reach a plan.
   * This is a preference, not evidence - see gardenPlan's `not-excluded`
   * constraint. A missing field reads as empty, so older stores load
   * unchanged and the schema version does not move. */
  excludedPlantIds: string[];
  brief: GardenBrief | null;
  savedLayouts: SavedLayout[];
};

const emptyStore: GardenStore = {
  version: SCHEMA_VERSION,
  savedPlantIds: [],
  excludedPlantIds: [],
  brief: null,
  savedLayouts: [],
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Exported for tests: this is the function that decides what an older
 * stored garden becomes, so the compatibility rules are checkable. */
export function parseSavedLayout(value: unknown): SavedLayout | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const brief = parseGardenBrief(record.brief);
  if (
    typeof record.id !== "string" ||
    typeof record.createdAt !== "string" ||
    !brief ||
    !Array.isArray(record.species)
  ) {
    return null;
  }

  const species = record.species.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    return typeof entry.plantId === "string" &&
      typeof entry.quantity === "number" &&
      Number.isFinite(entry.quantity)
      ? [{ plantId: entry.plantId, quantity: entry.quantity }]
      : [];
  });

  return {
    id: record.id,
    character: typeof record.character === "string" ? record.character : "Saved garden",
    label:
      typeof record.label === "string" && record.label.trim() ? record.label : null,
    createdAt: record.createdAt,
    brief,
    species,
    seed: typeof record.seed === "string" ? record.seed : null,
    variationCounter:
      typeof record.variationCounter === "number" ? record.variationCounter : 0,
    datasetVersion:
      typeof record.datasetVersion === "string" ? record.datasetVersion : null,
    rulesVersion:
      typeof record.rulesVersion === "string" ? record.rulesVersion : null,
    placements: Array.isArray(record.placements)
      ? record.placements.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const entry = item as Record<string, unknown>;
          return typeof entry.plantId === "string" &&
            [entry.xM, entry.yM, entry.radiusM].every((v) => typeof v === "number" && Number.isFinite(v))
            ? [{ plantId: entry.plantId, xM: entry.xM as number, yM: entry.yM as number, radiusM: entry.radiusM as number }]
            : [];
        })
      : null,
    budget:
      record.budget && typeof record.budget === "object" &&
      typeof (record.budget as Record<string, unknown>).text === "string"
        ? {
            text: (record.budget as Record<string, unknown>).text as string,
            checkedAt: String((record.budget as Record<string, unknown>).checkedAt ?? ""),
            place: typeof (record.budget as Record<string, unknown>).place === "string"
              ? ((record.budget as Record<string, unknown>).place as string)
              : null,
          }
        : null,
  };
}

/** Fold any older shape into the current one. Each future version adds a
 * step here rather than replacing this function. */
function migrate(raw: unknown): GardenStore {
  if (!raw || typeof raw !== "object") return { ...emptyStore };
  const record = raw as Record<string, unknown>;

  return {
    version: SCHEMA_VERSION,
    savedPlantIds: isStringArray(record.savedPlantIds) ? record.savedPlantIds : [],
    excludedPlantIds: isStringArray(record.excludedPlantIds)
      ? record.excludedPlantIds
      : [],
    brief: parseGardenBrief(record.brief),
    savedLayouts: Array.isArray(record.savedLayouts)
      ? record.savedLayouts.flatMap((item) => {
          const layout = parseSavedLayout(item);
          return layout ? [layout] : [];
        })
      : [],
  };
}

function readLegacy(): GardenStore | null {
  const savedValue = window.localStorage.getItem(LEGACY_SAVED_PLANTS_KEY);
  const briefValue = window.localStorage.getItem(LEGACY_BRIEF_KEY);
  if (savedValue === null && briefValue === null) return null;

  const parsedSaved = savedValue ? JSON.parse(savedValue) : [];
  return {
    version: SCHEMA_VERSION,
    savedPlantIds: isStringArray(parsedSaved) ? parsedSaved : [],
    excludedPlantIds: [],
    brief: briefValue ? parseGardenBrief(JSON.parse(briefValue)) : null,
    savedLayouts: [],
  };
}

export function loadStore(): GardenStore {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value) return migrate(JSON.parse(value));
    return readLegacy() ?? { ...emptyStore };
  } catch {
    // Private windows and cleared site data both throw here; an empty
    // store is the right answer, not a crash.
    return { ...emptyStore };
  }
}

export function saveStore(store: GardenStore): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...store, version: SCHEMA_VERSION }),
    );
  } catch {
    // Storage full or blocked - the session still works, it just will not
    // persist. Nothing useful to tell the user mid-interaction.
  }
}

export function createLayoutId(): string {
  return `layout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** "18 Sept 2026" - how saved layout dates render in listings. */
export function formatSavedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
