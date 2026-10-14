# layout-v2e: keeping drifts together (v6)

Rulebook **713f9bad5bec** (frozen), dataset **6c081d3d2f60**, same seeds.
The runs cover the 100 batch briefs plus the fixed case, every option.

Branch `layout-v2e` starts from `layout-v2d` (a63d43b). Raw rows and tables
are in `reports/layout_v2e/`. The scripts are the layout-v2d ones, run with
`V2D_DIR=layout_v2e`.

## Why

In the D33b report, v4′ loosened drifts on big beds. In S006 the median gap
from a plant to its nearest same-species plant went from 0 to 44 cm, because
the Lloyd step has no pull between members of a group.

## What changed (config only, `RELAX.cohesion`)

**v6 = v4′ + group cohesion.** No plant may end up further than 10 cm edge
to edge from its nearest same-species plant, or further than Stage 4 left
it, if that was already more. The check runs on every move and every swap,
for the plant that moves and for each of its group-mates. The 10 cm is an
assumption, not an agreed value.

## Result: v6 adopted as the branch default

| Metric | (o) | (o)+D33 | v4′ | **v6** |
|---|---:|---:|---:|---:|
| Briefs feasible (of 101) | 94 | 94 | 94 | 94 |
| Median Z | 0.8990 | 0.8990 | 0.8990 | 0.8990 |
| Cover (median) | 0.650 | 0.650 | 0.653 | 0.655 |
| **Largest gap (median)** | 0.175 | 0.158 | 0.145 | **0.142** |
| 95th-pct gap, cm (median) | 56.5 | 51.8 | 41.4 | 45.2 |
| 1 m-cell cover variance (median) | 0.0597 | 0.0534 | 0.0470 | 0.0491 |
| Quadrant CV (median) | 0.190 | 0.185 | 0.176 | 0.175 |
| 9-cell cover, min (median) | 0.286 | 0.306 | 0.333 | 0.333 |
| **Grouped plants > 10 cm from any group-mate (median share)** | 0.132 | 0.176 | 0.267 | **0.167** |
| 12-case / D24 (b) east 1 | 12/12 / pass | 12/12 / pass | 12/12 / pass | 12/12 / pass |
| Options with a hard failure | 0 | 0 | 0 | 0 |
| Plants outside the bed / removed | 0 / – | 0 / 0 | 0 / 0 | 0 / 0 |
| Plants added (gap fill) | – | – | 242 in 167 options | 239 in 168 options |
| Size swaps kept | – | 0 | 51 | 1 |
| Tree canopies overlapping: same / different species | 258 / 243 | 222 / 230 | 213 / 225 | 205 / 230 |

Z per option is identical to (o) in every config. On the sample plans, the
median gap from a plant to its nearest same-species plant:

| | (o) | (o)+D33 | v4′ | v6 |
|---|---:|---:|---:|---:|
| S006 (12 x 8 m) | 0 cm | 16 | 44 | 9 |
| Fixed case | 0 | 0 | 3 | 2 |
| S001 | 0 | 0 | 0 | 0 |

**What v6 does:**
- Drifts stay as tight as under D33, or tighter.
- The largest gap is the best of the four configs (0.142).
- It keeps most of v4′'s gain on the 95th-percentile gap and the cell
  variance. It gives back a little, because plants can no longer leave their
  group to fill a hole.
- Swaps almost stop (1 kept), since swapping two plants would pull each one
  out of its drift.

All 136 unit tests pass with v6 as the default. The tests include a new
cohesion test.

**Limitation:** the cohesion check covers moves and swaps, not the gap fill.
An added plant is placed in a gap even when that is away from the rest of
its species, e.g. the lone pink plant at the top right of S006. If that
reads wrong, the next step is to require an added plant to stand within
10 cm of a group-mate.

## Figures

`reports/figures/layout_v2e/{d33,v4b,v6}_{S001,S006,FIX}.png` show (o) as
placed beside each variant, for the same brief and seed.
