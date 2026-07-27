# Silly Goose MVP — implementation roadmap

Updated: 2026-07-27

## Current state

The repository contains a usable plant-discovery prototype and a researched
Western Cape data foundation. The next work should focus on the decision and
layout engine, not on adding more decorative interface states.

## Milestone 1 — constraint contract

- Extend the plant schema with soil, reviewed water/sun tolerances, mature
  canopy, category, style membership and legal status.
- Define every criterion as hard or soft.
- Define behaviour for missing and uncertain data.
- Add user inputs for soil, bed dimensions/shape and design direction.
- Add unit-tested feasibility rules.

Exit condition: the engine can explain why every rejected plant was rejected.

## Milestone 2 — calibrated soft ranking

- Run horticultural expert pairwise comparisons.
- Build and normalise the AHP matrix.
- calculate `λmax`, consistency index and consistency ratio;
- reject weight sets that fail the agreed consistency threshold;
- implement Goal Programming with explicit targets and directional penalties;
- return an explanation trace with each candidate.

Exit condition: reviewed fixtures rank in the expected order and each penalty
can be reconstructed from the output trace.

## Milestone 3 — group selection

- Derive usable bed area and open-space allowance.
- Use mature canopy area as the spatial cost.
- Define category minimum and maximum ratios for the supported garden styles.
- Implement the multidimensional-knapsack feasibility model.
- Start with the paper’s greedy constructive heuristic behind a stable solver
  interface.

Exit condition: every selected group satisfies area and category constraints.

## Milestone 4 — measured 2D layout

- Support a rectangular bed first.
- Place circular canopy footprints without overlap.
- Return coordinates, quantities, spacing, legend and unfilled/open area.
- Make every placement editable without losing the feasibility trace.
- Add irregular boundaries only after the rectangular model is validated.

Exit condition: the rendered plan and the numerical feasibility check agree.

## Milestone 5 — validation

- Review outputs with horticultural experts.
- Run failure-mode and effects analysis.
- Test edge cases: very small beds, deep shade, missing soil data, incompatible
  style requests and sparse candidate pools.
- Record sensitivity to weights, targets and open-space ratio.

Exit condition: known failure modes have clear controls and user-facing
explanations.

