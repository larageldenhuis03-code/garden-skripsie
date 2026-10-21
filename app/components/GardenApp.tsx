"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  biomeLabels,
  bioregionLabels,
  plants,
  sunLabels,
  waterLabels,
  type Bioregion,
  type NationalBiome,
  type Plant,
  type Sun,
  type Water,
} from "../data/plants";
import {
  MAX_BED_DIMENSION_M,
  MIN_BED_DIMENSION_M,
  bedShapeFor,
  bedShapeLabels,
  buildGardenPlan,
  buildGardenPlanVariants,
  neverPlantedReason,
  MINIMUM_SCREENING_SPECIES,
  availableColours,
  colourSchemeLabels,
  countScreeningSpecies,
  extraPreferenceDescriptions,
  extraPreferenceLabels,
  hasUnknownColour,
  colourSchemes,
  evaluateHardFilters,
  pickedColours,
  MINIMUM_VIABLE_POOL,
  gardenStyleDescriptions,
  survivesHardFilters,
  gardenStyleLabels,
  withRelaxedFilter,
  soilLabels,
  windDescriptions,
  windLabels,
  validateGardenBrief,
  type ColourPreference,
  type ColourScheme,
  type ExtraPreference,
  type GardenBrief,
  type GardenPlan,
  type GardenStyle,
  type Wind,
  type ViewingEdge,
  type PlantAssessment,
  rowsAvailable,
  WIND_SITE_FACTOR,
  computeHeightTiers,
  tierOf,
} from "../lib/planning";
import bioregionMapData from "../data/bioregion_map.generated.json" with { type: "json" };
import { isEstimatedBioregion, places, type Place } from "../data/places";
import { SourcingPanel } from "./SourcingPanel";
import { traceEnabled, tracePlan } from "../lib/planning/trace.ts";
import { PlantTypeSymbol } from "./PlantTypeSymbol";
import { isFeaturePlant, roleTypeOf } from "../lib/planning/engineData.ts";
import { bedDrawing } from "./bedDrawing.ts";
import { DATASET_VERSION } from "../data/datasetVersion";
import {
  createLayoutId,
  formatSavedDate,
  loadStore,
  saveStore,
  type SavedBudget,
  type SavedLayout,
} from "../lib/storage.ts";

type View = "home" | "finder" | "results" | "browse" | "saved" | "method";

/** The answers the finder opens with. Not a test fixture: the engine's
 * regression briefs live in tests/engine.test.ts. */
const defaultBrief: GardenBrief = {
  biomes: [],
  bioregion: "Southwest Fynbos Bioregion",
  // Owner, 21 Oct 2026 (usability review): sun, water and soil remove
  // plants, so they start blank - a pre-ticked answer is taken without
  // being read. Continue asks for all four.
  soil: "" as GardenBrief["soil"],
  wind: "" as GardenBrief["wind"],
  viewingEdge: "north",
  sun: "" as GardenBrief["sun"],
  water: "" as GardenBrief["water"],
  bedWidthM: 2,
  bedLengthM: 3,
  style: "undecided",
  colour: { mode: "none" },
  extras: [],
};

/** One line under each soil option, so no block is left with bare
 * labels while its neighbours explain themselves. The first three
 * describe the squeeze test above; the fourth says what the planner
 * actually does with an unknown answer. */
const SOIL_DESCRIPTIONS: Record<string, string> = {
  sandy: "Loose and free-draining",
  loam: "Balanced, crumbly soil",
  clay: "Heavy soil that holds water",
  "not-sure": "We will accept any of the three.",
};

/** Every plant type in the catalogue, with how many carry it. A plant
 * listed as "Ground Cover, Perennial" counts under both, and appears
 * under either filter - the field is a list, so it is read as one. */
const PLANT_TYPE_OPTIONS: { value: string; label: string; count: number }[] = (() => {
  const counts = new Map<string, number>();
  for (const plant of plants) {
    for (const part of String(plant.form ?? "")
      .split(",")
      .map((piece) => piece.trim())
      .filter(Boolean)) {
      counts.set(part, (counts.get(part) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value, count]) => ({ value, label: value, count }));
})();

/** The five steps, named so people know what is coming. */
const STEP_NAMES = ["Location", "Conditions", "Size", "Style", "Extras"];

/** Each page has its own address, so the browser's Back button works. */
const VIEW_PATHS = {
  home: "#/",
  finder: "#/plan-a-garden",
  results: "#/garden-plan",
  browse: "#/plant-library",
  method: "#/how-it-works",
  saved: "#/my-gardens",
} as const;
const stepPath = (step: number) => `${VIEW_PATHS.finder}/step-${step + 1}`;

/** Letters to change to turn a into b, for forgiving town search. */
function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = row[j];
      row[j] = next;
    }
  }
  return row[b.length];
}

/** Jumps to the top of the page at once. "instant", not "auto": the page sets
 * `scroll-behavior: smooth`, which "auto" follows, so each new step used to
 * open where the last one was scrolled to and then slide up. */
function scrollToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}

/** Where this plant's values come from, read from its own source fields
 * so the note is true for this plant, not for the catalogue in general. */
function provenanceText(plant: Plant): string {
  const parts: string[] = [];
  const from = [
    plant.dataSource.includes("plantzafrica") ? "a PlantZAfrica (SANBI) profile" : null,
    plant.dataSource.includes("bioscape")
      ? `${plant.occurrenceCount} BioSCape occurrence record${plant.occurrenceCount === 1 ? "" : "s"} in the Western Cape`
      : null,
  ].filter(Boolean);
  if (from.length) parts.push(`This plant comes from ${from.join(" and ")}.`);
  const size = (source: string | null, measured: string) =>
    source === "original" ? measured
      : source === "web-research" ? "taken from published sources"
      : source === "expert-estimate" ? "an expert estimate"
      : "estimated from similar plants, not measured";
  parts.push(`Its height is ${size(plant.heightSource, "a recorded value")}; its spread is ${size(plant.spreadSource, "a measured value")}.`);
  const inferred: string[] = [];
  const unknown: string[] = [];
  for (const [name, source] of [["light", plant.sunSource], ["water", plant.waterSource], ["soil", plant.soilTypeSource]] as const) {
    const s = (source ?? "").toUpperCase();
    if (s === "GENUS") inferred.push(`${name} from its genus`);
    else if (s === "BIOME") inferred.push(`${name} from its vegetation type`);
    else if (s === "UNRESOLVED" || s === "") unknown.push(name);
  }
  if (!inferred.length && !unknown.length) parts.push("Its light, water and soil needs are recorded.");
  if (inferred.length) parts.push(`Inferred, not recorded: ${inferred.join("; ")}.`);
  if (unknown.length) parts.push(`Not known: ${unknown.join(", ")}.`);
  return parts.join(" ");
}

function formatDimension(value: number | null) {
  if (value === null) return "Not measured";
  if (value < 100) return `${Math.round(value)} cm`;
  const metres = value / 100;
  return `${Number.isInteger(metres) ? metres : metres.toFixed(1)} m`;
}

function PlantPortrait({
  plant,
  hero = false,
}: {
  plant: Plant;
  hero?: boolean;
}) {
  // Same retry and the same final fallback as PlantPhoto. Without this a
  // dead URL rendered a broken-image icon here, which is the one outcome
  // the drawn placeholder exists to prevent.
  const { attempt, failed, onError } = usePhotoRetry(plant.photoUrl);

  if (plant.photoUrl && !failed) {
    return (
      <div
        className={`plant-portrait has-photo accent-${plant.accent}${hero ? " portrait-hero" : ""}`}
      >
        <img
          key={attempt}
          className="portrait-photo"
          src={plant.photoUrl}
          alt={`${plant.commonName} (${plant.scientificName})`}
          loading="lazy"
          onError={onError}
        />
        <span className="portrait-index">{plant.id}</span>
        <div className="portrait-caption">
          <strong>{plant.scientificName}</strong>
          {plant.photoAttribution && (
            <small>
              Photo:{" "}
              {plant.photoSourceUrl ? (
                <a
                  href={plant.photoSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                >
                  {plant.photoAttribution}
                </a>
              ) : (
                plant.photoAttribution
              )}
            </small>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`plant-portrait accent-${plant.accent}${hero ? " portrait-hero" : ""}`}
      aria-label={`Image placeholder for ${plant.commonName}, prompt ${plant.id}`}
    >
      <span className="portrait-index">{plant.id}</span>
      <span className="portrait-stem" aria-hidden="true" />
      <span className="portrait-leaf leaf-one" aria-hidden="true" />
      <span className="portrait-leaf leaf-two" aria-hidden="true" />
      <span className="portrait-leaf leaf-three" aria-hidden="true" />
      <div className="portrait-caption">
        <span>Botanical image coming soon</span>
        <strong>{plant.scientificName}</strong>
        <small>Artwork reference {plant.id}</small>
      </div>
    </div>
  );
}

function Header({
  view,
  savedCount,
  navigate,
}: {
  view: View;
  /** null until the device store has loaded, so no "0" flashes first. */
  savedCount: number | null;
  navigate: (view: View) => void;
}) {
  return (
    <header className="site-header">
      <button className="wordmark" onClick={() => navigate("home")}>
        <span>Silly Goose</span>
        <small>Garden planner</small>
      </button>
      <nav aria-label="Primary navigation">
        <button
          className={view === "finder" || view === "results" ? "is-active" : ""}
          onClick={() => navigate("finder")}
        >
          Plan a garden
        </button>
        <button
          className={view === "browse" ? "is-active" : ""}
          onClick={() => navigate("browse")}
        >
          Plant library
        </button>
        <button
          className={view === "method" ? "is-active" : ""}
          onClick={() => navigate("method")}
        >
          How it works
        </button>
      </nav>
      <button className="saved-link" onClick={() => navigate("saved")}>
        <span className="saved-label">My gardens</span>
        <span className="saved-count">{savedCount ?? ""}</span>
      </button>
    </header>
  );
}

function HomeView({
  start,
  browse,
  openSavedGardens,
  savedLayoutCount,
}: {
  start: () => void;
  browse: () => void;
  openSavedGardens: () => void;
  savedLayoutCount: number;
}) {
  return (
    <main>
      <section className="home-page">
        <div className="home-copy">
          <h1>
            Let’s grow your <em>garden.</em>
          </h1>
          <p className="home-intro">
            Tell us about your space, its sun and soil, and what you love.
            We’ll find suitable plants, arrange them into a garden layout, and
            estimate what your planting could cost.
          </p>
          <div className="home-actions">
            <button className="button button-dark" onClick={start}>
              Create my garden
            </button>
            <button className="text-link" onClick={browse}>
              Browse plant library →
            </button>
            {/* Only offered once there is something to open. */}
            {savedLayoutCount > 0 && (
              <button className="text-link" onClick={openSavedGardens}>
                My saved gardens ({savedLayoutCount})
              </button>
            )}
          </div>
        </div>
        <figure className="home-illustration">
          <img
            src="/images/flowers-sketch.png"
            alt="Crayon sketch of three flowers: a red-hot poker, an agapanthus and a crane flower"
            width={981}
            height={796}
          />
        </figure>
      </section>
    </main>
  );
}

/** When the user picks a bioregion straight off the map rather than a
 * named place, derive its biomes from every place already mapped to that
 * bioregion. Falls back to Fynbos, which covers most of the province. */
function biomesForBioregion(bioregion: Bioregion): NationalBiome[] {
  const found = new Set<NationalBiome>();
  for (const place of places) {
    if (place.bioregion === bioregion) {
      for (const biome of place.biomes) found.add(biome);
    }
  }
  return found.size > 0 ? [...found] : ["Fynbos"];
}

/** One plain-language line per biome, shown beside each selected
 * vegetation type so the choice means something to a novice. */
const biomeDescriptions: Record<NationalBiome, string> = {
  Fynbos: "Fine-leaved Cape shrubland — proteas, ericas and restios.",
  "Succulent Karoo": "Dry, winter-rainfall scrub with many succulents.",
  "Nama Karoo": "Open, arid shrubland with summer rain.",
  Grassland: "Grass-dominated veld with few shrubs or trees.",
  Savanna: "Grassy ground layer under scattered trees.",
  "Albany Thicket": "Dense, spiny, drought-hardy thicket.",
  "Indian Ocean Coastal Belt": "Warm, humid coastal forest and grassland.",
  Forest: "Closed-canopy Afrotemperate forest in sheltered ravines.",
  Desert: "Extremely arid, sparsely vegetated ground.",
};


/** A single optional screen. Every option promotes matching species and
 * penalises nothing, so this can never shrink the pool (spec 6). */
function ExtraPreferencesPicker({
  brief,
  onChange,
}: {
  brief: GardenBrief;
  onChange: (extras: ExtraPreference[]) => void;
}) {
  // Privacy is the thin one - warn from the pool that actually survives
  // this user's site answers, not from the whole catalogue.
  const screeningCount = useMemo(() => {
    const pool = plants.filter(
      (plant) => !plant.excludedFromLayout && survivesHardFilters(plant, brief),
    );
    return countScreeningSpecies(pool);
  }, [brief]);

  const toggle = (extra: ExtraPreference) =>
    onChange(
      brief.extras.includes(extra)
        ? brief.extras.filter((item) => item !== extra)
        : [...brief.extras, extra],
    );

  const privacyThin =
    brief.extras.includes("privacy") &&
    screeningCount < MINIMUM_SCREENING_SPECIES;

  return (
    <div className="choice-stack">
      <div className="choice-grid two-column">
        {(Object.keys(extraPreferenceLabels) as ExtraPreference[]).map((extra) => (
          <ChoiceButton
            key={extra}
            multi
            selected={brief.extras.includes(extra)}
            title={extraPreferenceLabels[extra]}
            copy={extraPreferenceDescriptions[extra]}
            onClick={() => toggle(extra)}
          />
        ))}
      </div>
      {privacyThin && (
        <p className="filter-reason is-warning">
          Only {screeningCount} plant{screeningCount === 1 ? "" : "s"} suited to
          your site {screeningCount === 1 ? "is" : "are"} recorded as a hedge or
          screen, so we cannot build much privacy into this bed. We will still
          put {screeningCount === 1 ? "it" : "them"} first.
        </p>
      )}
    </div>
  );
}

/** Colour is optional and skipping it is a first-class choice, shown as
 * prominently as the two ways of expressing a preference (spec 5.2). */
function ColourPreferencePicker({
  brief,
  value,
  onChange,
}: {
  brief: GardenBrief;
  value: ColourPreference;
  onChange: (preference: ColourPreference) => void;
}) {
  // Only offer colours the user can actually get: the pool that already
  // survives their site answers, minus anything never recommended.
  const offered = useMemo(() => {
    const pool = plants.filter(
      (plant) => !plant.excludedFromLayout && survivesHardFilters(plant, brief),
    );
    return availableColours(pool);
  }, [brief]);

  const toggleCustom = (colour: string) => {
    // Picking a chip after a palette starts from that palette's colours.
    const current =
      value.mode === "custom"
        ? value.colours
        : value.mode === "scheme"
          ? [...colourSchemes[value.scheme]]
          : [];
    const next = current.includes(colour)
      ? current.filter((item) => item !== colour)
      : [...current, colour];
    onChange(next.length === 0 ? { mode: "none" } : { mode: "custom", colours: next });
  };

  return (
    <fieldset>
      <legend>2. Colour palette</legend>
      <p className="field-help">What colours appeal to you?</p>
      <div className="colour-modes">
        <ChoiceButton
          selected={value.mode === "none"}
          title="No colour preference"
          copy="We will not favour any particular colour."
          onClick={() => onChange({ mode: "none" })}
        />
        {(Object.keys(colourSchemes) as ColourScheme[]).map((scheme) => {
          const selected = value.mode === "scheme" && value.scheme === scheme;
          return (
            <button
              key={scheme}
              type="button"
              className={`choice-button colour-scheme${selected ? " is-selected" : ""}`}
              onClick={() => onChange({ mode: "scheme", scheme })}
              aria-pressed={selected}
            >
              <span>{selected ? "●" : "○"}</span>
              <strong>{colourSchemeLabels[scheme]}</strong>
              {/* The colours themselves, rather than their names: a
                  gardener choosing a palette is choosing by eye. */}
              <span className="colour-swatches" aria-hidden="true">
                {colourSchemes[scheme].map((colour) => (
                  <i
                    key={colour}
                    style={{ background: flowerColourInk[colour] ?? UNKNOWN_COLOUR_INK }}
                  />
                ))}
              </span>
              <small>{colourSchemes[scheme].join(", ")}</small>
            </button>
          );
        })}
      </div>

      <details className="colour-custom">
        <summary>Or pick exact colours</summary>
        <div className="colour-chips">
          {offered.map(({ colour }) => {
            const selected =
              (value.mode === "custom" && value.colours.includes(colour)) ||
              (value.mode === "scheme" && (colourSchemes[value.scheme] as readonly string[]).includes(colour));
            return (
              <button
                key={colour}
                type="button"
                className={`colour-chip${selected ? " is-selected" : ""}`}
                onClick={() => toggleCustom(colour)}
                aria-pressed={selected}
              >
                <i
                  className="chip-swatch"
                  aria-hidden="true"
                  style={{ background: flowerColourInk[colour] ?? UNKNOWN_COLOUR_INK }}
                />
                {colour[0].toUpperCase() + colour.slice(1)}
              </button>
            );
          })}
        </div>
        {offered.length === 0 && (
          <p className="filter-reason">
            None of the plants that suit your site have a recorded flower
            colour.
          </p>
        )}
      </details>
    </fieldset>
  );
}

/** Live "how many plants can survive here" readout under each site
 * question, plus the named degradation path when the pool gets too small
 * to plan from (spec 4, 4.1). */
function SurvivingCount({
  brief,
  setBrief,
  excluded = [],
  openExcluded,
}: {
  brief: GardenBrief;
  setBrief: (brief: GardenBrief) => void;
  /** The user's own exclusions, so a small pool can name them as a cause. */
  excluded?: string[];
  openExcluded?: () => void;
}) {
  const answered = brief.sun in sunLabels && brief.water in waterLabels && brief.soil in soilLabels;
  const outcome = useMemo(
    () => (answered ? evaluateHardFilters(plants, brief, excluded) : null),
    [answered, brief, excluded],
  );

  if (!outcome) {
    return (
      <p className="filter-count">
        Answer sun, water and soil to see how many plants can grow here.
      </p>
    );
  }

  if (!outcome.belowMinimum) {
    return (
      <p className="filter-count">
        <strong>{outcome.survivingCount.toLocaleString("en-ZA")}</strong> plants
        can survive here.
      </p>
    );
  }

  const restrictiveLabel = outcome.restrictive
    .slice(0, 3)
    .map((filter) =>
      filter === "soil"
        ? soilLabels[brief.soil].toLowerCase()
        : filter === "sun"
          ? sunLabels[brief.sun].toLowerCase()
          : waterLabels[brief.water].toLowerCase(),
    )
    .join(" + ");

  return (
    <div className="filter-count is-warning">
      <p>
        <strong>{outcome.survivingCount}</strong> plants can survive here — too
        few to build a plan from. We need at least {MINIMUM_VIABLE_POOL}.
      </p>
      {restrictiveLabel && (
        <p className="filter-reason">
          {restrictiveLabel} is an uncommon combination in your area.
        </p>
      )}
      {outcome.excludedHere > 0 && (
        <p className="filter-reason">
          {outcome.excludedHere === 1
            ? "One plant that suits these conditions is one you excluded"
            : `${outcome.excludedHere} plants that suit these conditions are ones you excluded`}
          , so putting some back is the quickest way to get above the minimum.
          {openExcluded && (
            <>
              {" "}
              <button type="button" className="text-link" onClick={openExcluded}>
                Review your excluded plants
              </button>
            </>
          )}
        </p>
      )}
      {outcome.relaxations.length > 0 ? (
        <div className="filter-relax">
          <p className="filter-reason">
            We can widen one answer. Each option below shows what it admits and
            how many plants you would get back — nothing is changed until you
            choose.
          </p>
          {outcome.relaxations.map((relaxation) => (
            <button
              key={relaxation.filter}
              type="button"
              className="relax-option"
              onClick={() => setBrief(withRelaxedFilter(brief, relaxation.filter))}
            >
              <strong>{relaxation.label}</strong>
              <small>{relaxation.detail}</small>
              <b>{relaxation.recoveredCount.toLocaleString("en-ZA")} plants</b>
            </button>
          ))}
        </div>
      ) : (
        <p className="filter-reason">
          There is nothing left to widen safely. Vegetation type is never
          relaxed, and full sun and sheltered shade are never bridged. Change an
          answer above
          {outcome.excludedHere > 0 ? ", show some hidden plants again," : ""} or
          come back later: the catalogue only records light, water and soil for
          some species yet, and this combination will have more plants to choose
          from as that evidence is filled in.
        </p>
      )}
      {outcome.alreadyRelaxed.length > 0 && (
        <p className="filter-reason">
          Already widened:{" "}
          {outcome.alreadyRelaxed
            .map((filter) =>
              filter === "soil" ? "soil" : filter === "sun" ? "light" : "water",
            )
            .join(", ")}
          .
        </p>
      )}
    </div>
  );
}

/** Draws the bed the user is actually describing, to scale, as they type.
 * There is no shape to choose: the shape follows from the numbers, so the
 * two can never disagree. North is the top edge (spec 3). */
/**
 * What each step still needs, and why it matters.
 *
 * The validator already knows which fields are unanswered, but the finder
 * was only using its boolean: Continue greyed out with no explanation.
 * These say what is missing AND what it is for, because "choose a soil
 * description" does not tell anyone why they cannot move on.
 *
 * The distinction is deliberate: a BLOCKER stops the step, while a NOTE
 * is a consequence the user should know about but is free to accept.
 * Only the answers that actually filter plants are ever blockers - style,
 * colour and the extras rank plants and never remove one, so they stay
 * optional and are never demanded here.
 */
type StepCheck = { label: string; detail: string };

function stepBlockers(
  step: number,
  brief: GardenBrief,
  selectedPlace: Place | null,
  dimensionsValid: boolean,
): StepCheck[] {
  const out: StepCheck[] = [];
  if (step === 0) {
    if (selectedPlace === null) {
      out.push({
        label: "Your town or suburb",
        detail:
          "It decides which plants suit your area, and how far the nearest nurseries are.",
      });
    }
    if (brief.biomes.length === 0) {
      out.push({
        label: "At least one vegetation type",
        detail:
          "This is the filter that decides which plants can be recommended at all.",
      });
    }
  }
  if (step === 1) {
    if (!(brief.sun in sunLabels)) out.push({ label: "Sunlight", detail: "Choose one of the three." });
    if (!(brief.water in waterLabels)) out.push({ label: "Water", detail: "Choose one of the three." });
    if (!(brief.soil in soilLabels)) out.push({ label: "Soil", detail: "Choose one, or “I’m not sure”." });
    if (!(brief.wind in windLabels)) out.push({ label: "Wind exposure", detail: "Choose one of the three." });
  }
  if (step === 2 && !dimensionsValid) {
    for (const [label, value] of [["Width", brief.bedWidthM], ["Length", brief.bedLengthM]] as const) {
      if (Number.isFinite(value) && value >= MIN_BED_DIMENSION_M && value <= MAX_BED_DIMENSION_M) continue;
      out.push({
        label,
        detail: !Number.isFinite(value)
          ? "Enter a number in metres."
          : value > MAX_BED_DIMENSION_M
            ? `${value} m is too big — the most is ${MAX_BED_DIMENSION_M} m.`
            : `${value} m is too small — the least is ${MIN_BED_DIMENSION_M} m.`,
      });
    }
  }
  return out;
}

/** Consequences worth knowing, which never stop the user continuing. */
function stepNotes(step: number, brief: GardenBrief, survivors: number | null): StepCheck[] {
  const out: StepCheck[] = [];
  if (step === 1) {
    if (survivors !== null && survivors > 0 && survivors < 40) {
      out.push({
        label: `Only ${survivors} plants survive these conditions`,
        detail:
          "A plan is still possible, but there is little to choose from. Changing the light, water or soil answer opens it up.",
      });
    }
  }
  if (step === 3 || step === 4) {
    out.push({
      label: "These answers are optional",
      detail:
        "Style, colour and the extras change the order plants rank in. They never remove a plant.",
    });
  }
  return out;
}

/**
 * The four sides a gardener can stand on. Four, not eight: the depth axis
 * that puts tall plants at the back is the bed's own width or length, and a
 * diagonal has no such axis on a rectangle. So each option names the side
 * you stand on *and* the way you then look, and the arrow points into the
 * bed, matching the figure in the preview beside it.
 */
/** P30 / P60 of the catalogue's heights - the engine's own tiers
 * (3_Height_Tiers), so the drawing shows height the way the engine reads
 * it. Display only. */
const HEIGHT_TIERS = computeHeightTiers(plants);

const VIEWING_EDGE_OPTIONS: {
  edge: ViewingEdge;
  label: string;
  looking: string;
  arrow: string;
}[] = [
  { edge: "north", label: "North side", looking: "south", arrow: "↓" },
  { edge: "west", label: "West side", looking: "east", arrow: "→" },
  { edge: "east", label: "East side", looking: "west", arrow: "←" },
  { edge: "south", label: "South side", looking: "north", arrow: "↑" },
];

function BedPreview({
  widthM,
  lengthM,
  valid,
  viewingEdge,
}: {
  widthM: number;
  lengthM: number;
  valid: boolean;
  /** Which edge the gardener stands at, drawn as a figure on that side. */
  viewingEdge: ViewingEdge;
}) {
  // A scale drawing: the longer side fills the box, so a 30 m bed and a
  // 1 m bed are both legible and the proportions stay true. Margins leave
  // room for the compass letters and the dimension lines.
  const BOX = 300;
  const M = 68;
  const longest = Math.max(widthM, lengthM);
  const scale = valid && longest > 0 ? BOX / longest : 0;
  const w = Math.max(10, widthM * scale);
  const h = Math.max(10, lengthM * scale);
  const x0 = M + (BOX - w) / 2;
  const y0 = M + (BOX - h) / 2;
  const total = BOX + M * 2;

  // Grid lines every metre, but thinned on big beds so they stay readable.
  const step = scale * (longest > 20 ? 5 : 1);
  const gridStepM = longest > 20 ? 5 : 1;
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  if (valid && step > 3) {
    for (let x = x0 + step; x < x0 + w - 0.5; x += step) lines.push({ x1: x, y1: y0, x2: x, y2: y0 + h });
    for (let y = y0 + step; y < y0 + h - 0.5; y += step) lines.push({ x1: x0, y1: y, x2: x0 + w, y2: y });
  }

  // Where the gardener stands, and which way they face from there: always
  // the middle of the side they view from (owner, 20 Oct). The dimension
  // on that side moves to the opposite side instead, and the compass sits
  // in the corners, so nothing is under the figure.
  const figure = {
    north: { x: x0 + w / 2, y: y0 - 34, dx: 0, dy: 1 },
    south: { x: x0 + w / 2, y: y0 + h + 34, dx: 0, dy: -1 },
    east: { x: x0 + w + 36, y: y0 + h / 2, dx: -1, dy: 0 },
    west: { x: x0 - 36, y: y0 + h / 2, dx: 1, dy: 0 },
  }[viewingEdge];
  // The way you face is read off the same list the buttons use, so the
  // preview and the choice can never disagree about it.
  const looking = VIEWING_EDGE_OPTIONS.find((o) => o.edge === viewingEdge)?.looking;

  return (
    <figure className="bed-preview">
      <figcaption>Your bed, from above</figcaption>
      {valid ? (
        <svg
          viewBox={`0 0 ${total} ${total}`}
          className="bed-preview-svg"
          role="img"
          aria-label={`${widthM} by ${lengthM} metre bed, north at the top, viewed from the ${viewingEdge} side`}
        >
          {/* Compass: north is always the top edge of the drawing. In the
              left corners, so the middle of each side is free for the figure. */}
          <text className="bed-compass" x={18} y={16} textAnchor="middle">N</text>
          <path className="bed-compass-mark" d="M18,20 l-4,7 h8 z" />
          <path className="bed-compass-mark" d={`M18,${total - 20} l-4,-7 h8 z`} />
          <text className="bed-compass" x={18} y={total - 6} textAnchor="middle">S</text>

          {/* The bed, with a metre grid for scale. */}
          <rect className="bed-rect" x={x0} y={y0} width={w} height={h} />
          {lines.map((line, index) => (
            <line key={index} className="bed-grid-line" {...line} />
          ))}

          {/* Dimension lines, drawn outside the bed like a plan drawing:
              the width along the top and the length down the left, each
              moved to the opposite side when the figure stands there. */}
          <g className="bed-dimension">
            {(() => {
              const below = viewingEdge === "north";
              const yLine = below ? y0 + h + 14 : y0 - 14;
              const yText = below ? y0 + h + 28 : y0 - 18;
              return (
                <>
                  <line x1={x0} y1={yLine} x2={x0 + w} y2={yLine} />
                  <line x1={x0} y1={yLine - 4} x2={x0} y2={yLine + 4} />
                  <line x1={x0 + w} y1={yLine - 4} x2={x0 + w} y2={yLine + 4} />
                  <text x={x0 + w / 2} y={yText} textAnchor="middle">{widthM} m</text>
                </>
              );
            })()}
            {(() => {
              const right = viewingEdge === "west";
              const xLine = right ? x0 + w + 14 : x0 - 14;
              const xText = right ? x0 + w + 22 : x0 - 18;
              return (
                <>
                  <line x1={xLine} y1={y0} x2={xLine} y2={y0 + h} />
                  <line x1={xLine - 4} y1={y0} x2={xLine + 4} y2={y0} />
                  <line x1={xLine - 4} y1={y0 + h} x2={xLine + 4} y2={y0 + h} />
                  <text
                    x={xText}
                    y={y0 + h / 2}
                    textAnchor="middle"
                    transform={`rotate(-90 ${xText} ${y0 + h / 2})`}
                  >
                    {lengthM} m
                  </text>
                </>
              );
            })()}
          </g>

          {/* Where you stand, and the way you look into the bed. */}
          <g className="bed-figure">
            <circle cx={figure.x} cy={figure.y - 5} r={3.4} />
            <path d={`M${figure.x},${figure.y - 1} v7 M${figure.x - 4},${figure.y + 1} h8 M${figure.x},${figure.y + 6} l-3,5 M${figure.x},${figure.y + 6} l3,5`} />
            <path
              className="bed-figure-look"
              d={`M${figure.x + figure.dx * 9},${figure.y + figure.dy * 9} l${figure.dx * 12},${figure.dy * 12}`}
              markerEnd="url(#look)"
            />
          </g>
          <defs>
            <marker id="look" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 z" fill="currentColor" />
            </marker>
          </defs>
        </svg>
      ) : (
        <p className="bed-preview-empty">
          Each side must be between {MIN_BED_DIMENSION_M} m and {MAX_BED_DIMENSION_M} m. Fix the size to see your bed.
        </p>
      )}
      {valid && (
        <div className="bed-preview-legend">
          <span>
            <i className="swatch-bed" aria-hidden="true" /> garden bed
          </span>
          <span>
            <i className="swatch-grid" aria-hidden="true" /> {gridStepM} m grid (for scale)
          </span>
          <strong>
            {widthM} m × {lengthM} m · {(widthM * lengthM).toFixed(widthM * lengthM < 10 ? 1 : 0)} m²
          </strong>
        </div>
      )}
      {valid && (
        <p className="bed-preview-standing">
          You are standing on the <strong>{viewingEdge}</strong> side, looking {looking}.
        </p>
      )}
    </figure>
  );
}

/** Number inputs are held as text while being edited. Binding them
 * straight to a number means clearing the field yields Number("") === 0,
 * which writes a real 0 back and leaves a stubborn leading zero in front
 * of whatever is typed next. */
function DimensionField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(
    Number.isFinite(value) && value > 0 ? String(value) : "",
  );

  // Follow the brief when it changes from elsewhere (loading the test
  // garden, say) without fighting what is being typed.
  //
  // Object.is, not !==: an empty field reports NaN, and NaN !== NaN is
  // always true, so a plain comparison re-syncs on every render and spins
  // into an infinite re-render loop.
  const [lastValue, setLastValue] = useState(value);
  if (!Object.is(value, lastValue)) {
    setLastValue(value);
    const asNumber = Number(text);
    if (!Number.isFinite(asNumber) || !Object.is(asNumber, value)) {
      setText(Number.isFinite(value) && value > 0 ? String(value) : "");
    }
  }

  return (
    <label>
      <span>{label}</span>
      <div>
        <input
          type="number"
          inputMode="decimal"
          min={MIN_BED_DIMENSION_M}
          max={MAX_BED_DIMENSION_M}
          step="0.1"
          value={text}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            // An empty or half-typed field reports NaN rather than 0, so
            // it reads as "not answered yet" instead of a zero-size bed.
            const parsed = next.trim() === "" ? Number.NaN : Number(next);
            onChange(parsed);
          }}
          onBlur={() => {
            // Tidy "2." or "02" once the user moves on.
            const parsed = Number(text);
            if (Number.isFinite(parsed) && text.trim() !== "") {
              setText(String(parsed));
            }
          }}
        />
        <em>metres</em>
      </div>
    </label>
  );
}

function BiomeSelection({
  available,
  biomes,
  bioregionSource,
  onChange,
}: {
  /** Every vegetation type in the chosen area - the options on offer,
   * independent of which the user has ticked. */
  available: NationalBiome[];
  biomes: NationalBiome[];
  bioregionSource: string | null;
  onChange: (biomes: NationalBiome[]) => void;
}) {
  if (available.length === 0) return null;

  // A species is a candidate if any of its biomes is one of these, and it
  // is not excluded from beds - the same any-match rule the planner uses.
  const candidateCount = plants.filter(
    (plant) =>
      !plant.excludedFromLayout &&
      plant.biome?.some((biome) => biomes.includes(biome)),
  ).length;

  // Straight include/exclude. Nothing is pre-ticked, so the user is
  // choosing what to include rather than removing what they did not ask
  // for.
  const toggle = (biome: NationalBiome) =>
    onChange(
      biomes.includes(biome)
        ? biomes.filter((item) => item !== biome)
        : [...biomes, biome],
    );

  return (
    <div className="biome-selection">
      <p className="biome-lead">
        {available.length > 1
          ? "Your area has more than one type of natural vegetation. Choose the ones to include — pick several if your garden spans them, or you are not sure which it sits in."
          : "This is the natural vegetation of your area. Include it to see plants suited to it."}
      </p>

      <div className="biome-options">
        {available.map((biome) => {
          const selected = biomes.includes(biome);
          return (
            <button
              key={biome}
              type="button"
              className={`biome-option${selected ? " is-selected" : ""}`}
              onClick={() => toggle(biome)}
              aria-pressed={selected}
            >
              <span>{selected ? "☑" : "☐"}</span>
              <strong>{biomeLabels[biome]}</strong>
              <small>{biomeDescriptions[biome]}</small>
            </button>
          );
        })}
      </div>

      {isEstimatedBioregion(bioregionSource) && (
        <p className="biome-caveat">
          Estimated from the nearest mapped vegetation — adjust if you know
          your area.
        </p>
      )}

      {biomes.length === 0 ? (
        <p className="biome-count is-empty">
          Choose at least one to carry on.
        </p>
      ) : (
        <p className="biome-count">
          <strong>{candidateCount.toLocaleString("en-ZA")}</strong> plants
          suited to your area.
        </p>
      )}
    </div>
  );
}

function ChoiceButton({
  selected,
  title,
  copy,
  onClick,
  multi = false,
}: {
  selected: boolean;
  title: string;
  copy?: string;
  onClick: () => void;
  /** Several can be chosen: drawn as tick boxes, not radio dots. */
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      className={`choice-button${selected ? " is-selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span>{multi ? (selected ? "☑" : "☐") : selected ? "●" : "○"}</span>
      <strong>{title}</strong>
      {copy && <small>{copy}</small>}
    </button>
  );
}

/** Confirms the selection in terms of vegetation type, which is what
 * actually filters the plant list - the bioregion behind it is kept on
 * the record for traceability but is no longer shown here. */
function placeResultText(place: Place): string {
  const names = place.biomes.map((biome) => biomeLabels[biome]);
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

  if (isEstimatedBioregion(place.bioregionSource)) {
    return `${place.name} has no mapped natural vegetation of its own (likely urban or farmland), so we matched it to the nearest: ${list}.`;
  }
  if (place.biomes.length > 1) {
    return `${place.name} spans ${list}.`;
  }
  return `${place.name} sits in ${list}.`;
}

function PlaceCombobox({
  onChange,
}: {
  onChange: (place: Place) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const trimmed = query.trim().toLowerCase();
  const exact =
    trimmed.length > 0
      ? places.filter((place) => place.name.toLowerCase().includes(trimmed)).slice(0, 20)
      : [];
  // Small spelling slips ("stellenbosh") still find the town.
  const filtered =
    exact.length > 0 || trimmed.length < 4
      ? exact
      : places
          .map((place) => {
            const name = place.name.toLowerCase();
            return { place, d: Math.min(editDistance(trimmed, name), editDistance(trimmed, name.slice(0, trimmed.length))) };
          })
          .filter(({ d }) => d <= 2)
          .sort((a, b) => a.d - b.d)
          .slice(0, 10)
          .map(({ place }) => place);

  return (
    <div className="place-combobox" ref={containerRef}>
      <label>
        <span>Town or suburb</span>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder="e.g. Rondebosch, Cederberg, Hermanus"
          role="combobox"
          aria-expanded={open}
          aria-controls="place-combobox-list"
          aria-autocomplete="list"
          autoComplete="off"
        />
      </label>
      {open && trimmed.length > 0 && (
        <ul
          className="place-combobox-list"
          id="place-combobox-list"
          role="listbox"
        >
          {filtered.length ? (
            filtered.map((place) => (
              <li key={`${place.name}-${place.category}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected?.name === place.name}
                  onClick={() => {
                    onChange(place);
                    setSelected(place);
                    setQuery(place.name);
                    setOpen(false);
                  }}
                >
                  {place.name}
                  <span className="place-combobox-category">
                    {place.category}
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="place-combobox-empty" role="presentation">
              No matching place — try a nearby town, or use the map below
              instead.
            </li>
          )}
        </ul>
      )}
      {selected && (
        <p className="place-combobox-result">{placeResultText(selected)}</p>
      )}
    </div>
  );
}

// 25 bioregions share a repeating palette (indexed, not named per-region -
// there are too many for a hand-picked color per name to stay meaningful).
const BIOREGION_PALETTE_SIZE = 9;
const bioregionOrder = Object.keys(bioregionLabels) as Bioregion[];
const bioregionColorIndex = new Map(
  bioregionOrder.map((bioregion, index) => [bioregion, index % BIOREGION_PALETTE_SIZE]),
);

/** The map is an equirectangular projection, so x is linear in longitude
 * and y in latitude. Rather than duplicating the generator's constants, the
 * two lines are fitted to the map's own labelled towns. */
const mapProjection = (() => {
  const fit = (pairs: [number, number][]) => {
    const n = pairs.length;
    const mx = pairs.reduce((a, [x]) => a + x, 0) / n;
    const my = pairs.reduce((a, [, y]) => a + y, 0) / n;
    const slope =
      pairs.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0) /
      pairs.reduce((a, [x]) => a + (x - mx) ** 2, 0);
    return (value: number) => my + slope * (value - mx);
  };
  const towns: Record<string, [number, number]> = {
    "Cape Town": [-33.9249, 18.4241], Stellenbosch: [-33.9346, 18.86], Worcester: [-33.6464, 19.4485],
    Hermanus: [-34.4187, 19.2345], Knysna: [-34.0363, 23.0471], Clanwilliam: [-32.1811, 18.8963],
  };
  const labelled = bioregionMapData.townLabels.filter((t) => towns[t.name]);
  const xOf = fit(labelled.map((t) => [towns[t.name][1], t.x]));
  const yOf = fit(labelled.map((t) => [towns[t.name][0], t.y]));
  return (lat: number, lon: number) => ({ x: xOf(lon), y: yOf(lat) });
})();

type NurseryMapData = {
  pins: { nursery: string; branch: string; town: string; lat: number; lon: number; approximate: boolean; kind: string }[];
  notMapped: { nursery: string; reason: string }[];
};

function BioregionMap({
  value,
  onChange,
}: {
  value: Bioregion;
  onChange: (bioregion: Bioregion) => void;
}) {
  // Nursery branches from the sourcing settings file (2_Branches), geocoded
  // on the server; fetched once, shown as pins.
  const [nurseries, setNurseries] = useState<NurseryMapData | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/nurseries")
      .then((response) => response.json() as Promise<NurseryMapData & { ok: boolean }>)
      .then((data) => {
        if (!cancelled && data.ok) setNurseries({ pins: data.pins, notMapped: data.notMapped });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div className="bioregion-map">
      <svg
        className="bioregion-map-svg"
        viewBox={bioregionMapData.viewBox}
        role="group"
        aria-label="Map of the Western Cape's bioregions. Choose the bioregion closest to your garden."
      >
        <path
          className="bioregion-outline"
          d={bioregionMapData.outline}
          aria-hidden="true"
        />
        {bioregionMapData.regions.map((region) => {
          const bioregion = region.bioregion as Bioregion;
          const colorIndex = bioregionColorIndex.get(bioregion) ?? 0;
          return (
            <path
              key={bioregion}
              d={region.path}
              className={`bioregion-region bioregion-color-${colorIndex}${value === bioregion ? " is-selected" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={value === bioregion}
              aria-label={bioregionLabels[bioregion]}
              onClick={() => onChange(bioregion)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onChange(bioregion);
                }
              }}
            >
              <title>{bioregionLabels[bioregion]}</title>
            </path>
          );
        })}
        {bioregionMapData.townLabels.map((town) => (
          <text
            key={town.name}
            className="bioregion-map-town-label"
            x={town.x}
            y={town.y}
          >
            {town.name}
          </text>
        ))}
        {nurseries?.pins.map((pin, _position, all) => {
          const base = mapProjection(pin.lat, pin.lon);
          // Several branches at one point (e.g. three at George's town
          // centre) are fanned out so each pin stays visible.
          const same = all.filter((other) => {
            const o = mapProjection(other.lat, other.lon);
            return Math.hypot(o.x - base.x, o.y - base.y) < 6;
          });
          const k = same.indexOf(pin);
          const spread = same.length > 1 ? 9 : 0;
          const x = base.x + spread * Math.cos((2 * Math.PI * k) / same.length);
          const y = base.y + spread * Math.sin((2 * Math.PI * k) / same.length);
          return (
            <g key={`${pin.nursery}-${pin.branch}`} className={`nursery-pin nursery-pin-${pin.kind}`} transform={`translate(${x} ${y})`}>
              <circle r={7} />
              <title>
                {`${pin.branch}${pin.approximate ? " (town centre - street address not found)" : ""}${pin.kind === "walk-in" ? " - walk-in only" : pin.kind === "availability" ? " - wholesale availability list" : ""}`}
              </title>
            </g>
          );
        })}
      </svg>
      <div className="nursery-map-key">
        {nurseries ? (
          <>
            <p>
              <span className="nursery-key-dot" aria-hidden="true" /> Dots: the
              nurseries we check prices at.
            </p>
            <details className="nursery-not-mapped">
              <summary>Which nurseries?</summary>
              <p>
                {nurseries.pins.length} on the map
                {nurseries.pins.some((pin) => pin.approximate)
                  ? `, ${nurseries.pins.filter((pin) => pin.approximate).length} shown at their town centre`
                  : ""}
                .
                {nurseries.notMapped.length > 0
                  ? ` Also checked: ${nurseries.notMapped.map((n) => n.nursery).join(", ")}.`
                  : ""}
              </p>
            </details>
          </>
        ) : (
          <p>Loading nursery locations…</p>
        )}
      </div>
    </div>
  );
}

function FinderView({
  brief,
  setBrief,
  selectedPlace,
  setSelectedPlace,
  availableBiomes,
  setAvailableBiomes,
  finish,
  cancel,
  excluded,
  openExcluded,
}: {
  brief: GardenBrief;
  setBrief: (value: GardenBrief) => void;
  selectedPlace: Place | null;
  setSelectedPlace: (place: Place | null) => void;
  availableBiomes: NationalBiome[];
  setAvailableBiomes: (biomes: NationalBiome[]) => void;
  finish: () => void;
  cancel: () => void;
  /** The user's exclusions, so the live survivor count matches the pool the
   * engine will actually plan from. */
  excluded: string[];
  openExcluded: () => void;
}) {
  // Each step is its own browser history entry (usability review, 21 Oct),
  // so the Back button goes to the previous step instead of leaving.
  const [step, setStep] = useState(() => {
    if (typeof window === "undefined") return 0;
    const state = window.history.state as { view?: string; step?: number } | null;
    return state?.view === "finder" && Number.isInteger(state.step)
      ? Math.min(Math.max(state.step as number, 0), STEP_NAMES.length - 1)
      : 0;
  });
  const [attempted, setAttempted] = useState(false);
  const goToStep = (next: number) => {
    setStep(next);
    setAttempted(false);
    window.history.pushState({ view: "finder", step: next }, "", stepPath(next));
  };
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const state = event.state as { view?: string; step?: number } | null;
      if (state?.view === "finder") {
        setStep(Number.isInteger(state.step) ? (state.step as number) : 0);
        setAttempted(false);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // Every step opens at the top of the page, before it is painted.
  useLayoutEffect(() => {
    scrollToTop();
  }, [step]);

  const dimensionsValid =
    Number.isFinite(brief.bedWidthM) &&
    brief.bedWidthM >= MIN_BED_DIMENSION_M &&
    brief.bedWidthM <= MAX_BED_DIMENSION_M &&
    Number.isFinite(brief.bedLengthM) &&
    brief.bedLengthM >= MIN_BED_DIMENSION_M &&
    brief.bedLengthM <= MAX_BED_DIMENSION_M;
  const steps = [
    {
      title: "Where is your garden?",
      note: "Type your town or suburb, or click the map. We do not need your address.",
      content: (
        <div className="choice-stack place-step">
          <PlaceCombobox
            onChange={(place) => {
              setSelectedPlace(place);
              // The area's vegetation types become the options; nothing is
              // pre-selected, so the user picks what to include.
              setAvailableBiomes([...place.biomes]);
              // Only one type: ticked for you (usability review, 21 Oct).
              setBrief({ ...brief, biomes: place.biomes.length === 1 ? [...place.biomes] : [], bioregion: place.bioregion });
            }}
          />
          {/* Right under the town, so the confirmation sits where the
              answer was given (usability review, 21 Oct). */}
          <BiomeSelection
            available={availableBiomes}
            biomes={brief.biomes}
            bioregionSource={selectedPlace?.bioregionSource ?? null}
            onChange={(biomes) => setBrief({ ...brief, biomes })}
          />
          <BioregionMap
            value={brief.bioregion}
            onChange={(bioregion) => {
              setSelectedPlace(null);
              const found = biomesForBioregion(bioregion);
              setAvailableBiomes(found);
              setBrief({ ...brief, bioregion, biomes: found.length === 1 ? found : [] });
            }}
          />
        </div>
      ),
    },
    {
      title: "What are the conditions in this bed?",
      note: "Four quick answers about the site. Sun, water and soil narrow the plant list; wind shapes how the bed is arranged.",
      content: (
        <div className="choice-stack site-conditions">
          <fieldset>
            <legend>Sunlight</legend>
            <p className="field-help">
              How many hours of direct sunlight does your bed receive?
            </p>
            <div className="choice-grid">
              {(Object.keys(sunLabels) as Sun[]).map((sun) => (
                <ChoiceButton
                  key={sun}
                  selected={brief.sun === sun}
                  title={sun === "full" ? "Full sun" : sun === "part" ? "Part sun" : "Shade"}
                  copy={
                    sun === "full"
                      ? "Six or more hours"
                      : sun === "part"
                        ? "Three to six hours"
                        : "Less than three hours"
                  }
                  onClick={() => setBrief({ ...brief, sun })}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Water</legend>
            <p className="field-help">
              How much water will the bed get, from rain and your watering?
            </p>
            {/* A per-place note from the reviewed place list. It informs the
                answer and never sets it - the question is about what the
                gardener will actually do. Only some places carry it. */}
            {selectedPlace?.preferredWaterLevel === "low" && (
              <p className="field-note">
                {selectedPlace.name} is a dry area — gardens here usually do
                best with low watering.
              </p>
            )}
            <div className="choice-grid">
              {(Object.keys(waterLabels) as Water[]).map((water) => (
                <ChoiceButton
                  key={water}
                  selected={brief.water === water}
                  title={water === "low" ? "Little" : water === "moderate" ? "Some" : "Plenty"}
                  copy={
                    water === "low"
                      ? "Dry once plants are settled"
                      : water === "moderate"
                        ? "A good soak now and then"
                        : "Often damp, or watered often"
                  }
                  onClick={() => setBrief({ ...brief, water })}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Soil</legend>
            <p className="field-help">What best describes your soil?</p>
            <details className="field-more">
              <summary>How do I tell?</summary>
              <p>
                Wet a handful and squeeze it. If it falls apart at once it is
                sandy; if it holds a ball that crumbles when poked it is loam;
                if it stays in a sticky ribbon it is clay.
              </p>
            </details>
            <div className="choice-grid two-column compact-choices">
              {(Object.keys(soilLabels) as (keyof typeof soilLabels)[]).map(
                (soil) => (
                  <ChoiceButton
                    key={soil}
                    selected={brief.soil === soil}
                    title={soilLabels[soil]}
                    copy={SOIL_DESCRIPTIONS[soil]}
                    onClick={() => setBrief({ ...brief, soil })}
                  />
                ),
              )}
            </div>
          </fieldset>

          <fieldset>
            <legend>Wind exposure</legend>
            <p className="field-help">How exposed is your bed to wind?</p>
            <div className="choice-grid">
              {(Object.keys(windLabels) as Wind[]).map((wind) => (
                <ChoiceButton
                  key={wind}
                  selected={brief.wind === wind}
                  title={windLabels[wind]}
                  copy={windDescriptions[wind]}
                  onClick={() => setBrief({ ...brief, wind })}
                />
              ))}
            </div>
          </fieldset>

          <SurvivingCount
            brief={brief}
            setBrief={setBrief}
            excluded={excluded}
            openExcluded={openExcluded}
          />
        </div>
      ),
    },
    {
      title: "How big is the planting bed?",
      // The only step with a drawing: it earns a wider panel.
      wide: true,
      note: `Measure the bed in metres and we will draw it as you type. Each side can be between ${MIN_BED_DIMENSION_M} m and ${MAX_BED_DIMENSION_M} m.`,
      content: (
        <div className="bed-editor">
          <div className="bed-controls">
            <section>
              <h3>1. Set your bed size</h3>
              <div className="dimension-editor">
                <DimensionField
                  label="Width"
                  value={brief.bedWidthM}
                  onChange={(bedWidthM) => setBrief({ ...brief, bedWidthM })}
                />
                <span aria-hidden="true">×</span>
                <DimensionField
                  label="Length"
                  value={brief.bedLengthM}
                  onChange={(bedLengthM) => setBrief({ ...brief, bedLengthM })}
                />
              </div>
              <p className="bed-note">
                <span aria-hidden="true">i</span> The top edge of the drawing is north.
              </p>
            </section>
            <section>
              <h3>2. Choose your orientation</h3>
              <p className="field-help">
                Pick the side you usually view the bed from; the taller plants go at the back of that view.
              </p>
              <p className="field-note">
                Not sure where north is? A phone compass app shows it, or just
                pick the side you look from most.
              </p>
              <div
                className="viewing-edge-grid"
                role="group"
                aria-label="Which side you look at the bed from"
              >
                {VIEWING_EDGE_OPTIONS.map(({ edge, label, looking, arrow }) => (
                  <button
                    key={edge}
                    type="button"
                    className={`viewing-edge-button is-${edge}${brief.viewingEdge === edge ? " is-selected" : ""}`}
                    aria-pressed={brief.viewingEdge === edge}
                    aria-label={`Stand on the ${edge} side, looking ${looking}`}
                    onClick={() => setBrief({ ...brief, viewingEdge: edge })}
                  >
                    <span className="viewing-edge-arrow" aria-hidden="true">
                      {arrow}
                    </span>
                    <span className="viewing-edge-name">{label}</span>
                    <span className="viewing-edge-look" aria-hidden="true">
                      looking {looking}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
          <BedPreview
            widthM={brief.bedWidthM}
            lengthM={brief.bedLengthM}
            valid={dimensionsValid}
            viewingEdge={brief.viewingEdge}
          />
        </div>
      ),
    },
    {
      title: "What should the garden feel like?",
      note: "These are preferences, not rules. Nothing here removes a plant from your list — it only changes what we put first.",
      content: (
        <div className="choice-stack preference-blocks">
          <fieldset>
            <legend>1. Garden style</legend>
            <p className="field-help">What look do you love?</p>
            <div className="choice-grid two-column">
              {(Object.keys(gardenStyleLabels) as GardenStyle[]).map((style) => (
                <ChoiceButton
                  key={style}
                  selected={brief.style === style}
                  title={gardenStyleLabels[style]}
                  copy={
                    style === "undecided"
                      ? "We will not favour a particular look. Your bed still gets a balanced mix of heights and a few different plant types."
                      : gardenStyleDescriptions[style]
                  }
                  onClick={() => setBrief({ ...brief, style })}
                />
              ))}
            </div>
          </fieldset>
          <ColourPreferencePicker
            brief={brief}
            value={brief.colour}
            onChange={(colour) => setBrief({ ...brief, colour })}
          />
        </div>
      ),
    },
    {
      title: "Anything else matter to you?",
      note: "Pick as many as you like, or none.",
      content: (
        <ExtraPreferencesPicker
          brief={brief}
          onChange={(extras) => setBrief({ ...brief, extras })}
        />
      ),
    },
  ];

  const current = steps[step];
  const finalStep = steps.length - 1;
  const previewPlan = useMemo(() => {
    if (!validateGardenBrief(brief).valid) return null;
    return buildGardenPlan(plants, brief, { excludedPlantIds: excluded });
  }, [brief, excluded]);
  const planIsReady =
    previewPlan?.status === "provisional-plan" &&
    Boolean(previewPlan.layout?.placements.length);
  // Steps are referenced by the field they set rather than a bare index,
  // so inserting a step cannot silently move the gate onto the wrong one.
  const locationStep = 0;
  const dimensionsStep = 2;
  // What is missing on this step, and what it is for. Computed from the
  // same conditions that disable Continue, so the two can never disagree.
  const survivors = useMemo(
    () =>
      validateGardenBrief(brief).valid
        ? evaluateHardFilters(plants, brief, excluded).survivingCount
        : null,
    [brief, excluded],
  );
  const blockers = stepBlockers(step, brief, selectedPlace, dimensionsValid);
  const notes = stepNotes(step, brief, survivors);

  // The same conditions as the blockers, so the two can never disagree.
  // Step 1 needs the area the user lives in (it drives the plants and the
  // nursery distances), not just a biome ticked on the map.
  void locationStep;
  void dimensionsStep;
  const canContinue =
    blockers.length === 0 &&
    (step !== finalStep || (validateGardenBrief(brief).valid && planIsReady));

  return (
    <main className="finder-shell">
      <div
        className="finder-progress"
        aria-label={`Step ${step + 1} of ${steps.length}`}
      >
        <span>
          Step {step + 1} of {steps.length}: {STEP_NAMES[step]}
        </span>
        <div>
          {steps.map((_, index) => (
            <i key={index} className={index <= step ? "is-complete" : ""} title={STEP_NAMES[index]} />
          ))}
        </div>
        <ol className="finder-step-names" aria-hidden="true">
          {STEP_NAMES.map((name, index) => (
            <li key={name} className={index === step ? "is-current" : index < step ? "is-done" : ""}>{name}</li>
          ))}
        </ol>
      </div>
      {step === finalStep && !planIsReady && (
        <aside className="finder-example is-warning" aria-live="polite">
          <div>
            <strong>These answers don’t produce a complete plan yet.</strong>
            <p>
              Check your measurements and answers. If they’re accurate, keep
              them—the current library may not have a suitable mix for this
              bed.
            </p>
          </div>
        </aside>
      )}
      <section className={`finder-panel${current.wide ? " is-wide" : ""}`}>
        <div className="finder-question">
          <h1 className={step === 0 ? "question-two-lines" : undefined}>
            {step === 0 ? (
              <>
                <span>Where is your</span>
                <span>garden?</span>
              </>
            ) : (
              current.title
            )}
          </h1>
          <p>{current.note}</p>
        </div>
        <div className="finder-choices">
          {current.content}
          {attempted && blockers.length > 0 && (
            <aside className="finder-alert is-blocking" role="status" aria-live="polite">
              <strong>
                {blockers.length === 1
                  ? "One more answer before you can continue"
                  : `${blockers.length} more answers before you can continue`}
              </strong>
              <ul>
                {blockers.map((item) => (
                  <li key={item.label}>
                    <b>{item.label}</b> — {item.detail}
                  </li>
                ))}
              </ul>
            </aside>
          )}
          {notes.length > 0 && (
            <aside className="finder-alert" aria-live="polite">
              <ul>
                {notes.map((item) => (
                  <li key={item.label}>
                    <b>{item.label}</b> — {item.detail}
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </section>
      <div className="finder-footer">
        <button
          className="text-link"
          onClick={step === 0 ? cancel : () => goToStep(step - 1)}
        >
          ← {step === 0 ? "Back home" : "Previous"}
        </button>
        {/* Usability review (21 Oct): never greyed out. Clicking it with an
            answer missing shows what is missing; nothing shows before. */}
        <button
          className={`button button-dark${canContinue ? "" : " is-waiting"}`}
          aria-disabled={!canContinue}
          title={canContinue ? undefined : blockers.map((item) => item.label).join("; ") || undefined}
          onClick={() => {
            if (!canContinue) {
              setAttempted(true);
              return;
            }
            if (step === finalStep) finish();
            else goToStep(step + 1);
          }}
        >
          {step === finalStep ? "Build my garden plan" : "Continue"} <span aria-hidden="true">→</span>
        </button>
      </div>
    </main>
  );
}

function PlantCard({
  plant,
  match,
  saved,
  excluded,
  open,
  toggleSaved,
  toggleExcluded,
}: {
  plant: Plant;
  match?: PlantAssessment;
  saved: boolean;
  excluded: boolean;
  open: () => void;
  toggleSaved: () => void;
  toggleExcluded: () => void;
}) {
  return (
    <article
      className={`plant-card${match ? ` status-${match.status}` : ""}${excluded ? " is-excluded" : ""}`}
    >
      <button className="portrait-button" onClick={open}>
        <PlantPortrait plant={plant} />
      </button>
      <div className="plant-card-head">
        <div>
          <p>{shortName(plant)}</p>
          <h3>{plant.scientificName}</h3>
          {otherNamesLine(plant) ? <small className="plant-other-names">{otherNamesLine(plant)}</small> : null}
        </div>
        {neverPlantedReason(plant) ? (
          <span className="educational-badge" title={`Never planted: ${neverPlantedReason(plant)}.`}>
            For educational purposes
          </span>
        ) : (
        <div className="plant-card-buttons">
          <button
            className={`save-button${saved ? " is-saved" : ""}`}
            onClick={toggleSaved}
            aria-label={`${saved ? "Remove" : "Add"} ${plant.commonName} ${saved ? "from" : "to"} favourites`}
            aria-pressed={saved}
          >
            {saved ? "Favourite" : "Favourite"} <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
          </button>
          <button
            type="button"
            className={`exclude-button${excluded ? " is-excluded" : ""}`}
            onClick={toggleExcluded}
            aria-pressed={excluded}
            aria-label={`${excluded ? "Show again" : "Hide"} ${plant.commonName}`}
            title={
              excluded
                ? "Show this plant in my plans again"
                : "Hide this plant from my plans"
            }
          >
            {excluded ? "Show again" : "Hide"}{" "}
            <span aria-hidden="true">{excluded ? "↺" : "⃠"}</span>
          </button>
        </div>
        )}
      </div>
      <div className="plant-card-meta">
        <span>{plant.form}</span>
        {/* Named explicitly: users read a bare "Up to 1.2 m" as the width
            of the plant as often as its height. */}
        <span>
          {plant.heightCm === null
            ? "Height not measured"
            : `${formatDimension(plant.heightCm)} tall`}
        </span>
        <span>
          {plant.flowerStart}–{plant.flowerEnd}
        </span>
      </div>
      {match && (
        <div className="match-reasons">
          <div>
            <span className={`status-label status-${match.status}`}>
              {match.status === "candidate"
                ? "Good fit"
                : match.status === "review"
                  ? "Check first"
                  : "Not a fit"}
            </span>
            {match.stage1 && match.stage1.rawMax > 0 && (
              <strong>
                {Math.round(match.stage1.score * 100)}% match for your preferences
              </strong>
            )}
          </div>
          <p>{match.reasons.join(" · ")}</p>
          <details>
            <summary>Why this result?</summary>
            <ul>
              {match.feasibility.trace.map((entry) => (
                <li key={entry.constraintId}>
                  <span>
                    {entry.status === "pass"
                      ? "Works"
                      : entry.status === "fail"
                        ? "Doesn’t fit"
                        : "Not sure"}
                  </span>
                  <p>{entry.reason}</p>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
      <button className="card-link" onClick={open}>
        View plant <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

/** The 12 atomic flower colours, as ink. Circles are filled with these
 * at 50% transparency (spec 9); a plant with no recorded colour is drawn
 * in neutral foliage green with a dashed outline instead of a guess. */
const flowerColourInk: Record<string, string> = {
  White: "#f2efe4",
  Cream: "#e8dfbe",
  Yellow: "#d9b430",
  Orange: "#cf7a2c",
  Red: "#a83a2c",
  Pink: "#d08aa0",
  Purple: "#7b5a97",
  "Mauve/Lilac": "#9c8bbd",
  Blue: "#4a6f9c",
  Green: "#6f8a5a",
  Brown: "#7a5c42",
  Black: "#3a3630",
};

const UNKNOWN_COLOUR_INK = "#8fa07e";

function tint(ink: string): string {
  return `color-mix(in srgb, ${ink} 50%, transparent)`;
}

/** Circles carry the plant's own flower colour. The dominant one is the
 * first the source records - PlantZAfrica lists the principal colour
 * first - and a multi-coloured plant is drawn as hard-edged bands of every colour it
 * records, dominant first, rather than picking one and hiding the rest or
 * blending them into a colour the plant does not have. Single-colour and
 * unknown-colour plants get a flat fill. */
function markerBackground(plant: Plant): string {
  const inks = (plant.flowerColour ?? [])
    .map((colour) => flowerColourInk[colour])
    .filter((ink): ink is string => Boolean(ink));

  if (inks.length <= 1) return tint(inks[0] ?? UNKNOWN_COLOUR_INK);

  const step = 100 / inks.length;
  const stops = inks
    .map((ink, index) => {
      const from = (step * index).toFixed(2);
      const to = (step * (index + 1)).toFixed(2);
      return `${tint(ink)} ${from}%, ${tint(ink)} ${to}%`;
    })
    .join(", ");
  return `linear-gradient(135deg, ${stops})`;
}

/** A common-name field such as "peacock moraea (Eng.); uiltjie (Afr.) Two
 * subspecies are recognized: ..." read for display only (the data is not
 * changed): the English name as the title, every other name with its
 * language, and any trailing sentence as a note. */
const NAME_LANGUAGES: Record<string, string> = { "Eng.": "English", "Afr.": "Afrikaans" };
function plantNames(plant: Plant): { title: string; others: string[]; note: string | null } {
  const raw = (plant.commonName ?? "").trim();
  if (!raw) return { title: plant.scientificName, others: [], note: null };
  const parts = raw.split(";").map((part) => part.trim()).filter(Boolean);
  let note: string | null = null;
  const names = parts.map((part, index) => {
    const tagged = /^(.*?)\s*\(([^)]+)\)\s*(.*)$/.exec(part);
    if (!tagged) return { name: part.replace(/\.$/, ""), lang: null as string | null };
    const rest = tagged[3].trim();
    if (rest && !/^[.,;:]+$/.test(rest) && index === parts.length - 1) note = rest;
    return { name: tagged[1].trim(), lang: tagged[2].trim() };
  });
  const english = names.find((n) => n.lang === "Eng.") ?? names[0];
  const title = english.name.charAt(0).toUpperCase() + english.name.slice(1);
  const others = names
    .filter((n) => n !== english && n.name)
    .map((n) => (n.lang ? `${n.name} (${NAME_LANGUAGES[n.lang] ?? n.lang})` : n.name));
  return { title, others, note };
}

/** The display title of a plant (its English common name). */
function shortName(plant: Plant): string {
  return plantNames(plant).title;
}

/** The other common names and any note, as one line under the title. */
function otherNamesLine(plant: Plant): string | null {
  const { others, note } = plantNames(plant);
  const line = [others.join(" · "), note].filter(Boolean).join(" — ");
  return line || null;
}

/** Care instructions grouped and de-duplicated rather than repeated per
 * plant (spec 9). */
function groupedCareInstructions(
  species: { plant: Plant }[],
): { instruction: string; names: string[] }[] {
  const byInstruction = new Map<string, string[]>();
  for (const { plant } of species) {
    // `note` carries the care text the pipeline assembled. The opening
    // sentence describes the growth form, which is not care guidance.
    const sentences = plant.note
      .split(". ")
      .map((part) => part.trim())
      .filter(
        (part) =>
          part.length > 0 &&
          !part.startsWith("A ") &&
          !part.startsWith("No horticultural"),
      );
    for (const sentence of sentences) {
      const text = sentence.endsWith(".") ? sentence : `${sentence}.`;
      const existing = byInstruction.get(text) ?? [];
      if (!existing.includes(shortName(plant))) existing.push(shortName(plant));
      byInstruction.set(text, existing);
    }
  }
  return [...byInstruction.entries()]
    .map(([instruction, names]) => ({ instruction, names }))
    .sort((left, right) => right.names.length - left.names.length);
}

/**
 * A short care paragraph for the bed as a whole.
 *
 * The per-plant notes are lists of tags ("Notable features: Drought
 * resistant; Feeds honeybees") repeated across species, which read as
 * clutter when stacked. This counts the tags that recur and states what
 * they mean for this bed, in order of what a gardener acts on: water
 * first, then what the planting will attract, then what it can be used
 * for, then what the data does not vouch for.
 *
 * Every sentence is built from counts of the recorded tags. Nothing is
 * inferred about a plant that the source did not record - an absent tag
 * means "not recorded", never "not true", so counts are always given as
 * "n of the m plants here".
 */
function careParagraph(species: { plant: Plant; quantity: { quantity: number } }[]): string[] {
  const total = species.length;
  if (total === 0) return [];

  const tagged = (tag: string) =>
    species.filter(({ plant }) => (plant.specialFeatures ?? []).includes(tag));
  const names = (list: typeof species) => listOf(list.map(({ plant }) => shortName(plant)));
  const fireCount = species.filter(({ plant }) =>
    /Resprouts post-fire|Serotinous|Flowers post-fire/.test(plant.note),
  ).length;

  const drought = tagged("Drought resistant");
  const wet = tagged("Wet sites");
  const bees = tagged("Feeds honeybees");
  const birds = tagged("Attracts birds");
  const butterflies = tagged("Attracts butterflies");
  const fragrant = tagged("Fragrant");
  const hedge = tagged("Hedge/screen");
  const pot = tagged("Good potplant");
  const edible = tagged("Edible plant");
  const medicinal = tagged("Medical plant");

  const sentences: string[] = [];

  // 1. Watering - the thing the gardener actually does week to week.
  if (drought.length > 0 && wet.length > 0) {
    sentences.push(
      `${sentenceCase(numberWord(drought.length))} of the ${total} plants here are recorded as drought resistant, but ${names(wet)} ${wet.length === 1 ? "is" : "are"} recorded for wet sites — give ${wet.length === 1 ? "it" : "them"} the dampest corner of the bed and water ${wet.length === 1 ? "it" : "them"} separately.`,
    );
  } else if (drought.length >= Math.ceil(total / 2)) {
    sentences.push(
      `Most of this bed is drought tolerant: ${drought.length} of the ${total} plants are recorded as drought resistant, so it should not need frequent watering.`,
    );
  } else if (drought.length > 0) {
    sentences.push(
      `${sentenceCase(numberWord(drought.length))} of the ${total} plants are recorded as drought resistant; the rest have no water note recorded, so watch them through their first summer.`,
    );
  } else if (wet.length > 0) {
    sentences.push(`${names(wet)} ${wet.length === 1 ? "is" : "are"} recorded for wet sites and will want the dampest part of the bed.`);
  }

  // 2. What the planting brings in, and what it will smell like.
  const wildlife: string[] = [];
  if (bees.length > 0) wildlife.push(`${bees.length} ${bees.length === 1 ? "feeds" : "feed"} honeybees`);
  if (birds.length > 0) wildlife.push(`${birds.length} ${birds.length === 1 ? "attracts" : "attract"} birds`);
  if (butterflies.length > 0) {
    wildlife.push(`${butterflies.length} ${butterflies.length === 1 ? "attracts" : "attract"} butterflies`);
  }
  if (wildlife.length > 0) {
    sentences.push(
      `Of these, ${listOf(wildlife)}${fragrant.length > 0 ? `, and ${fragrant.length} ${fragrant.length === 1 ? "is" : "are"} recorded as fragrant` : ""}.`,
    );
  } else if (fragrant.length > 0) {
    sentences.push(
      `${sentenceCase(numberWord(fragrant.length))} of these ${fragrant.length === 1 ? "is" : "are"} recorded as fragrant.`,
    );
  }

  // 3. What the plants can be used for, where that changes a decision.
  const uses: string[] = [];
  if (hedge.length > 0) uses.push(`${names(hedge)} can be grown as a hedge or screen`);
  if (pot.length >= Math.ceil(total / 2)) uses.push(`${numberWord(pot.length)} also grow well in pots`);
  if (uses.length > 0) sentences.push(`${sentenceCase(listOf(uses))}.`);

  // 4. Fire behaviour is habitat background, not a garden instruction, and
  // is labelled as such so nobody reads it as something to do.
  if (fireCount > 0) {
    sentences.push(
      fireCount === 1
        ? `${sentenceCase(numberWord(1))} is a fynbos species that regrows or reseeds after fire — that is how it behaves in the wild, not something to do in a garden.`
        : `${sentenceCase(numberWord(fireCount))} are fynbos species that regrow or reseed after fire — that is how they behave in the wild, not something to do in a garden.`,
    );
  }

  // 5. What the record does not vouch for.
  if (edible.length > 0 || medicinal.length > 0) {
    const kinds = [edible.length > 0 ? "edible" : null, medicinal.length > 0 ? "medicinal" : null].filter(Boolean);
    sentences.push(
      `Some are listed with ${kinds.join(" or ")} uses in their source profiles; those are records of traditional use, not advice, and are not checked here.`,
    );
  }

  return sentences;
}

/** Small counts read better as words when they open a sentence. */
function numberWord(n: number): string {
  return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] ?? String(n);
}

/** "a, b and c" - used wherever a count is read back as a list. */
function listOf(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** How many times a photo is fetched before we call it missing, and how
 * long to wait between tries.
 *
 * Both photo hosts serve fine when asked one at a time, but pza.sanbi.org
 * is a single HTTP/1.1 Apache host, which caps the browser at six parallel
 * connections and makes a gridful of cards a queue. A request that is
 * dropped or cancelled in that queue used to be permanent - one blip and
 * the card read "No image available" for the rest of the session even
 * though the URL was good. Two retries turn a transient failure back into
 * a photo; a genuinely dead URL still settles on the neutral card. */
const PHOTO_ATTEMPTS = 3;
const PHOTO_RETRY_MS = [600, 1800];

/** Retry state for one hot-linked photo. `attempt` is used as the <img>
 * key: changing it remounts the element, which re-requests the file. The
 * URL is never mutated - PlantZAfrica's styled images carry a signed
 * `?itok=` token that a cache-busting parameter could invalidate. */
function usePhotoRetry(photoUrl: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const timer = useRef<number | null>(null);

  // A card can be reused for a different plant as lists re-render, so the
  // retry count resets when the URL changes. Adjusted during render rather
  // than in an effect - React's documented way to reset state on a prop
  // change, and it avoids showing the previous plant's photo first.
  const [lastUrl, setLastUrl] = useState(photoUrl);
  if (lastUrl !== photoUrl) {
    setLastUrl(photoUrl);
    setAttempt(0);
    setFailed(false);
  }

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  // An event handler, so it reads `attempt` from the current render and is
  // never double-invoked the way a state updater can be. Each retry only
  // fires after setAttempt has re-rendered, so the value is never stale.
  const onError = () => {
    const next = attempt + 1;
    if (next >= PHOTO_ATTEMPTS) {
      setFailed(true);
      return;
    }
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => setAttempt(next),
      PHOTO_RETRY_MS[next - 1] ?? 1800,
    );
  };

  return { attempt, failed, onError };
}

/** Photos are hot-linked rather than downloaded, so a moved or
 * hotlink-blocked file 404s at runtime even when photoUrl is populated.
 * Both that case and "no photo at all" fall back to the same neutral
 * card, never a broken image (spec 0.5) - but only after the retries
 * above, so a slow host does not read as a missing photo. */
function PlantPhoto({ plant }: { plant: Plant }) {
  const { attempt, failed, onError } = usePhotoRetry(plant.photoUrl);

  if (!plant.photoUrl || failed) {
    return (
      <div
        className="plant-photo is-missing"
        role="img"
        aria-label={`No image available for ${plant.commonName}`}
      >
        <span>No image available</span>
      </div>
    );
  }

  return (
    <figure className="plant-photo">
      <img
        key={attempt}
        src={plant.photoUrl}
        alt={`${plant.commonName} (${plant.scientificName})`}
        loading="lazy"
        onError={onError}
      />
      <figcaption>
        {plant.photoSourceUrl ? (
          <a href={plant.photoSourceUrl} target="_blank" rel="noreferrer">
            {plant.photoAttribution}
          </a>
        ) : (
          plant.photoAttribution
        )}
        {plant.photoLicense ? ` · ${plant.photoLicense}` : ""}
      </figcaption>
    </figure>
  );
}

/** The saved-plant mark: a small heart, drawn so it never depends on the
 * font having the glyph. */
function SavedHeart() {
  return (
    <svg viewBox="0 0 16 16" width="100%" height="100%" focusable="false">
      <path
        d="M8 14s-5.5-3.4-5.5-7.2A3 3 0 0 1 8 4.9a3 3 0 0 1 5.5 1.9C13.5 10.6 8 14 8 14z"
        fill="currentColor"
      />
    </svg>
  );
}

/** The planting plan: every plant as a circle at its position, north at the
 * top. Used for the live layout and for saved gardens alike. */
/** The standing figure from the bed preview, reused on the plan so the
 * viewpoint mark means the same thing in both places. It sits on the
 * edge the gardener said they stand on, facing into the bed. */
function ViewerFigure() {
  return (
    <svg
      className="viewer-figure"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="5" r="2.6" fill="currentColor" stroke="none" />
      <path d="M12 8v7M7.5 10.5h9M12 15l-3 6M12 15l3 6" />
    </svg>
  );
}

/**
 * Every answer the plan was built from, as one labelled chip each. It used
 * to show five of them, which read as if the rest had been ignored. Each
 * value is the same label the question itself used, so the strip and the
 * brief cannot say different things.
 */
function briefChips(brief: GardenBrief): { label: string; value: string }[] {
  const edge = VIEWING_EDGE_OPTIONS.find((o) => o.edge === brief.viewingEdge);
  const colour =
    brief.colour.mode === "scheme"
      ? colourSchemeLabels[brief.colour.scheme]
      : brief.colour.mode === "custom" && brief.colour.colours.length > 0
        ? brief.colour.colours
            .map((c) => c[0].toUpperCase() + c.slice(1))
            .join(", ")
        : "No preference";
  return [
    { label: "Vegetation", value: brief.biomes.map((b) => biomeLabels[b]).join(" · ") },
    { label: "Soil", value: soilLabels[brief.soil] },
    { label: "Sun", value: sunLabels[brief.sun] },
    { label: "Water", value: waterLabels[brief.water] },
    { label: "Wind", value: windLabels[brief.wind] },
    { label: "Bed", value: `${brief.bedWidthM} × ${brief.bedLengthM} m` },
    { label: "Shape", value: bedShapeLabels[bedShapeFor(brief.bedWidthM, brief.bedLengthM)] },
    {
      label: "You stand",
      value: edge ? `${edge.label}, looking ${edge.looking}` : brief.viewingEdge,
    },
    { label: "Style", value: gardenStyleLabels[brief.style] },
    { label: "Colour", value: colour },
    {
      label: "Also wanted",
      value:
        brief.extras.length > 0
          ? brief.extras.map((e) => extraPreferenceLabels[e]).join(", ")
          : "Nothing extra",
    },
  ];
}

/**
 * Where this plan actually put its tall plants, read off the drawing.
 *
 * Every option is laid out from the edge the gardener stands on (owner
 * decision, 12 October 2026). Two things can still put tall plants near
 * the viewer: the aerodynamic ramp, which in a windy bed deep enough for
 * several rows steps the planting up away from the south and east wind
 * whichever side the gardener is on; and layering being a placement
 * preference rather than a hard rule. Rather than claim a rule that may
 * not have held, this measures the height-weighted average distance from
 * where she stands and says what is there - and, when it is the wind,
 * says that.
 */
/**
 * D24 option C: the view comes first, so on a windy site the layout may
 * leave plants more exposed than a wind-first layout would. Said only
 * when it applies.
 */
function windNote(brief: GardenBrief): string | null {
  if (WIND_SITE_FACTOR[brief.wind] <= 0) return null;
  const edge = brief.viewingEdge;
  if (edge === "south" || edge === "east") {
    return `Wind: you look at this bed from the ${edge}, which is also a side the wind comes from. To keep your view open there is no windbreak along that edge, so the plants nearest you may take the most wind.`;
  }
  if (rowsAvailable(brief.bedLengthM) >= 3) {
    return "Wind: this layout puts your view first, so the tallest plants stand at the back, which here is the windward south or east side. They may take more wind than a layout built around the wind would give them.";
  }
  return null;
}

function layeringNote(
  layout: { bedWidthM: number; bedLengthM: number; placements: { plantId: string; xM: number; yM: number }[] },
  brief: GardenBrief,
): string | null {
  const byId = new Map(plants.map((plant) => [plant.id, plant]));
  const heights = layout.placements.flatMap((p) => {
    const height = byId.get(p.plantId)?.heightCm;
    return height ? [{ height, xM: p.xM, yM: p.yM }] : [];
  });
  if (heights.length < 3) return null;
  const { bedWidthM: W, bedLengthM: L, } = layout;
  const edge = brief.viewingEdge;
  const span = edge === "north" || edge === "south" ? L : W;
  if (span <= 0) return null;
  const depthOf = (x: number, y: number) =>
    edge === "north" ? y : edge === "south" ? L - y : edge === "west" ? x : W - x;
  const total = heights.reduce((sum, h) => sum + h.height, 0);
  const share =
    heights.reduce((sum, h) => sum + h.height * depthOf(h.xM, h.yM), 0) / total / span;
  if (share > 0.55) {
    return `The taller plants sit towards the back of this bed, away from the ${edge} side where you stand.`;
  }
  if (share < 0.45) {
    return `The taller plants in this layout ended up nearer the ${edge} side, where you stand. Regenerate for one that banks them at the back.`;
  }
  return "The taller plants are spread through this bed rather than banked at the back.";
}

type BedView = "sketchbook" | "real-life";

/** Sketchbook or Real-life. Its own component because the plan renders it
 * on the options line while a saved-garden card renders it on the bed. */
function LayoutViewSwitch({
  view,
  onChange,
}: {
  view: BedView;
  onChange: (view: BedView) => void;
}) {
  return (
    <div className="layout-views" role="group" aria-label="Layout view">
      <button type="button" aria-pressed={view === "sketchbook"} onClick={() => onChange("sketchbook")}>
        Drawing
      </button>
      <button type="button" aria-pressed={view === "real-life"} onClick={() => onChange("real-life")}>
        Photos
      </button>
    </div>
  );
}

function BedDiagram({
  widthM,
  lengthM,
  placements,
  openPlant,
  savedIds = [],
  viewingEdge,
  view: controlledView,
  onViewChange,
}: {
  widthM: number;
  lengthM: number;
  placements: { plantId: string; xM: number; yM: number; radiusM: number; instanceId?: string; sequence?: number }[];
  openPlant: (plant: Plant) => void;
  /** Plants in the user's saved library get a small badge. */
  savedIds?: readonly string[];
  /** Given by the plan, which puts the Sketchbook / Real-life switch on
   * the same line as the three options. Left out elsewhere, and then the
   * drawing carries its own switch. */
  view?: BedView;
  onViewChange?: (view: BedView) => void;
  /** Labelled on the drawing so the plan can be held up against the real
   * bed. The drawing itself is never rotated - north stays at the top. */
  viewingEdge?: ViewingEdge;
}) {
  const plantsById = new Map(plants.map((plant) => [plant.id, plant]));
  // Two views of the same plan: the sketchbook circles, or each circle
  // filled with a photo of its species so the finished bed can be pictured.
  const [ownView, setOwnView] = useState<BedView>("sketchbook");
  const view = controlledView ?? ownView;
  const setView = onViewChange ?? setOwnView;
  const [brokenPhotos, setBrokenPhotos] = useState<ReadonlySet<string>>(new Set());
  const anySaved = placements.some((p) => savedIds.includes(p.plantId));
  // Sketchbook symbol per species: the plant type it was placed for.
  const roleType = (plant: Plant) => roleTypeOf(plant, isFeaturePlant(plant));
  const symbolTypes = [
    ...new Set(
      placements.flatMap((p) => {
        const plant = plantsById.get(p.plantId);
        const type = plant ? roleType(plant) : null;
        return type ? [type] : [];
      }),
    ),
  ];
  // Always north-up, in Stage 4's own coordinates (x west -> east, y north
  // -> south): a long bed is drawn tall rather than turned on its side, so
  // the compass, the viewer figure and the labels never need translating.
  const drawing = bedDrawing(widthM, lengthM, viewingEdge);
  const viewerSide = drawing.viewerSide;
  // Names are no longer printed inside the circles - at planting scale they
  // stacked into unreadable noise. The name is disclosed on hover or
  // keyboard focus instead, and a tap opens the full plant profile.
  const [hovered, setHovered] = useState<number | null>(null);
  const markers = placements.flatMap((placement, index) => {
    const plant = plantsById.get(placement.plantId);
    if (!plant) return [];
    return [{
      placement, plant, index, at: drawing.toPercent(placement.xM, placement.yM),
      unknownColour: hasUnknownColour(plant),
      estimated: plant.spreadConfidence !== "original",
      saved: savedIds.includes(plant.id),
      tier: plant.heightCm === null ? null : tierOf(plant.heightCm, HEIGHT_TIERS),
    }];
  });
  const tip = hovered === null ? null : markers.find((m) => m.index === hovered) ?? null;
  return (
    /* The ratio lives on the wrap, not only on the drawing, so the scale
       bar and the plant key line up with the bed instead of with the
       page. Inside it, `.plan-bed-frame` is exactly the drawing's own
       box: the two dimensions, the hover label and the viewpoint mark are
       measured off that, so none of them can drift. */
    <div
      className={`plan-bed-wrap${viewerSide ? ` viewer-${viewerSide}` : ""}`}
      style={{ "--bed-aspect": drawing.aspect } as CSSProperties}
    >
      {controlledView === undefined ? (
        <LayoutViewSwitch view={view} onChange={setView} />
      ) : null}
      <div className="plan-north" aria-hidden="true">
        N ↑
      </div>
      <div className="plan-bed-frame">
      <div
        className={`plan-bed${view === "real-life" ? " is-real-life" : ""}`}
        style={
          {
            aspectRatio: `${widthM} / ${lengthM}`,
            // One grid square = one square metre, so the drawing can be
            // paced out in the real bed. It used to be a tenth of the bed
            // whatever the bed measured, which told the gardener nothing.
            "--bed-cols": widthM,
            "--bed-rows": lengthM,
          } as CSSProperties
        }
        aria-label={`${widthM} by ${lengthM} metre planting layout, north at the top`}
      >
        {markers.map(({ placement, plant, index, at, unknownColour, estimated, tier }) => {
          const style: CSSProperties = {
            left: `${at.left - (placement.radiusM / widthM) * 100}%`,
            top: `${at.top - (placement.radiusM / lengthM) * 100}%`,
            width: `${((placement.radiusM * 2) / widthM) * 100}%`,
            height: `${((placement.radiusM * 2) / lengthM) * 100}%`,
            background: markerBackground(plant),
          };
          return (
            <button
              key={placement.instanceId ?? `${placement.plantId}-${index}`}
              className={`plan-marker${estimated ? " is-estimated" : ""}${unknownColour ? " is-unknown-colour" : ""}${tier ? ` is-h-${tier}` : ""}`}
              style={style}
              onClick={() => openPlant(plant)}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered((current) => (current === index ? null : current))}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered((current) => (current === index ? null : current))}
              aria-label={`${plant.commonName}, plant ${(placement.sequence ?? index) + 1}${savedIds.includes(plant.id) ? ", one of your favourites" : ""}`}
            >
              {view === "real-life" && plant.photoUrl && !brokenPhotos.has(plant.id) ? (
                <img
                  className="marker-photo"
                  src={plant.photoUrl}
                  alt=""
                  loading="lazy"
                  onError={() => setBrokenPhotos((current) => new Set(current).add(plant.id))}
                />
              ) : null}
              {view === "sketchbook" ? <PlantTypeSymbol type={roleType(plant)} /> : null}
              {savedIds.includes(plant.id) ? (
                <span className="saved-badge" aria-hidden="true"><SavedHeart /></span>
              ) : null}
            </button>
          );
        })}
      </div>
      {/* Where the gardener stands: the same figure the bed preview uses,
          just outside the edge, with a small arrow pointing into the bed.
          It sits in the frame, not the bed, which clips its contents. */}
      {viewerSide ? (
        // An overlay exactly the size of the bed, so the figure is placed
        // against the bed's own edge - the frame also holds the scale bar.
        <div className="plan-bed-edges">
          <span
            className={`plan-viewer is-${viewerSide}`}
            role="img"
            aria-label={`You stand on the ${viewingEdge} side`}
            title="You stand on this side"
          >
            <ViewerFigure />
            <span className="plan-viewer-look" aria-hidden="true" />
          </span>
        </div>
      ) : null}
      {/* Sits outside .plan-bed, which clips its children, so a name near
          an edge is never cut in half. Purely decorative: the same text is
          already on the button's aria-label. */}
      {tip ? (
        <div className="plan-tip-layer" aria-hidden="true">
          <span
            className="plan-tip"
            style={{
              left: `${tip.at.left}%`,
              // Half a radius above centre, not a full one: the label used
              // to float a whole circle away from the pointer.
              top: `${tip.at.top - (tip.placement.radiusM / 2 / lengthM) * 100}%`,
            }}
          >
            {shortName(tip.plant)}
            {tip.plant.heightCm ? ` · ${formatDimension(tip.plant.heightCm)} tall` : ""}
            {tip.saved ? " · saved" : ""}
            {tip.unknownColour ? " · colour not recorded" : ""}
            {tip.estimated ? " · spread estimated" : ""}
          </span>
        </div>
      ) : null}
      <div className="plan-scale" aria-hidden="true">
        <span className="plan-scale-bar" style={{ width: `${(1 / widthM) * 100}%` }} />
        <span>1 m</span>
      </div>
      {/* As on the bed-size preview: width along the top, length down the
          left side - each moved to the opposite side when the viewer stands
          there. They hang off an overlay exactly the size of the bed. */}
      <div className="plan-bed-measures">
        <div className="plan-measure plan-measure-width">{widthM} m</div>
        <div className="plan-measure plan-measure-length">{lengthM} m</div>
      </div>
      </div>
      {/* Owner, 21 Oct: a tester was unsure whether the symbols were
          buttons, so the legend sits in a labelled box. */}
      <div className="plan-key" role="note" aria-label="Key to the drawing">
      <p className="plan-key-title">
        Key <span>· explains the drawing</span>
      </p>
      {view === "sketchbook" && symbolTypes.length > 0 ? (
        <ul className="symbol-key" aria-label="Plant type symbols">
          {symbolTypes.map((type) => (
            <li key={type}>
              <span className="symbol-key-mark">
                <PlantTypeSymbol type={type} />
              </span>
              {type === "bi/annual" ? "Bi/annual" : type[0].toUpperCase() + type.slice(1)}
            </li>
          ))}
        </ul>
      ) : null}
      {/* The circles show how WIDE a plant grows, which says nothing about
          how tall it is - an 8 m tree can draw a smaller circle than a
          15 cm ground cover. The ring weight carries height, so a bed that
          is layered tall-at-the-back can also be seen to be. */}
      <p className="height-key">
        <span>Ring shows height:</span>
        <span className="height-key-item">
          <i className="height-key-ring is-h-short" aria-hidden="true" /> under{" "}
          {formatDimension(HEIGHT_TIERS.p30)}
        </span>
        <span className="height-key-item">
          <i className="height-key-ring is-h-medium" aria-hidden="true" />{" "}
          {formatDimension(HEIGHT_TIERS.p30)} to {formatDimension(HEIGHT_TIERS.p60)}
        </span>
        <span className="height-key-item">
          <i className="height-key-ring is-h-tall" aria-hidden="true" />{" "}
          {formatDimension(HEIGHT_TIERS.p60)} or taller
        </span>
      </p>
      {anySaved ? (
        <p className="saved-key">
          <span className="legend-saved" aria-hidden="true"><SavedHeart /></span> also one of your favourites
        </p>
      ) : null}
      </div>
    </div>
  );
}

/** How many of this plan's species carry one of the colours the gardener
 * asked for. Display only - the engine has already used this. */
function coloursMatched(plan: GardenPlan): number {
  const wanted = pickedColours(plan.brief.colour);
  if (wanted.length === 0) return 0;
  const byId = new Map(plants.map((p) => [p.id, p]));
  const ids = (plan.quantities?.quantities ?? []).map((q) => q.id);
  return ids.filter((id) => {
    const colours = byId.get(id)?.flowerColour ?? [];
    return colours.some((colour) => wanted.includes(colour));
  }).length;
}

/** One plain line saying how an option differs from the other two. Only
 * says something when this option is strictly the leader on that
 * measure, so it never invents a difference that is not there. */
function describeOption(plan: GardenPlan, all: GardenPlan[]): string {
  const species = (p: GardenPlan) => p.quantities?.quantities.length ?? 0;
  const total = (p: GardenPlan) => p.quantities?.totalPlants ?? 0;
  const mine = species(plan);
  const others = all.filter((p) => p !== plan);
  if (others.length === 0) return "";
  if (others.every((p) => mine > species(p))) return "The widest mix of different plants.";
  if (others.every((p) => mine < species(p))) return "The simplest planting, with fewer kinds to look after.";
  if (others.every((p) => total(plan) > total(p))) return "The fullest bed, with the most plants in it.";
  if (others.every((p) => total(plan) < total(p))) return "The most open bed, with the most space between plants.";
  const colours = coloursMatched(plan);
  if (colours > 0 && others.every((p) => colours > coloursMatched(p))) {
    return "Closest to the colours you chose.";
  }
  // No strict lead on anything: say nothing rather than a line that
  // describes every option equally (owner, walkthrough 4).
  return "";
}

/** Just the money from the budget line. The full sentence - what is in
 * the figure, what was not found, when it was checked - stays in the
 * budget panel beside the calculation, where there is room for it. */
function guidePrice(budget: SavedBudget | null | undefined): string {
  if (!budget) return "Checking…";
  // "About R405 for 8 of 21 plants", not a bare range that hides how much
  // of the bed it covers (usability review, 21 Oct).
  const typical = budget.text.match(/typical (R[\d\s.,]+?)\)/)?.[1]?.trim();
  if (!typical) return "Not priced yet";
  const part = budget.text.match(/for (\d+) of (\d+) plants/);
  return part ? `About ${typical} for ${part[1]} of ${part[2]} plants` : `About ${typical}`;
}

function PlanSummary({
  plan,
  place,
  savedIds,
  openPlant,
  onSave,
  onBudget,
  budget,
  onRegenerate,
  onExclude,
  isSaved,
  variantTabs,
  readOnly = false,
}: {
  plan: GardenPlan;
  /** The user's town, for nursery distances. */
  place: string | null;
  /** The user's saved plant library, to badge those plants in the plan. */
  savedIds: readonly string[];
  openPlant: (plant: Plant) => void;
  /** Rule a plant out from here, having seen it in the bed. Absent on a
   * re-opened saved garden, which is a record and not a live plan. */
  onExclude?: (id: string) => void;
  onSave: () => void;
  /** The nursery budget line, once it arrives - stored with a saved garden. */
  onBudget: (budget: SavedBudget) => void;
  /** The same line, for the summary row. Display only. */
  budget?: SavedBudget | null;
  onRegenerate: () => void;
  isSaved: boolean;
  /** The option switcher, rendered beside the bed so changing option does
   * not mean scrolling back up to find what moved. */
  variantTabs?: ReactNode;
  /** A saved garden being re-opened: it is a record of a decision already
   * made, so it offers no Save or Regenerate. */
  readOnly?: boolean;
}) {
  const plantsById = new Map(plants.map((plant) => [plant.id, plant]));
  // The bed fills the content area; the plant list slides over it. It
  // starts closed, so the drawing is seen whole first, and the "Plants"
  // tab on its top right corner opens it (owner, walkthrough 4).
  const [plantsOpen, setPlantsOpen] = useState(false);
  // Held here rather than in the drawing, so the switch can sit on the
  // same line as the three options.
  const [bedView, setBedView] = useState<BedView>("sketchbook");

  if (
    plan.status === "no-plan" ||
    !plan.layout ||
    !plan.quantities ||
    plan.layout.placements.length === 0
  ) {
    return (
      <section className="plan-output plan-unavailable">
        <div>
          <span>Plan failed</span>
          <h2>We couldn’t build a layout for this bed.</h2>
        </div>
        <p>
          Try a larger bed or change one of your answers. We’ll keep the plant
          checks here so you can see what got in the way.
        </p>
        {/* The engine's own account of what stopped it. Without this the
            reasons were computed and then thrown away, so a plan could fail
            with no explanation on screen. */}
        {plan.diagnostics.length > 0 && (
          <ul className="plan-failure-reasons">
            {plan.diagnostics.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  const layout = plan.layout;
  const quantities = plan.quantities;

  // Widest first. The engine returns quantities in species-id order, which
  // carries no meaning for a reader; sorting by spread makes the list run
  // the same way the eye reads the bed - the big structural plants that
  // dominate the layout at the top, the ground cover at the bottom. A
  // plant with no recorded spread sorts last rather than as zero, and the
  // name breaks ties so the order is stable between renders.
  const species = quantities.quantities
    .flatMap((quantity) => {
      const plant = plantsById.get(quantity.id);
      return plant ? [{ plant, quantity }] : [];
    })
    .sort((left, right) => {
      const a = left.plant.spreadCm ?? -1;
      const b = right.plant.spreadCm ?? -1;
      return b - a || left.plant.commonName.localeCompare(right.plant.commonName);
    });
  const care = groupedCareInstructions(species);
  const careLines = careParagraph(species);
  const anyEstimatedSpread = species.some(
    ({ plant }) => plant.spreadConfidence !== "original",
  );
  const anyUnknownColour = species.some(({ plant }) => hasUnknownColour(plant));

  return (
    <section className="plan-output">
      {!readOnly && (
        <div className="plan-ready">
          <p>
            <strong>Your garden plan is ready.</strong>{" "}
            {isSaved ? "Saved — find it under My gardens." : "Save it to keep it under My gardens."}
          </p>
          <button className="button button-dark" onClick={onSave} disabled={isSaved}>
            {isSaved ? "Saved ✓" : "Save this garden plan"}
          </button>
        </div>
      )}
      {/* Every answer the plan was built from, folded into one clean line
          across the page; open it to read them all. */}
      <details className="brief-strip">
        <summary>
          <span>Your answers</span>
          <span className="brief-strip-hint" aria-hidden="true">
            {briefChips(plan.brief)
              .slice(0, 4)
              .map(({ value }) => value)
              .join(" · ")}
            {" …"}
          </span>
        </summary>
        <div className="brief-strip-body" aria-label="Garden brief summary">
          {briefChips(plan.brief).map(({ label, value }) => (
            <span key={label}>
              <small>{label}</small>
              {value}
            </span>
          ))}
        </div>
      </details>

      {/* The view switch and the three options, on one line across the
          whole page like the answers above, rather than squeezed into the
          width of the drawing. */}
      <div className="plan-layout-head">
        <LayoutViewSwitch view={bedView} onChange={setBedView} />
        {variantTabs}
      </div>

      {/* The ratio again, so the drawer tab and the panel can be pinned to
          the drawing's own right-hand edge rather than the page's. */}
      <div
        className="plan-output-grid"
        style={
          {
            // Width / length: the drawing is north-up, so a long bed is
            // tall, and its height is capped by the same viewport budget.
            "--bed-aspect": layout.bedWidthM / layout.bedLengthM,
          } as CSSProperties
        }
      >
        <div className="plan-layout-column">
          {/* The tab and the panel live in here, so they hang off the
              drawing's own top right corner rather than off the page -
              which is what made the tab look stranded, and what made the
              open panel cover the third option. */}
          <div className="plan-bed-area">
            <BedDiagram
              widthM={layout.bedWidthM}
              lengthM={layout.bedLengthM}
              placements={layout.placements}
              openPlant={openPlant}
              savedIds={savedIds}
              viewingEdge={plan.brief.viewingEdge}
              view={bedView}
              onViewChange={setBedView}
            />

          <button
            type="button"
            className="plan-drawer-tab"
            aria-expanded={plantsOpen}
            aria-controls="plan-plant-drawer"
            onClick={() => setPlantsOpen((open) => !open)}
          >
            <span>{plantsOpen ? "Hide plants" : "Plants"}</span>
            <span aria-hidden="true">{plantsOpen ? "›" : "‹"}</span>
          </button>

          <div
            id="plan-plant-drawer"
            className={`plan-legend${plantsOpen ? " is-open" : ""}`}
            aria-hidden={!plantsOpen}
          >
            <div className="plan-drawer-bar">
              <h3>Plants in this bed</h3>
              <button
                type="button"
                className="plan-drawer-close"
                onClick={() => setPlantsOpen(false)}
                aria-label="Close the plant list"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="plan-legend-heading">
              <span>Plant</span>
              <span>How many</span>
            </div>
            {species.map(({ plant, quantity }) => (
              <div key={quantity.id} className="plan-legend-item">
                <button onClick={() => openPlant(plant)} className="plan-legend-row">
                  <span
                    className="legend-dot"
                    style={{ background: markerBackground(plant) }}
                  />
                  <span>
                    <strong>
                      {shortName(plant)}
                      {savedIds.includes(plant.id) ? (
                        <span className="legend-saved" title="One of your favourites" aria-label="favourite"><SavedHeart /></span>
                      ) : null}
                    </strong>
                    <em>{plant.scientificName}</em>
                  </span>
                  <b>× {quantity.quantity}</b>
                </button>
                <p className="legend-measure">
                  {formatDimension(plant.heightCm)} tall ·{" "}
                  {formatDimension(plant.spreadCm)} wide
                  {plant.spreadConfidence !== "original" ? " (estimated)" : ""}
                  {hasUnknownColour(plant) ? " · Colour not recorded" : ""}
                  {onExclude && (
                    <button
                      type="button"
                      className="legend-exclude"
                      onClick={() => onExclude(plant.id)}
                      title={`Hide ${plant.commonName} from my plans`}
                      aria-label={`Hide ${plant.commonName} and rebuild the plans`}
                    >
                      Hide
                    </button>
                  )}
                </p>
              </div>
            ))}
            </div>
          </div>
        </div>
      </div>

      {/* The plain summary, under the drawing. Each figure carries its
          unit, and the price says plainly that it is a guide. */}
      <dl className="plan-summary-row">
        <div>
          <dt>Plants</dt>
          <dd>{quantities.totalPlants}</dd>
        </div>
        <div>
          <dt>Different plants</dt>
          <dd>{quantities.quantities.length}</dd>
        </div>
        <div>
          <dt>Bed size</dt>
          <dd>
            {plan.brief.bedWidthM} × {plan.brief.bedLengthM} m
          </dd>
        </div>
        <div>
          <dt>Open space</dt>
          <dd>{Math.round(layout.realisedOpenSpaceRatio * 100)}%</dd>
        </div>
        <div>
          <dt>Guide price</dt>
          <dd>{guidePrice(budget)}</dd>
        </div>
      </dl>

      {(anyEstimatedSpread || anyUnknownColour) && (
        <p className="plan-caveat">
          {anyEstimatedSpread
            ? "Circles with a dashed edge use an estimated mature spread rather than a measured one. "
            : ""}
          {anyUnknownColour
            ? "Plants with no recorded flower colour are drawn in neutral green rather than a guessed colour."
            : ""}
        </p>
      )}

      {/* "Why these plants" and "Care" answer two halves of the same
          question, and each is a short paragraph, so they sit side by side
          rather than leaving a column of empty page between them. */}
      <div className="plan-reasoning">
      <div className="plan-why">
        <h3>Why these plants</h3>
        <p>
          This is <strong>{plan.character.toLowerCase()}</strong> of three.
          Every plant here can take{" "}
          {{ full: "full sun", part: "part sun", sheltered: "shade" }[plan.brief.sun]},{" "}
          {{ low: "little water", moderate: "some water", moist: "plenty of water" }[plan.brief.water]} and{" "}
          {plan.brief.soil === "not-sure" ? "any of the three soils" : `${soilLabels[plan.brief.soil].toLowerCase()} soil`}, and grows in{" "}
          {plan.brief.biomes.map((biome) => biomeLabels[biome]).join(" or ")}.
          {plan.brief.style !== "undecided"
            ? ` We favoured a ${gardenStyleLabels[plan.brief.style].toLowerCase()} character.`
            : ""}
          {plan.brief.extras.length > 0
            ? ` We also looked for ${plan.brief.extras
                .map((extra) => extraPreferenceLabels[extra].toLowerCase())
                .join(", ")}.`
            : ""}
        </p>
      </div>

      <div className="plan-care">
          <h3>Care</h3>
          {/* Moved here from under the drawing (owner, 20 Oct): the layout
              notes are part of looking after the bed. The wind and
              layering notes differ for each layout. */}
          <p className="care-summary">
            Shown at mature size. Mulch open ground, and fill gaps with annuals while plants grow (2–3 years).
          </p>
          {windNote(plan.brief) ? <p className="care-summary">{windNote(plan.brief)}</p> : null}
          {layeringNote(layout, plan.brief) ? (
            <p className="care-summary">{layeringNote(layout, plan.brief)}</p>
          ) : null}
          {careLines.length > 0 && (
            <p className="care-summary">{careLines.join(" ")}</p>
          )}
          {care.length > 0 && (
            <details className="care-detail">
              <summary>
                What each plant&apos;s profile records
                <small>{care.length} notes across {species.length} species</small>
              </summary>
              <ul>
                {care.map(({ instruction, names }) => (
                  <li key={instruction}>
                    <strong>{instruction}</strong>
                    <span>{names.join(", ")}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>

      <div className="plan-plants">
        <h3>The plants in this layout</h3>
        <div className="plan-plant-grid">
          {species.map(({ plant, quantity }) => (
            <article key={plant.id} className="plan-plant-card">
              <PlantPhoto plant={plant} />
              <h4>{shortName(plant)}</h4>
              <em>{plant.scientificName}</em>
              <dl>
                <div>
                  <dt>Quantity</dt>
                  <dd>× {quantity.quantity}</dd>
                </div>
                <div>
                  <dt>Height</dt>
                  <dd>{formatDimension(plant.heightCm)}</dd>
                </div>
                <div>
                  <dt>Spread</dt>
                  <dd>
                    {formatDimension(plant.spreadCm)}
                    {plant.spreadConfidence !== "original" ? " (est.)" : ""}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </div>

      <SourcingPanel
        key={place ?? ""}
        place={place}
        onBudget={onBudget}
        items={species.map(({ plant, quantity }) => ({
          plantId: plant.id,
          n: quantity.quantity,
          label: plant.commonName,
        }))}
      />

      <div className="plan-actions" hidden={readOnly}>
        <button className="button button-dark" onClick={onSave} disabled={isSaved}>
          {isSaved ? "Saved ✓" : "Save this garden plan"}
        </button>
        <button
          className="text-link"
          onClick={onRegenerate}
          title="Replaces these three options. Save one first to keep it."
        >
          Show 3 new options
        </button>
      </div>

      <details className="plan-assumptions">
        <summary>
          How we worked this out
          <span>View notes</span>
        </summary>
        <div>
          <section>
            <h3>What we assumed</h3>
            <ul>
              {plan.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3>Notes for this plan</h3>
            <ul>
              {[...new Set(plan.diagnostics)].map((diagnostic) => (
                <li key={diagnostic}>{diagnostic}</li>
              ))}
              <li>
                Reference {plan.seed} — the same answers always rebuild this
                layout.
              </li>
            </ul>
          </section>
        </div>
      </details>
    </section>
  );
}

function CollectionView({
  mode,
  brief,
  place,
  onBudgetForSaved,
  saved,
  excluded,
  openPlant,
  toggleSaved,
  toggleExcluded,
  setCategory,
  restart,
  onSaveLayout,
  isLayoutSaved,
}: {
  mode: "results" | "browse";
  brief: GardenBrief;
  place: string | null;
  saved: string[];
  /** Plants the user has ruled out; they never enter the pool. */
  excluded: string[];
  openPlant: (plant: Plant) => void;
  toggleSaved: (id: string) => void;
  toggleExcluded: (id: string) => void;
  setCategory: (ids: string[], list: "saved" | "excluded", on: boolean) => void;
  restart: () => void;
  onSaveLayout: (plan: GardenPlan, budget: SavedBudget | null) => void;
  isLayoutSaved: (plan: GardenPlan) => boolean;
  onBudgetForSaved: (plan: GardenPlan, budget: SavedBudget) => void;
}) {
  // Latest budget line per plan (by seed), so saving can store it.
  const [budgets, setBudgets] = useState<Record<string, SavedBudget>>({});
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<string>("All");
  const [limit, setLimit] = useState(12);
  // Regenerate deliberately produces a different set; reopening the same
  // counter reproduces this one exactly (spec 8.6).
  const [variationCounter, setVariationCounter] = useState(0);
  const [chosenVariant, setChosenVariant] = useState(0);

  // Only the results view needs plans. This component also serves the
  // plant library, where it used to build three full layouts for nothing
  // - and where a first-time visitor has the default brief, which has no
  // vegetation type, so buildGardenPlanVariants threw and took the whole
  // page down. The brief is validated as well as the mode, so an
  // incomplete answer set can never crash the view again.
  const variants = useMemo(
    () =>
      mode === "results" && validateGardenBrief(brief).valid
        ? buildGardenPlanVariants(plants, brief, {
            savedPlantIds: saved,
            excludedPlantIds: excluded,
            variationCounter,
          })
        : [],
    // `excluded` is a dependency, so ruling a plant out rebuilds all three
    // options straight away - no Regenerate press needed.
    [mode, brief, saved, excluded, variationCounter],
  );
  const plan: GardenPlan | undefined =
    variants[Math.min(chosenVariant, variants.length - 1)];

  // ?trace=1 prints the engine's working to the console, for the demo
  // video. Strictly a reader of values the plan already carries; with
  // the flag off this effect does nothing at all.
  useEffect(() => {
    if (!plan || !traceEnabled()) return;
    tracePlan(plan, plants.length);
  }, [plan]);

  const ranked = useMemo<
    { plant: Plant; match?: PlantAssessment }[]
  >(() => {
    if (mode === "results" && plan) {
      const plantsById = new Map(plants.map((plant) => [plant.id, plant]));
      return plan.assessments.flatMap((match) => {
        const plant = plantsById.get(match.plantId);
        return plant ? [{ plant, match }] : [];
      });
    }

    return [...plants]
      .sort((left, right) => right.occurrenceCount - left.occurrenceCount)
      .map((plant) => ({ plant }));
  }, [mode, plan]);

  const filtered = ranked.filter(({ plant }) => {
    const haystack =
      `${plant.commonName} ${plant.scientificName} ${plant.family}`.toLowerCase();
    const queryMatches = haystack.includes(query.toLowerCase());
    const formMatches =
      form === "All" ||
      // The field is a list - "Ground Cover, Perennial" - so it is
      // matched part by part rather than as one string. A plant under
      // two types appears under either.
      plant.form
        .split(",")
        .map((part) => part.trim().toLowerCase())
        .includes(form.toLowerCase());
    return queryMatches && formMatches;
  });

  // Owner, 21 Oct 2026: favourite or exclude a whole plant type at once.
  // The whole type, not just the plants the search shows, and never the
  // educational-only plants (they cannot be favourited or excluded).
  const categoryIds =
    form === "All"
      ? []
      : plants
          .filter(
            (plant) =>
              neverPlantedReason(plant) === null &&
              plant.form.split(",").map((part) => part.trim().toLowerCase()).includes(form.toLowerCase()),
          )
          .map((plant) => plant.id);
  const savedSet = new Set(saved);
  const excludedSet = new Set(excluded);
  const allSaved = categoryIds.length > 0 && categoryIds.every((id) => savedSet.has(id));
  const allExcluded = categoryIds.length > 0 && categoryIds.every((id) => excludedSet.has(id));

  return (
    <main className="collection-shell">
      <section className={`collection-intro${mode === "results" ? " is-compact" : ""}`}>
        <div>
          <h1>
            {mode === "results" ? (
              <>
                Your <em>{brief.bedWidthM} × {brief.bedLengthM} m</em> garden plan.
              </>
            ) : (
              <>
                Explore {plants.length.toLocaleString("en-ZA")} plants suited
                to the <em>Western Cape.</em>
              </>
            )}
          </h1>
        </div>
        <div className="collection-note">
          <p>
            {mode === "results"
              ? "Checked against your answers. Anything we’re unsure about is marked."
              : "Plants from PlantZAfrica (SANBI) profiles and BioSCape field records. Where a value is estimated or unknown, the plant says so — we never guess."}
          </p>
          {mode === "results" && (
            <button className="text-link" onClick={restart}>
              ← Change my answers
            </button>
          )}
        </div>
      </section>

      {mode === "results" && plan && (
        <>
          <PlanSummary
            variantTabs={
              <div className="variant-tabs" role="tablist" aria-label="Three layout options">
                {variants.map((variant, index) => (
                  <button
                    key={variant.character}
                    role="tab"
                    aria-selected={index === chosenVariant}
                    className={`variant-tab${index === chosenVariant ? " is-selected" : ""}`}
                    onClick={() => setChosenVariant(index)}
                  >
                    <strong>{variant.character}</strong>
                    <small>
                      {variant.quantities
                        ? `${variant.quantities.totalPlants} plants · ${variant.quantities.quantities.length} species`
                        : "No layout"}
                    </small>
                    {describeOption(variant, variants) ? (
                      <em>{describeOption(variant, variants)}</em>
                    ) : null}
                  </button>
                ))}
              </div>
            }
            plan={plan}
            place={place}
            savedIds={saved}
            openPlant={openPlant}
            onSave={() => onSaveLayout(plan, budgets[plan.seed] ?? null)}
            budget={budgets[plan.seed] ?? null}
            onBudget={(budget) => {
              setBudgets((current) => ({ ...current, [plan.seed]: budget }));
              // Saved before the prices arrived: fill the budget in now.
              onBudgetForSaved(plan, budget);
            }}
            isSaved={isLayoutSaved(plan)}
            onExclude={(id) => {
              toggleExcluded(id);
              // The three options rebuild from the smaller pool; the first
              // one is the new best, so land the user there rather than on
              // a tab that now holds a different garden.
              setChosenVariant(0);
            }}
            onRegenerate={() => {
              setVariationCounter((current) => current + 1);
              setChosenVariant(0);
            }}
          />
        </>
      )}

      {/* The library is its own screen. It used to render under the
          plan as well, which buried the result the gardener came for
          beneath nine thousand pixels of catalogue. */}
      {mode === "browse" && (
        <>
        <section className="collection-tools" aria-label="Collection filters">
          <label className="search-field">
            <span>Search plants</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setLimit(12);
              }}
              placeholder="Search by common or scientific name"
            />
          </label>
          {/* Twenty-one types is too many to show as buttons, so this is
              a list. Each one carries its count, which saves choosing a
              type and finding three plants behind it. */}
          <div className="filter-row">
            <span id="plant-type-label">Plant type</span>
            {/* Owner, 21 Oct: favourite or exclude the chosen type right
                beside the list. */}
            <div className="type-filter-line">
            <select
              className="plant-type-select"
              aria-labelledby="plant-type-label"
              value={form}
              onChange={(event) => {
                setForm(event.target.value);
                setLimit(12);
              }}
            >
              <option value="All">All types ({plants.length.toLocaleString("en-ZA")})</option>
              {PLANT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.count})
                </option>
              ))}
            </select>
            {categoryIds.length > 0 && (
              <>
                <button
                  type="button"
                  className={allSaved ? "is-active" : ""}
                  aria-pressed={allSaved}
                  title={`${categoryIds.length} ${form.toLowerCase()} plants that can be planted`}
                  onClick={() => setCategory(categoryIds, "saved", !allSaved)}
                >
                  {allSaved ? "Unfavourite all" : `Favourite all ${categoryIds.length}`}{" "}
                  <span aria-hidden="true">{allSaved ? "♥" : "♡"}</span>
                </button>
                <button
                  type="button"
                  className={allExcluded ? "is-active" : ""}
                  aria-pressed={allExcluded}
                  title={`${categoryIds.length} ${form.toLowerCase()} plants that can be planted`}
                  onClick={() => setCategory(categoryIds, "excluded", !allExcluded)}
                >
                  {allExcluded ? "Show all again" : `Hide all ${categoryIds.length}`}{" "}
                  <span aria-hidden="true">{allExcluded ? "↺" : "⃠"}</span>
                </button>
              </>
            )}
            </div>
          </div>
        </section>

        <div className="results-count">
          <span>{filtered.length.toLocaleString("en-ZA")} plants</span>
          <span className="results-label">Plant library</span>
        </div>

        {filtered.length ? (
          <section className="plant-grid">
            {filtered.slice(0, limit).map(({ plant, match }) => (
              <PlantCard
                key={plant.id}
                plant={plant}
                match={match}
                saved={saved.includes(plant.id)}
                excluded={excluded.includes(plant.id)}
                open={() => openPlant(plant)}
                toggleSaved={() => toggleSaved(plant.id)}
                toggleExcluded={() => toggleExcluded(plant.id)}
              />
            ))}
          </section>
        ) : (
          <section className="empty-state">
            <h2>No plants match these filters.</h2>
            <button
              className="text-link"
              onClick={() => {
                setQuery("");
                setForm("All");
              }}
            >
              Clear the filters
            </button>
          </section>
        )}

        {limit < filtered.length && (
          <div className="load-more">
            <button
              className="button button-outline"
              onClick={() => setLimit(limit + 12)}
            >
              Show twelve more <span>↓</span>
            </button>
          </div>
        )}
        </>
      )}
    </main>
  );
}

/**
 * A saved garden re-opened in full. The layout is rebuilt from the brief
 * and the stored seed, which is what makes it the same garden rather than
 * a new one - so the care notes, the reasoning and the nursery check all
 * come back with it. If the dataset or the rulebook has changed since it
 * was saved, the rebuild can differ, and the page says so rather than
 * quietly showing something else.
 */
function SavedLayoutPage({
  layout,
  savedIds,
  openPlant,
  onRename,
  onBack,
}: {
  layout: SavedLayout;
  savedIds: readonly string[];
  openPlant: (plant: Plant) => void;
  onRename: (id: string, label: string) => void;
  onBack: () => void;
}) {
  const plan = useMemo(() => {
    const variants = buildGardenPlanVariants(plants, layout.brief);
    return variants.find((variant) => variant.seed === layout.seed) ?? variants[0];
  }, [layout.brief, layout.seed]);

  const stale =
    (layout.datasetVersion !== null && layout.datasetVersion !== DATASET_VERSION) ||
    (layout.rulesVersion !== null && plan.engine !== null && layout.rulesVersion !== plan.engine.rulesVersion);
  const rebuiltDifferently = plan.seed !== layout.seed;

  return (
    <>
      <div className="saved-page-bar">
        <button className="text-link" onClick={onBack}>
          ← All saved gardens
        </button>
        <button className="text-link print-button" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
        <LayoutName layout={layout} onRename={onRename} />
        <span>
          Saved {formatSavedDate(layout.createdAt)} · reference {layout.seed}
        </span>
      </div>
      {(stale || rebuiltDifferently) && (
        <p className="sourcing-warning">
          {rebuiltDifferently
            ? "This garden could not be rebuilt exactly - the plants and positions below are the closest match to the one you saved."
            : "The plant data or the planting rules have changed since you saved this garden, so what you see may differ slightly from the version you saved."}
        </p>
      )}
      <PlanSummary
        plan={plan}
        place={layout.budget?.place ?? null}
        savedIds={savedIds}
        openPlant={openPlant}
        onSave={() => {}}
        onBudget={() => {}}
        budget={layout.budget}
        onRegenerate={() => {}}
        isSaved
        readOnly
      />
    </>
  );
}

/** The name of a saved garden, editable in place. Blank clears the name
 * and the default ("Option 1") comes back, so a garden is never nameless.
 * Enter commits, Escape abandons - typing in a list should never need a
 * trip to a dialog. */
function LayoutName({
  layout,
  onRename,
}: {
  layout: SavedLayout;
  onRename: (id: string, label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(layout.label ?? "");

  if (!editing) {
    return (
      <span className="saved-layout-name">
        <strong>{layout.label ?? layout.character}</strong>
        <button
          type="button"
          className="rename-button"
          onClick={() => {
            setDraft(layout.label ?? "");
            setEditing(true);
          }}
          aria-label={`Rename ${layout.label ?? layout.character}`}
        >
          Rename
        </button>
      </span>
    );
  }

  const commit = () => {
    onRename(layout.id, draft);
    setEditing(false);
  };

  return (
    <span className="saved-layout-name is-editing">
      <input
        // Focused on open: the button was just clicked to start typing.
        autoFocus
        value={draft}
        maxLength={60}
        placeholder={layout.character}
        aria-label="Name for this garden"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setEditing(false);
        }}
        onBlur={commit}
      />
      <button type="button" className="rename-button" onMouseDown={commit}>
        Save
      </button>
    </span>
  );
}

function SavedLayoutsList({
  layouts,
  onRemove,
  onRename,
  openPlant,
  savedIds,
  onOpen,
}: {
  layouts: SavedLayout[];
  savedIds: readonly string[];
  onRemove: (id: string) => void;
  onRename: (id: string, label: string) => void;
  openPlant: (plant: Plant) => void;
  onOpen: (id: string) => void;
}) {
  if (layouts.length === 0) return null;
  const plantsById = new Map(plants.map((plant) => [plant.id, plant]));

  return (
    <section className="saved-layouts">
      <div className="saved-layout-grid">
        {layouts.map((layout) => (
          <article key={layout.id} className="saved-layout-card">
            <header>
              <LayoutName layout={layout} onRename={onRename} />
              {/* Every saved layout is listed with the date it was made. */}
              <time dateTime={layout.createdAt}>
                {formatSavedDate(layout.createdAt)}
              </time>
            </header>
            <p className="saved-layout-meta">
              {layout.brief.bedWidthM} × {layout.brief.bedLengthM} m ·{" "}
              {layout.species.reduce((total, item) => total + item.quantity, 0)}{" "}
              plants · {layout.species.length} species
              {/* The card's drawing is too small to carry the words
                  "you stand here", so the side is said here instead and
                  the drawing keeps only the figure. */}
              {" · "}you stand on the {layout.brief.viewingEdge} side
            </p>
            {layout.placements && layout.placements.length > 0 ? (
              <BedDiagram
                widthM={layout.brief.bedWidthM}
                lengthM={layout.brief.bedLengthM}
                placements={layout.placements}
                openPlant={openPlant}
                savedIds={savedIds}
                viewingEdge={layout.brief.viewingEdge}
              />
            ) : (
              <p className="saved-layout-note">
                Saved before planting plans were stored - rebuild it from
                the same answers to see where each plant goes.
              </p>
            )}
            {layout.budget ? (
              <p className="saved-layout-budget">
                {/* The figure only. The full line - what is in it, what
                    was not found, when it was checked - is on the
                    garden's own page, where there is room for it. */}
                {guidePrice(layout.budget)}
                <small> guide price</small>
              </p>
            ) : null}
            <ul>
              {layout.species.map((item) => {
                const plant = plantsById.get(item.plantId);
                if (!plant) return null;
                return (
                  <li key={item.plantId}>
                    <button className="text-link" onClick={() => openPlant(plant)}>
                      {shortName(plant)}
                    </button>{" "}
                    × {item.quantity}
                  </li>
                );
              })}
            </ul>
            <footer>
              <button className="text-link" onClick={() => onOpen(layout.id)}>
                Open full layout →
              </button>
              {/* Printing from the list would put every saved garden on
                  the page, so this opens the one you picked first and
                  prints that. The wait is for the layout to rebuild -
                  a saved garden is re-planned from its seed, not
                  stored as a picture. */}
              <button
                className="text-link"
                onClick={() => {
                  onOpen(layout.id);
                  window.setTimeout(() => window.print(), 900);
                }}
              >
                Print / Save as PDF
              </button>
              <button className="text-link" onClick={() => onRemove(layout.id)}>
                Remove
              </button>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

function SavedView({
  saved,
  excluded,
  savedLayouts,
  removeLayout,
  renameLayout,
  openPlant,
  toggleSaved,
  toggleExcluded,
  browse,
}: {
  saved: string[];
  excluded: string[];
  savedLayouts: SavedLayout[];
  removeLayout: (id: string) => void;
  renameLayout: (id: string, label: string) => void;
  openPlant: (plant: Plant) => void;
  toggleSaved: (id: string) => void;
  toggleExcluded: (id: string) => void;
  browse: () => void;
}) {
  const savedPlants = plants.filter((plant) => saved.includes(plant.id));
  const excludedPlants = plants.filter((plant) => excluded.includes(plant.id));
  // Three different things live here - whole gardens, the plants you liked
  // and the plants you ruled out - so they get their own tabs rather than
  // one stacked on the other.
  const [tab, setTab] = useState<"gardens" | "plants" | "excluded">(
    savedLayouts.length > 0 ? "gardens" : "plants",
  );
  // One saved garden opened in full. Cleared if that garden is removed.
  const [openedId, setOpenedId] = useState<string | null>(null);
  const opened = savedLayouts.find((item) => item.id === openedId) ?? null;

  if (opened) {
    return (
      <main className="saved-shell">
        <SavedLayoutPage
          layout={opened}
          savedIds={saved}
          openPlant={openPlant}
          onRename={renameLayout}
          onBack={() => setOpenedId(null)}
        />
      </main>
    );
  }

  return (
    <main className="saved-shell">
      <section className="saved-intro">
        <h1>
          Your gardens, your favourites,
          <br />
          your <em>choices.</em>
        </h1>
        <p>
          Saved in this browser only: clearing your browser data or
          switching device loses them. My gardens keeps your garden plans,
          favourites are the plants you love (used only if they suit your
          bed), and hidden plants are never used in your plans.
        </p>
      </section>

      <div className="saved-tabs" role="tablist" aria-label="Saved gardens, favourites and exclusions">
        <button
          role="tab"
          aria-selected={tab === "gardens"}
          className={`saved-tab${tab === "gardens" ? " is-selected" : ""}`}
          onClick={() => setTab("gardens")}
        >
          My gardens <span>{savedLayouts.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "plants"}
          className={`saved-tab${tab === "plants" ? " is-selected" : ""}`}
          onClick={() => setTab("plants")}
        >
          Favourite plants <span>{savedPlants.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "excluded"}
          className={`saved-tab${tab === "excluded" ? " is-selected" : ""}`}
          onClick={() => setTab("excluded")}
        >
          Hidden plants <span>{excludedPlants.length}</span>
        </button>
      </div>

      {tab === "gardens" &&
        (savedLayouts.length > 0 ? (
          <SavedLayoutsList
            layouts={savedLayouts}
            savedIds={saved}
            onRemove={removeLayout}
            onRename={renameLayout}
            openPlant={openPlant}
            onOpen={setOpenedId}
          />
        ) : (
          <section className="saved-empty">
            <p>
              No saved gardens yet. Make a garden plan and use{" "}
              <strong>Save this garden plan</strong> to keep it here.
            </p>
          </section>
        ))}

      {tab === "plants" && (
        <>
      {savedPlants.length ? (
        <>
          <div className="saved-summary">
            <span>{savedPlants.length} plants</span>
            <span>
              {new Set(savedPlants.map((plant) => plant.form)).size} plant types
            </span>
          </div>
          <section className="plant-grid saved-grid">
            {savedPlants.map((plant) => (
              <PlantCard
                key={plant.id}
                plant={plant}
                saved
                excluded={false}
                open={() => openPlant(plant)}
                toggleSaved={() => toggleSaved(plant.id)}
                toggleExcluded={() => toggleExcluded(plant.id)}
              />
            ))}
          </section>
        </>
      ) : (
        <section className="empty-state saved-empty">
          <h2>You haven’t picked any favourites yet.</h2>
          <p>
            Browse the library and tap the heart on plants you like.
            Favourites are only used if they suit your bed.
          </p>
          <button className="button button-dark" onClick={browse}>
            Browse the plant library <span aria-hidden="true">→</span>
          </button>
        </section>
      )}
        </>
      )}

      {tab === "excluded" && (
        <>
          {excludedPlants.length ? (
            <>
              <div className="saved-summary">
                <span>{excludedPlants.length} excluded</span>
                <span>Left out of every new plan until you put it back</span>
              </div>
              <section className="plant-grid saved-grid">
                {excludedPlants.map((plant) => (
                  <PlantCard
                    key={plant.id}
                    plant={plant}
                    saved={saved.includes(plant.id)}
                    excluded
                    open={() => openPlant(plant)}
                    toggleSaved={() => toggleSaved(plant.id)}
                    toggleExcluded={() => toggleExcluded(plant.id)}
                  />
                ))}
              </section>
            </>
          ) : (
            <section className="empty-state saved-empty">
              <h2>You haven’t hidden any plants.</h2>
              <p>
                If a plan suggests something you do not want — a plant you
                dislike, or one you already have too much of — use{" "}
                <strong>Hide</strong> on it. It will be left out of every new
                plan until you show it again here.
              </p>
              <button className="button button-dark" onClick={browse}>
                Browse the plant library <span aria-hidden="true">→</span>
              </button>
            </section>
          )}
        </>
      )}
    </main>
  );
}

/** Line icons for the method page. Stroked, not filled, so they read as
 * annotations beside the type rather than competing with it. */
function MethodIcon({ name }: { name: "sun" | "filter" | "heart" | "plan" | "phone" | "ruler" | "clock" }) {
  const paths: Record<string, ReactNode> = {
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
      </>
    ),
    filter: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
    heart: <path d="M12 20s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.8C19 15.7 12 20 12 20z" />,
    plan: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.6" />
        <circle cx="15.5" cy="8.5" r="1.6" />
        <circle cx="8.5" cy="15.5" r="1.6" />
        <circle cx="15.5" cy="15.5" r="1.6" />
      </>
    ),
    phone: <path d="M6 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2.2 2A16 16 0 0 1 4 5.2 2 2 0 0 1 6 3z" />,
    ruler: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  };
  return (
    <svg
      className="method-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}

/** The four steps, in the order the planner actually runs them. The copy
 * stays deliberately short: the detail that used to live here is in the
 * sources disclosure below, where someone who wants it can find it. */
const METHOD_STEPS: { icon: "sun" | "filter" | "heart" | "plan"; title: string; copy: string }[] = [
  {
    icon: "sun",
    title: "Tell us about your garden",
    copy: "Where is your garden? How much sun and water does it get? Tell us about your soil, bed size and conditions.",
  },
  {
    icon: "filter",
    title: "Find plants that can thrive",
    copy: "We filter out plants that don’t suit your garden’s growing conditions, including unsuitable or invasive plants.",
  },
  {
    icon: "heart",
    title: "Make it your own",
    copy: "Choose your garden style, favourite colours and other preferences to help shape your plant selection.",
  },
  {
    icon: "plan",
    title: "Get your garden plan",
    copy: "Explore your proposed layout, the plants and quantities to use, and estimated costs where available.",
  },
];

/** The three standing caveats. They are the honest limits of an MVP, so
 * they sit on the page itself rather than inside a disclosure. */
const METHOD_NOTES: { icon: "phone" | "ruler" | "clock"; lead: string; copy: string }[] = [
  { icon: "phone", lead: "Prices are a guide.", copy: "Phone the nursery before you go." },
  { icon: "ruler", lead: "Plant sizes are a guide.", copy: "Check the details with your nursery." },
  { icon: "clock", lead: "A starting point.", copy: "Adjust the plan to what you see in your garden." },
];

function MethodView({ start }: { start: () => void }) {
  return (
    <main className="method-shell">
      <section className="method-hero">
        <p className="method-eyebrow">Your garden, made simple</p>
        <h1>How it works</h1>
        <p>
          Answer a few simple questions about your garden and discover plants
          that suit your space, conditions and style. Get a garden-bed plan, a
          plant list and estimated costs.
        </p>
        <button className="button button-dark" onClick={start}>
          Create my garden <span aria-hidden="true">→</span>
        </button>
      </section>

      <section className="method-steps">
        <h2>Your garden in 4 simple steps</h2>
        <ol className="step-grid">
          {METHOD_STEPS.map((step, index) => (
            <li key={step.title} className="step-card">
              <div className="step-card-head">
                <span className="step-number">{index + 1}</span>
                <MethodIcon name={step.icon} />
              </div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="method-notes">
        <h2>Good to know</h2>
        <div className="note-row">
          {METHOD_NOTES.map((note) => (
            <p key={note.lead} className="note-card">
              <MethodIcon name={note.icon} />
              <span>
                <strong>{note.lead}</strong> {note.copy}
              </span>
            </p>
          ))}
        </div>

        {/* The provenance that used to be spread across the four steps.
            Kept in full - it is what makes a recommendation checkable -
            but folded away so the page reads in ten seconds. */}
        <details className="method-sources">
          <summary>Where does the plant information come from?</summary>
          <ul>
            <li>
              {plants.length.toLocaleString("en-ZA")} Western Cape species,
              from <strong>PlantZAfrica (SANBI)</strong> plant profiles and{" "}
              <strong>BioSCape</strong> field records.
            </li>
            <li>
              Sun, water and soil needs are <strong>recorded</strong> for most
              plants. Where one is not, it is inferred from the plant’s genus
              or, for water and soil, its vegetation type. Your area’s
              vegetation type comes from SANBI’s 2018 national vegetation map.
            </li>
            <li>
              Invasive plants on the <strong>NEMBA list</strong> are removed
              first, along with poisonous, parasitic and water plants.
            </li>
            <li>
              A plant with <strong>no record</strong> for your sun, water or
              soil is left out too, rather than assumed to cope.
            </li>
            <li>
              If too few plants fit, we relax{" "}
              <strong>soil first, then water, then sun</strong> — and tell
              you which.
            </li>
            <li>
              Most plant spreads (about 9 in 10) are{" "}
              <strong>estimated</strong> from the plant’s height or from
              similar plants, not measured, so the circles show likely size
              rather than nursery spacing.
            </li>
            <li>
              Nursery prices are checked live from each nursery’s own site
              and price lists. They are indicative, never live stock.
            </li>
          </ul>
        </details>
      </section>

      <section className="method-cta">
        <div className="method-cta-inner">
          <h2>Ready to plan your bed?</h2>
          <button className="button button-on-dark" onClick={start}>
            Create my garden <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    </main>
  );
}
function DetailDrawer({
  plant,
  place,
  saved,
  excluded,
  close,
  toggleSaved,
  toggleExcluded,
}: {
  plant: Plant;
  place: string | null;
  saved: boolean;
  excluded: boolean;
  close: () => void;
  toggleSaved: () => void;
  toggleExcluded: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("drawer-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("drawer-open");
    };
  }, [close]);

  return (
    <div className="drawer-layer">
      <button
        className="drawer-backdrop"
        onClick={close}
        aria-label="Close plant profile"
      />
      <aside
        className="detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
      >
        <div className="drawer-toolbar">
          <span>
            {plant.family} family
          </span>
          <button onClick={close}>Close ×</button>
        </div>
        <PlantPortrait plant={plant} hero />
        <div className="detail-copy">
          <h2 id="detail-title" className="detail-title">{shortName(plant)}</h2>
          <p className="detail-scientific">{plant.scientificName}</p>
          {otherNamesLine(plant) ? <p className="plant-other-names detail-other-names">{otherNamesLine(plant)}</p> : null}
          <p className="detail-note">{plant.note}</p>
          {neverPlantedReason(plant) ? (
            <p className="detail-note detail-educational">
              <strong>For educational purposes.</strong> This plant is never
              planted, because {neverPlantedReason(plant)} — a limit of the
              plant itself or of the tool at this point. It cannot be
              favourited or excluded.
            </p>
          ) : (
          <div className="detail-actions">
            <button
              className={`button ${saved ? "button-outline" : "button-dark"}`}
              onClick={toggleSaved}
            >
              {saved ? "Remove from favourites" : "Add to favourites"}{" "}
              <span>{saved ? "−" : "+"}</span>
            </button>
            <button
              type="button"
              className={`button button-outline${excluded ? " is-excluded" : ""}`}
              onClick={toggleExcluded}
              aria-pressed={excluded}
            >
              {excluded ? "Show in my plans again" : "Hide from my plans"}
            </button>
          </div>
          )}
          {excluded && (
            <p className="detail-note detail-excluded">
              Excluded by you, so it is left out of every new plan. Its record
              here is unchanged.
            </p>
          )}

          <dl className="detail-facts">
            <div>
              <dt>Growth form</dt>
              <dd>{plant.form}</dd>
            </div>
            <div>
              <dt>Maximum height</dt>
              <dd>{formatDimension(plant.heightCm)}</dd>
            </div>
            <div>
              <dt>Typical spread</dt>
              <dd>{formatDimension(plant.spreadCm)}</dd>
            </div>
            <div>
              <dt>Flowers seen</dt>
              <dd>
                {plant.flowerStart}–{plant.flowerEnd}
              </dd>
            </div>
            <div>
              <dt>Light</dt>
              <dd>
                {plant.sun
                  ? plant.sun.map((item) => sunLabels[item]).join(" · ")
                  : "Not yet checked"}
              </dd>
            </div>
            <div>
              <dt>Water</dt>
              <dd>{plant.water ? waterLabels[plant.water] : "Not yet checked"}</dd>
            </div>
          </dl>

          {/* Collapsed: it is provenance, which matters but is not what
              someone opens a plant to read. */}
          <details className="detail-evidence">
            <summary>About this information</summary>
            <p>{provenanceText(plant)}</p>
          </details>

          <SourcingPanel
            key={`${plant.id}|${place ?? ""}`}
            compact
            place={place}
            items={[{ plantId: plant.id, n: 1, label: plant.commonName }]}
          />
        </div>
      </aside>
    </div>
  );
}

/** Where testers send feedback while the MVP is being reviewed. The bare
 * /viewform URL is the one respondents use; the ?usp=publish-editor
 * parameter Google appends in its publish dialog is for the editor and is
 * dropped here. */
const FEEDBACK_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdp3qvnTKqknIn8XO_VJ7GAdMpqgvuG-hhEidAh4jSjAs1b3A/viewform";

function Footer({ method }: { method: () => void }) {
  return (
    <footer className="site-footer">
      <div className="footer-mark">
        <span>Silly Goose</span>
      </div>
      <p>
        A Western Cape garden planner built with BioSCape field records,
        PlantZAfrica (SANBI) profiles and SANBI’s 2018 vegetation map.
      </p>
      <button className="text-link" onClick={method}>
        How the planner works →
      </button>
      {/* The MVP is being tested: the form is how a tester reports what the
          planner got wrong. Opens in a new tab so a half-finished garden is
          never lost - the brief and the plan are device-local. */}
      <a
        className="text-link footer-feedback"
        href={FEEDBACK_FORM_URL}
        target="_blank"
        rel="noreferrer"
      >
        Tell us what you think ↗︎
      </a>
      <span className="footer-version">MVP · 2026</span>
    </footer>
  );
}

export function GardenApp() {
  const [view, setView] = useState<View>("home");
  const [brief, setBrief] = useState<GardenBrief>(defaultBrief);
  const [saved, setSaved] = useState<string[]>([]);
  // Plants ruled out by hand. They leave the pool at Stage 0, so the three
  // options rebuild without them the moment this changes.
  const [excluded, setExcluded] = useState<string[]>([]);
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([]);
  const [savedReady, setSavedReady] = useState(false);
  const [briefReady, setBriefReady] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  // Location context lives here, not in the finder, so navigating away and
  // back does not lose the place the user searched for.
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [availableBiomes, setAvailableBiomes] = useState<NationalBiome[]>([]);

  useEffect(() => {
    queueMicrotask(() => {
      const store = loadStore();
      // Plants that are never planted cannot be favourited or excluded, so
      // any left from before that rule are dropped.
      const plantable = (id: string) => {
        const plant = plants.find((p) => p.id === id);
        return !plant || neverPlantedReason(plant) === null;
      };
      setSaved(store.savedPlantIds.filter(plantable));
      setExcluded(store.excludedPlantIds.filter(plantable));
      setSavedLayouts(store.savedLayouts);
      if (store.brief) setBrief(store.brief);
      setSavedReady(true);
      setBriefReady(true);
    });
  }, []);

  useEffect(() => {
    if (!savedReady || !briefReady) return;
    saveStore({
      version: 1,
      savedPlantIds: saved,
      excludedPlantIds: excluded,
      brief,
      savedLayouts,
    });
  }, [saved, excluded, savedLayouts, brief, savedReady, briefReady]);

  const navigate = (nextView: View) => {
    setView(nextView);
    setSelectedPlant(null);
    window.history.pushState(
      { view: nextView, step: 0 },
      "",
      nextView === "finder" ? stepPath(0) : VIEW_PATHS[nextView],
    );
  };

  // The address names the page, so reloading keeps it and the browser's
  // Back button goes to the previous page or step instead of leaving the
  // app (usability review, 21 Oct).
  useEffect(() => {
    const hash = window.location.hash;
    const match = (Object.entries(VIEW_PATHS) as [View, string][]).find(
      ([name, path]) => name !== "home" && hash.startsWith(path),
    );
    const initial: View = match ? match[0] : "home";
    const stepMatch = /step-(\d+)/.exec(hash);
    window.history.replaceState(
      { view: initial, step: stepMatch ? Number(stepMatch[1]) - 1 : 0 },
      "",
      hash || VIEW_PATHS.home,
    );
    if (initial !== "home") queueMicrotask(() => setView(initial));
    const onPop = (event: PopStateEvent) => {
      const state = event.state as { view?: View } | null;
      setView(state?.view ?? "home");
      setSelectedPlant(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Every page opens at the top, once the new page is in place and before it
  // is painted.
  useLayoutEffect(() => {
    scrollToTop();
  }, [view]);

  // The app always opens at the top: the browser is not allowed to restore
  // an old scroll position on reload.
  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
    scrollToTop();
  }, []);

  const saveLayout = (plan: GardenPlan, budget: SavedBudget | null) => {
    if (!plan.quantities) return;
    const round = (value: number) => Math.round(value * 1000) / 1000;
    setSavedLayouts((current) => [
      {
        id: createLayoutId(),
        character: plan.character,
        // "Stellenbosch, 2 × 3 m (option 1)" rather than three "Option 1"s.
        label: `${selectedPlace ? `${selectedPlace.name}, ` : ""}${plan.brief.bedWidthM} × ${plan.brief.bedLengthM} m (${plan.character.toLowerCase()})`,
        createdAt: new Date().toISOString(),
        brief: plan.brief,
        species: plan.quantities!.quantities.map((quantity) => ({
          plantId: quantity.id,
          quantity: quantity.quantity,
        })),
        seed: plan.seed,
        variationCounter: plan.variationCounter,
        datasetVersion: DATASET_VERSION,
        rulesVersion: plan.engine?.rulesVersion ?? null,
        // The plan itself, so the gardener knows exactly where to plant.
        placements: (plan.layout?.placements ?? []).map((p) => ({
          plantId: p.plantId, xM: round(p.xM), yM: round(p.yM), radiusM: round(p.radiusM),
        })),
        budget,
      },
      ...current,
    ]);
  };

  // A garden saved before its nursery prices arrived gets the budget line
  // as soon as it does.
  const addBudgetToSaved = (plan: GardenPlan, budget: SavedBudget) =>
    setSavedLayouts((current) =>
      current.some((l) => l.seed === plan.seed && l.character === plan.character && !l.budget)
        ? current.map((l) =>
            l.seed === plan.seed && l.character === plan.character && !l.budget ? { ...l, budget } : l,
          )
        : current,
    );

  // A layout is "already saved" when one with the same seed and character
  // is stored - the seed covers the whole input vector, so this is exactly
  // "you have saved this garden".
  const isLayoutSaved = (plan: GardenPlan) =>
    savedLayouts.some(
      (layout) => layout.seed === plan.seed && layout.character === plan.character,
    );

  const removeLayout = (id: string) =>
    setSavedLayouts((current) => current.filter((layout) => layout.id !== id));

  /** Name a saved garden, or clear the name back to its default. Blank
   * input means "no label", not an empty title. */
  const renameLayout = (id: string, label: string) => {
    const trimmed = label.trim();
    setSavedLayouts((current) =>
      current.map((layout) =>
        layout.id === id ? { ...layout, label: trimmed ? trimmed : null } : layout,
      ),
    );
  };

  /** A never-planted plant has no Favourite or Exclude (owner, 21 Oct). */
  const isNeverPlanted = (id: string) => {
    const plant = plants.find((p) => p.id === id);
    return plant !== undefined && neverPlantedReason(plant) !== null;
  };

  const toggleSaved = (id: string) => {
    if (isNeverPlanted(id)) return;
    setSaved((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      // Hearting a plant you had excluded is a change of mind, so it comes
      // back into the pool rather than sitting in both lists at once.
      setExcluded((ids) => ids.filter((item) => item !== id));
      return [...current, id];
    });
  };

  /** A whole plant type at once (owner, 21 Oct). Same rule as the single
   * buttons: favouriting clears an exclusion and excluding clears a heart. */
  const setCategory = (ids: string[], list: "saved" | "excluded", on: boolean) => {
    const group = new Set(ids.filter((id) => !isNeverPlanted(id)));
    const add = (current: string[]) => [...current, ...[...group].filter((id) => !current.includes(id))];
    const remove = (current: string[]) => current.filter((id) => !group.has(id));
    if (list === "saved") {
      setSaved(on ? add : remove);
      if (on) setExcluded(remove);
    } else {
      setExcluded(on ? add : remove);
      if (on) setSaved(remove);
    }
  };

  const toggleExcluded = (id: string) => {
    if (isNeverPlanted(id)) return;
    setExcluded((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      // Excluding and hearting the same plant contradict each other, and the
      // heart also feeds the Stage 1 bonus, so excluding drops the heart.
      setSaved((ids) => ids.filter((item) => item !== id));
      return [...current, id];
    });
  };

  return (
    <div className="site-shell">
      <Header view={view} savedCount={savedReady ? savedLayouts.length : null} navigate={navigate} />
      {view === "home" && (
        <HomeView
          start={() => navigate("finder")}
          browse={() => navigate("browse")}
          openSavedGardens={() => navigate("saved")}
          savedLayoutCount={savedLayouts.length}
        />
      )}
      {view === "finder" && (
        <FinderView
          brief={brief}
          setBrief={setBrief}
          selectedPlace={selectedPlace}
          setSelectedPlace={setSelectedPlace}
          availableBiomes={availableBiomes}
          setAvailableBiomes={setAvailableBiomes}
          finish={() => navigate("results")}
          cancel={() => navigate("home")}
          excluded={excluded}
          openExcluded={() => navigate("saved")}
        />
      )}
      {(view === "results" || view === "browse") && (
        <CollectionView
          mode={view}
          brief={brief}
          place={selectedPlace?.name ?? null}
          saved={saved}
          excluded={excluded}
          openPlant={setSelectedPlant}
          onSaveLayout={saveLayout}
          onBudgetForSaved={addBudgetToSaved}
          isLayoutSaved={isLayoutSaved}
          toggleSaved={toggleSaved}
          toggleExcluded={toggleExcluded}
          setCategory={setCategory}
          restart={() => navigate("finder")}
        />
      )}
      {view === "saved" && (
        <SavedView
          saved={saved}
          excluded={excluded}
          savedLayouts={savedLayouts}
          removeLayout={removeLayout}
          renameLayout={renameLayout}
          openPlant={setSelectedPlant}
          toggleSaved={toggleSaved}
          toggleExcluded={toggleExcluded}
          browse={() => navigate("browse")}
        />
      )}
      {view === "method" && (
        <MethodView start={() => navigate("finder")} />
      )}
      {view !== "home" && <Footer method={() => navigate("method")} />}
      {selectedPlant && (
        <DetailDrawer
          plant={selectedPlant}
          place={selectedPlace?.name ?? null}
          saved={saved.includes(selectedPlant.id)}
          excluded={excluded.includes(selectedPlant.id)}
          close={() => setSelectedPlant(null)}
          toggleSaved={() => toggleSaved(selectedPlant.id)}
          toggleExcluded={() => toggleExcluded(selectedPlant.id)}
        />
      )}
    </div>
  );
}
