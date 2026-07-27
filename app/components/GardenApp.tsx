"use client";

import { useEffect, useMemo, useState } from "react";
import {
  areaLabels,
  goalLabels,
  plants,
  sunLabels,
  waterLabels,
  type Area,
  type Goal,
  type Plant,
  type Sun,
  type Water,
} from "../data/plants";

type View = "home" | "finder" | "results" | "browse" | "saved" | "method";
type Space = "compact" | "medium" | "generous";
type Preferences = {
  area: Area;
  sun: Sun;
  water: Water;
  space: Space;
  goals: Goal[];
};

const defaultPreferences: Preferences = {
  area: "cape-town",
  sun: "full",
  water: "low",
  space: "medium",
  goals: ["flowers", "pollinators"],
};

const spaceLabels: Record<Space, string> = {
  compact: "Courtyard or compact bed",
  medium: "A typical suburban bed",
  generous: "Room for large shrubs or trees",
};

const formFilters = [
  "All",
  "Shrub",
  "Tree",
  "Restio",
  "Groundcover",
  "Geophyte",
] as const;

function formatDimension(value: number | null) {
  if (value === null) return "Not measured";
  if (value < 100) return `${Math.round(value)} cm`;
  const metres = value / 100;
  return `${Number.isInteger(metres) ? metres : metres.toFixed(1)} m`;
}

function spaceFits(plant: Plant, space: Space) {
  if (space === "compact") return plant.heightCm <= 120;
  if (space === "medium") return plant.heightCm <= 400;
  return true;
}

function scorePlant(plant: Plant, preferences: Preferences) {
  let score = 0;
  const reasons: string[] = [];

  if (plant.sun.includes(preferences.sun)) {
    score += 4;
    reasons.push(`Matches ${sunLabels[preferences.sun].toLowerCase()}`);
  } else if (
    preferences.sun === "part" &&
    (plant.sun.includes("full") || plant.sun.includes("sheltered"))
  ) {
    score += 2;
    reasons.push("Flexible with light");
  }

  if (plant.water === preferences.water) {
    score += 3;
    reasons.push(`Fits ${waterLabels[preferences.water].toLowerCase()}`);
  } else if (preferences.water === "moderate" && plant.water === "low") {
    score += 2;
    reasons.push("Comfortable with less water");
  } else if (preferences.water === "low" && plant.water === "moderate") {
    score -= 1;
  }

  if (spaceFits(plant, preferences.space)) {
    score += 3;
    reasons.push(
      preferences.space === "compact"
        ? "Sized for a smaller bed"
        : preferences.space === "medium"
          ? "Fits a typical garden bed"
          : "Has room to reach its form",
    );
  } else {
    score -= 3;
  }

  const matchedGoals = preferences.goals.filter((goal) =>
    plant.goals.includes(goal),
  );
  score += matchedGoals.length * 2;
  if (matchedGoals.length) {
    reasons.push(goalLabels[matchedGoals[0]]);
  }

  if (plant.areas.includes(preferences.area)) {
    score += 2;
    reasons.push(`Suited to ${areaLabels[preferences.area]}`);
  }

  score += Math.min(2, Math.log10(plant.occurrenceCount + 1) / 2);

  return {
    score,
    reasons: reasons.slice(0, 3),
    signalCount: Math.min(6, Math.max(1, reasons.length + matchedGoals.length)),
  };
}

function PlantPortrait({
  plant,
  hero = false,
}: {
  plant: Plant;
  hero?: boolean;
}) {
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
        <span>Botanical portrait</span>
        <strong>{plant.scientificName}</strong>
        <small>Artwork placeholder · prompt {plant.id}</small>
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
  savedCount: number;
  navigate: (view: View) => void;
}) {
  return (
    <header className="site-header">
      <button className="wordmark" onClick={() => navigate("home")}>
        <span>Silly Goose</span>
        <small>MVP · Western Cape</small>
      </button>
      <nav aria-label="Primary navigation">
        <button
          className={view === "finder" ? "is-active" : ""}
          onClick={() => navigate("finder")}
        >
          Find my plants
        </button>
        <button
          className={view === "browse" || view === "results" ? "is-active" : ""}
          onClick={() => navigate("browse")}
        >
          The collection
        </button>
        <button
          className={view === "method" ? "is-active" : ""}
          onClick={() => navigate("method")}
        >
          Our method
        </button>
      </nav>
      <button className="saved-link" onClick={() => navigate("saved")}>
        Saved garden <span>{String(savedCount).padStart(2, "0")}</span>
      </button>
    </header>
  );
}

function HomeView({
  start,
  browse,
  openPlant,
}: {
  start: () => void;
  browse: () => void;
  openPlant: (plant: Plant) => void;
}) {
  const preview = [plants[1], plants[18], plants[29], plants[36]];
  return (
    <>
      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">A garden guide for the Western Cape</p>
            <h1>
              Begin with
              <br />
              the <em>veld.</em>
            </h1>
            <p className="hero-intro">
              Find indigenous plants that make sense for your light, space and
              way of gardening—then understand why each one belongs.
            </p>
            <div className="hero-actions">
              <button className="button button-dark" onClick={start}>
                Describe my garden <span>↗</span>
              </button>
              <button className="text-link" onClick={browse}>
                Browse all 48 plants
              </button>
            </div>
            <dl className="hero-facts">
              <div>
                <dt>01</dt>
                <dd>Western Cape native or endemic</dd>
              </div>
              <div>
                <dt>02</dt>
                <dd>Backed by specimen and trait records</dd>
              </div>
            </dl>
          </div>
          <div className="hero-art">
            <div className="hero-placeholder">
              <span className="portrait-index">PROMPT-HERO-01</span>
              <div className="hero-botanical-mark" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="portrait-caption">
                <span>Commissioned artwork placeholder</span>
                <strong>Four lives of the Cape veld</strong>
                <small>King protea · buchu · heath · restio</small>
              </div>
            </div>
            <p className="vertical-note">
              Rooted in place. Chosen with evidence. Grown with care.
            </p>
          </div>
        </section>

        <section className="manifesto-band">
          <p>Not a list of fashionable plants.</p>
          <h2>A small field guide to what could thrive where you are.</h2>
          <span>48 researched starting points · one garden at a time</span>
        </section>

        <section className="specimen-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Selected specimens · 01–04</p>
              <h2>Four ways into a Cape garden</h2>
            </div>
            <button className="text-link" onClick={browse}>
              View the full collection ↗
            </button>
          </div>
          <div className="home-specimen-grid">
            {preview.map((plant, index) => (
              <button
                className="home-specimen"
                key={plant.id}
                onClick={() => openPlant(plant)}
              >
                <PlantPortrait plant={plant} />
                <span className="specimen-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="specimen-copy">
                  <strong>{plant.commonName}</strong>
                  <em>{plant.scientificName}</em>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="how-section">
          <div className="how-title">
            <p className="eyebrow">How it works</p>
            <h2>
              Observation,
              <br />
              before recommendation.
            </h2>
          </div>
          <ol className="how-list">
            <li>
              <span>01</span>
              <div>
                <strong>Read your site</strong>
                <p>Tell us what is actually observable: light, water and room.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Match the evidence</strong>
                <p>We rank a reviewed collection and explain every useful signal.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Build a shortlist</strong>
                <p>Save a considered mix, then verify it with your local nursery.</p>
              </div>
            </li>
          </ol>
        </section>
      </main>
    </>
  );
}

function ChoiceButton({
  selected,
  title,
  copy,
  onClick,
}: {
  selected: boolean;
  title: string;
  copy?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`choice-button${selected ? " is-selected" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span>{selected ? "●" : "○"}</span>
      <strong>{title}</strong>
      {copy && <small>{copy}</small>}
    </button>
  );
}

function FinderView({
  preferences,
  setPreferences,
  finish,
  cancel,
}: {
  preferences: Preferences;
  setPreferences: (value: Preferences) => void;
  finish: () => void;
  cancel: () => void;
}) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      eyebrow: "Where are you growing?",
      title: "Place changes the shortlist.",
      note: "A broad area is enough for this version. We do not request your precise address.",
      content: (
        <div className="choice-grid two-column">
          {(Object.keys(areaLabels) as Area[]).map((area) => (
            <ChoiceButton
              key={area}
              selected={preferences.area === area}
              title={areaLabels[area]}
              onClick={() => setPreferences({ ...preferences, area })}
            />
          ))}
        </div>
      ),
    },
    {
      eyebrow: "How much direct light?",
      title: "Watch the sun, not the compass.",
      note: "Choose the condition that describes most of the planting area through the growing season.",
      content: (
        <div className="choice-grid">
          {(Object.keys(sunLabels) as Sun[]).map((sun) => (
            <ChoiceButton
              key={sun}
              selected={preferences.sun === sun}
              title={sunLabels[sun]}
              copy={
                sun === "full"
                  ? "Six or more hours"
                  : sun === "part"
                    ? "Three to six hours"
                    : "Bright, protected light"
              }
              onClick={() => setPreferences({ ...preferences, sun })}
            />
          ))}
        </div>
      ),
    },
    {
      eyebrow: "Summer water",
      title: "How much help can you give?",
      note: "Established indigenous plants still vary. This is an editorial prototype grouping, not an irrigation prescription.",
      content: (
        <div className="choice-grid">
          {(Object.keys(waterLabels) as Water[]).map((water) => (
            <ChoiceButton
              key={water}
              selected={preferences.water === water}
              title={waterLabels[water]}
              copy={
                water === "low"
                  ? "Dry once established"
                  : water === "moderate"
                    ? "A deep drink at intervals"
                    : "Naturally damp or irrigated"
              }
              onClick={() => setPreferences({ ...preferences, water })}
            />
          ))}
        </div>
      ),
    },
    {
      eyebrow: "Available room",
      title: "Let the mature plant fit.",
      note: "We compare your choice with source-derived maximum height. Canopy observations are shown separately.",
      content: (
        <div className="choice-grid">
          {(Object.keys(spaceLabels) as Space[]).map((space) => (
            <ChoiceButton
              key={space}
              selected={preferences.space === space}
              title={spaceLabels[space]}
              copy={
                space === "compact"
                  ? "Mostly below 1.2 m"
                  : space === "medium"
                    ? "Shrubs up to about 4 m"
                    : "Trees and large screens welcome"
              }
              onClick={() => setPreferences({ ...preferences, space })}
            />
          ))}
        </div>
      ),
    },
    {
      eyebrow: "Garden intentions",
      title: "What should this planting do?",
      note: "Choose as many as matter. Your priorities affect the order, not which plants exist.",
      content: (
        <div className="choice-grid two-column">
          {(Object.keys(goalLabels) as Goal[]).map((goal) => {
            const selected = preferences.goals.includes(goal);
            return (
              <ChoiceButton
                key={goal}
                selected={selected}
                title={goalLabels[goal]}
                onClick={() =>
                  setPreferences({
                    ...preferences,
                    goals: selected
                      ? preferences.goals.filter((item) => item !== goal)
                      : [...preferences.goals, goal],
                  })
                }
              />
            );
          })}
        </div>
      ),
    },
  ];

  const current = steps[step];
  return (
    <main className="finder-shell">
      <div className="finder-progress" aria-label={`Step ${step + 1} of 5`}>
        <span>
          Garden brief · {String(step + 1).padStart(2, "0")} / 05
        </span>
        <div>
          {steps.map((_, index) => (
            <i key={index} className={index <= step ? "is-complete" : ""} />
          ))}
        </div>
      </div>
      <section className="finder-panel">
        <div className="finder-question">
          <p className="eyebrow">{current.eyebrow}</p>
          <h1>{current.title}</h1>
          <p>{current.note}</p>
        </div>
        <div className="finder-choices">{current.content}</div>
      </section>
      <div className="finder-footer">
        <button
          className="text-link"
          onClick={step === 0 ? cancel : () => setStep(step - 1)}
        >
          ← {step === 0 ? "Back home" : "Previous"}
        </button>
        <button
          className="button button-dark"
          disabled={step === 4 && preferences.goals.length === 0}
          onClick={step === 4 ? finish : () => setStep(step + 1)}
        >
          {step === 4 ? "See my matches" : "Continue"} <span>↗</span>
        </button>
      </div>
    </main>
  );
}

function PlantCard({
  plant,
  match,
  saved,
  open,
  toggleSaved,
}: {
  plant: Plant;
  match?: ReturnType<typeof scorePlant>;
  saved: boolean;
  open: () => void;
  toggleSaved: () => void;
}) {
  return (
    <article className="plant-card">
      <button className="portrait-button" onClick={open}>
        <PlantPortrait plant={plant} />
      </button>
      <div className="plant-card-head">
        <div>
          <p>{plant.commonName}</p>
          <h3>{plant.scientificName}</h3>
        </div>
        <button
          className={`save-button${saved ? " is-saved" : ""}`}
          onClick={toggleSaved}
          aria-label={`${saved ? "Remove" : "Save"} ${plant.commonName}`}
          aria-pressed={saved}
        >
          {saved ? "Saved" : "Save"} <span>{saved ? "●" : "○"}</span>
        </button>
      </div>
      <div className="plant-card-meta">
        <span>{plant.form}</span>
        <span>Up to {formatDimension(plant.heightCm)}</span>
        <span>
          {plant.flowerStart}–{plant.flowerEnd}
        </span>
      </div>
      {match && (
        <div className="match-reasons">
          <strong>{match.signalCount}/6 useful signals</strong>
          <p>{match.reasons.join(" · ")}</p>
        </div>
      )}
      <button className="card-link" onClick={open}>
        Read the specimen note <span>↗</span>
      </button>
    </article>
  );
}

function CollectionView({
  mode,
  preferences,
  saved,
  openPlant,
  toggleSaved,
  restart,
}: {
  mode: "results" | "browse";
  preferences: Preferences;
  saved: string[];
  openPlant: (plant: Plant) => void;
  toggleSaved: (id: string) => void;
  restart: () => void;
}) {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<(typeof formFilters)[number]>("All");
  const [limit, setLimit] = useState(12);

  const ranked = useMemo(() => {
    const values = plants.map((plant) => ({
      plant,
      match: scorePlant(plant, preferences),
    }));
    values.sort((a, b) =>
      mode === "results"
        ? b.match.score - a.match.score
        : b.plant.occurrenceCount - a.plant.occurrenceCount,
    );
    return values;
  }, [mode, preferences]);

  const filtered = ranked.filter(({ plant }) => {
    const haystack =
      `${plant.commonName} ${plant.scientificName} ${plant.family}`.toLowerCase();
    const queryMatches = haystack.includes(query.toLowerCase());
    const formMatches =
      form === "All" ||
      (form === "Shrub" && plant.form.toLowerCase().includes("shrub")) ||
      plant.form.toLowerCase().includes(form.toLowerCase());
    return queryMatches && formMatches;
  });

  return (
    <main className="collection-shell">
      <section className="collection-intro">
        <div>
          <p className="eyebrow">
            {mode === "results"
              ? `Your garden brief · ${areaLabels[preferences.area]}`
              : "The working collection · 48 specimens"}
          </p>
          <h1>
            {mode === "results" ? (
              <>
                A shortlist with
                <br />
                reasons to <em>believe it.</em>
              </>
            ) : (
              <>
                Meet the first
                <br />
                forty-eight.
              </>
            )}
          </h1>
        </div>
        <div className="collection-note">
          <p>
            {mode === "results"
              ? "Ordered by your observable conditions and intentions. The match is transparent; it is not a guarantee."
              : "Every plant starts with accepted taxonomy, Western Cape occurrence evidence and a regional trait record."}
          </p>
          {mode === "results" && (
            <button className="text-link" onClick={restart}>
              Change my garden brief ↗
            </button>
          )}
        </div>
      </section>

      <section className="collection-tools" aria-label="Collection filters">
        <label className="search-field">
          <span>Search the collection</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(12);
            }}
            placeholder="Common name, scientific name or family"
          />
        </label>
        <div className="filter-row">
          <span>Plant form</span>
          <div>
            {formFilters.map((item) => (
              <button
                key={item}
                className={form === item ? "is-active" : ""}
                onClick={() => {
                  setForm(item);
                  setLimit(12);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="results-count">
        <span>{String(filtered.length).padStart(2, "0")} plants</span>
        <span>
          {mode === "results" ? "Ranked for this garden" : "Editorial collection"}
        </span>
      </div>

      {filtered.length ? (
        <section className="plant-grid">
          {filtered.slice(0, limit).map(({ plant, match }) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              match={mode === "results" ? match : undefined}
              saved={saved.includes(plant.id)}
              open={() => openPlant(plant)}
              toggleSaved={() => toggleSaved(plant.id)}
            />
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <p className="eyebrow">No specimens found</p>
          <h2>Try a broader name or another plant form.</h2>
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
    </main>
  );
}

function SavedView({
  saved,
  openPlant,
  toggleSaved,
  browse,
}: {
  saved: string[];
  openPlant: (plant: Plant) => void;
  toggleSaved: (id: string) => void;
  browse: () => void;
}) {
  const savedPlants = plants.filter((plant) => saved.includes(plant.id));
  return (
    <main className="saved-shell">
      <section className="saved-intro">
        <p className="eyebrow">Saved on this device</p>
        <h1>
          Your working
          <br />
          garden list.
        </h1>
        <p>
          A shortlist, not a shopping cart. Compare mature scale and structure
          before deciding what belongs together.
        </p>
      </section>
      {savedPlants.length ? (
        <>
          <div className="saved-summary">
            <span>{savedPlants.length} specimens</span>
            <span>
              Tallest ·{" "}
              {formatDimension(
                Math.max(...savedPlants.map((plant) => plant.heightCm)),
              )}
            </span>
            <span>
              {new Set(savedPlants.map((plant) => plant.form)).size} growth forms
            </span>
          </div>
          <section className="plant-grid saved-grid">
            {savedPlants.map((plant) => (
              <PlantCard
                key={plant.id}
                plant={plant}
                saved
                open={() => openPlant(plant)}
                toggleSaved={() => toggleSaved(plant.id)}
              />
            ))}
          </section>
        </>
      ) : (
        <section className="empty-state saved-empty">
          <p className="eyebrow">The page is still quiet</p>
          <h2>Save a few plants and begin arranging the conversation.</h2>
          <button className="button button-dark" onClick={browse}>
            Browse the collection <span>↗</span>
          </button>
        </section>
      )}
    </main>
  );
}

function MethodView({ start }: { start: () => void }) {
  return (
    <main className="method-shell">
      <section className="method-hero">
        <p className="eyebrow">Our method · version 0.1</p>
        <h1>
          Evidence first.
          <br />
          Certainty, <em>never performed.</em>
        </h1>
        <p>
          Silly Goose brings accepted names, herbarium occurrence and regional
          plant traits into one readable starting point. It also tells you where
          the evidence stops.
        </p>
      </section>
      <section className="method-grid">
        <article>
          <span>01</span>
          <h2>Names & native range</h2>
          <p>
            SANPC 2026 is the taxonomic backbone. The visible collection is
            limited to accepted taxa marked native or native-endemic for the
            Western Cape.
          </p>
        </article>
        <article>
          <span>02</span>
          <h2>Occurrence evidence</h2>
          <p>
            BODATSA preserved specimens confirm that a name has a Western Cape
            record. Collection density helps ordering only slightly; it does not
            prove garden performance.
          </p>
        </article>
        <article>
          <span>03</span>
          <h2>Form & scale</h2>
          <p>
            BioSCape provides growth form, maximum height and field canopy
            observations. Field dimensions are shown as evidence, not nursery
            promises.
          </p>
        </article>
        <article>
          <span>04</span>
          <h2>Editorial layer</h2>
          <p>
            Sun, water, broad area affinity and garden uses are prototype
            editorial groupings. They must be reviewed horticulturally before a
            public production release.
          </p>
        </article>
      </section>
      <section className="method-callout">
        <div>
          <p className="eyebrow">The practical rule</p>
          <h2>Use the shortlist to ask better questions.</h2>
        </div>
        <p>
          Confirm the plant’s current name, local provenance, mature dimensions
          and availability with a reputable indigenous nursery before planting.
        </p>
        <button className="button button-dark" onClick={start}>
          Make a garden brief <span>↗</span>
        </button>
      </section>
    </main>
  );
}

function DetailDrawer({
  plant,
  saved,
  close,
  toggleSaved,
}: {
  plant: Plant;
  saved: boolean;
  close: () => void;
  toggleSaved: () => void;
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
            Specimen {plant.id} · {plant.family}
          </span>
          <button onClick={close}>Close ×</button>
        </div>
        <PlantPortrait plant={plant} hero />
        <div className="detail-copy">
          <p className="eyebrow">{plant.commonName}</p>
          <h2 id="detail-title">{plant.scientificName}</h2>
          <p className="detail-note">{plant.note}</p>
          <button
            className={`button ${saved ? "button-outline" : "button-dark"}`}
            onClick={toggleSaved}
          >
            {saved ? "Remove from garden" : "Save to my garden"}{" "}
            <span>{saved ? "−" : "+"}</span>
          </button>

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
              <dt>Field median canopy</dt>
              <dd>{formatDimension(plant.spreadCm)}</dd>
            </div>
            <div>
              <dt>Flowering record</dt>
              <dd>
                {plant.flowerStart}–{plant.flowerEnd}
              </dd>
            </div>
            <div>
              <dt>Light grouping</dt>
              <dd>{plant.sun.map((item) => sunLabels[item]).join(" · ")}</dd>
            </div>
            <div>
              <dt>Water grouping</dt>
              <dd>{waterLabels[plant.water]}</dd>
            </div>
          </dl>

          <div className="detail-evidence">
            <p className="eyebrow">Evidence note</p>
            <p>
              {plant.occurrenceCount} Western Cape BODATSA specimen records are
              represented in the processed source summary. Height, growth form
              and flowering fields come from BioSCape. Light, water and use
              groupings are editorial and await horticultural review.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Footer({ method }: { method: () => void }) {
  return (
    <footer className="site-footer">
      <div className="footer-mark">
        <span>Silly Goose</span>
        <small>Minimum viable planting</small>
      </div>
      <p>
        A working Western Cape garden guide built from SANPC, BODATSA and
        BioSCape data.
      </p>
      <button className="text-link" onClick={method}>
        Read the methodology ↗
      </button>
      <span className="footer-version">MVP · 2026</span>
    </footer>
  );
}

export function GardenApp() {
  const [view, setView] = useState<View>("home");
  const [preferences, setPreferences] =
    useState<Preferences>(defaultPreferences);
  const [saved, setSaved] = useState<string[]>([]);
  const [savedReady, setSavedReady] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const value = window.localStorage.getItem("silly-goose-saved");
        if (value) setSaved(JSON.parse(value));
      } catch {
        setSaved([]);
      } finally {
        setSavedReady(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!savedReady) return;
    window.localStorage.setItem("silly-goose-saved", JSON.stringify(saved));
  }, [saved, savedReady]);

  const navigate = (nextView: View) => {
    setView(nextView);
    setSelectedPlant(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleSaved = (id: string) => {
    setSaved((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  return (
    <div className="site-shell">
      <Header view={view} savedCount={saved.length} navigate={navigate} />
      {view === "home" && (
        <HomeView
          start={() => navigate("finder")}
          browse={() => navigate("browse")}
          openPlant={setSelectedPlant}
        />
      )}
      {view === "finder" && (
        <FinderView
          preferences={preferences}
          setPreferences={setPreferences}
          finish={() => navigate("results")}
          cancel={() => navigate("home")}
        />
      )}
      {(view === "results" || view === "browse") && (
        <CollectionView
          mode={view}
          preferences={preferences}
          saved={saved}
          openPlant={setSelectedPlant}
          toggleSaved={toggleSaved}
          restart={() => navigate("finder")}
        />
      )}
      {view === "saved" && (
        <SavedView
          saved={saved}
          openPlant={setSelectedPlant}
          toggleSaved={toggleSaved}
          browse={() => navigate("browse")}
        />
      )}
      {view === "method" && (
        <MethodView start={() => navigate("finder")} />
      )}
      <Footer method={() => navigate("method")} />
      {selectedPlant && (
        <DetailDrawer
          plant={selectedPlant}
          saved={saved.includes(selectedPlant.id)}
          close={() => setSelectedPlant(null)}
          toggleSaved={() => toggleSaved(selectedPlant.id)}
        />
      )}
    </div>
  );
}
