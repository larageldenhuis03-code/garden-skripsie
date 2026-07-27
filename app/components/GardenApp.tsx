"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
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
import {
  MAX_BED_DIMENSION_M,
  MIN_BED_DIMENSION_M,
  buildGardenPlan,
  densityLabels,
  drainageLabels,
  parseGardenBrief,
  soilLabels,
  validateGardenBrief,
  workingExampleBrief,
  workingExampleOutput,
  type GardenBrief,
  type PlantAssessment,
} from "../lib/planning";

type View = "home" | "finder" | "results" | "browse" | "saved" | "method";

const defaultBrief: GardenBrief = {
  ...workingExampleBrief,
  goals: [...workingExampleBrief.goals],
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
        <span className="saved-label">Saved plants</span>
        <span className="saved-count">
          {String(savedCount).padStart(2, "0")}
        </span>
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
              <span>
                Describe your <em>garden.</em>
              </span>
              <span>
                Discover the plants that <em>fit.</em>
              </span>
            </h1>
            <p className="hero-intro">
              Tell us where your garden is, how much sun and water it gets, and
              the size of your bed. We’ll suggest plants and show you how they
              could fit.
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
        </section>

        <section className="manifesto-band">
          <h2>A garden plan built around the space you actually have.</h2>
          <p>
            This first version checks your conditions, suggests plants and
            works out a simple layout. Some growing details still need to be
            checked by a local plant expert.
          </p>
        </section>

        <section className="specimen-section">
          <div className="section-heading">
            <div>
              <h2>Start with the plant library</h2>
              <p>
                A starting collection of 48 local plants, backed by Western
                Cape records.
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
            <h2>How your plan comes together</h2>
            <p>Four simple steps, with anything uncertain clearly marked.</p>
          </div>
          <ol className="how-list">
            <li>
              <span>01</span>
              <div>
                <strong>Tell us about the space</strong>
                <p>
                  Choose your area, soil, drainage, sunlight, water and bed
                  size.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>See what may work</strong>
                <p>
                  We check each plant against your answers and show anything
                  we’re unsure about.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Choose a plant mix</strong>
                <p>
                  We pick a mix that fits the bed and works towards your goals.
                </p>
              </div>
            </li>
            <li>
              <span>04</span>
              <div>
                <strong>See the layout</strong>
                <p>
                  We arrange the plants inside your bed and show how many you
                  may need.
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
  brief,
  setBrief,
  finish,
  cancel,
}: {
  brief: GardenBrief;
  setBrief: (value: GardenBrief) => void;
  finish: () => void;
  cancel: () => void;
}) {
  const [step, setStep] = useState(0);
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
      note: "Choose the nearest pilot area. We do not need your address.",
      content: (
        <div className="choice-grid two-column">
          {(Object.keys(areaLabels) as Area[]).map((area) => (
            <ChoiceButton
              key={area}
              selected={brief.area === area}
              title={areaLabels[area]}
              onClick={() => setBrief({ ...brief, area })}
            />
          ))}
        </div>
      ),
    },
    {
      title: "What is the soil and drainage like?",
      note: "If you’re not sure, choose “I’m not sure”. We’re still checking which soils suit each plant.",
      content: (
        <div className="choice-stack">
          <fieldset>
            <legend>Soil</legend>
            <div className="choice-grid two-column compact-choices">
              {(
                Object.keys(soilLabels) as (keyof typeof soilLabels)[]
              ).map((soil) => (
                <ChoiceButton
                  key={soil}
                  selected={brief.soil === soil}
                  title={soilLabels[soil]}
                  onClick={() => setBrief({ ...brief, soil })}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Drainage</legend>
            <div className="choice-grid two-column compact-choices">
              {(
                Object.keys(drainageLabels) as (keyof typeof drainageLabels)[]
              ).map((drainage) => (
                <ChoiceButton
                  key={drainage}
                  selected={brief.drainage === drainage}
                  title={drainageLabels[drainage]}
                  onClick={() => setBrief({ ...brief, drainage })}
                />
              ))}
            </div>
          </fieldset>
        </div>
      ),
    },
    {
      title: "How much direct sun does the bed get?",
      note: "Choose what applies to most of the bed.",
      content: (
        <div className="choice-grid">
          {(Object.keys(sunLabels) as Sun[]).map((sun) => (
            <ChoiceButton
              key={sun}
              selected={brief.sun === sun}
              title={sunLabels[sun]}
              copy={
                sun === "full"
                  ? "Six or more hours"
                  : sun === "part"
                    ? "Three to six hours"
                    : "Bright, protected light"
              }
              onClick={() => setBrief({ ...brief, sun })}
            />
          ))}
        </div>
      ),
    },
    {
      title: "How much summer water can you provide?",
      note: "Choose the closest match. You can change it later.",
      content: (
        <div className="choice-grid">
          {(Object.keys(waterLabels) as Water[]).map((water) => (
            <ChoiceButton
              key={water}
              selected={brief.water === water}
              title={waterLabels[water]}
              copy={
                water === "low"
                  ? "Dry once settled in"
                  : water === "moderate"
                    ? "A good soak now and then"
                    : "Often damp or watered"
              }
              onClick={() => setBrief({ ...brief, water })}
            />
          ))}
        </div>
      ),
    },
    {
      title: "How large is the planting bed?",
      note: `Measure the bed in metres. The width and length can each be between ${MIN_BED_DIMENSION_M} m and ${MAX_BED_DIMENSION_M} m.`,
      content: (
        <div className="dimension-editor">
          <label>
            <span>Width</span>
            <div>
              <input
                type="number"
                min={MIN_BED_DIMENSION_M}
                max={MAX_BED_DIMENSION_M}
                step="0.1"
                value={Number.isFinite(brief.bedWidthM) ? brief.bedWidthM : ""}
                onChange={(event) =>
                  setBrief({
                    ...brief,
                    bedWidthM: Number(event.target.value),
                  })
                }
              />
              <em>metres</em>
            </div>
          </label>
          <span aria-hidden="true">×</span>
          <label>
            <span>Length</span>
            <div>
              <input
                type="number"
                min={MIN_BED_DIMENSION_M}
                max={MAX_BED_DIMENSION_M}
                step="0.1"
                value={
                  Number.isFinite(brief.bedLengthM) ? brief.bedLengthM : ""
                }
                onChange={(event) =>
                  setBrief({
                    ...brief,
                    bedLengthM: Number(event.target.value),
                  })
                }
              />
              <em>metres</em>
            </div>
          </label>
          <p>
            {dimensionsValid
              ? `${(brief.bedWidthM * brief.bedLengthM).toFixed(1)} m² total bed area`
              : `Enter a width and length between ${MIN_BED_DIMENSION_M} m and ${MAX_BED_DIMENSION_M} m`}
          </p>
        </div>
      ),
    },
    {
      title: "How full should the bed feel?",
      note: "This helps us leave the right amount of open space.",
      content: (
        <div className="choice-grid">
          {(
            Object.keys(densityLabels) as (keyof typeof densityLabels)[]
          ).map((density) => (
            <ChoiceButton
              key={density}
              selected={brief.density === density}
              title={densityLabels[density]}
              copy={
                density === "open"
                  ? "About 45% left open"
                  : density === "balanced"
                    ? "About 30% left open"
                    : "About 18% left open"
              }
              onClick={() => setBrief({ ...brief, density })}
            />
          ))}
        </div>
      ),
    },
    {
      title: "What do you want the planting to do?",
      note: "Choose as many as you like. For now, every goal counts equally.",
      content: (
        <div className="choice-grid two-column">
          {(Object.keys(goalLabels) as Goal[]).map((goal) => {
            const selected = brief.goals.includes(goal);
            return (
              <ChoiceButton
                key={goal}
                selected={selected}
                title={goalLabels[goal]}
                onClick={() =>
                  setBrief({
                    ...brief,
                    goals: selected
                      ? brief.goals.filter((item) => item !== goal)
                      : [...brief.goals, goal],
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
  const finalStep = steps.length - 1;
  const previewPlan = useMemo(() => {
    if (!validateGardenBrief(brief).valid) return null;
    return buildGardenPlan(plants, brief);
  }, [brief]);
  const planIsReady =
    previewPlan?.status === "provisional-plan" &&
    Boolean(previewPlan.layout?.placements.length);
  const canContinue =
    (step !== 4 || dimensionsValid) &&
    (step !== finalStep ||
      (validateGardenBrief(brief).valid && planIsReady));

  const loadWorkingExample = () => {
    setBrief({
      ...workingExampleBrief,
      goals: [...workingExampleBrief.goals],
    });
  };

  return (
    <main className="finder-shell">
      <div
        className="finder-progress"
        aria-label={`Step ${step + 1} of ${steps.length}`}
      >
        <span>
          Step {step + 1} of {steps.length}
        </span>
        <div>
          {steps.map((_, index) => (
            <i key={index} className={index <= step ? "is-complete" : ""} />
          ))}
        </div>
      </div>
      {(step === 0 || (step === finalStep && !planIsReady)) && (
        <aside
          className={`finder-example${step === finalStep ? " is-warning" : ""}`}
          aria-live="polite"
        >
          <div>
            <strong>
              {step === finalStep
                ? "These answers don’t produce a complete plan yet."
                : "Want a result you can test against?"}
            </strong>
            <p>
              {step === finalStep
                ? "Check your measurements and answers. If they’re accurate, keep them—the current library may not have a suitable mix. Use the test garden only to see how the planner works."
                : `The Garden Route test garden is preloaded: sandy soil, quick drainage, part sun, occasional summer water and a 2 × 3 m bed. It produces ${workingExampleOutput.totalPlants} plants across ${workingExampleOutput.species} species.`}
            </p>
          </div>
          <button className="text-link" onClick={loadWorkingExample}>
            {step === finalStep ? "Use the test garden" : "Reset the test garden"}
          </button>
        </aside>
      )}
      <section className="finder-panel">
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
          disabled={!canContinue}
          onClick={step === finalStep ? finish : () => setStep(step + 1)}
        >
          {step === finalStep ? "Build my plan" : "Continue"} <span>↗</span>
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
  match?: PlantAssessment;
  saved: boolean;
  open: () => void;
  toggleSaved: () => void;
}) {
  return (
    <article
      className={`plant-card${match ? ` status-${match.status}` : ""}`}
    >
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
          <div>
            <span className={`status-label status-${match.status}`}>
              {match.status === "candidate"
                ? "Good fit"
                : match.status === "review"
                  ? "Check first"
                  : "Not a fit"}
            </span>
            <strong>{Math.round(match.suitability)}% match for your goals</strong>
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
        View plant <span>↗</span>
      </button>
    </article>
  );
}

function PlanSummary({
  plan,
  openPlant,
}: {
  plan: ReturnType<typeof buildGardenPlan>;
  openPlant: (plant: Plant) => void;
}) {
  const plantsById = new Map(plants.map((plant) => [plant.id, plant]));

  if (
    plan.status === "no-plan" ||
    !plan.layout ||
    !plan.quantities ||
    plan.layout.placements.length === 0
  ) {
    return (
      <section className="plan-output plan-unavailable">
        <div>
          <span>Your layout</span>
          <h2>We couldn’t build a layout for this bed.</h2>
        </div>
        <p>
          Try a larger bed or change one of your answers. We’ll keep the plant
          checks here so you can see what got in the way.
        </p>
      </section>
    );
  }

  const layout = plan.layout;
  const quantities = plan.quantities;
  const rotated = layout.bedLengthM > layout.bedWidthM;
  const displayWidthM = rotated ? layout.bedLengthM : layout.bedWidthM;
  const displayLengthM = rotated ? layout.bedWidthM : layout.bedLengthM;

  return (
    <section className="plan-output">
      <div className="plan-output-heading">
        <div>
          <span>Your garden plan</span>
          <h2>
            {plan.brief.bedWidthM} × {plan.brief.bedLengthM} m bed
          </h2>
        </div>
        <p>
          {quantities.totalPlants} plants · {quantities.quantities.length}{" "}
          species · about {Math.round(layout.realisedOpenSpaceRatio * 100)}%
          open space
        </p>
      </div>

      <div className="brief-strip" aria-label="Garden brief summary">
        <span>{areaLabels[plan.brief.area]}</span>
        <span>{soilLabels[plan.brief.soil]}</span>
        <span>{drainageLabels[plan.brief.drainage]}</span>
        <span>{sunLabels[plan.brief.sun]}</span>
        <span>{waterLabels[plan.brief.water]}</span>
        <span>{densityLabels[plan.brief.density]}</span>
      </div>

      <div className="plan-output-grid">
        <div className="plan-bed-wrap">
          <div
            className="plan-bed"
            style={{
              aspectRatio: `${displayWidthM} / ${displayLengthM}`,
            }}
            aria-label={`${plan.brief.bedWidthM} by ${plan.brief.bedLengthM} metre planting layout`}
          >
            {layout.placements.map((placement) => {
              const plant = plantsById.get(placement.plantId);
              if (!plant) return null;
              const displayX = rotated
                ? placement.yM
                : placement.xM;
              const displayY = rotated
                ? layout.bedWidthM - placement.xM
                : placement.yM;
              const style: CSSProperties = {
                left: `${((displayX - placement.radiusM) / displayWidthM) * 100}%`,
                top: `${((displayY - placement.radiusM) / displayLengthM) * 100}%`,
                width: `${((placement.radiusM * 2) / displayWidthM) * 100}%`,
                height: `${((placement.radiusM * 2) / displayLengthM) * 100}%`,
              };

              return (
                <button
                  key={placement.instanceId}
                  className={`plan-marker accent-${plant.accent}`}
                  style={style}
                  onClick={() => openPlant(plant)}
                  aria-label={`${plant.commonName}, plant ${placement.sequence}`}
                  title={`${plant.commonName} · ${placement.instanceId}`}
                >
                  <span>{plant.id}</span>
                </button>
              );
            })}
          </div>
          <div className="plan-measure plan-measure-width">
            {displayWidthM} m
          </div>
          <div className="plan-measure plan-measure-length">
            {displayLengthM} m
          </div>
        </div>

        <div className="plan-legend">
          <div className="plan-legend-heading">
            <span>Plants</span>
            <span>Quantity</span>
          </div>
          {quantities.quantities.map((quantity) => {
            const plant = plantsById.get(quantity.id);
            if (!plant) return null;
            return (
              <button
                key={quantity.id}
                onClick={() => openPlant(plant)}
                className="plan-legend-row"
              >
                <span className={`legend-dot accent-${plant.accent}`} />
                <span>
                  <strong>{plant.commonName}</strong>
                  <em>{plant.scientificName}</em>
                </span>
                <b>× {quantity.quantity}</b>
              </button>
            );
          })}
        </div>
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
  saved,
  openPlant,
  toggleSaved,
  restart,
}: {
  mode: "results" | "browse";
  brief: GardenBrief;
  saved: string[];
  openPlant: (plant: Plant) => void;
  toggleSaved: (id: string) => void;
  restart: () => void;
}) {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<(typeof formFilters)[number]>("All");
  const [limit, setLimit] = useState(12);
  const plan = useMemo(() => buildGardenPlan(plants, brief), [brief]);

  const ranked = useMemo<
    { plant: Plant; match?: PlantAssessment }[]
  >(() => {
    if (mode === "results") {
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
                Your <em>{brief.bedWidthM} × {brief.bedLengthM} m</em>
                <br />
                planting plan.
              </>
            ) : (
              <>
                The first
                <br />
                <em>48</em> plants.
              </>
            )}
          </h1>
        </div>
        <div className="collection-note">
          <p>
            {mode === "results"
              ? "We used your answers to check the plants, choose a mix and lay it out in the bed. Anything we’re unsure about is clearly marked."
              : "These 48 plants are backed by Western Cape records. We’re still checking some practical growing details with plant experts."}
          </p>
          {mode === "results" && (
            <button className="text-link" onClick={restart}>
              Change my answers ↗
            </button>
          )}
        </div>
      </section>

      {mode === "results" && (
        <PlanSummary plan={plan} openPlant={openPlant} />
      )}

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
          {mode === "results"
            ? `${plan.counts.excluded} not a fit · ${plan.counts.review} need checking`
            : "Plant library"}
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
          These plants are saved on this device. Use this list to compare the
          ones you like.
        </p>
      </section>
      {savedPlants.length ? (
        <>
          <div className="saved-summary">
            <span>{savedPlants.length} plants</span>
            <span>
              Tallest ·{" "}
              {formatDimension(
                Math.max(...savedPlants.map((plant) => plant.heightCm)),
              )}
            </span>
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
          What we’re still <em>checking.</em>
        </h1>
        <p>
          The planner uses your answers to suggest plants, work out quantities
          and draw a simple bed layout. When information is missing, we say so.
        </p>
      </section>
      <section className="method-grid">
        <article>
          <span>01</span>
          <h2>Plant records</h2>
          <p>
            The 48 plants use names, sizes and Western Cape records from SANPC,
            BODATSA and BioSCape.
          </p>
        </article>
        <article>
          <span>02</span>
          <h2>Plant checks</h2>
          <p>
            Each plant is checked against your area, light, water and bed size.
            Soil and drainage still need expert checking.
          </p>
        </article>
        <article>
          <span>03</span>
          <h2>Your priorities</h2>
          <p>
            The planner looks at every goal you choose. For now, each goal
            counts equally.
          </p>
        </article>
        <article>
          <span>04</span>
          <h2>Plant mix and layout</h2>
          <p>
            The planner chooses a mix, works out how many may fit and places
            them inside the bed. Plant size is an estimate, not nursery spacing
            advice.
          </p>
        </article>
      </section>
      <section className="method-callout">
        <div>
          <h2>The next step is checking the growing advice.</h2>
        </div>
        <p>
          A local plant expert still needs to review soil, water, spacing and
          likely results. Until then, treat the plan as a useful starting
          point—not a guarantee.
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
            Plant {plant.id} · {plant.family}
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
            {saved ? "Remove saved plant" : "Save plant"}{" "}
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
              <dd>{plant.sun.map((item) => sunLabels[item]).join(" · ")}</dd>
            </div>
            <div>
              <dt>Water</dt>
              <dd>{waterLabels[plant.water]}</dd>
            </div>
          </dl>

          <div className="detail-evidence">
            <h3>About this information</h3>
            <p>
              We found {plant.occurrenceCount} Western Cape records for this
              plant in BODATSA. Height, plant type and flowering time come from
              BioSCape. We’re still checking the light, water and garden-use
              advice.
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
        A Western Cape garden planner built with SANPC, BODATSA and BioSCape
        plant data.
      </p>
      <button className="text-link" onClick={method}>
        How the planner works ↗
      </button>
      <span className="footer-version">MVP · 2026</span>
    </footer>
  );
}

export function GardenApp() {
  const [view, setView] = useState<View>("home");
  const [brief, setBrief] = useState<GardenBrief>(defaultBrief);
  const [saved, setSaved] = useState<string[]>([]);
  const [savedReady, setSavedReady] = useState(false);
  const [briefReady, setBriefReady] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const savedValue = window.localStorage.getItem("silly-goose-saved");
        const parsedSaved = savedValue ? JSON.parse(savedValue) : [];
        setSaved(
          Array.isArray(parsedSaved)
            ? parsedSaved.filter((item): item is string => typeof item === "string")
            : [],
        );

        const briefValue = window.localStorage.getItem("silly-goose-brief");
        const parsedBrief = briefValue
          ? parseGardenBrief(JSON.parse(briefValue))
          : null;
        if (parsedBrief) setBrief(parsedBrief);
      } catch {
        setSaved([]);
      } finally {
        setSavedReady(true);
        setBriefReady(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!savedReady) return;
    window.localStorage.setItem("silly-goose-saved", JSON.stringify(saved));
  }, [saved, savedReady]);

  useEffect(() => {
    if (!briefReady) return;
    window.localStorage.setItem("silly-goose-brief", JSON.stringify(brief));
  }, [brief, briefReady]);

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
          brief={brief}
          setBrief={setBrief}
          finish={() => navigate("results")}
          cancel={() => navigate("home")}
        />
      )}
      {(view === "results" || view === "browse") && (
        <CollectionView
          mode={view}
          brief={brief}
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
