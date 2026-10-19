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
