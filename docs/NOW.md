# Where the project is now

**Audience:** the user and anyone joining the project

**Purpose:** current status, next work and required input

**Updated:** 2026-07-27

## The short version

Silly Goose currently helps someone discover and save Western Cape plants. The
next product milestone is to turn the garden brief into a reviewed planting
plan—not merely a ranked list.

The mathematical foundation is built and tested. It remains disconnected from
the interface because the horticultural rules, expert weights and spacing
assumptions have not yet been reviewed.

## Status

| Area | Status | What that means |
|---|---|---|
| Garden brief | Working | Five broad questions; soil and exact bed dimensions still need to be added |
| Plant library | Working | 48 curated plants with search, profiles and evidence notes |
| Recommendations | Provisional | A hand-set heuristic orders plants; it is not the research model |
| Saved plants | Working | Stored on the current device; no account required |
| Data foundation | Working | SANPC, BODATSA and BioSCape extracts are reproducible |
| Hard-constraint engine | Built, not configured | Execution and explanation tracing work; reviewed rules are missing |
| AHP and Goal Programming | Built, not calibrated | Mathematics and consistency checks work; expert inputs are missing |
| Group selection | Provisional | Selects a feasible species subset; cannot yet calculate quantities |
| Quantities and 2D layout | Not built | Requires reviewed canopy, spacing and composition rules |
| Visual system | In progress | A V01 hero candidate exists as `hero.png`; it is not integrated or approved |

## What happens next

### 1. Review the V01 hero in context

Codex integrates the supplied candidate into the home page with responsive
cropping. The user approves it or requests one focused GPT revision. No second
image prompt becomes active before that decision.

**Output:** one approved hero that sets the standard for later artwork.

### 2. Define the planning contract

Write the exact garden inputs, plant attributes, hard constraints, soft goals,
missing-data behaviour and explanation returned by the engine.

**Output:** a typed schema, data dictionary and reviewed feasible/infeasible
test cases.

### 3. Review the horticultural data

Populate or explicitly mark unknown:

- soil compatibility;
- sun and water tolerances;
- mature canopy and spacing;
- plant category and design role;
- current legal status; and
- confidence and provenance for every modelled field.

**Output:** no production rule based on an unexplained editorial guess.

### 4. Calibrate recommendations

Collect expert pairwise comparisons, accept only a consistent AHP matrix, set
Goal Programming targets and compare the output with reviewed garden cases.

**Output:** explainable rankings that can replace the current heuristic.

### 5. Generate quantities and a bed plan

Extend binary species selection to integer quantities, then place circular
canopy footprints inside a rectangular bed.

**Output:** species, counts, coordinates, spacing, legend, unused area and an
assumption trace.

## What will be true when the MVP is complete

A user can:

1. describe location, soil, light, water and a rectangular bed;
2. choose practical and visual goals;
3. receive only plants that pass reviewed hard constraints;
4. understand why each plant was ranked or rejected;
5. receive a balanced group with quantities and spacing; and
6. use a measured 2D plan while seeing material uncertainties.

## Input needed from the user

Now:

- approve or revise the V01 hero after it is shown in the site.

Later:

- help choose or reach a Western Cape horticultural reviewer;
- approve the final garden questions and result format; and
- decide how much empty space and visual density should be offered as defaults.

## Not now

- Accounts or cross-device history
- Nursery stock, pricing or purchasing
- Nationwide plant coverage
- Irregular bed geometry
- Computer-vision site surveys
- Garden diaries
- Forty-eight generated plant portraits

These become relevant only after the recommendation and layout outputs are
credible.
