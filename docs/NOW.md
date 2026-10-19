# Where the project is now

**Audience:** the user and anyone joining the project

**Purpose:** current status, material limitations and next decisions

**Updated:** 2026-10-01

## The short version

Silly Goose now runs the full planning sequence:

`garden brief -> feasibility -> AHP weights -> Goal Programming -> species group -> quantities -> rectangular layout`

The result is a working **provisional plan**, not yet reviewed horticultural
advice. Every unsupported field and model assumption stays visible.

The public MVP is available at
<https://silly-goose-mvp.nanema.chatgpt.site>.

## Status

| Area | Status | Meaning |
|---|---|---|
| Garden brief | Working | Bioregion, soil, drainage, light, water, dimensions, density and goals; stored locally |
| Plant library | Working | 2,843 Western Cape-compatible plants (BioSCape + PlantZAfrica) with search, profiles, photos and source notes; sun/water/bioregion coverage varies by plant |
| Mined-data link | Tested | Every visible plant's taxonomy, height, spread, sun, water, biome and bioregion is audited against `data/processed/plant_database_western_cape.csv` |
| Feasibility | Working, provisional | Every plant returns pass/fail/unknown with reasons and evidence |
| AHP | Working, uncalibrated | Matrix audit is live; selected goals currently receive equal weight |
| Goal Programming | Working, provisional | Directional penalties rank non-excluded plants |
| Group selection | Working, provisional | Deterministic binary constructor respects area, open space and species limit |
| Quantities | Working, provisional | Integer counts use field-canopy area as the capacity proxy |
| 2D layout | Working, provisional | Conservative rectangular packer returns non-overlapping coordinates |
| Saved plants | Working | Stored on the current device |
| Excluded plants | Working | Plants the gardener rules out by hand; removed at Stage 0 before scoring, reversible from the Saved page, stored on the current device |
| Nursery sourcing | Working, provisional | Weekly-refreshed catalogue listings and an opportunistic indicative price per matched species; see "Nursery sourcing" below |
| Responsive layouts | Working | Core flow, plan, library and plant profiles adapt to phone-sized touch screens |
| Visual system | In review | Cape botanical print direction is integrated and still being refined |

## What is source-backed

- Accepted Western Cape taxonomy from SANPC
- Western Cape specimen occurrence counts from BODATSA
- Height, growth form, flowering and available canopy measurements from
  BioSCape
- **Bioregion** (the real match key - one level finer than biome, e.g.
  "Southwest Fynbos" vs just "Fynbos"), derived from real occurrence
  coordinates via a point-in-polygon join against the Western Cape
  government's own vegetation-map layer (majority vote across a species'
  occurrences)
- **Biome** (coarser, supporting info), from the same technique against
  SANBI's National Vegetation Map 2018; species with no BioSCape occurrence
  record instead get a lower-confidence biome inferred from PlantZAfrica's
  horticultural zone text, tagged as such
- Sun, water, soil, spread, common names and photo URLs from PlantZAfrica
  (SANBI) horticultural profiles, where a PlantZAfrica match exists; a
  photo-less remainder falls back to a matched iNaturalist photo
- Every visible plant's membership in the Western Cape-filtered,
  invasive-species-filtered plant database
  (`data/processed/plant_database_western_cape.csv`) - a species qualifies
  by an occurrence actually inside a Western Cape bioregion, or by sharing
  a biome with the Western Cape despite being recorded elsewhere; either
  way it's real evidence, never a guess, and which applies is recorded on
  every plant

An automated test prevents those visible fields from drifting away from the
processed data.

Coverage after the 2026-09-18 finalised dataset (see below): 82.8% of plants
have sun data, 99.1% water, 98.8% soil, 100% spread and height, 99.8% a biome
(nearly all, by construction - a biome match is the entry ticket into this
file), but still only 23.4% a specific bioregion (the rest are the
lower-confidence "shares a Western Cape biome" tier). Missing fields show as
"unknown" in the planning engine (never silently treated as a pass or fail).
Note that the completed spread/height figures are largely **imputed** rather
than measured - the per-field `*_source` columns record which.

The end-to-end regression suite also caught a bad 2 × 5 m result in which tiny
canopy records produced 26 copies of one geophyte and 99% open space. The
planner now rejects sub-15 cm values as spacing evidence, selects across
provisional planting layers and tests that tiny records cannot dominate.

## Finalised dataset (2026-09-18)

The upstream source is now the hand-finalised workbook
`FINAL.DATASET.FINAL.xlsx`, imported by
`data/scripts/import_final_dataset.py` into
`data/processed/plant_database_western_cape.csv`. Same 2,843 species, 47
columns instead of 34.

What changed, measured before and after:

| Field | Was | Now |
|---|---|---|
| `spread_cm` | 7.5% | **100%** |
| `height_cm` | 76.2% | **100%** |
| `water` | 73.1% | 99.1% |
| `soil_type` | 68.6% | 98.8% |
| `sun` | 71.3% | 82.8% |

This removes the constraint that had been limiting the planner: spread is
the layout stage's capacity proxy, so a species without one never reached a
layout. Only 16 species previously had both a spread and a bioregion.

**Most of those values are inferred, not measured** — `spread_source` is
`original` for 212 species, `lookup` for 839, `group-median` for 869 and
`ratio-imputed` for 909, with 336 flagged `outlier` and 18 `suspect-low`.
Height is `original` for 2,165 and imputed for 678. Sun, water and soil
carry their own `*_source` and `*_confidence` columns. All of this is now
carried onto `Plant` (`spreadSource`, `spreadOutlierFlag`, `spreadNote`,
`heightSource`, `sunSource`/`sunConfidence`, and the water and soil
equivalents) so the interface can distinguish a measurement from an
estimate. **It does not yet do so** — surfacing it is the next job.

The old `growth_form` / `plant_type_pza` pair was replaced by one
`plant type` column, which is what `Plant.form` now reads.

The guided fixture moved from 3 plants / 3 species to **5 / 5**, open space
unchanged at 43%, for the reason above — re-verified by running the
planner, not assumed.

## Dataset switched to `FINAL.DATASET.FINAL.the correctone.xlsx` (2026-10-19)

Owner instruction: this is the only dataset workbook to use from now on.
The sync and the importer now default to it. Dataset version
**1e15fe4470f8**, which replaces 6c081d3d2f60. The rulebook stays frozen
at 713f9bad5bec: the edited `Algorithm_rulebook.xlsx` (b5e2e4c9fee4) is not
imported.

**What changed:** the same 2,843 species; 46 records differ, with 45 spreads
and 9 heights corrected as expert estimates. All 5 `suspect-low` trees are
corrected, e.g. Brachylaena glabra 30 → 400 cm spread and 18 → 6 m tall,
and Protea laurifolia 30 → 200 cm and 8 → 4.5 m.

**Tests no longer all pass.** 3 layering tests fail on the new data:
- the 12-case (east option 1: tall 4.05 m vs short 5.08 m from the viewer);
- D24 (b) (north option 3);
- D24 (c) (south option 1: windbreak plant B2132 off the windward edge).

The cause is the data, not the code: a clean copy of the last commit fails
the same 3 tests. Relaxation is not involved. Engine-final behaviour (D29b
off) fails D24 (b) only.

The new spreads change which plans are chosen, and plans with very wide
plants (3 m and more) put short plants behind tall ones. The tests are kept
as they are; the fix belongs in the layout and is still to come.

## layout-v2f: v7 on by default on the branch (2026-10-14)

Branch `layout-v2f`. The full report is `reports/layout_v2f_comparison.md`.

Gap-fill plants must now stand within 10 cm of their own species
(`RELAX.cohesionFill`). Drifts are the tightest measured: 0.114 of grouped
plants are more than 10 cm from a group-mate. The largest gap stays 0.142,
Z and feasibility are unchanged, and all 137 tests pass.

## layout-v2e: v6 (v4' + group cohesion) on by default on the branch (2026-10-14)

Branch `layout-v2e`. The full report is `reports/layout_v2e_comparison.md`.

A group cohesion clamp (`RELAX.cohesion`, 10 cm, an assumption) stops
relaxation from pulling drifts apart. Against v4′:
- the share of grouped plants more than 10 cm from a group-mate drops from
  0.267 to 0.167;
- the largest gap is 0.142, the best measured;
- Z and feasibility are unchanged, and all 136 tests pass.

Gap-fill plants may still stand away from their group.

## layout-v2d: D33b, v4' on by default on the branch (2026-10-14)

Branch `layout-v2d`, from `layout-v2c`. The full report is
`reports/layout_v2d_comparison.md`.

The relaxation now runs as v4', the best variant that passes every test:
- Lloyd steps on a radius-weighted power diagram;
- a hard edge guard (plants slide along walls, never leave the bed);
- size swaps that even out 1 m-cell cover;
- a gap fill that adds one plant of an already-selected species to each of
  the 3 largest gaps, within H3 max and the H5 cap.

Against D33 it shrinks the median largest gap (0.158 → 0.145) and the
95th-percentile gap (52 → 41 cm). Z and feasibility are unchanged, no plant
leaves the bed and none is removed.

Not adopted:
- v3's ±0.15 clamp for short plants breaks the B1223/B1172 layering test.
- The drift split breaks the 12-case test.

Known trade-off: drifts loosen on big beds (S006: same-species gap 0 → 44
cm), because Lloyd has no same-species pull.

Known data issue: 38 tree species have a spread under 1 m, most of them
imputed and 5 flagged `suspect-low`.

## layout-v2c: D33 relaxation pass on by default on the branch (2026-10-14)

Branch `layout-v2c`, from `layout-v2b`. The full report is
`reports/layout_v2c_comparison.md`.

After Stage 4, plants are nudged apart into nearby open ground. Each plant
stays near its target depth, and the feature plant, the windbreak row and
climbers keep their places. The result is kept only if the largest empty
patch shrinks and every check holds.

It runs only on layouts that already pass every hard check, so selection, Z
and feasibility never change.

With D29b config (o) it is accepted in about half the plans, where about 9
plants move about 15 cm. The median largest gap falls 0.175 → 0.158. All
134 tests pass. Setting: `RELAX` in engineConfig, no rulebook change.

## layout-v2b: relative height gradient adopted on the branch; D32 reverted (2026-10-14)

Branch `layout-v2b` (from layout-v2 after its revert), rulebook
713f9bad5bec. The full report is `reports/layout_v2b_comparison.md`.

**D29b, config (o), is the default on this branch.** Flags `LAYOUT_V2B`
in engineConfig. It has five parts:
- each species aims for depth d* = (rank − 0.5)/n by height, as a soft
  target;
- a curved front edge;
- a hard rule: no tree centred in the front 0.35 (measured on the curve);
- a corners-first placement order;
- each group starts in the emptiest of nine cells.

Against engine-final it holds Z (−0.0018), loses no brief, spreads plants
more evenly, passes every test, and fixes D24 (b).

Known limitations:
- Plants ≥ 80 cm still stand in front when a plan is mostly tall,
  because the gradient is relative.
- The curve lets trees stand forward at the sides of the bed.

The drift-split flag stays off: it breaks the 12-case test.

**D32 (capacity-aware selection) was built, measured and reverted.** It
broke two existing tests. It also missed its 25% filler target in most
plans and raised dominance. It is kept in history as 5d1d175.

## layout-v2 height bands: built, measured, reverted (2026-10-14)

Branch `layout-v2`, rulebook 713f9bad5bec. D29 (height bands) and D30 (band
shaping) were built and measured over the 100 batch briefs plus a fixed case
(`reports/layout_v2_comparison.md`).

- **The gain:** D29 removed every tall plant centred in the front band
  (482 → 0).
- **The cost:** median Z fell by 0.013–0.019, the largest gap roughly doubled,
  and fail-rule drops rose 2.5x. Most selections lack enough short plants to
  fill the front band.

That breached the owner's time box (median Z moves more than 0.01), so Steps
1–3 were reverted. The engine keeps engine-final's D28 fallback.

Known limitations on this branch:
- Tall plants can still be centred in front.
- D24 (b), windy 8 x 6 m east view option 1, fails again (tall 5.33 m vs
  short 5.35 m from the viewer).

The likely fix is band-aware selection in Stage 2/3.

## Plant list ordered by spread; sun option re-worded (2026-10-05)

The plan's plant list ran in species-id order, which means nothing to a
reader. It is now **widest first**, so the list runs the way the eye reads the
bed: the structural plants that dominate the layout at the top, ground cover
at the bottom. Plants with no recorded spread sort last rather than as zero,
and the common name breaks ties so the order does not shift between renders.
The card grid below the layout uses the same order.

The Sheltered sun option read "Bright, protected light" while its two
siblings were given in hours ("Six or more", "Three to six"). It now reads
**"Less than three hours"**, and the help text above the question matches.

## Layout review: C1 and C2 implemented (2026-10-05)

Two items from the layout review needed new work; the rest were covered or
are tuning. Both are in the code and **not yet in the workbook** - the edits
to make are written up in `docs/rulebook-changes-2026-10-05.md`.

**C1 - small plants scale with the bed.** A species narrower than 30 cm may
now form larger groups on larger beds: the band's ladder extends along
3/5/7/9/11/15/19/25 up to
`MIN(25, MAX(band max, FLOOR(1 x W x L)))`. It only adds sizes, never removes
one. `speciesInfo` takes the bed area to do this, defaulting to null (the
unscaled ladder) for studies that build a catalogue-wide pool.

**C2 - P17 lateral balance.** f(p) gains a term favouring the third of the
viewer-facing width holding the least canopy. Mean imbalance across 18
layouts fell from **15.2% to 8.9%**, and drifts got *tighter* rather than
looser (2.16 -> 1.75 radii over 147 groups), so B3 is intact.

Two design points came out of measurement and contradict the obvious reading
of the review note, which is why they are worth remembering: counting **all**
placed canopy beats counting the layer's own (per-layer at w = 0.35 was worse
than no term at all, 16.9%), and applying it to **every** plant beats
applying it only to drift starts. The first version written to the note's
wording made balance worse, and the sweep is what caught it.

**Caveat worth carrying.** C1 widens the ladder but Stage 3 still picks n
under H1 and H5, so on a 10 x 6 m fynbos bed the chosen sizes stayed 5/3/3
even with 19 and 25 available. If large drifts are the goal, the binding
constraint is H5 / `k_headroom`, not the ladder.

## H7: a footprint cap on structural plants (2026-10-05)

Rulebook `2a7444dd4274` adds H7 (`5_Stage2_Constraints` row 11): an L1
species may not cover more than phi = 0.25 of the bed on its own,
`pi (s_i / 2)^2 <= phi W L`, which is a 2.76 m spread on a 6 x 4 m bed. The
code now implements it - the workbook had only documented it.

- `footprint_cap` needed a mapping in `import_rulebook.py`; the status row
  imported but the value did not, so `RULES.stage2.footprintCap` was
  undefined. It reads 0.25 now. The mapping is optional, so an older
  workbook still imports and an absent value means **no cap**, never a
  guessed one.
- `runEngine` drops failing species before the search (`y_i = 0`) and logs
  each one with its footprint and the cap. `withinLimits()` also rejects any
  selection containing one, so Stage 3 cannot build around it. Both use
  `exceedsFootprintCap`.
- H7 joins the reported hard checks, so it shows in the plan's trace beside
  H1-H5.
- It is **H7, not H6**, following the rulebook: H6 was the biome cap removed
  on 2026-09-28 and the Change_Log still refers to it.

No testing was run on this, by request - no unit tests, no batch, no
sensitivity. Typecheck and lint pass, and the derived cap reproduces the
rulebook's hand-check figure (2.76 m on 6 x 4 m). **The behavioural effect is
unmeasured**: the rulebook's own note that small beds may lose every L1
species, and with it part of the A3 structure score, has not been checked
against the Block B scenarios. Two further interactions deserve the same
scrutiny when phi is tested - L2 climbers need an L1 host, and a wind-affected
shallow bed needs a windward-row species, which is usually L1-tier.

## P2 revised: overlap is a share of the smaller plant (2026-10-05)

Rulebook `60273b1253ee` changes P2 from

`d_ij >= (1 - delta)(r_i + r_j)`  to  `d_ij >= r_i + r_j - delta * MIN(r_i, r_j)`

with delta unchanged at 0.15, and states the same test as a ratio:
`overlap / MIN(r_i, r_j) <= delta`. The old form scaled the allowance with the
combined radii, so a large neighbour took a large absolute bite out of a small
plant - the false buck-weed beside the Searsia lost about 0.55 m. It now gives
up about 0.1 m.

**Code.** The formula had two independent statements, in `stage4.ts` and in
`layout.ts`'s audit. It now has one, `minCentreDistanceWith` in `layout.ts`,
which `minCentreDistance` calls; placement, the audit, the batch script,
`band_eval` and the Chapter 5 studies all route through it, so they cannot
drift. The rulebook's to-do listed `OVERLAP_TOL` in the batch script as a
separate task - it is not one: that script already calls `minCentreDistance`
and only prints delta in its header.

**Tests.** The P2 unit test now pins the new formula and asserts it is
stricter than the rule it replaced. A second test checks the ratio form on
every pair of every built layout - 3,434 pairs across 18 layouts, worst case
exactly 15.0% of the smaller radius, so the packer sits on the limit and
respects it. 110 unit tests pass.

**What it cost.** Batch feasibility fell from **95/100 to 93/100** with zero
violations - the predicted direction, since small plants now need more room.

**The Chapter 5 re-run was cancelled** (owner decision, 2026-10-05): the
sensitivity study is finished and is not being redone for this change. So
`reports/chapter5_results.md` describes the engine as it was under the old P2,
and its T1 cover figures, the 30 x 30 m finding and the "0 P1/P2 violations"
line in `1_Parameters` D122 were all measured under the superseded rule. The
batch re-run above is the current evidence; cite that, not Chapter 5, for
anything touching overlap or cover.

## Plant photos retry before giving up (2026-10-05)

Cards were showing "No image available" for plants that have a perfectly good
photo URL. The cause was not missing data and not a dead host: 2,828 of 2,843
plants carry a URL (only 15 genuinely have none), and a sample of 100
PlantZAfrica plus 100 iNaturalist URLs all returned HTTP 200, including with a
`localhost:3000` referer, so hot-linking is not blocked either.

The fault was in `PlantPhoto`: `onError` set `failed` once and nothing retried,
so a single dropped or cancelled request left the card blank for the rest of
the session. `pza.sanbi.org` is a single HTTP/1.1 Apache host, which caps the
browser at six parallel connections and turns a gridful of cards into a queue
- exactly where transient failures happen.

`usePhotoRetry` now gives each photo three attempts, 600 ms then 1,800 ms
apart, before falling back to the neutral card. The retry remounts the `<img>`
by changing its `key` rather than altering the URL, because PlantZAfrica's
styled images carry a signed `?itok=` token that a cache-busting parameter
could invalidate. `PlantPortrait` had no error handling at all and would
render a broken-image icon; it now shares the same hook and the same fallback.

Worth knowing for anything server-side: **SANBI returns 403 to non-browser
user-agents.** The images are fine from the browser, but any fetch from the
Worker or a script needs a browser-like User-Agent.

## Plant exclusions (2026-10-01)

The gardener can rule out a plant by hand. An excluded plant is removed in
Stage 0, before anything is scored, so it cannot be ranked, cannot be chosen
and cannot appear in a layout. "Exclude" sits beside **Save** on every plant
card - so the library can be pruned while browsing, before any layout exists -
on each row of the plan legend (so a plant can also be dropped the moment it
is seen in the bed) and in the plant drawer. The Saved page gained a third
tab, **Excluded plants**, which lists them and puts them back.

Four decisions worth recording:

- **It is a preference, not evidence.** The exclusion is a constraint named
  `not-excluded` whose reason says the *user* excluded the plant and whose
  only "source" is their own choice. Nothing is written onto the species: the
  plant keeps its full record and comes back unchanged. This keeps the Stage 0
  trace honest - a hand exclusion never masquerades as a horticultural
  failure.
- **It takes effect immediately.** The three options are a `useMemo` over the
  exclusion set, so ruling a plant out rebuilds all three straight away.
  Pressing Regenerate afterwards is optional, not required.
- **Saved gardens are untouched.** A saved layout is a record of a decision
  already made, so exclusions do not apply when one is re-opened. Otherwise
  saved gardens would silently change as the exclusion list grew.
- **The seed only moves when an exclusion exists.** `planSeed` adds the
  exclusion set to its hashed input *only* when the set is non-empty, so every
  garden saved before this feature still reproduces from its stored seed. A
  test pins that.

Excluding enough plants can push the pool below `N_min` = 15. That was already
the "too few to plan from" state; it now names user exclusions as a cause when
they are genuinely one - counting only excluded plants that would otherwise
have passed the site filters, so an exclusion is never blamed for a plant the
soil filter had removed anyway - and says both that putting some back would
help and that the combination will gain plants as missing light, water and
soil evidence is recorded.

## Location now filters on biome, not bioregion (2026-09-18)

The location step used to set a single `bioregion` and the planner matched
plants by exact equality on it. That filtered on the sparse field: plants
carry a `bioregion` for 23.4% of records against a `biome` for 99.8%, and
only 10 of 25 bioregions contain any plants at all.

Now a place carries **every biome it touches** and a plant is kept if any
of its biomes is one the user has selected.

- `assign_place_bioregions.R` dissolves the source vegetation map by
  `BIOME_18` and assigns each place its intersecting biomes — centroid
  plus a 1 km boundary buffer for settlements and suburbs, all
  intersecting biomes ordered by area share for municipalities and
  districts. Every one of the 1,669 places resolved; 235 span more than
  one.
- `generate_places_json.py` carries `biomes` through, and also does the
  light curation: a word-boundary blocklist
  (`data/scripts/place_blocklist.txt`, 14 airports/industrial/reserve
  points removed) and de-duplication by name keeping the most specific
  category (58 collapsed). 1,597 places ship.
- `GardenBrief` gained `biomes: NationalBiome[]`; `bioregion` is retained
  for display and traceability but no longer filters.
- The `bioregion-affinity` constraint became `biome-match`, using set
  intersection.

**Effect:** for a Southwest Fynbos location the candidate pool goes from
**305 to 2,327 plants** — 7.6×. The guided fixture is unchanged at 3/3/43%
because the binding limits downstream are the sun/water filters, the
species cap and the 2 × 3 m bed, not the location filter.

The UI shows every matched biome with a one-line description, lets the
user deselect any but the last, adds the *"Estimated from the nearest
mapped vegetation"* caveat where `bioregion_source` is `nearest`, and
shows a running *"N plants suited to your area"* count.

## Soil became a real filter; drainage stopped pretending to be one (2026-09-18)

Both the `soil` and `drainage` hard constraints returned a hardcoded
`unknown` for every plant. Under the `review` unknown-policy that meant
**no plant could ever reach "candidate"** — the planner reported 0
candidates and worked entirely off the review pool.

- **Soil is now a real any-match filter** against `Plant.soilType`, which
  the finalised dataset populates for 2,807 of 2,843 species. Choosing
  "I'm not sure" passes everything rather than filtering, because the user
  saying they don't know is not evidence against a plant.
- **Drainage was removed as a constraint.** There is no plant-level
  drainage source and never was, so it could only ever return `unknown`
  and suppress candidates. It is still collected and shown on the plan as
  context; it just no longer pretends to filter.

Candidates went from **0 to 243** for the guided example. The fixture
result is unchanged at 3/3/43%.

The site questions now show a running count after each answer. Below 15
surviving species the app names the restrictive combination and offers a
relaxation, ranked by a fixed cost and **widening the accepted set along
each gradient** rather than discarding the answer:

| Order | Filter | Cost | What relaxing admits |
|---|---|---|---|
| 1st | Soil | 0.276 | selected type + adjacent (sandy ↔ loam ↔ clay) |
| 2nd | Water | 0.316 | selected level + one step wetter |
| 3rd | Sun | 0.408 | full ↔ part only, never part ↔ sheltered |
| — | Biome | ∞ | never relaxed |

**The costs come from the gardener survey (2026-09-29).** Table 3.3's
criterion weights — sunlight 0.257, water 0.199, soil 0.174 — renormalised
over these three filters (sum 0.630) so they sum to 1: the more important
gardeners rated a factor, the more it costs to compromise on it. They
replaced the judgement values 0.137 / 0.239 / 0.625, which produced the
same order but had no source, so this is a provenance change rather than a
behavioural one.

**They are not the engine's scoring weights.** The goal weights remain the
rulebook's equal baseline, and sun, water and soil are hard filters rather
than weighted criteria — Table 3.3 informs this ordering and nothing else.

The order is derived from the costs, not hardcoded, so the interface
cannot drift from the model. A relaxation is only offered when it would
actually recover plants: a sheltered bed is never offered a light
relaxation (it has no adjacent level), and a moist brief is never offered
a water one. Relaxations accumulate on `brief.relaxedFilters` rather than
overwriting the user's answer, so the original brief stays intact and the
plan can say what was widened.

Measured on clay + sheltered + low water: 9 surviving; relaxing soil adds
loam and recovers 25, water recovers 15, sun is correctly not offered.

The cumulative funnel for the test garden: 2,843 catalogue → 2,589 after
safety exclusions → 1,884 after biome → 661 after sun, water and soil.

## Style and colour: soft preferences that rank, never filter (2026-09-18)

`app/lib/planning/preferences.ts` adds the two soft inputs. Neither can
remove a species from the pool — both only add to a plant's score, so
expressing a preference never pushes a well-suited plant below one that
would have outranked it. A test asserts exactly that: with a style and
colour set, every plant's suitability is **≥** its score with no
preference, and the pool size is unchanged.

- **Style** is a weighting profile over plant types and growth habits,
  not a tag on each species — Mediterranean favours shrubs and
  succulents, cottage favours perennials, bulbs and annuals, fynbos
  favours restios, shrubs and graminoids. A small secondary lift comes
  from `special_features`. "Undecided" scores every plant equally, so
  variety and reliability decide instead.
- **Colour** is optional and skipping it is a first-class choice. Warm /
  Cool / Neutral schemes, or a custom picker listing only the atomic
  colours actually present in the user's surviving pool, each with a
  count. A match adds a bonus; a mismatch adds nothing; **a missing
  colour is neutral, never a mismatch**. Multi-colour plants are scored on
  their best match, not an average.

*Superseded 2026-09-21 by Stage 1 (below): the graded style profiles,
best-match colour and the 18/12-point weights were replaced by the
agreed equation.*

Verified that preferences genuinely change the outcome (the
anti-genericness check): holding the site fixed and varying only style
gives four different species sets, and warm vs cool give visibly
different colour profiles.

### Two data bugs found and fixed

- **`flowerColour` was a string, not an array.** The multi-value parse
  built the array, then a later line overwrote it with the raw cell, so
  every colour read as one blob. Fixed; the catalogue now yields exactly
  the **12 atomic colours** the spec expects.
- **58 mis-encoded text values in the workbook.** `FINAL.DATASET.FINAL.xlsx`
  contains UTF-8 read back as cp1252, so "tailor's patches" arrived as
  "tailorâ€™s patches" in 45 plant names. Repaired at the import boundary
  in `import_final_dataset.py`, guarded so a genuinely accented name is
  never mangled. Zero remaining.

## Optional extras (2026-09-18)

Five optional preferences on one screen, all multi-select, all soft:
low maintenance, privacy/screening, flowers & pollinators, fragrance,
attract wildlife.

Every one reads **only `special_features`** — no other column stands in
for them. Coverage in the recommendable pool of 2,589: drought
resistant 768, feeds honeybees 740, attracts birds 481, fragrant 441,
attracts butterflies 333, pioneer 142, hedge/screen 148. **32.4% of the
pool carries no recorded features at all**, and the tags are positive
flags only, so a preference promotes what matches and never penalises
the rest. A test asserts no plant's score drops when extras are selected,
including the untagged.

Two supporting fields were missing from the app and are now carried
through: `gardeningSkill` (2,020 records) sharpens low-maintenance, and
`floweringSeason` (2,738) sharpens pollinators. Neither is a primary
source.

**Privacy is the thin one and the interface says so.** Only 148 species
in the pool carry `Hedge/screen`, and within that set plants are ranked
by height — a 30 cm "hedge" screens nothing, so the score scales to full
at 2 m. If fewer than three screening species survive the user's site
answers, the screen says so plainly rather than quietly ignoring the
preference. For the guided test garden, 15 of 661 surviving species
screen, so the caveat does not fire there.

Extras add at most 15 points against the goal score's 0–100, alongside
style's 18 and colour's 12 — all provisional until spec 8.4.

## Three results, saved gardens and the results view (2026-09-18)

**Three layouts, distinct by design.** `buildGardenPlanVariants` returns
*Most colourful*, *Lowest maintenance* and *Most structured*. Each profile
multiplies the user's own soft preferences **and** applies a criterion of
its own — colourfulness, drought-hardiness, structural growth habit —
because a brief expressing no style, colour or extras would otherwise
multiply zero by three different weights and produce three identical
layouts. That was a real bug, caught by running it.

**Reproducible without being uniform.** `planSeed()` hashes the whole
input vector (biomes, site answers, bed, density, style, colour, extras,
goals, relaxations, saved plants, variation counter) with FNV-1a. The same
answers always rebuild the same three layouts; "Regenerate" increments the
counter and deliberately produces a different set. The seed feeds a
sub-point tie-break that is **deliberately excluded from `suitability`** —
ordering may depend on the seed, but the score a plant is judged on must
not, or a soft preference could appear to lower a plant's standing.

**Saved plants** get a 25-point nudge, applied to the score and never to
feasibility — so a favourite that fails a site constraint stays excluded.
Verified: a saved plant rises to rank 1 of 2,843, and a saved plant that
fails the light check stays `excluded`.

**Saved gardens** persist under the versioned `garden_tool_v1` key with a
migration path from the old unversioned keys, each stored with its
creation date, seed and variation counter so it reopens identically.

**The results view** now carries: the north arrow, circles filled with
each plant's flower colour at 50% transparency, **dashed edges for
estimated spread or unknown colour** with a caveat explaining both, a 1 m
scale bar, grouped and de-duplicated care instructions, a "why these
plants" summary, and a plant list with photo, attribution, licence,
both names, quantity, height and spread. Photos carry an `onError`
fallback to the same neutral card used when no photo exists — they are
hot-linked, so a moved file 404s at runtime even when `photoUrl` is set.

The guided fixture moved to **8 plants / 5 species / 39% open space**: soil
becoming a real filter plus the seeded tie-break lets the selector fill the
bed rather than stopping at three.

## Stage 1: the plant score (2026-09-21)

The ad-hoc points scale (goal 0-100 + style 18 + colour 12 + extras 15 +
saved 25) is replaced by the agreed Stage 1 equation:

`raw_i = 0.637 style_i + 0.105 colour_i + 0.258 extras_i + 0.105 saved_i + 0.637 W_site windres_i`,
`score_i = raw_i / raw_max`, raw_max = sum of the ACTIVE terms' weights
(0 when nothing is chosen, in which case every score is 0).

- Code: `stage1.ts`; every number in `stage1Config.ts`; wind resilience in
  `windRules.ts` (the stub is gone). Each assessment carries the full
  breakdown (`stage1`: score, raw, rawMax and every term).
- Style mapping (agreed, owner's garden-style rules): Fynbos = recorded
  biome Fynbos, any plant type; Mediterranean = shrub, succulent, tree,
  ground cover or climber; Cottage = perennial, bi/annual, bulb,
  geophyte, shrub, climber or scrambler.
- Low shrub = shrub with height_cm <= 100 (ASSUMPTION). A shrub with no
  recorded height is not assumed low.
- Colour schemes drop violet and grey (not in the dataset); Wildlife is
  birds only. Both owner decisions.
- The old graded style profiles, best-match colour, and privacy-by-height
  grading were removed - they were not agreed.
- The three result tabs still differ by a result-profile nudge (weight
  0.2) that sits OUTSIDE the Stage 1 score. It is pre-Stage-2
  scaffolding, to be replaced when Stage 2/3 define diversity.
- Guided example moved 9/6/32% -> 16/7/30%: that brief activates no
  term, so order now comes from the seeded tie-break alone.

## Pre-pilot design pass (2026-09-22)

Background art removed (files deleted); home page redesigned to the
owner's layout with her crayon flower sketch (also the site icon); area
compulsory at step 1; results labelled Option 1-3 with their scores;
saved plants badged in layouts; Sketchbook / Real-life layout views
(Real-life fills circles with species photos); saved gardens store the
plan and the budget line; the budget line states which plants it leaves
out.

- Step 1 map pins every enabled nursery branch from 2_Branches
  (`/api/nurseries`, geocoded live and cached). Not mappable, listed
  beside the map: ClicknPlant (online only), Prime Trees (no address).
  7 of 15 pins sit at their town centre because OpenStreetMap did not find
  the street address.
- Sketchbook circles carry the owner's plant-type symbols at 50% opacity.
  A species with several types gets the type it was PLACED for - the one
  that decided its layout layer (`roleTypeOf` in engineData.ts): tree
  first, then specialist, climbing, matrix, seasonal, carpet, fern, then
  shrub / succulent / perennial.

## Live nursery sourcing (2026-09-22)

Driven by `Nursery_Sourcing_Search_Spec.xlsx`; replaces the retired weekly
scrape. Each layout gets a "Where to buy" panel (also in the plant detail
drawer): per listing nursery, distance and band, size class, per-plant
price, stock, link, date checked, match label and snapshot note, plus the
bed budget (Low / Typical / High from the Standard class), coverage,
outdated-price count, single-nursery basket and walk-in-only nurseries.

- Live sources: Cape Garden Centre and Plantify (Shopify), ClicknPlant
  (WooCommerce), Stodels and Tulbagh (platform "TO CONFIRM" in the
  workbook - auto-detected as WooCommerce). Harry Goemans: walk-in only.
- PDFs parsed: Garden Route 339 rows, Kraaibosch 443, Samgro 82,
  Prime Trees 76. They are skipped until 3_PDF_Sources gets a
  "source id" column (owner to add).
- Owner decisions: server route with the live workbook locally and a
  snapshot when deployed; old scraper retired; PDFs linked by a source id
  column; unconfirmed platforms auto-detected.
- Rulebook note: the rulebook changed again (9ac463ee3735) - Mediterranean
  cover 0.6-0.8 (was 0.5-0.7). The hand check now gives A4 = 0.862 and
  Z = 0.745; the test reads cover_min from the rulebook.

## Rulebook f378049c487c integrated (2026-09-22)

The test-run-1 decisions are now written into Algorithm_rulebook.xlsx, and
the engine reads them from there (engineConfig.ts takes each from RULES,
labelled with its cell): placement_fail_limit, retry_cover_factor,
row_pitch, placement_restarts, random_tries_per_plant, delta,
k_headroom (revised) = 2.0, size_var_min = 3, feature_threshold,
feature_list (revised); shade ON HOLD.

Engine changes it brought: G3 in thirds with a size-variety term
(D_min_effective); the fail rule now leaves a species out after two
failed placements and retries at 90% of the failed cover (the old
"drop the lowest-scoring group" is superseded). Hand check re-run: A3 =
0.889, Z = 0.758 (was 0.770) - update 9_Hand_Check to match.

Group sizes now: A 3,3,5,5,7,7,11,11 / B 1,3,3,3,3,5,7 / C 3,3,3,3,3,5 /
D 3,3,11 / E 3x10,5,7. All 75 unit and 6 render tests pass.

Open: the rulebook's H4 now defines a feature plant by SIZE alone; the
engine still requires list AND size (owner's earlier choice) via
engineConfig FEATURE_REQUIRES_LIST. Size alone makes 38% of layout-ready
plants features, with H4 allowing one per bed.

The sync now works from a temporary copy of each workbook, so an open
Excel file no longer blocks it.

## Test run 1 decisions applied (2026-09-22)

All in `app/lib/planning/engineConfig.ts`, labelled by rulebook ID:
fail rule / row pitch 1.2 m / 6 restarts x 240 tries / climbers need an
L1 host kept; smallest groups only until S_min, then every size;
P2 overlap tolerance 0.15 (placement and overlap checker alike; the
formula it feeds was revised 2026-10-05, see below); shade
switched off (no shade term, no P14 - hand check stays 1.4235 / 0.811);
feature plant = on the list AND > 150 cm tall or > 100 cm wide, no family
rule, Podocarpus falcatus and Cyathea dregei removed; windward = south and
east edges, P11 length test only; NEMBA hook reads
app/data/nemba_exclusions.json (now populated, see below); the fixed
guided garden replaced by five regression briefs.

**F4 is a live check again (2026-09-24).** `app/data/nemba_exclusions.json`
had an empty `species[]`, so the run-time invasive check excluded nothing:
the catalogue's invasives had been removed upstream by the retired
`combine_plant_database.R`, and nothing in the running app verified it.
`data/scripts/build_nemba_exclusions.py` now rebuilds the file from
`data/raw/InvasivePlants.txt` (1,077 binomials; genus-only entries are
deliberately skipped, since `onExclusionList` matches by prefix and would
otherwise exclude indigenous congeners). Two tests in `tests/engine.test.ts`
hold it: a listed species put through the engine fails F4, and no species
in the shipped catalogue is on the list — it currently passes with zero
matches, confirming the upstream removal held. Still open: that file is an
alien-taxa checklist, **not** the gazetted NEMBA notice, which remains
untranscribed (`data/sources.json`, `nemba-invasive-list-2020`).

## H3 revised: who may be a group of one (rulebook 45dc005091c3, 2026-09-30)

The rulebook widened H3. A group of one is now allowed for:

- the **feature plant**, in any spread band (unchanged), and
- any plant in **spread band 2 or 3** whose layer is **not** Matrix (L3)
  or Fill (L4) - those keep a minimum of three, because their job is to
  read as a drift rather than a single specimen.

Band 1 (the narrowest spreads) is unchanged: 1 stays feature-only. So a
lone plant can appear only in L1, L2, L5, L6 or L7. Implemented in
`speciesInfo` (`app/lib/planning/engineData.ts`), which builds `allowedN`
from the band list, the layer and the feature flag. **1,437 of 2,843
species may now form a group of one**, against a handful before.

Two tests hold it: one pins `allowedN` per band, layer and feature flag;
one checks H3 honours whatever sizes a species allows.

### KNOWN CONSEQUENCE - the optimiser now prefers single specimens

Allowing n = 1 across half the catalogue changed what Stage 3 selects. On
the regression briefs:

| Brief | Group sizes now | Total plants |
|---|---|---|
| A fynbos 6 x 4 | 1,1,1,1,1 | 5 |
| B mediterranean 8 x 5 | 1,1,1,1,1,1 | 6 |
| E fynbos 12 x 8 | 1,3,3,3,1,1,3,1,1,1 | 18 |

Across the 100-scenario batch, **28 of 96 successful plans are entirely
single plants**, and the median is 2.0 plants per species where a drift
would be 3.

Z went **up** (brief A 0.9450, B 0.9800, E 0.9841): singletons maximise
species count, which lifts the variety and colour goals, while cover is
met by fewer, larger plants. The optimiser is doing exactly what the
goals reward. Nothing is broken - H1-H5 hold, the batch stays at 96/100
with zero constraint failures - but a Mediterranean bed of six lone
plants is not the drift planting the rulebook describes elsewhere.

**Regression briefs A and B now fail TR1-2** ("groups must not all be the
same size") because every group is size 1, and brief E fails the
k_headroom check for the same reason. Left failing and recorded here
rather than weakened, per the regression contract. This needs an owner
decision - the options are to cap how many species may be singletons, to
require at least one drift of three or more per bed, or to let G3 penalise
a bed whose groups are all the same size more strongly than it does now.

## Dataset e5d14caf5ca0 imported (2026-09-30), and what it moved

The dataset workbook had been edited at a DIFFERENT path
(`OneDrive - Stellenbosch University/FINAL.DATASET.FINAL.xlsx`) from the
one the sync reads (`Skripsie/FINAL.DATASET.FINAL.xlsx`), so 12 days of
corrections were not reaching the code. The newer file is now in place;
the superseded one is kept beside it as
`FINAL.DATASET.FINAL.superseded-2026-09-18.xlsx`.

**The import also had to change.** The workbook grew from 3 sheets to 23,
and `FINAL_DATASET` is no longer the first one, so reading `sheet1.xml`
returned the new `Summary` tab and **zero species**. The import now
resolves the sheet **by name** through `workbook.xml`, which makes it
independent of tab order. Only `FINAL_DATASET` is read; the DQ, audit and
report tabs are ignored.

What changed in the data: **95 spread values, 71 heights**, one species'
flowering months (Tinnea barbata) and one water level (Searsia lancea,
moist -> low). Many of the changed cells are now `expert-estimate` rather
than `lookup` or `imputed_genus_median`. Four new columns arrived
(`height_class`, `height_cm_original`, `spread_cm_original`,
`expert_verification_required`); they are carried in the processed CSV but
not yet surfaced on `Plant`.

**Regression brief B now fails TR1-2** (8 x 5 m Mediterranean): it returns
five groups of three, so the groups are all the same size. This is a
consequence of the new spreads, not a broken rule - H1-H5 all pass, cover
is 0.686 inside the 0.60-0.80 band, and the diagnostics show the fail rule
retrying at 69% cover after a placement failure. The wider corrected
canopies mean an upsized group can no longer be packed. Brief E has failed
the same check since test run 1 for a different reason (H5). Left failing
and recorded here rather than weakened, per the regression contract; it
needs an owner decision on whether TR1-2 should hold when the fail rule
has had to cut back.

## Pilot round 1 — test results and parameter decisions (2026-09-30)

Six studies, each a committed script so the numbers stay reproducible:
`npm run study:nmin`, `study:pool`, `study:capacity`, `study:tiers`,
`study:sensitivity`, `study:bands`, plus the hand-check cases in
`tests/engine.test.ts` and the 100-scenario `test:batch`.

### N_min = 15 — KEEP, and upgrade from ASSUMPTION to TESTED

`study:pool` took the 41 combinations whose pool is 15-25 species and
planned a bed from every area band, with the pool cut to 10, 15, 20, 30
and uncut:

| Pool cut | Band 1 (3x3) | Band 2 (6x4) | Band 3 (10x10) |
|---|---|---|---|
| 10 | 41/41 | 41/41 | **27/41** |
| 15 | 41/41 | 41/41 | 41/41 |
| 20 | 41/41 | 41/41 | 41/41 |
| 30 | 41/41 | 41/41 | 41/41 |

Every plan that was produced passed H1-H5 at every cut. **Layouts hold at
15 and fail at 10 on the largest band**, which is exactly the condition
set for justifying the value. Tying N_min to S_min is NOT needed: band 3
does not fail at 15. Note the convergence - 1.5 x S_min for band 3 is
also 15 - so a flat 15 and a band-scaled rule agree at the only band
where it matters.

Z rises slightly with a bigger pool (band 3: 0.4394 at 15, 0.4543 at 20,
0.4573 at 30), so 15 is the feasibility threshold, not the quality
optimum.

### T0 — record 0.069, and leave the rulebook cell EMPTY

The code derives it: T0 = 0.05 x Z / ln2 = 0.0721 x Z, so a move making Z
5% worse is accepted about half the time at the start. Measured over 13
runs: min 0.0617, median 0.0691, mean 0.0688, max 0.0721.

Record 0.069 as the observed value but do not fill `t0` in the workbook.
The code reads `RULES.stage3.t0 ?? derived`, so filling it replaces the
formula with a constant, and a weak bed (generic 4 x 2, T0 = 0.0338)
would then anneal roughly twice as hot as intended.

### Everything else the pilot round established

- **Stage 1 barely discriminates.** Over a 1,128-plant pool there are only
  3 to 27 distinct scores, and in one brief **576 plants tie at exactly
  1.0000**. Moving any Stage 1 weight by +/-20% changes neither the top 20
  nor the top plant - not because the weights are robust but because the
  terms are binary and the score space has collapsed. This is the most
  significant finding of the round, and it explains the "options too
  alike" result from the batch test. lambda cannot reorder plants at all
  (Stage 2 only); Z moves by |S_bar - G| x 0.2 at +/-20%.
- **Annealing is mistuned but earning its place.** alpha = 0.95 puts T
  below 1% of T0 after 90 iterations, so 95.5% of the 2,000 are effectively
  hill-climbing. It still improved Z in 10 of 13 runs, mean +0.018, best
  +0.056. Open item: alpha ~ 0.998, or cooling per block.
- **Capacity is limited by packing, not arithmetic.** The rules allow
  cover_min on every bed size, but a real 30 x 30 m run reached 0.60
  against a 0.75 cover_min. The cause is band 3 allowing 20 species while
  the widest spread band caps a group at 3 plants.
- **G1 tier targets are reachable** in 95.4% of combinations for every
  style; when a plan is thin it is pool size, not the tier mix.
- **Relaxation is a feasibility tool, not a quality one.** Of 24 cases,
  8 had no plan until a filter was widened; where both sides planned, Z
  rose in 8 and fell in 8, mean -0.0016. Soil was offered first in 21 of
  24, as the cost ordering intends.
- **Per-layer depth bands: do NOT adopt as tested.** They fix the L1
  occupancy overshoot (3.31 -> at most 1.01) but make the outcome
  seed-dependent: on one bed the plants placed ranged 1-22 across ten
  seeds (sd 9.62) where the current single band gave 22-22 (sd 0).
  band_min made no difference anywhere over 0.20-0.40.
- **Unknown evidence now excludes** (2026-09-29). Median pool 184 -> 94,
  cases below N_min 3.0% -> 8.1%, batch feasibility 98 -> 97 of 100.

### Open discrepancy to settle in the workbook

`random_tries_per_plant` is 240 in the rulebook, but Stage 4 draws
`retryBudget / 4` = **60** random candidates per plant per restart, then
adds the tangency contact set. Either change the code to use the full 240
or record in the rulebook that a quarter of the budget is drawn randomly.
Candidate positions are a HYBRID of random draws and tangency points, not
tangency-based alone - Chapter 2 needs that wording.

## Viewing edge (owner decision, 2026-09-28) — implemented

The brief gained `viewingEdge` ("north" | "east" | "south" | "west"),
asked for at the bed-size step as a compass picker under the bed preview.
It answers the gap noted in the layout review: the engine had assumed the
gardener stands at the north edge, so "tallest at the back" was only right
for north-viewed beds.

**What it moves, and what it does not.** `viewingAxis()` in `stage4.ts`
measures layer depth from the chosen edge, and that is the only thing it
changes. Map coordinates are untouched — x still runs from the west edge,
y from the north — so the windward row, P3–P13 and every compass-based
check keep working exactly as before. **Wind does not care where anyone is
standing**, and the code says so.

**Only one of the three options uses it** (the owner's call, better than a
global rule): the lowest-scoring option is re-run with the viewing edge as
its front, the other two keep the rulebook's north assumption, and that
option carries a diagnostic saying which it is. This also gives the three
options a real reason to differ, which is the "options too alike" finding
from the batch test.

**The sun conflict is left visible rather than resolved.** Viewing from
the south puts tall plants on the north edge, where the sun comes from, so
they shade the bed. The rulebook has no rule for this; showing both
arrangements side by side is what lets it be judged. If a rule is wanted
later, it belongs in the rulebook, not in the code.

The drawing is **not** rotated: north stays at the top so the plan still
matches the real garden, and the chosen edge is labelled "you stand here".
Gardens saved before this input default to north.

## Biome expansion — PARKED (owner decision, 2026-09-28)

The rulebook's biome-expansion rule (add the biomes within 5 km, then
15 km, before relaxing any filter; `delta_biome` penalty on added
species; `biome_cap` as H6; V6 stop-and-warn) is **out of scope for this
app for now**. Nothing was ever built for it, so nothing was removed —
`delta_biome`, `biome_cap`, `r_expand_1` and `r_expand_2` arrive from the
workbook as status labels only and no code reads them.

**Why it stopped here.** It was blocked on data, not on effort: V1 and V2
need the biomes within 5 km and 15 km of a place, and the app's place
records carry no coordinates at all (`name`, `category`, `biomes`,
`bioregion`, `bioregionSource`). Producing them means extending
`assign_place_bioregions.R`, which does hold the geometry. Everything
downstream — the engine reading the settings, V6, the cap and radius
sensitivity runs — waits on that one output.

**The rulebook and the code still agree numerically**, which is why this
is safe to park rather than a divergence to flag in the report:
`4_Stage1_Score A6` is `score_i = MAX(0, raw_i / raw_max − delta_biome ·
added_i)`, and with no expansion `added_i` is always 0, so it reduces to
the `raw_i / raw_max` the code computes. H6 is likewise vacuous when no
species are added. The hand check is unaffected.

**To revive it**, in order: emit the 5 km / 15 km biome lists from the
location script; map the four parameters in `import_rulebook.py`; then
implement V0–V6 and H6. Until the first of those exists, the rest cannot
be tested. Rulebook rows describing the rule should be marked as
specified-but-not-implemented so the report does not claim behaviour the
tool does not have.

## Stages 0-4 built from the algorithm rulebook (2026-09-22)

`Algorithm_rulebook.xlsx` now drives the whole engine. It syncs like the
dataset (`import_rulebook.py` -> `engine_rules.generated.json`, version
stamped on saved gardens). Built: Stage 0 F5/F6/F9, the Stage 1 shade
term, Stage 2 H1-H5 / A1-A5 / Z, Stage 3 greedy + local improvement +
annealing, Stage 4 layered L1-L7 placement with Option C and P1-P14.
The rulebook's hand check is reproduced exactly in a test (Z = 0.76957).

Owner decisions applied: F5 without wind; spread bands = dataset
terciles (39 / 100 cm); no-wind beds keep L1 at the back; three results =
top 3 distinct by Z.

Implementation choices to confirm (not in the rulebook):
- Fail rule converges by also (a) leaving out a species that failed to
  place twice and (b) re-searching with a packing cap of 90% of the cover
  that failed - circles cannot pack Cottage's 85-90% cover.
- Species enter the greedy start at their smallest group until the H2
  floor is reached, with a look-ahead so the floor stays reachable.
- Placement: contact-point packing, 6 restarts, retry budget 240.
- Row pitch 1.2 m (top of the rulebook's 1.0-1.2 m) for rows_available.
- Climbers need an L1 host in the selection (placement rule L2).
- Guided example moved 16/7/30% -> 9/3/41%.

## Dataset auto-sync (2026-09-21)

Editing `FINAL.DATASET.FINAL.xlsx` no longer needs manual pipeline runs:
`sync_dataset.mjs` runs before `dev` and `build`, rebuilds the catalogue
only when the workbook's hash changes, and stamps the version
(`fd9ad1dabe6a` at setup, 2,843 plants) onto every saved garden. Restart
`npm run dev` to pick up an edit made while it is running. The algorithm
CSV will be wired the same way when it arrives.

## Nursery sourcing

Added 2026-09-12. A weekly GitHub Actions job
(`.github/workflows/nursery-sourcing.yml`) runs
`data/scripts/sourcing/scrape.py`, matches each nursery's catalogue against
the plant database, writes `data/processed/nursery_sourcing.csv`, and folds
it into the generated catalogue via the existing
`generate_plants_json.py`. It never runs at request time — the app has no
backend.

- Matching is a tiered cascade (scientific name → common name → family),
  short-circuiting on the first hit; only high (scientific) and medium
  (common name) confidence matches render in the UI. Family-tier matches
  exist only to disambiguate an ambiguous common name and are never shown
  as a species-level match.
- Only two sources are live: Stodels and Cape Garden Centre (both
  e-commerce, so both can carry a price). The other eight nurseries in
  scope are listed but inactive in `data/scripts/sourcing/sources.py`
  pending an adapter each.
- **The Stodels adapter is unverified against the live page.**
  stodels.com sits behind bot-management that returned 403 to every
  research fetch while this was built, so its HTML selectors are a
  best-effort guess (with a Shopify-JSON attempt tried first). If the
  weekly run logs "extracted zero listings" for `stodels`, that's the
  expected symptom — inspect the real markup from an unblocked connection
  and fix `data/scripts/sourcing/adapters/stodels.py`.
- A failed or empty scrape for a nursery keeps that nursery's previous
  rows rather than blanking its listings.
- The UI never claims live stock — "Listed at"/catalogue language only,
  always with the last-successful-scrape date and a prompt to phone ahead.

**The sourcing note does not currently appear in any plan.** The pipeline
is wired end-to-end and verified (a live run matched ~14–25 real listings
with real prices, and the note renders from that data), but the matched
species and the plannable species barely overlap:

- Only 212 of 2,843 plants have a `spreadCm` value at all, and the
  quantities/layout stage needs one as its capacity proxy — a plant
  without it fails `canopy-fit` and never reaches a layout.
- None of the currently matched nursery species have a spread measurement
  paired with everything else the planner needs. A search over all 810
  bioregion × sun × water × soil × drainage briefs (on a generous 6 × 6 m
  bed) placed a sourced species **zero** times.
- So the feature is correct but presently unobservable in the plan output.
  It will start appearing on its own as "Next evidence work" item 1
  (sourced tolerances and reviewed mature spacing) fills in spread values
  for common garden species — which is exactly the set nurseries stock.
  No code change is needed for that; it is a data gap, not a wiring gap.

## What remains provisional

- Plant-level soil and drainage compatibility are missing.
- Sun, water and bioregion are sourced (BioSCape occurrence data and
  PlantZAfrica horticultural profiles) but not expert-reviewed, and are
  missing for a meaningful share of plants (about 29% lack sun, 27% lack
  water, 77% lack a *specific* bioregion) — shown as "unknown," not guessed.
- Most plants (77%) only have the coarser biome-level match, not a specific
  bioregion — real evidence (they share a biome with the Western Cape) but
  weaker than an actual Western Cape occurrence record; each plant's
  `bioregionSource` records which applies ("occurrence" vs "biome-only").
- Garden-use labels (goals) are only auto-derived for "flowers," from a
  recorded bloom window or colour; the rest need manual curation.
- Field-canopy medians are not reviewed nursery spacing.
- Equal AHP weights are not expert priorities.
- Open-space and maximum-species defaults are interface settings, not
  horticultural standards.
- Density-based plant-count ceilings prevent implausible quantities but are not
  reviewed spacing guidance.
- The 15 cm spacing-evidence floor and layer ratios are defensive prototype
  rules, not horticultural thresholds.
- The greedy selector and shelf packer are deterministic constructors, not
  global optimisers.

## Next evidence work

### 1. Horticultural enrichment

For each plant, add sourced soil, drainage, light, water, mature spread and
spacing values with confidence and review status.

### 2. Expert calibration

Collect pairwise comparisons, accept only an AHP matrix with `CR < 0.10`, then
review the Goal Programming targets and penalties.

### 3. Composition rules

Define plant roles, category minimums/maximums, density defaults and expected
plant combinations with a Western Cape horticultural reviewer.

### 4. Reviewed garden cases

Create feasible, infeasible and missing-evidence fixtures. Compare the app's
group, quantities and coordinates with expert expectations.

### 5. Algorithm refinement

Only after reviewed cases exist, compare the current deterministic phase-one
constructors with Simulated Annealing or another justified search method.

## Technical debt to revisit

- **Client bundle size.** `app/data/plant_database.generated.json` (~2.2 MB)
  and `app/data/bioregion_map.generated.json` (~165 KB) both ship to the
  browser in full via `app/data/plants.ts`/`GardenApp.tsx`, even though most
  fields (photo URLs, attribution, the `note` description) are only needed
  once a plant card or detail view actually renders, not for filtering.
  Splitting this into a lean index (names, bioregion, sun/water) plus
  per-plant details fetched on demand would meaningfully shrink the initial
  load and stop the bundle growing 1:1 with dataset richness. Not done yet —
  real engineering effort (fetch mechanism, loading states), deferred until
  it's actually causing a felt problem rather than a theoretical one.
  `generate_plants_json.py` and `generate_western_cape_map_svg.py` already
  write compact (non-pretty-printed) JSON as a smaller, no-risk interim step.

## Input needed from the user

- Help identify or reach a Western Cape horticultural reviewer.
- Approve the final garden questions and plan presentation.

## Not now

- Accounts or cross-device history
- Nursery stock, prices or purchasing
- Irregular or multi-bed geometry
- Computer-vision site measurement
- Ongoing garden-care diaries
- Nationwide coverage (see scope history below)

These do not improve the credibility of the current plan and remain outside the
MVP.

**Scope history:** nationwide coverage was "not now" until 2026-08-10, went
into scope for a week (a national 9-biome system, a South Africa map, real
national biome data), then came back out on 2026-08-17. In practice, national
scope diluted the catalogue more than it helped — species tagged Savanna or
Indian Ocean Coastal Belt (neither of which occurs in the Western Cape)
outnumbered real Western Cape flora, and BioSCape's occurrence sampling was
always Western-Cape-focused, so "national" mostly meant thinner evidence
spread over a bigger, less relevant map. Reverting to the Western Cape
unlocked something the national version couldn't have: real **bioregion**
detail (SANBI's own finer classification, e.g. "Southwest Fynbos" vs just
"Fynbos") and a map at a scale where that detail is legible. The clickable
map now shows Western Cape bioregions (`BioregionMap` in
`GardenApp.tsx`, `data/processed/western_cape_bioregions.geojson`), not
national biomes. A species that was only ever recorded outside the Western
Cape (e.g. in Baviaanskloof, Eastern Cape) is still kept if it shares a
biome with somewhere in the Western Cape — that part of the national work
wasn't wasted, it's what tier 2 ("biome-only") matching is built on.
