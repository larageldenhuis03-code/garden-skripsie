# Rulebook changes to make — layout review (C1, C2)

**For:** whoever edits `Algorithm_rulebook.xlsx`
**Date:** 2026-10-05
**Why:** the code now implements C1 and C2 from the layout review. The
workbook does not describe either yet, so the two are out of step until these
edits are made. Nothing below changes an agreed value; both new parameters are
**ASSUMPTION**.

Items 2, 5 and 6 of the review were already covered (B3, and B4 which shipped
as H7). Items 3, 7 and 9 are tuning or data fixes, not rule changes — see
"Not done" at the end.

---

## 1. New parameters — `1_Parameters`

Four rows for C1 and one for C2. Next free row is 104 (103 is `footprint_cap`).

| Symbol | Value | Units | Status | Meaning |
|---|---|---|---|---|
| `small_spread_max` | 30 | cm | ASSUMPTION | A species narrower than this counts as a "small plant" for C1 |
| `small_group_per_m2` | 1 | plants/m² | ASSUMPTION | How many small plants one m² of bed earns |
| `small_group_max` | 25 | plants | ASSUMPTION | Hard ceiling on a bed-scaled small-plant group |
| `small_group_ladder` | 3, 5, 7, 9, 11, 15, 19, 25 | — | ASSUMPTION | The group sizes a small plant may take, continuing the existing odd ladder past 15 |
| `w_balance` | 0.5 | — | ASSUMPTION | Weight of the P17 lateral balance term in f(p) |

---

## 2. C1 — small plants scale with the bed

**Where:** `5_Stage2_Constraints`, as a note on the H3 row (group sizes), since
this extends H3 rather than adding a constraint.

**Wording:**

> **H3 extension (C1).** A species whose spread is below `small_spread_max`
> may form larger groups on larger beds. Its allowed sizes are the band's own
> ladder extended along `small_group_ladder` up to
>
> `n_max = MIN(small_group_max, MAX(band max, FLOOR(small_group_per_m2 × W × L)))`
>
> This only ever **adds** sizes; the band's existing ladder is never reduced,
> so every size H3 allowed before is still allowed. Species at or above
> `small_spread_max` are unaffected.

**Worked example** for the hand check, if you want one — a species 20 cm wide
(spread band 1, ladder `3,5,7,9,11,15`):

| Bed | n_max | Allowed sizes |
|---|---|---|
| 6 m² | 15 | 3, 5, 7, 9, 11, 15 (unchanged) |
| 9 m² | 15 | 3, 5, 7, 9, 11, 15 (unchanged) |
| 24 m² | 19 | 3, 5, 7, 9, 11, 15, **19** |
| 50 m² | 25 | 3, 5, 7, 9, 11, 15, **19, 25** |
| 100 m² | 25 | 3, 5, 7, 9, 11, 15, **19, 25** |

601 species in the catalogue are narrower than 30 cm.

---

## 3. C2 — lateral balance, as P17

**Where:** `6_Stage3_4_Rules`, a new placement rule row after P16.

**Wording:**

> **P17 lateral balance.** Divide the bed's viewer-facing width into thirds.
> For each candidate position, add to f(p)
>
> `w_balance × (A_fullest − A_third(p)) / A_fullest`
>
> where `A_third` is the canopy area already placed in that third and
> `A_fullest` is the largest of the three. The term is 0 in the fullest third
> and 1 in an empty one, so it draws planting toward the emptiest side. It is
> a preference, never a constraint: it can never make a position infeasible.

**Two details that differ from the review note**, both decided on measurement
rather than preference — worth recording in the rule's notes column:

1. It counts **all placed canopy, not that layer's alone.** Per-layer was the
   review's wording and the obvious reading, but each layer holds few plants,
   so the signal was mostly noise. Per-layer at w = 0.35 made balance *worse*
   than having no term at all.
2. It applies to **every plant, not only the first of a drift.** Restricting
   it to drift starts let the rest of each group clump back into the same
   corner.

---

## 4. `14_Test_Results` — a row for the C2 measurement

The balance term was tuned on 18 layouts (6 bed shapes × 3 styles, one seed
each). Imbalance = (fullest third − emptiest third) ÷ total canopy, averaged.

| w_balance | Scope | Applied to | Mean imbalance |
|---|---|---|---|
| 0 (no term) | — | — | 15.2% |
| 0.35 | that layer | drift starts | 16.9% |
| 1.0 | that layer | drift starts | 14.4% |
| 1.0 | all canopy | drift starts | 10.8% |
| **0.5** | **all canopy** | **every plant** | **8.9%** ← chosen |
| 1.0 | all canopy | every plant | 9.4% |
| 2.0 | all canopy | every plant | 10.1% |

Drift cohesion was checked at the same time and **improved**: mean drift
spread fell from 2.16 to 1.75 canopy radii across 147 groups, so B3 is intact.

This is a tuning sweep on one seed per case, not a validation run. It says the
term helps and that 0.5 is near its optimum; it does not establish the figure
across the full scenario set.

---

## 5. `Change_Log`

> C1 — small-spread species may form bed-scaled groups (H3 extension).
> Previously every band ladder was fixed, so a small plant filled a 30 m² bed
> no better than a 6 m² one. C2 — new placement rule P17 adds a lateral
> balance term to f(p), measured to cut third-to-third imbalance from 15.2% to
> 8.9%. Both parameters ASSUMPTION; neither changes an agreed value.

## 6. `10_Open_Items`

The code-side item for C1/C2 can be closed. Two new ones to open:

- **φ (H7) is still untested** against the Block B scenarios — carried over.
- **`w_balance` = 0.5 is tuned on 18 layouts, one seed each.** Confirm across
  the full scenario set before it is promoted from ASSUMPTION.

---

## Not done, and why

| Review item | Status |
|---|---|
| 3 — layer positioning (`w_d` tuning) | Tuning, not a rule change. Needs the sensitivity run, which is cancelled. The bad height/spread records it also depends on (e.g. laurel protea) are a **data** fix in `FINAL.DATASET.FINAL.xlsx`, not code. |
| 7 — groundcovers at edges (L6 `d_target` = 0.2) | Rule already exists; tuning only. |
| 8 — colour coherence | Not built, agreed future work. |
| 9 — irregularity | Rule already exists (seeded jitter + random draws). No change unless rows are actually seen. |

One thing C1 does **not** fix on its own: Stage 3 still chooses `n` under H1
(total cover) and H5 (no species dominates), so a bigger ladder only gets used
where those allow it. On a 10 × 6 m fynbos bed the selected sizes stayed small
(5, 3, 3, …) even with 19 and 25 available. If large drifts are the goal, the
binding constraint is H5 / `k_headroom`, not the ladder — worth a look before
assuming C1 alone will fill big beds.
