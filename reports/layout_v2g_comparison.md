# layout-v2g: last-resort fill (v8, v8b)

Rulebook **713f9bad5bec** (frozen), dataset **1e15fe4470f8**, same seeds.
The runs cover the 100 batch briefs plus the fixed case, every option.

Branch `layout-v2g` starts from `layout-v2f`. The dataset switch commit
03083d3 (to `FINAL.DATASET.FINAL.the correctone.xlsx`, the owner's correction
of 46 records) landed on this branch during the work. So every config below, v7 included, was
re-run on the new dataset. These rows are **not** comparable with the
layout-v2b–v2f reports, which used dataset 6c081d3d2f60.

The device shell has a time limit, so each config ran in two parts
(`V2D_SLICE=0:50` and `50:`) and the CSV and JSON files were merged.
`v2d_v8_ds6c08.*` is an early v8 run on the old dataset, kept for reference
only.

## What changed (config only, `RELAX.lastFill`, default off)

**v8 = v7 + a last-resort fill.** After relaxation and the v7 gap fill, plants
keep being added into the empty ground that is left. Each round:
- finds every gap;
- tries its points from the roomiest down, against the candidates in Stage 1
  score order;
- adds the first plant that fits.

It repeats until a round adds nothing, or 200 plants are added.
- **Nothing placed moves.**
- Candidates are the plan's own species, under the same limits as v7: H3
  maximum, H5 cap, and within 10 cm of their own group.
- Every added plant must:
  - touch nothing and stay inside the bed (P1/P2);
  - keep P4/P5, the tree rule and its depth tolerance;
  - keep total canopy area within cover_max (H1).
- Z and H1–H7 stay those of the Stage 2/3 selection.

**v8b = v8 + pool species (`lastFillPool`).** If the plan's own species can't
fill a spot, the 20 best-scoring pool species the plan did not select may be
tried. The H2 ceiling is kept. A new species enters as one plant, and any more
of it must join that plant. Its depth target is the d* of the selected species
nearest it in height.

## Result

| Metric | v7 | v8 | v8b |
|---|---:|---:|---:|
| Briefs feasible (of 101) | 94 | 94 | 94 |
| Options feasible | 275/282 | 275/282 | 275/282 |
| Median Z (identical per option) | 0.8994 | 0.8994 | 0.8994 |
| **Cover (median)** | 0.678 | 0.685 | **0.706** |
| Options with cover ≥ 0.75 / ≥ 0.80 | 57 / 19 | 63 / 20 | 76 / 26 |
| **Largest gap (median)** | 0.130 | 0.118 | **0.090** |
| 95th-pct gap, cm (median) | 46.2 | 42.7 | 35.6 |
| 1 m-cell cover variance (median) | 0.0470 | 0.0440 | 0.0341 |
| 9-cell cover, min (median) | 0.357 | 0.388 | 0.429 |
| Loose drifts (share > 10 cm from a group-mate) | 0.087 | 0.077 | 0.067 |
| Plants added by v8 (options with any) | – | 723 (132) | 2,917 (228) |
| … of species the plan did not select | – | 0 | 2,254 |
| New species per option (median / max) | – | – | 2 / 10 |
| New species entering as a single lone plant | – | – | 369 of 739 |
| Tall (≥ 80 cm) centred in front (total) | 797 | 811 | 899 |
| Trees centred in front (straight edge) | 37 | 37 | 37 |
| Hard failures / plants outside the bed | 0 / 0 | 0 / 0 | 0 / 0 |
| 12-case layering test | 11/12 | 11/12 | 12/12 |
| D24 (b) east, option 1 | pass | pass | pass |

v8b passes 12/12 only because the extra short plants pull the mean depth of
the short plants forward. It does not fix the east-1 failure, which is a
dataset effect (see below).

## Reading it

- **v8 is safe but small.** On the median option it adds nothing: the plan's
  own species are already at their H3 maximum or H5 cap, or have no room
  beside their group. Where it does add plants, they extend existing drifts.
  Cover rises by 0.7 points and the largest gap shrinks from 0.130 to 0.118.
- **v8b fills more, but changes the plant list.** Cover rises by 2.8 points
  and the largest gap falls by a third (0.130 → 0.090). But 77% of the added
  plants are species the optimisation did not choose, and half of those new
  species are a single small plant. In the figures they show as scattered dots
  at the bed edges. This puts the goal-programming selection, H3b (single
  plants) and the shopping list and price outside what Stage 2/3 controls.
  Tall-in-front also rises from 797 to 899.
- **Neither gets near 95–100% fill.** Non-overlapping circles cap packing; the
  densest regular packing of equal circles covers about 91%. The fill also
  stops at cover_max, H3/H5 and the depth bands, which is by design.

## Dataset switch (found during this work)

With dataset 1e15fe4470f8, v7 itself fails:
- the 12-case test (east 1: tall 4.05 m vs short 5.08 m from the viewer);
- three unit tests in `tests/engine.test.ts`: "every option is laid out from
  the viewing edge", "D24 (b)…" and "D24 (c)…".

The same failures occur on a clean export of 03083d3 without the v8 code, so
they come from the dataset switch, not from v8. The two new tests (v8 and
v8b: nothing moves, Z unchanged, added plants touch nothing, hard checks hold,
within cover_max) pass. With `lastFill` off, which is the default, the engine
behaves exactly as v7.

## Figures

`reports/figures/layout_v2g/{v8,v8b}_{S001,S006,FIX}.png` show v7 (left)
beside v8 or v8b (right), for the same brief and seed. "No plant moved" in each
title confirms the approved layout is untouched.

## v9: open fill (only H2 dropped)

`RELAX.openFill` is off by default. It was built in a parallel session. The
10:44 full run is stale, because the code changed at 10:48; it is kept as
`v2d_v9_stale_0844.*`. `v2d_v9.*` merges three parts run on the current code:
p1 = briefs 0–49, p2a = 50–75, p2b = 76–100 with the checks. Dataset
1e15fe4470f8.

How v9 fills:
- It only adds, after v7. Nothing that is already placed moves.
- It ignores the H2 species ceiling and no other rule. After every addition,
  H1, H3b, H4, H5 and H7 must hold.
- Candidates are the whole ranked pool, bar feature plants, climbers, the
  windbreak species and fail-rule drops.
- The biggest gap is filled first. In each gap, the best Stage 1 score wins
  among the plants that fill it well (radius ≥ 0.5 × the gap's largest free
  radius).
- A new species goes in as a whole group of an allowed H3 size, with members
  within 10 cm of each other.

| Metric | v7 | v9 |
|---|---:|---:|
| Briefs / options feasible | 94 / 275 | 94 / 275 |
| Median Z (identical per option) | 0.8994 | 0.8994 |
| **Cover (median)** | 0.678 | **0.727** |
| Options with cover ≥ 0.75 / 0.80 / 0.85 | 57 / 19 / 4 | 108 / 52 / 17 |
| **Largest gap (median)** | 0.130 | **0.070** |
| 95th-pct gap, cm | 46.2 | 32.5 |
| 9-cell cover, min | 0.357 | 0.490 |
| Quadrant CV | 0.155 | 0.100 |
| Loose drifts | 0.087 | 0.046 |
| Plants added (options with any) | – | 8,384 (223) |
| … of species new to the plan | – | 7,624 |
| New species per option, median / max | – | 3 / 60 |
| Species per option, median | 5 | 9 |
| Tall (≥ 80 cm) centred in front | 797 | 1,122 |
| Trees in front / hard failures / outside the bed | 37 / 0 / 0 | 37 / 0 / 0 |
| 12-case / D24 (b) east 1 | 11/12 / pass | 12/12 / pass |

The 12/12 is again a measurement effect, as in v8b: the added short plants
change the mean depths. The largest-option cases reach the 300-plant
implementation bound (openFillMax).

## v9h: open fill + hard front rule

Owner, 19 Oct 2026. Rulebook **713f9bad5bec**, dataset **1e15fe4470f8**, same
seeds. One full run (`V2D_OUT=v9h`), compared with the existing v7 and v9 rows.
v7 was not re-run.

**What changed:**
- **Front rule.** No plant the open fill (v9), the last fill (v8) or the gap
  fill (v7) adds may be h_back_min (80 cm) or taller and centred in the front
  band. The test uses straight depth from the viewer, below 0.35 of the span.
  It is hard, like the tree rule. Plants Stage 4 placed are not affected.
- **Defaults.** `openFill` is on by default; `lastFill` and `lastFillPool`
  stay off. There is no cap on new species: `openFillMax` (300) is only a
  runaway guard.
- **Tests.** `tests/relax-d33b.test.ts` gains a v9 test: no added plant of
  80 cm or more centred in the front band, nothing v7 placed moved, Z
  unchanged, hard checks pass. The v7, v8 and D33 tests now pin
  `openFill`/`lastFill` off, so they keep testing the variant they were
  written for.

| Metric | v7 | v9 (old) | v9h |
|---|---:|---:|---:|
| Dataset of every row | 1e15fe4470f8 | 1e15fe4470f8 | 1e15fe4470f8 |
| Briefs feasible (of 101) | 94 | 94 | 94 |
| Options feasible | 275/282 | 275/282 | 275/282 |
| Z identical to v7, per option | 282/282 | 282/282 | 282/282 |
| Cover (median) | 0.678 | 0.727 | 0.727 |
| Options with cover >= 0.75 | 57 | 108 | 105 |
| Options with cover >= 0.80 | 19 | 52 | 50 |
| Largest gap (median) | 0.130 | 0.070 | 0.070 |
| 95th-pct gap, cm (median) | 46.2 | 32.5 | 32.7 |
| 9-cell cover, min (median) | 0.357 | 0.490 | 0.490 |
| **Tall (>= 80 cm) centred in front (sum)** | 797 | 1122 | 790 |
| Trees centred in front (sum) | 37 | 37 | 37 |
| Options with a hard failure | 0 | 0 | 0 |
| Plants outside the bed (sum) | 0 | 0 | 0 |
| v9 plants added: total / median / max | – | 8384 / 12 / 301 | 8201 / 12 / 302 |
| v9 new species: total / median / max | – | 1666 / 3 / 60 | 1630 / 3 / 61 |
| Species per option (median) | 5 | 9 | 9 |
| 12-case layering test | 11/12 | 12/12 | 12/12 |
| D24 (b) east, option 1 | pass | pass | pass |

The v7 and v9 rows are the existing files, unchanged.

**What the run shows:**
- **The front rule works.** Tall plants centred in front fall from 1,122 in
  the old v9 to 790, below v7's 797. v9h is lower than v7 because the rule
  now also applies to v7's own gap fill, so this count includes only plants
  Stage 4 placed. Trees in front are unchanged (37).
- **The front rule costs almost nothing in fill.** Cover is unchanged (median
  0.727), with 3 fewer options at 0.75 or more (105 vs 108). The largest gap
  (0.070) and the emptiest-ninth cover (0.490) match v9; the 95th-percentile
  gap is 32.7 vs 32.5 cm.
- **Unchanged against v7:** Z on every option (282/282), feasibility (94
  briefs), no hard failure, no plant outside the bed.
- **The open fill adds a lot of variety.** It adds a median of 12 plants and
  3 new species per option; species per option rise from 5 to 9 (median).
  The largest single option gains 302 plants and 61 new species. 302 is above
  the 300 guard because the last group is placed whole.

**Tests:** `npm run test:unit` gives 139 of 140 passing. The one failure is
D24 (c), a known dataset failure. Of the three tests the new dataset broke,
the 12-case and D24 (b) now pass. That is because the open fill adds plants,
mostly short ones near the front, which shifts the tall-versus-short averages
those tests compare. v7's own plants are not placed differently. No other
test fails.

**Figures:** `reports/figures/layout_v2g/v9h_{S001,S006,FIX}.png`, each with
v7 on the left and v9h on the right.

## v9c / v10

Owner, 19 Oct 2026. Rulebook **713f9bad5bec**, dataset **1e15fe4470f8**, same
seeds. One run each, compared with the existing v7 and v9h rows; v7 and v9h
were not re-run.

**v9c** limits what the open fill may add (`RELAX`, now the defaults):
- at most 7 species per plan that were not in the plan
  (`openFillMaxNewSpecies`);
- no added plant narrower than 30 cm (`openFillMinSpreadM`);
- no fallback into slivers (`openFillFallback: false`): only plants that
  fill the gap well are tried, and a gap no such plant fits is left open.

**v10** (`KEEP_PLACED`, off by default) keeps what fits. When a species
cannot be placed, only that species is left out; the plants already placed
stay, and it is named in a "KP:" line. A windbreak species or feature plant
still fails as before. v10 ran on the v9c defaults, so it is v9c plus
keep-what-fits.

| Metric | v7 | v9h | v9c | v10 |
|---|---:|---:|---:|---:|
| Dataset of every row | 1e15fe4470f8 | 1e15fe4470f8 | 1e15fe4470f8 | 1e15fe4470f8 |
| Briefs feasible (of 101) | 94 | 94 | 94 | 93 |
| Options feasible | 275/282 | 275/282 | 275/282 | 272/280 |
| Z identical to v7, per option | 282/282 | 282/282 | 282/282 | 52/280 |
| Median Z | 0.8994 | 0.8994 | 0.8994 | 0.9031 |
| Cover (median) | 0.678 | 0.727 | 0.697 | 0.672 |
| Options with cover >= 0.75 / 0.80 | 57 / 19 | 105 / 50 | 75 / 24 | 73 / 29 |
| Largest gap (median) | 0.130 | 0.070 | 0.100 | 0.125 |
| **Tall (>= 80 cm) centred in front, sum (<= 797)** | 797 | 790 | 790 | 749 |
| Trees centred in front, sum | 37 | 37 | 37 | 35 |
| Options with a hard failure | 0 | 0 | 0 | 0 |
| Plants outside the bed | 0 | 0 | 0 | 0 |
| Plants per option: median / max | 20 / 64 | 34 / 342 | 22 / 88 | 20 / 89 |
| Species per option: median / max | 5 / 19 | 9 / 72 | 6 / 26 | 6 / 25 |
| v9 new species: total / median / max | - | 1630 / 3 / 61 | 320 / 0 / 7 | 343 / 0 / 7 |
| **v9 added plants narrower than 30 cm (must be 0 in v9c, v10)** | not recorded | not recorded | 0 | 0 |
| v9 added plants: spread, cm (median of option medians) | not recorded | not recorded | 30 | 39 |
| Options with a fail-rule retry ('Retrying at no more than') | 254 (same path as v9c) | 254 (same path as v9c) | 254 | 136 |
| Options with a KP line / KP species left out | 0 / 0 (KEEP_PLACED off) | 0 / 0 (KEEP_PLACED off) | 0 / 0 | 160 / 176 |
| 12-case / D24 (b) east 1 | 11/12 / pass | 12/12 / pass | 11/12 / pass | 12/12 / pass |

v7 and v9h ran before the retry column existed. They take the same engine
path as v9c, since the fills only run on accepted layouts and Z is identical
on all 282 options, so they share v9c's retry count. The added-plant spreads
were not recorded for v7 and v9h.

**Reading:**
- **v9c's limits hold.** No plan gets more than 7 new species (320 in total
  against v9h's 1,630), and no added plant is under 30 cm. Cover lands
  between v7 and v9h (0.697 against 0.678 and 0.727), with the largest gap at
  0.100. Z, feasibility and the front rule (790 ≤ 797) are unchanged.
- **v10 halves the fail rule's retries but does not raise cover.** Retries
  fall from 254 to 136 options. 176 species are left out across 160
  options, and the median Z rises (0.8994 → 0.9031). But median cover is
  lower (0.672) and the largest gap larger (0.125) than v9c, and tall plants
  in front fall to 749.
- **v10 loses one brief:** S073, the smallest bed (0.5 × 0.5 m). Leaving
  species out drops the plan below the H2 floor of 3 species. Because the
  layout is complete, no species is named as the failure, so the fail rule
  cannot exclude one. It can only lower the cover cap, until no mix fits.
  KEEP_PLACED stays off.

**Tests:** `npm run test:unit` gives 142 tests with 3 failing, the known
dataset failures (12-case east 1, D24 (b), D24 (c)), and no others. The new
v9c test (≤ 7 new species, nothing under 30 cm, Z unchanged) and v10 test
(off fails as before; on completes, the species is left out and named in a
KP line, no overlap, hard checks pass) pass. Note the 12-case and D24 (b)
fail again with v9c as the default. Under v9h they passed only because the
open fill's small plants moved the averages those tests compare.

**Figures:** `reports/figures/layout_v2g/{v9c,v10}_{S001,S006,FIX}.png`,
each with v7 on the left.
