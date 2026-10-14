# layout-v2c: D33 final relaxation pass

Every config runs on rulebook **713f9bad5bec** (frozen) and dataset
**6c081d3d2f60**, with the same seeds. The runs cover the 100 batch briefs plus
the fixed case (6 x 2 m fynbos, south view, part sun, moist), every option of
each.

Branch `layout-v2c` starts from `layout-v2b` (a14ada6), not from `layout-v2`
HEAD (2eb254c), because config (n) needs the D29b code, which only
`layout-v2b` has. `layout-v2b` is `layout-v2` HEAD plus D29b behind flags. With
those flags off it reproduces engine-final row for row: (a′) here matches
`reports/layout_v2b/v2b_ap.csv` with 0 differences over 281 rows.

Where each config ran:
- **(a′), (n), (o)** ran on this branch.
- **(b)** ran on layout-v2 Step 3 (29a408d), with the same `relax.ts` hooked in
  for measurement only.

Raw rows are in `reports/layout_v2c/`. Scripts: `scripts/layout-v2c-run.ts`,
`layout-v2c-compare.ts` and `layout-v2c-figures.ts`.

## What D33 does

After Stage 4 places a plan, and before output, plants are nudged apart and
into open ground. Each step:
- every movable plant is pushed by every neighbour whose gap is below the
  target gap g, in proportion to the shortfall;
- same-species neighbours push at 0.5, so drifts stay together;
- bed edges also push.

The target gap is g = free area ÷ total plant perimeter, for each bed.

The pass stops after 200 steps, or when no plant moves 1 cm. Every move is
checked against these limits:
- **Depth:** a plant stays within depth_tol of its target depth. One that
  started outside it may not drift further away.
- **Overlap:** no gap falls below 0, or below where Stage 4 left it.
- **Placement rules:** the plant stays inside the bed, and P2, P5 and P4 hold.
- **Fixed plants:** the feature plant and the windbreak row don't move.
- **Climbers:** they move with their host.
- **Hard rules:** the tree-front rule and every other hard rule hold.

The relaxed plan is kept only if its largest empty patch shrinks and every
check holds. Otherwise the original layout stands. The result is logged per
plan as a "D33 relax: accepted / rejected" line.

There is no rulebook change. The setting lives in engineConfig `RELAX`
(`on` = relax_on).

One decision taken beyond the prompt: relaxation runs only on a layout that
already passes every hard check. Without that guard it can repair a layout
the fail rule would reject (e.g. a P5 overlap), which changes the fail rule's
path, and so the selection and Z (seen on S006 in (n)). With the guard it
moves plants only. Selection and Z are identical with and without it in
every config.

## Path taken

Relaxation improves spread in every base, with Z and feasibility unchanged.
**The best configuration that passes every test is (o) + relax: D29b config
(o) plus D33.** It is now this branch's default (`RELAX.on = true`). All 134
unit tests pass, the new relax tests included. The local preview runs it.

(n) + relax has the best spread of all, but (n) itself fails one 12-case
option (south 3), so it does not qualify.

## Table

| Metric | (a′) | (a′) + relax | (b) | (b) + relax | (n) | (n) + relax | (o) | **(o) + relax** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Briefs feasible (of 101) | 94 | 94 | 92 | 92 | 94 | 94 | 94 | 94 |
| Options feasible | 274/281 | 274/281 | 271/280 | 271/280 | 277/284 | 277/284 | 273/280 | 273/280 |
| Median Z | 0.9008 | 0.9008 | 0.8865 | 0.8865 | 0.9063 | 0.9063 | 0.8990 | 0.8990 |
| Cover (median) | 0.637 | 0.637 | 0.481 | 0.481 | 0.656 | 0.656 | 0.650 | 0.650 |
| **Largest empty patch (median)** | 0.191 | 0.170 | 0.395 | 0.385 | 0.160 | 0.142 | 0.175 | 0.158 |
| Quadrant CV (median) | 0.197 | 0.190 | 0.390 | 0.370 | 0.160 | 0.148 | 0.190 | 0.185 |
| 9-cell cover, min (median) | 0.222 | 0.238 | 0.020 | 0.041 | 0.309 | 0.333 | 0.286 | 0.306 |
| 9-cell cover, median (median) | 0.691 | 0.691 | 0.500 | 0.500 | 0.667 | 0.667 | 0.673 | 0.691 |
| 12-case layering test | 12/12 | 12/12 | 9/12 | 9/12 | 11/12 | 11/12 | 12/12 | 12/12 |
| D24 (b) east, option 1 | FAIL | FAIL | pass | pass | pass | pass | pass | pass |
| Options with a hard failure | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Tall (≥ 80 cm) centred in front | 584 | 587 | 0 | 0 | 790 | 782 | 758 | 752 |
| Trees centred in front (straight edge) | 9 | 9 | 0 | 0 | 42 | 41 | 48 | 48 |
| Relaxation accepted (feasible options) | – | 135/274 | – | 117/271 | – | 145/277 | – | 147/273 |
| Median move, all movable plants (cm) | – | 0.0 | – | 3.4 | – | 0.0 | – | 0.0 |
| Plants moved per accepted plan (median) | – | 8 | – | 9 | – | 9 | – | 9 |
| Median move of the plants that moved (cm) | – | 14.4 | – | 18.6 | – | 13.9 | – | 14.7 |

The selection and Z with and without relax are **identical** in all four
bases.

In the accepted plans, the largest gap shrank by a median of:
- (a′): 0.015 (max 0.212);
- (b): 0.012 (max 0.315);
- (n): 0.017 (max 0.137);
- (o): 0.017 (max 0.237).

## Reading it

- **It is a local nudge, not a reshuffle.** In an accepted plan the median
  plant does not move. About 9 plants per plan move, by a median of about
  15 cm, into the open ground beside them. Drifts stay together.
- **About half the plans are kept** (135–147 of about 275). The rest are
  rejected because the gap did not shrink. That happens most when plants
  already sit snug against the bed edges, as in engine-final (a′): there the
  edge push opens a strip along the edge, so the pass is rejected and the
  original stands.
- **Spread improves in every base.** On (o): largest gap 0.175 → 0.158,
  quadrant CV 0.190 → 0.185, emptiest-ninth cover 0.286 → 0.306.
- **Layering is unchanged.** The depth clamp holds each plant near its target,
  the 12-case and D24 (b) results don't change, and tall-in-front moves by
  only a few plants.
- **Cover cannot change**, because the same plants are used. D33 spreads the
  open ground more evenly; it does not add planting.

## Figures

`reports/figures/layout_v2c/<base>_<brief>.png` (SVG alongside), for bases
a′, b, n and o and briefs S001, S006 and FIX. Each shows the same plan before
and after relaxation, with the same seed and plants. The title says whether
relaxation was accepted; when rejected, the two panels are identical.
