# layout-v2d: D33b final adjustments

Every config runs on rulebook **713f9bad5bec** (frozen) and dataset
**6c081d3d2f60**, with the same seeds. The runs cover the 100 batch briefs plus
the fixed case (6 x 2 m fynbos, south view, part sun, moist), every option of
each.

Branch `layout-v2d` starts from `layout-v2c` (2e4f56c), not from `layout-v2`
HEAD. That is because every config here builds on (o)+D33, which only exists
from `layout-v2c` on.

All configs run on this branch with D29b config (o), with the flags set in
memory. Raw rows are in `reports/layout_v2d/`; the printed tables are in
`reports/layout_v2d/tables.md`. Scripts: `scripts/layout-v2d-run.ts`,
`layout-v2d-compare.ts` and `layout-v2d-figures.ts`.

## What changed (config only, engineConfig `RELAX`)

- **Hard edge guard (v1 onwards).** A move that crosses a bed edge is
  projected back inside, so the plant slides along the wall. A move that
  still breaks a clamp is shortened, never failed. Relaxation never removes
  a plant and never calls the fail rule.
  - If any hard check fails after the pass, the layout is put back exactly
    as placed. This did not happen in any run.
  - The existing clamps all hold: depth_tol, host, feature plant, windbreak,
    tree-front and no overlap.
- **v1:** power-diagram Lloyd relaxation, weighted by radius, replaces the
  force pass. Each plant steps towards the centroid of its power cell.
- **v2:** size swaps. Two plants within 20 cm of each other's height swap
  places when the larger-spread one stands in the fuller 1 m cell. A swap is
  kept only if the 1 m-cell cover variance drops.
- **v3:** the depth clamp widens to ±0.15 for plants under 50 cm.
- **v4:** gap fill. In each of the 3 largest gaps, one more plant of a species
  already selected is added.
  - The new count must stay within that species' H3 maximum, and its share
    within the H5 cap. No new species, no feature plant, no climber and no
    extra windbreak plant.
  - The added plant touches nothing, keeps every hard rule and stands within
    its depth tolerance.
  - It is planted (it joins the planting list), but Z and H1–H7 stay those of
    the Stage 2/3 selection.
  - A fix made along the way: the restart Stage 4 keeps is now chosen on the
    plants it placed itself, so added plants can never change the selection.
    Before this fix, 2 options' Z moved.
- **v5:** + drift split.
- **v4′ (added):** v4 without v3's short-plant clamp; see the path below.

## Path taken

**The best configuration that passes every test is v4′:** Lloyd + edge guard +
swaps + gap fill. It is the default on this branch and runs on localhost.
All 136 unit tests pass.

Why not the others:
- **v3, v4 and v5 break an existing test** (`D29b: B1223 and B1172 stand
  behind the short plants`, east edge). The ±0.15 clamp lets short plants
  move far enough that B1172 ends up behind B1223. I found this by switching
  each part on in turn: v1 and v2 pass, v3 fails.
- **v5 also breaks the 12-case** (10/12). This is the drift split again, as
  in layout-v2b.
- **v4′ gives up nothing measurable.** Dropping the clamp leaves every spread
  measure the same as v4 (largest gap 0.145, 95th-percentile gap 41.4 cm,
  cell variance 0.0470).

## Table

| Metric | (o) | (o)+D33 | v1 | v2 | v3 | v4 | **v4′** | v5 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Briefs feasible (of 101) | 94 | 94 | 94 | 94 | 94 | 94 | 94 | 94 |
| Options feasible | 273/280 | 273/280 | 273/280 | 273/280 | 273/280 | 273/280 | 273/280 | 277/284 |
| Median Z | 0.8990 | 0.8990 | 0.8990 | 0.8990 | 0.8990 | 0.8990 | 0.8990 | 0.8996 |
| Cover (median) | 0.650 | 0.650 | 0.650 | 0.650 | 0.650 | 0.654 | 0.653 | 0.664 |
| **Largest gap (median)** | 0.175 | 0.158 | 0.152 | 0.152 | 0.155 | 0.145 | **0.145** | 0.140 |
| 95th-pct gap, cm (median) | 56.5 | 51.8 | 43.3 | 43.3 | 43.1 | 41.4 | 41.4 | 37.7 |
| 1 m-cell cover variance (median) | 0.0597 | 0.0534 | 0.0501 | 0.0501 | 0.0501 | 0.0470 | 0.0470 | 0.0409 |
| Quadrant CV (median) | 0.190 | 0.185 | 0.179 | 0.180 | 0.179 | 0.175 | 0.176 | 0.158 |
| 9-cell cover, min (median) | 0.286 | 0.306 | 0.306 | 0.306 | 0.309 | 0.333 | 0.333 | 0.357 |
| 12-case layering test | 12/12 | 12/12 | 12/12 | 12/12 | 12/12 | 12/12 | 12/12 | 10/12 |
| B1223 / B1172 layering test | pass | pass | pass | pass | **FAIL** | **FAIL** | pass | **FAIL** |
| D24 (b) east, option 1 | pass | pass | pass | pass | pass | pass | pass | pass |
| Options with a hard failure | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Plants touching a bed edge (median per option) | 8 | 7 | 7 | 7 | 7 | 7 | 7 | 7 |
| **Plants outside the bed (must be 0)** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **Plants removed by D33 (must be 0)** | – | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Plants added (v4) | – | 0 | 0 | 0 | 0 | 251 in 175 options | 242 in 167 options | 253 in 174 options |
| Relaxation accepted | – | 147/273 | 156/273 | 161/273 | 160/273 | 160/273 | 161/273 | 160/277 |
| Size swaps kept | – | 0 | 0 | 51 | 69 | 69 | 51 | 56 |
| Tree canopies overlapping: same species / different | 258 / 243 | 222 / 230 | 213 / 225 | 213 / 225 | 211 / 226 | 211 / 226 | 213 / 225 | 193 / 222 |
| Tall (≥ 80 cm) centred in front | 758 | 752 | 748 | 748 | 749 | 760 | 761 | 830 |
| Trees centred in front (straight edge) | 48 | 48 | 48 | 48 | 48 | 48 | 48 | 58 |

**Z for each option equals (o)'s in every config except v5.** v5's drift
split re-places plants, which changes the fail rule's path.

Definitions:
- **Largest gap:** the largest empty patch on a 20 x 20 grid.
- **95th-pct gap:** the 95th percentile of how far bare ground (10 cm sample)
  lies from the nearest canopy.
- **1 m-cell cover variance:** the variance of the planted share of each
  1 m x 1 m cell.
- **At edge:** a canopy within 1 cm of a bed edge.
- **B1223 / B1172 row:** the unit test, run with each variant as the default.

## Trade-off to judge on the figures: drifts loosen

Lloyd has no pull between plants of the same species. The swaps also move
same-species plants apart. So groups spread out.

On the sample plans, the median edge-to-edge gap from a plant to its nearest
same-species neighbour:

| | (o) | (o)+D33 | v1 | v2 | v4′ | v5 |
|---|---:|---:|---:|---:|---:|---:|
| S006 (12 x 8 m) | 0 cm | 16 | 22 | 44 | 44 | 27 |
| Fixed case (6 x 2 m) | 0 | 0 | 3 | 3 | 3 | 2 |
| S001 (2 x 3 m) | 0 | 0 | 0 | 0 | 0 | 6 |

On big beds this reads as scattered groups, e.g. the small purple plants at
the front of S006. If drifts must stay tight, a same-species weight in the
Lloyd step (D33's 0.5) is the obvious next change. I have not made it.

## Tree checks

**Do tree canopies overlap anywhere?** Yes, in every config: in (o), 258 pairs
of the same species and 243 pairs of different species. No rule is broken:
- P2 allows any two canopies to overlap by up to δ = 0.15 of the smaller
  radius;
- P5 forbids a canopy only over a plant that does not take shade (the same
  species is exempt), and P5 passes in every option.

So a different-species tree overlap always sits over a shade-tolerant tree.
Relaxation reduces the overlaps (v4′: 213 / 225).

**Tree species with spread under 1 m:** 38 in the catalogue. "Imputed" means
the spread was filled in by the dataset pipeline, not measured.
- 5 are `original` measurements flagged `suspect-low` by the dataset itself,
  for example B0772 Protea laurifolia (8 m tall, 30 cm spread), used in 40
  options.
- Most of the rest are imputed, e.g. `group-median` 63 cm and `ratio-imputed`
  57 cm.
- Small-spread trees appear in 89 option slots in (o)+D33, so this data issue
  touches real plans.

| ID | Species | Height (cm) | Spread (cm) | Spread source | Imputed? | Flag | Options in (o)+D33 |
|---|---|---:|---:|---|---|---|---:|
| B2812 | Stoeberia arborea | 225 | 24 | group-median | yes |  | 0 |
| B0772 | Protea laurifolia | 800 | 30 | original | original | suspect-low | 40 |
| B1372 | Brachylaena glabra | 1800 | 30 | original | original | suspect-low | 12 |
| B1606 | Protea subvestita | 500 | 30 | original | original | suspect-low | 2 |
| B0268 | Protea nitida | 1000 | 37 | lookup | yes |  | 0 |
| B1192 | Encephalartos hirsutus | 450 | 40 | original | original |  | 0 |
| B2560 | Encephalartos lehmannii | 200 | 40 | original | original |  | 0 |
| B1455 | Alsophila dregei | 700 | 45 | original | original | suspect-low | 0 |
| B2405 | Encephalartos transvenosus | 450 | 45 | original | original |  | 0 |
| B2585 | Brachylaena discolor | 1000 | 45 | original | original |  | 4 |
| B0488 | Aloe ferox | 300 | 57 | ratio-imputed | yes | outlier | 0 |
| B1376 | Aloe rupestris | 600 | 57 | ratio-imputed | yes | outlier | 2 |
| B1449 | Cussonia sphaerocephala | 2500 | 57 | ratio-imputed | yes | outlier | 0 |
| B2227 | Crassula arborescens | 300 | 57 | ratio-imputed | yes | outlier | 0 |
| B2474 | Euphorbia ingens | 1200 | 57 | ratio-imputed | yes | outlier | 0 |
| B2484 | Aloe arborescens | 300 | 57 | ratio-imputed | yes | outlier | 0 |
| B2546 | Aloidendron barberae | 1500 | 57 | ratio-imputed | yes | outlier | 0 |
| B2702 | Aloe pluridens | 300 | 57 | ratio-imputed | yes | outlier | 0 |
| B0199 | Sideroxylon inerme | 1000 | 60 | original | original | suspect-low | 3 |
| B1207 | Adenia gummifera | 3000 | 63 | group-median | yes |  | 0 |
| B1339 | Rhoicissus rhomboidea | 600 | 63 | group-median | yes |  | 0 |
| B1465 | Bauhinia petersiana subsp. macrantha | 300 | 63 | group-median | yes |  | 8 |
| B1484 | Dalbergia armata | 500 | 63 | group-median | yes |  | 1 |
| B1528 | Rhoicissus tridentata | 300 | 63 | group-median | yes |  | 0 |
| B1541 | Cephalanthus natalensis | 400 | 63 | group-median | yes |  | 0 |
| B1673 | Ficus burtt-davyi | 500 | 63 | group-median | yes |  | 0 |
| B1830 | Strophanthus speciosus | 1000 | 63 | group-median | yes |  | 0 |
| B1923 | Adenopodia spicata | 1000 | 63 | group-median | yes |  | 0 |
| B2478 | Combretum bracteosum | 400 | 63 | group-median | yes |  | 0 |
| B2601 | Buddleja auriculata | 200 | 63 | group-median | yes |  | 5 |
| B2674 | Bauhinia bowkeri | 600 | 63 | group-median | yes |  | 0 |
| B2726 | Bauhinia galpinii | 450 | 63 | group-median | yes |  | 0 |
| B2771 | Carissa spinarum | 600 | 63 | group-median | yes |  | 3 |
| B2804 | Grewia afra | 800 | 63 | group-median | yes |  | 8 |
| B2830 | Carissa edulis | 500 | 63 | group-median | yes |  | 1 |
| B0004 | Cassytha ciliolata | 200 | 66 | lookup | yes |  | 0 |
| B0175 | Robsonodendron maritimum | 200 | 66 | lookup | yes |  | 0 |
| B2471 | Encephalartos inopinus | 200 | 67 | ratio-imputed | yes |  | 0 |

## Figures

`reports/figures/layout_v2d/<variant>_<brief>.png` (SVG alongside). There is
one for each of D33, v1–v5 and v4′, for S001, S006 and the fixed case.

Each figure shows (o) as placed (left) beside the same brief and seed under the
variant (right). v4, v4′ and v5 may add plants. v5 also re-places plants, so
its two panels are different plans.
