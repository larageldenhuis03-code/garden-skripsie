# Batch verification — 100 scenarios

Runs 100 garden briefs through the live engine and reports what came back.
Use it to check that a change to the rulebook, the dataset or a stage has not
broken planning across the whole input space, in a way five regression briefs
cannot.

```powershell
npm run test:batch
```

Takes about a minute. Writes `results/results.csv` (one row per scenario) and
`results/summary.txt` (the report). Exits non-zero if anything actually broke,
so it can gate a commit.

## What it runs

| Block | Count | What it covers |
|---|---|---|
| Site | 72 | Every sun × water × soil combination (3 × 3 × 4 = 36), twice. Location, wind, bed size, style and colour rotate across the runs, so no combination is tied to one set of preferences. |
| Bed size | 16 | The limits of the size fields: 0.5 × 0.5 m up to 30 × 30 m, long thin beds both ways, decimals, and a bed smaller than one plant. |
| Stress | 12 | Deep shade on wet clay, a rare colour, every extra at once, colours that fight the style, wind on a bed too shallow for rows. |

Locations are real rows from `app/data/places.ts`, one per bioregion (22 of
them), so the biome sets are genuine rather than invented. Scenario generation
is deterministic — the same file always produces the same 100 briefs.

**Not covered here:** the search box, the map pin and the results-page buttons.
They are not engine inputs. Test those in the human pilot.

## What it checks

Two independent passes per scenario:

1. **What the engine says about itself** — `engine.hard` (H1–H5) and the hard
   entries of `engine.placementChecks` (P1–P14).
2. **A separate geometry check**, recomputed here from the placement
   coordinates: no circle outside the bed, no pair closer than
   `minCentreDistance`, cover within the style's limit. If the two passes ever
   disagree, the engine is reporting a pass it did not earn — which is the
   point of running them separately.

Plus **repeatability**: the first 10 scenarios are planned twice and the
species, quantities and placement coordinates must match exactly.

Every threshold is read from `RULES` / `engineConfig` — the P2 overlap
tolerance, the per-style cover limits, the row pitch. **Do not hard-code a
tolerance in this harness.** A harness with its own numbers tests a different
engine than the one that ships. In particular, cover limits differ by style
(Fynbos 0.85, Mediterranean 0.80, Cottage 0.90), so a single "70%" figure
would be wrong for three of the four.

## Result codes

| Code | Meaning |
|---|---|
| `SUCCESS` | A plan, every hard rule met, nothing dropped. |
| `SUCCESS_DEGRADED` | A plan, every hard rule met, but the fail rule dropped a species or some plants could not be placed. |
| `INFEASIBLE_ENV` | No plan: nothing survived the Stage 0 filters for that site. |
| `INFEASIBLE_SPACE` | No plan: species survived the filters, but no feasible mix could be formed for that bed. |
| `CONSTRAINT_FAIL` | A plan was returned that breaks a hard rule. **Always a bug.** |
| `SLOW` | Over 3 s. Still checked, just flagged. |
| `TIMEOUT` / `ERROR` | Abandoned, or the engine threw. |

`CONSTRAINT_FAIL`, `ERROR`, `TIMEOUT` and any repeatability mismatch set a
non-zero exit code. An infeasible site does not — some sites genuinely have no
answer, and saying so is correct behaviour.

## Option variety is reported, not failed

The summary has an **OPTION VARIETY** section counting scenarios where the
three options share most of their species. This is deliberately *not* a
failure.

The engine's own test for a distinct option is an exact species-and-quantity
signature ([`buildGardenPlanVariants`](../../app/lib/planning/gardenPlan.ts)),
so two options can share every species and differ only in how many of each —
species similarity 1.00, but still "distinct" by that definition. Whether that
is enough difference to be worth showing as Option 1 / 2 / 3 is an owner
decision about the product, not a rule the engine breaks. The harness measures
it and leaves the judgement to you.

## Reading the results

`results.csv` columns worth sorting on:

- `code` — start here.
- `coverRatio` against `coverLimit` — how full the bed ended up.
- `z` — the Stage 2 objective; low scores across a whole input slice suggest
  the catalogue is thin there, not that the engine failed.
- `droppedSpecies`, `unplaced` — what the fail rule gave up on.
- `maxSimilarity`, `variety` — option variety, as above.

`summary.txt` breaks the success rate down by sun, water, soil, wind, style,
block and location. A low rate for one input value is usually a **data**
finding (few species recorded for that combination), not an engine fault —
check the pool size before blaming the optimiser.
