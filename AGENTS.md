# Silly Goose repository guide

This is the durable handoff for agents working in this repository. Keep it
short. Put changing project status in `docs/NOW.md`, product decisions in
`docs/PRODUCT.md`, mathematical detail in `docs/ENGINE.md`, and art direction
in `docs/VISUAL.md`.

## Project in one sentence

Silly Goose is a desktop-first Western Cape garden planner that turns a
gardener's real conditions and rectangular bed size into a provisional,
traceable indigenous plant group, quantities and measured layout.

Public site: <https://silly-goose-mvp.nanema.chatgpt.site>

The site is public to anyone with the link. It is an MVP, not reviewed
horticultural advice.

## Start every task here

1. Run `git status --short` and preserve unrelated user changes.
2. Read `docs/NOW.md`.
3. Read only the document needed for the task:
   - product or scope: `docs/PRODUCT.md`
   - data, evidence or maths: `docs/ENGINE.md`
   - copy, styling or imagery: `docs/VISUAL.md`
4. Inspect the implementation before proposing a rewrite.
5. Make the smallest coherent change, test it, and update the canonical doc
   when a decision or material limitation changes.

Do not create another planning document or decision log. Git is the change
history.

## Working agreement with the user

- Use judgement and keep moving when the intent is clear.
- Flag obvious errors, unsupported assumptions and contradictions. Fix them
  when the correction is safely within scope.
- Use plain English. Avoid generic AI slogans, inflated promises and decorative
  micro-headings.
- The user is the taste filter. For new artwork, give one page-specific prompt;
  the user generates and approves one image at a time, then Codex optimises and
  integrates it.
- Prefer a real placeholder over an unrelated or generic image.
- Keep human-facing documents concise, scannable and quality-dense.
- Never invent horticultural evidence to complete the interface.

## Stable product contract

- Region: Western Cape only, as of 2026-08-17 — reverted from a brief
  national experiment (2026-08-10 to 2026-08-17). National coverage diluted
  species relevance more than it helped (Savanna/Indian Ocean Coastal Belt
  species outnumbered real Western Cape flora in the catalogue), and
  rescoping unlocked real **bioregion**-level detail (SANBI's
  `BIOREGION_` field, one level finer than biome) that only makes sense at
  Western Cape scale. See `docs/NOW.md` for the full account.
- Audience: beginner or intermediate home gardeners.
- Primary surface: desktop; smaller screens must remain usable.
- Core flow: home -> seven-part garden brief -> provisional plan and plant
  library -> plant details and saved plants.
- Saved plants and draft answers are device-local.
- Current catalogue: the Western Cape-filtered plant database
  (`data/processed/plant_database_western_cape.csv`, regenerate via
  `data/scripts/generate_plants_json.py`) — thousands of species combining
  BioSCape occurrence records and PlantZAfrica horticultural profiles, not a
  small hand-curated list. A species qualifies either by an occurrence
  actually falling inside a Western Cape bioregion (high confidence) or by
  sharing a biome with the Western Cape despite being recorded elsewhere
  (lower confidence, no specific bioregion) — see "Data boundary" below.
  Coverage of sun/water/bioregion varies by plant; missing fields show as
  "unknown," never guessed. The untouched national dataset
  (`data/processed/plant_database_full.csv`, 3,643 species) stays available
  as an archive if national scope is ever revisited.
- Current geometry: one rectangular bed.
- The useful outcome is a plant group, quantities and placement, not merely a
  quiz result or ranked list.

Exact home hero copy:

> Describe your *garden.*  
> Discover the plants that *fit.*

Keep it on two lines at desktop sizes. `garden` and `fit` use the olive italic
treatment.

## Regression test briefs

There is no single fixed test garden any more (removed in test run 1).
`tests/engine.test.ts` holds five regression briefs (`TEST_BRIEFS`) that
between them cover different sun / water / soil combinations, every
style, and wind on and off. For each, the plan must exist, every hard
rule (H1-H5, P1-P5) must hold, the wind profile must match the wind
answer, and - in beds with four or more species - the groups must not all
be the same size. Keep them passing; if a justified change breaks one,
say why in docs/NOW.md rather than weakening the test.

## Evidence and planning guardrails

The runtime sequence is:

`brief -> hard checks -> AHP weights -> Goal Programming -> species group -> quantities -> layout`

Implementation lives in `app/lib/planning/`.

- A hard failure excludes a plant.
- Missing evidence remains `unknown`; it cannot silently become compatible.
- Occurrence proves a Western Cape record, not that a plant will thrive in a
  garden.
- AHP supplies soft-goal weights only. The equal-weight matrix is a baseline,
  not expert calibration.
- Current soil, light, water, spacing and composition rules include
  provisional fields or thresholds. Keep the warnings visible. Drainage and
  planting density are no longer asked: drainage has no plant-level source,
  and density is a constraint for the optimiser rather than a question.
- Field-canopy measurements are spacing proxies, not nursery spacing.
- The greedy selector and rectangular packer construct feasible prototypes;
  they do not prove a global optimum.
- Every exclusion, unknown, penalty and layout adjustment must remain
  reconstructable.

Read `docs/ENGINE.md` before changing any formula, threshold, source mapping,
test fixture or recommendation claim.

## Wind is algorithm-driven, not dataset-driven

Sun, water and soil each map to a column on the plant records and act as
**hard filters**: they remove incompatible species from the pool. Wind
does not, and the distinction must stay visible in the code.

- **There is no wind attribute on any species, and none may be created.**
  "Wind" appears in the catalogue only under `pollination` and
  `dispersal`, which describe reproduction, not tolerance. Do not
  text-mine those fields for it, do not add a wind column or derived flag
  to the plant data, the JSON generator or the R/Python pipeline, and do
  not treat any biome (including Indian Ocean Coastal Belt) as a wind
  proxy.
- **Wind never filters and never excludes.** `feasibilityConstraints()`
  does not reference it, and it is absent from the relaxation logic -
  relaxation applies only to hard filters. No wind rule may ever exclude
  a plant or make a feasible layout infeasible.
- **It reaches the engine through `app/lib/planning/windRules.ts`**, which
  is called from Stage 1 scoring only. `isWindResilient` works out
  `windres_i` at runtime from `plant_type`, `height_cm` and
  `special_features` (groundcovers, grasses/graminoids, restios, shrubs
  up to `LOW_SHRUB_MAX_HEIGHT_CM`, or `Hedge/screen`), and the site factor
  W_site (none 0 / protected 0.5 / affected 1) scales its weight. It only
  ever adds to a score.
- **Still to come from the expert interview**: a soft windbreak placement
  preference toward the windward south and east edges (Stage 4) and wind
  care advice. All additive, never penalties.

One subtlety worth keeping: wind **is** in the stored plan seed, so a
saved layout reopens as the garden it was made for, but it is
deliberately **excluded from the tie-break seed**. The tie-break only
separates otherwise-equal plants, and letting it depend on wind would
make layouts differ by wind answer for reasons unrelated to wind. Wind
moves layouts through the Stage 1 score, which is the honest route.

## The algorithm rulebook

**Every engine number comes from `Algorithm_rulebook.xlsx`** (beside the
repo), imported by `data/scripts/import_rulebook.py` into
`app/data/engine_rules.generated.json` and read through
`app/lib/planning/rules.ts` (`RULES`). The sync step rebuilds it whenever
the workbook changes, exactly like the dataset. Do not type a rulebook
value into the code - read it from `RULES`. `layout_rules_final.xlsx` is
NOT a source: ignore it (owner decision).

The engine, one file per stage:

- Stage 0 `gardenPlan.ts` feasibilityConstraints + `stage0Rules.ts`
  (F5 without its wind trigger, F6, F9). Wind and style never filter.
- Stage 1 `stage1.ts` / `stage1Config.ts` (no shade term: the shade
  bonus is future work).
- Data-derived inputs `engineData.ts`: P30/P60 and the spread-band
  terciles recalculated from the catalogue on load; layers L1-L7; feature
  plants; flowering seasons.
- Stage 2 `stage2.ts`: H1-H5, goals A1-A5, Z.
- Stage 3 `stage3.ts`: greedy start, local improvement, annealing (T0
  derived: a 5%-worse move accepted half the time at the start).
- Stage 4 `stage4.ts`: layered placement; D24 option C (13 Oct 2026): the
  view beats the wind - every option and profile measures depth from the
  viewing edge (tall at the back) and no windbreak row stands on the
  viewing edge; P1-P13 (P14, the shade footprints, is
  future work with the shade bonus).
- `engine.ts` runs Stages 2-4 with the fail rule; `gardenPlan.ts` shows the
  three best distinct results by Z.

`tests/engine.test.ts` reproduces the rulebook's 9_Hand_Check (Z = 0.770);
keep it passing.

Engine settings that are not rulebook parameters - the test-run-1
decisions (P2 overlap tolerance, feature size thresholds,
windward edges, fail-rule and placement settings, NEMBA file) - live in
ONE file, `app/lib/planning/engineConfig.ts`, each labelled with its
rulebook ID. Do not scatter engine numbers elsewhere.

## Stage 1 - the plant score

`app/lib/planning/stage1.ts` scores every plant in the Stage 0 pool in
[0, 1]; every number and mapping it uses lives in
`app/lib/planning/stage1Config.ts`, labelled "Agreed weight" or
"ASSUMPTION". Do not hard-code a Stage 1 number anywhere else, and do not
change an "Agreed" value without the owner. Stage 1 ranks and never
removes: a plant Stage 0 excluded is never scored (its `stage1` is null),
so saved plants and wind cannot bring it back. Because score_i is
normalised by raw_max, "a preference never penalises" is asserted on
raw_i, not score_i. `STYLE_FIT` is the owner's agreed garden-style
mapping.

## Nursery sourcing (live, annotate-only)

`Nursery_Sourcing_Search_Spec.xlsx` (beside the repo) says WHERE and HOW
to search nurseries. It is configuration only - never store prices, sizes
or stock as a dataset; they are fetched live for each layout
(`app/lib/sourcing/`), cached up to 7 days for speed only
(`.sourcing-cache.json`, never hand-edited). PDFs are the only snapshot
source: parsed once per file version by `data/scripts/ingest_catalogues.py`
into `data/processed/catalogues/`.

- **Annotate only.** Sourcing runs after the layout and must never change
  which plants are selected or where they sit (tested).
- **The workbook is read live on the dev server** (Vite middleware in
  `build/sourcing-dev-plugin.ts`, re-read when its modified time changes,
  from a temp copy, last good config kept on error). The deployed worker
  (`app/api/sourcing/route.ts`) uses the snapshot written by `data:sync`.
- **Tab names live only in `TABS` in `app/lib/sourcing/spec.ts`**; columns
  are found by header text. Formula cells are never read - status, size
  conversions, distance and budget are recalculated in code.
- **Politeness:** robots.txt respected, <= 1 request/second per site,
  5 s timeout, identifying User-Agent (also for Nominatim).
- Wholesale lists are availability only and never reach the budget.
- The weekly scraper and `nursery_sourcing.csv` are retired
  (`data/scripts/retired/sourcing/`).

## Data boundary

**The species catalogue comes from one source: the finalised workbook
`FINAL.DATASET.FINAL.xlsx` (kept beside the repo), imported by
`data/scripts/import_final_dataset.py`.** 2,843 species, 47 columns.
Every measurement field is populated (`spread_cm` and `height_cm` 100%,
sun/water/soil 83–99%) and each carries its own `*_source` /
`*_confidence` column recording how the value was obtained. Most spread
values are **imputed, not measured** — only 212 are `original` — so that
provenance must stay visible in the interface rather than being presented
as recorded evidence.

**The catalogue rebuilds itself when the workbook changes.**
`data/scripts/sync_dataset.mjs` runs before every `npm run dev` and
`npm run build` (and by hand as `npm run data:sync`, `--force` to rebuild
regardless). It hashes the workbook and, only if it changed, reruns
`import_final_dataset.py` then `generate_plants_json.py`, writing the
hash to `app/data/dataset_version.generated.json`. Saved gardens record
that version (`datasetVersion`). If the workbook is absent (CI, another
machine) the committed catalogue is used; if the pipeline fails the
build stops rather than shipping bad data. Override the workbook path
with `FINAL_DATASET_PATH`. The app never reads the workbook at runtime -
that keeps results reproducible. A dataset change can move the guided
example: if `npm run test:unit` fails on it after a sync, update the
fixture with the reason, as for any other change.

The R merge that previously built this catalogue
(`combine_plant_database.R`: the BioSCape + PlantZAfrica union, the
Western Cape scope rule and the invasive-species exclusion) was **retired
on 2026-09-18** and now lives in `data/scripts/retired/` with a README
explaining what it did. Do not run it — it would overwrite the import with
older, sparser data.

Still live and unrelated to the species dataset:

- `data/scripts/build_bioscape_traits.R` — **partly retired.** Its trait
  half is dead, but it remains the only producer of the spatial layers the
  app uses (`western_cape_bioregions.geojson`,
  `western_cape_outline.geojson`, `south_africa_biome_regions.geojson`).
  Re-run it only to rebuild those map layers.
- `data/scripts/assign_place_bioregions.R` — builds
  `western_cape_places.csv`, the location picker's data.
- `data/scripts/data_quality_report.R` — profiles the current dataset
  (fill rate, type and class count per attribute).
- legal-review warning sources described in `data/sources.json`.

The canonical combined catalogue is
`data/processed/plant_database_western_cape.csv` (the untouched national
version, `plant_database_full.csv`, stays as an archive).
`data/scripts/generate_plants_json.py`
reshapes it into `app/data/plant_database.generated.json`, which
`app/data/plants.ts` imports and types as the visible catalogue.
`tests/data-foundation.test.ts` prevents the two from drifting.

Do not hand-edit source-derived taxonomy, height, occurrence, canopy, sun,
water or biome values without updating the processing/audit trail — regenerate
via the R and Python scripts above instead. Not every field is populated for
every plant; missing sun/water/biome must stay `null` (surfaced as "unknown"
in the planning engine), never guessed.

## Visual and copy rules

- Direction: an eccentric Western Cape botanical print cabinet on old
  cotton-rag paper.
- Palette: cream, fern and lighter olive greens; no orange brand accent.
- Type: Bodoni Moda for display, Newsreader for editorial copy, Instrument Sans
  for controls and factual metadata.
- Use recognisable Cape flora, archival grids, hand-ruled borders and slight
  print imperfection.
- The home page follows the pre-pilot design (2026-09-22): left-aligned
  reading zone (heading, one paragraph, "Create my garden" and "Browse
  plant library"), and a separate illustration zone holding the crayon
  flower sketch. No background artwork anywhere - the AI hero and side
  columns were removed and their files deleted.
- Quiz headings should be question-sized, not oversized poster type.
- Avoid fake Latin, generated words inside images, glossy stock imagery,
  tropical foliage, burnt parchment and theatrical grunge.

Current web assets:

| Use | Runtime asset |
|---|---|
| Home illustration | `public/images/flowers-sketch.png` (transparent, from the owner's sketch) |
| Site icon | `public/favicon.png`, `public/icon.png`, `public/apple-touch-icon.png` (same sketch) |

The layout diagram has two views: Sketchbook (coloured circles) and
Real-life (each circle filled with the species photo, falling back to the
sketch circle when a photo fails). Plants in the saved library carry a ♥
badge in both.

## Important code map

| Area | Location |
|---|---|
| Main application UI | `app/components/GardenApp.tsx` |
| Site-wide styling | `app/globals.css` |
| Metadata and font loading | `app/layout.tsx` |
| Plant catalogue | `app/data/plants.ts` |
| Planning engine | `app/lib/planning/` |
| Nursery sourcing scrape (weekly, GitHub Actions) | `data/scripts/sourcing/` |
| Automated checks | `tests/` |
| Source data and processing | `data/` |

## Validation

Requires Node.js 22.13 or newer.

```powershell
npm test
npm run lint
npx tsc --noEmit
```

`npm test` includes the production build and rendered-page checks. For visual
changes, also inspect the relevant desktop viewport and a smaller responsive
viewport.

## Publishing

This repository already belongs to an OpenAI Sites project. Reuse the exact
`project_id` in `.openai/hosting.json`; never create a second site.

- Use local preview while implementing.
- Publish completed deployable changes through the existing Sites project
  unless the user asks for local-only work.
- Validate and push the exact source state before saving a Sites version.
- Never persist or print source-repository credentials.
- Reconfirm the public URL and access mode after deployment.

Documentation-only edits do not need a production deployment.

## Current priorities

1. Add sourced horticultural tolerances and reviewed mature spacing.
2. Calibrate AHP and Goal Programming with a Western Cape horticultural expert.
3. Build reviewed feasible, infeasible and missing-evidence garden cases.
4. Refine composition rules and the measured plan using those cases.
5. Add approved page artwork and plant portraits one at a time.
6. Remove unused assets only after reference checks.

Do not expand into accounts, checkout/payments, nationwide coverage,
irregular beds or garden-care diaries before the current recommendation is
credible. Nursery sourcing (catalogue listings and indicative prices,
refreshed weekly - see `docs/NOW.md`) is in scope; it must never claim live
stock.
