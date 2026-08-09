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

- Region: national (South Africa) as of 2026-08-10 — a deliberate, explicit
  override of the earlier "Western Cape first, no nationwide coverage yet"
  scope, made once the plant database gained real national biome data. See
  `docs/NOW.md` for why.
- Audience: beginner or intermediate home gardeners.
- Primary surface: desktop; smaller screens must remain usable.
- Core flow: home -> seven-part garden brief -> provisional plan and plant
  library -> plant details and saved plants.
- Saved plants and draft answers are device-local.
- Current catalogue: the combined plant database (`data/processed/plant_database_full.csv`,
  regenerate via `data/scripts/generate_plants_json.py`) — thousands of
  species combining BioSCape occurrence records and PlantZAfrica
  horticultural profiles, not a small hand-curated list. Coverage of
  sun/water/biome varies by plant; missing fields show as "unknown," never
  guessed.
- Current geometry: one rectangular bed.
- The useful outcome is a plant group, quantities and placement, not merely a
  quiz result or ranked list.

Exact home hero copy:

> Describe your *garden.*  
> Discover the plants that *fit.*

Keep it on two lines at desktop sizes. `garden` and `fit` use the olive italic
treatment.

## Verified garden fixture

The guided example in `app/lib/planning/workingExample.ts` is a regression
contract:

- Fynbos biome
- sandy soil
- drains quickly
- part sun
- moderate water
- 2 m x 3 m bed
- balanced density
- flowers and pollinators

Expected summary: **3 plants, 3 species, 43% open space**.

Do not change this result silently. If a justified model correction changes it,
update the fixture and tests and explain the reason in `docs/NOW.md` or
`docs/ENGINE.md`. (This fixture's numbers were recalculated on 2026-08-10 when
the plant catalogue moved from 48 hand-curated plants to the full combined
database — the old fixture used "Garden Route" area, which no longer exists as
a concept now that matching is biome-based.)

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
- Current soil, drainage, light, water, spacing, density and composition rules
  include provisional fields or thresholds. Keep the warnings visible.
- Field-canopy measurements are spacing proxies, not nursery spacing.
- The greedy selector and rectangular packer construct feasible prototypes;
  they do not prove a global optimum.
- Every exclusion, unknown, penalty and layout adjustment must remain
  reconstructable.

Read `docs/ENGINE.md` before changing any formula, threshold, source mapping,
test fixture or recommendation claim.

## Data boundary

The processed foundation combines:

- SANPC accepted Western Cape taxonomy, BODATSA occurrence summaries and
  BioSCape GCFR traits, joined and enriched with a point-in-polygon `biome`
  (SANBI National Vegetation Map 2018) by `data/scripts/build_bioscape_traits.R`,
  including an invasive-species exclusion pass (`data/raw/InvasivePlants.txt`);
- PlantZAfrica (SANBI) horticultural profiles — sun, water, soil, spread,
  common names and photo URLs — merged in by
  `data/scripts/combine_plant_database.R`, unioned with the BioSCape set so
  species with no BioSCape occurrence record still carry a zone-inferred
  biome (lower confidence, tagged via each plant's `biomeSource`); and
- legal-review warning sources described in `data/sources.json`.

The canonical combined catalogue is
`data/processed/plant_database_full.csv`. `data/scripts/generate_plants_json.py`
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
- Keep the current hero artwork static. Do not add protea movement, parallax or
  pointer-following effects.
- The botanical side columns begin below the navigation. The navigation stays
  opaque above them with its divider line intact.
- Quiz headings should be question-sized, not oversized poster type.
- Avoid fake Latin, generated words inside images, glossy stock imagery,
  tropical foliage, burnt parchment and theatrical grunge.

Current masters and web assets:

| Use | Source | Runtime asset |
|---|---|---|
| Home hero | `hero.png` | `public/images/editorial/home-hero.avif` with WebP and JPEG fallbacks |
| Side columns | `border.jpg` | `public/images/editorial/site-border.jpg` |

The archived V01 cabinet source remains at
`assets/source/home-cape-cabinet.png`; it is intentionally not a runtime asset.

## Important code map

| Area | Location |
|---|---|
| Main application UI | `app/components/GardenApp.tsx` |
| Site-wide styling | `app/globals.css` |
| Metadata and font loading | `app/layout.tsx` |
| Plant catalogue | `app/data/plants.ts` |
| Planning engine | `app/lib/planning/` |
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

Do not expand into accounts, commerce, nationwide coverage, irregular beds or
garden-care diaries before the current recommendation is credible.
