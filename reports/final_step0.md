# Final engine changes - Step 0 checks

Rulebook imported in the app: `098c8d085f61`. Dataset: `6c081d3d2f60`.
Workbook beside the repo (not yet imported): `6f37affddbc2`.
Code: branch `engine-final` = `main` (tag `pre-engine-final`, 24147d3) +
`ui-refinement` + `viewing-edge` (fast-forward to a118b26).

**Base branch.** The prompt assumes `ui-refinement` is merged; it was not
in `main`. `engine-final` takes `viewing-edge`, which contains all of
`ui-refinement` plus the orientation and rotated-compass fixes made after
it. `main` itself is unchanged.

## 1. Wind (b_wind)

Used. `app/lib/planning/stage1.ts`, the wind term:

```ts
wind: { ...term(isWindResilient(plant) ? 1 : 0, STAGE1_WEIGHTS.wind * siteFactor, siteFactor > 0), siteFactor },
```

b_wind = 0.637; W_site = 0 (none), 0.5 (protected), 1 (affected). For an
exposed site the term is active and adds 0.637 x W_site to a
wind-resilient plant's raw score (0 for others); raw_max includes the same
weight, so the score is normalised over it. At a site with no wind the
term is inactive.

## 2. colour_i when the species has no recorded colour

`colourTerm()` in `stage1.ts` returns matches / colours picked, with
`plant.flowerColour ?? []`, so an unrecorded colour scores **0** - the
same as a known mismatch - while the colour weight (0.105) stays in
raw_max. In G2/A2 (`stage2.ts`) the species contributes no colours
(`colours: plant.flowerColour ?? []`), so it adds nothing to the share of
the user's colours covered.

## 3. b_shade

The workbook has no `b_shade` row. The code still references it in:

- `data/scripts/import_rulebook.py` line 405: `"shade": num_optional(p, "b_shade", 0.105)` -
  the import does not require it, but substitutes 0.105 when absent;
- `app/lib/planning/stage1.ts` lines 131 and 170: `STAGE1_WEIGHTS.shade`, in
  raw_max and the shade term, both gated by `shadeTermActive()`;
- `app/lib/planning/stage1Config.ts`: `shadeTermActive()` returns false while
  `SHADE_ENABLED` is false;
- `app/lib/planning/engineConfig.ts`: `SHADE_ENABLED = false` (stated, no
  longer inferred from the rulebook since ui-refinement 6308cb2);
- `app/lib/planning/stage4.ts`: P14 reads `SHADE_ENABLED`;
- `tests/engine.test.ts`: asserts `SHADE_ENABLED === false`.

So the term is imported but never contributes to a plan.

## 4. P16 / viewer_option_count

Neither `viewer_option_count` nor `viewer_windbreak_edge` is read by any
code on any branch; they reach the app only as status strings.

- `main`: `buildGardenPlanVariants()` re-runs **one** option - the last of the
  options found, after sorting by Z - with `frontEdge = viewingEdge`, when
  the viewing edge is not north. The count (1) is implicit in the code.
- `engine-final` (from `viewing-edge`): `engineSite()` sets
  `frontEdge: brief.viewingEdge` for **every** option (owner decision
  12 Oct, "option C"); `depthAxisFor()` keeps north as the depth axis when
  the wind profile is the ramp. There is no re-run.
- On both, the windward row (P3/P11) stays on the true south and east
  edges whatever the viewing edge. No code places or removes a windbreak
  by viewing edge.

## 5. Contact bonus

Hard-coded: `app/lib/planning/stage4.ts` line 518 on this branch,
`if (index >= firstContact) pref += 0.05;`. It is not read from the
rulebook, and the workbook has no contact-bonus parameter. (The
`PLACEMENT.contactBonus` seam exists only on `coverage-test`.)

## 6. SUPERSEDED rows

The import neither skips nor rejects them. `read_parameters()` reads every
row of 1_Parameters and records its status; `current()` prefers a
"<symbol> (revised)" row when one exists. A SUPERSEDED parameter that the
importer reads is therefore still imported; its status reaches the app as
text in `RULES.status`.
