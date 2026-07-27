"use client";

import Image from "next/image";
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
        <span>Botanical photo placeholder</span>
        <strong>{plant.scientificName}</strong>
        <small>Use image prompt {plant.id}</small>
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
      </button>
      <nav aria-label="Primary navigation">
        <button
          className={view === "finder" ? "is-active" : ""}
          onClick={() => navigate("finder")}
        >
          Plant finder
        </button>
        <button
          className={view === "browse" || view === "results" ? "is-active" : ""}
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
        Saved plants <span>{String(savedCount).padStart(2, "0")}</span>
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
            <h1>
              A garden design
              <br />
              shaped by <em>place.</em>
            </h1>
            <p className="hero-intro">
              Tell us about your part of the Western Cape, the sunlight, the
              water you can provide and the room you have. We’ll turn those
              conditions into a suitable plant shortlist.
            </p>
            <div className="hero-actions">
              <button className="button button-dark" onClick={start}>
                Start my garden plan <span>↗</span>
              </button>
              <button className="text-link" onClick={browse}>
                Browse the plant library
              </button>
            </div>
          </div>
          <div className="hero-art">
            <figure className="hero-plate">
              <Image
                className="hero-image"
                src="/images/editorial/home-cape-cabinet.webp"
                alt="A hand-coloured botanical cabinet of Western Cape plants centred on a King Protea, with a small goose in the lower-right margin."
                width={1122}
                height={1402}
                priority
                sizes="(max-width: 900px) calc(100vw - 48px), (max-width: 1600px) 42vw, 540px"
              />
            </figure>
          </div>
        </section>

        <section className="manifesto-band">
          <h2>Turn the conditions you have into a garden that can actually work.</h2>
          <p>
            This version builds the plant shortlist. Soil, bed dimensions and
            the measured layout are the next part of the build.
          </p>
        </section>

        <section className="specimen-section">
          <div className="section-heading">
            <div>
              <h2>Start with the plant library</h2>
              <p>
                Forty-eight indigenous and endemic plants selected from the
                Western Cape data foundation.
              </p>
            </div>
            <button className="text-link" onClick={browse}>
              Browse all plants ↗
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
            <h2>From garden conditions to a planting plan</h2>
            <p>The first three steps work now. The measured layout is next.</p>
          </div>
          <ol className="how-list">
            <li>
              <span>01</span>
              <div>
                <strong>Describe your garden</strong>
                <p>Choose the area, sunlight, water and available room.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Review suitable plants</strong>
                <p>See why each plant appears and where the data is still limited.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Save a shortlist</strong>
                <p>Keep the plants you want to compare in one place.</p>
              </div>
            </li>
            <li>
              <span>04</span>
              <div>
                <strong>Generate the layout</strong>
                <p>
                  Next: use bed size and mature canopy to calculate quantities
                  and placement.
                </p>
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
      title: "Where is your garden?",
      note: "Choose the nearest area. We do not need your address.",
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
      title: "How much direct sun does the bed get?",
      note: "Choose the condition that describes most of the bed during the growing season.",
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
      title: "How much summer water can you provide?",
      note: "Choose the closest option. This is a broad grouping, not an irrigation schedule.",
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
      title: "How much room is available?",
      note: "We compare this with maximum recorded height. Exact bed measurements come in the next build.",
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
      title: "What do you want the planting to do?",
      note: "Choose as many as you need. These choices affect the order of the shortlist.",
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
          Step {step + 1} of 5
        </span>
        <div>
          {steps.map((_, index) => (
            <i key={index} className={index <= step ? "is-complete" : ""} />
          ))}
        </div>
      </div>
      <section className="finder-panel">
        <div className="finder-question">
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
          {step === 4 ? "See suitable plants" : "Continue"} <span>↗</span>
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
          <p>{match.reasons.join(" · ")}</p>
        </div>
      )}
      <button className="card-link" onClick={open}>
        View plant details <span>↗</span>
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
          <h1>
            {mode === "results" ? (
              <>
                Plants suited to
                <br />
                <em>{areaLabels[preferences.area]}.</em>
              </>
            ) : (
              <>
                The first
                <br />
                forty-eight plants.
              </>
            )}
          </h1>
        </div>
        <div className="collection-note">
          <p>
            {mode === "results"
              ? "This is a provisional shortlist based on the answers you gave. It uses an interim heuristic, not the AHP and Goal Programming model described in the research paper."
              : "Each plant has accepted taxonomy, a Western Cape specimen record and regional trait data. Horticultural fields still need expert review."}
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
          {mode === "results" ? "Provisional order" : "Working library"}
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
        <h1>
          Plants you’ve
          <br />
          saved.
        </h1>
        <p>
          These plants are saved on this device. The next planning stage will
          test which ones fit together in your measured bed.
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
          <h2>You haven’t saved any plants yet.</h2>
          <p>Browse the library and save the plants you want to compare.</p>
          <button className="button button-dark" onClick={browse}>
            Browse the plant library <span>↗</span>
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
        <h1>
          What works now.
          <br />
          What comes <em>next.</em>
        </h1>
        <p>
          The current build proves plant discovery, filtering, plant details
          and a saved shortlist. It does not yet implement the full decision
          model or generate a measured planting layout.
        </p>
      </section>
      <section className="method-grid">
        <article>
          <span>01</span>
          <h2>Plant data</h2>
          <p>
            In place: SANPC names, Western Cape BODATSA records and BioSCape
            height, form, flowering and canopy observations.
          </p>
        </article>
        <article>
          <span>02</span>
          <h2>Hard feasibility filters</h2>
          <p>
            Partial: native range is checked. Soil, legal exclusions and
            complete environmental compatibility still need reviewed rules and
            data.
          </p>
        </article>
        <article>
          <span>03</span>
          <h2>AHP and Goal Programming</h2>
          <p>
            Foundation built: matrix consistency, weights and directional
            penalties are tested. Expert comparisons and reviewed targets are
            still required before they replace the heuristic.
          </p>
        </article>
        <article>
          <span>04</span>
          <h2>Selection and layout</h2>
          <p>
            Partial: a provisional binary group selector is tested. Plant
            quantities, reviewed spacing and the measured 2D layout are not
            built yet.
          </p>
        </article>
      </section>
      <section className="method-callout">
        <div>
          <h2>The next build defines the planning rules.</h2>
        </div>
        <p>
          First define every input, hard constraint and missing-data path. Then
          review the plant evidence, calibrate the weights and connect the
          tested engine to real garden cases.
        </p>
        <button className="button button-dark" onClick={start}>
          Try the plant finder <span>↗</span>
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
          <p className="plant-common-name">{plant.commonName}</p>
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
            <h3>About this information</h3>
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
      </div>
      <p>
        A Western Cape plant-discovery prototype built from SANPC, BODATSA and
        BioSCape data.
      </p>
      <button className="text-link" onClick={method}>
        See what comes next ↗
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
