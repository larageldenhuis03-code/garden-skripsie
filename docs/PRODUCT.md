# Product brief

**Audience:** the user, designers and product collaborators

**Purpose:** the stable definition of Silly Goose

**Updated:** 2026-07-27

## Product outcome

Turn the conditions a Western Cape gardener already has into an indigenous
garden they can realistically plant.

The useful output is not a long plant list. It is a suitable group, sensible
quantities, measured spacing and a plan that explains its assumptions.

## Who it is for

A beginner or intermediate Western Cape home gardener who wants indigenous
plants but does not know:

- which plants are feasible for the site;
- which plants work together;
- how many will fit; or
- where to place them.

Desktop is the primary planning surface because comparison and bed layout need
space. Mobile should remain usable.

## Target experience

1. Describe the site: place, soil, light and available water.
2. Enter the bed dimensions.
3. Choose practical goals and a visual direction.
4. Remove plants that cannot work under the reviewed constraints.
5. Rank the remaining plants against the user's goals.
6. Select a balanced group within the area budget.
7. Generate quantities, spacing and a 2D bed plan.
8. Show the evidence, assumptions and local checks still required.

## Product principles

### Be useful before being broad

Start with one region, one bed shape and a curated catalogue. Expand only when
the result is trustworthy.

### Explain every recommendation

Rejections, penalties, rankings and group choices must be reconstructable.
Apparent precision without an explanation is not acceptable.

### Separate evidence from editorial judgement

Occurrence records show presence, not garden performance. Prototype labels may
help test the experience, but they cannot become production rules without a
source, confidence and review.

### Prefer a plan over a quiz result

The discovery flow is scaffolding. The product becomes valuable when it returns
a coherent group, quantities and placement.

### Keep the interaction focused

Use one continuous application for this phase. Save plants locally rather than
introducing accounts before they solve a real problem.

### Let the Western Cape feel specific

The product, language and artwork should be recognisably local. Generic
“nature app” conventions are not the design target.

## Settled choices

| Choice | Current decision |
|---|---|
| Geography | Western Cape first |
| Catalogue | 48 curated plants until wider horticultural coverage is reviewed |
| Primary device | Desktop-first, responsive on smaller screens |
| Current navigation | One continuous application |
| Home page | Header and hero only; detailed content begins after an action |
| Saving | Device-local |
| Recommendation architecture | Hard filters → Goal Programming → group selection → layout |
| Calibration | AHP supplies weights; it does not rank plants directly |
| Transparency | Complete trace for every material decision |
| Visual production | One GPT-generated asset at a time, approved in context |
| Voice | Plain, specific and proportionate to the evidence |

## Open product decisions

These are intentionally unresolved:

- the final garden-question set;
- the plant category and design-role taxonomy;
- the default open-space and visual-density choices;
- the best way to show confidence and missing evidence;
- whether the first plan supports one bed or several; and
- which expert-reviewed cases define an acceptable recommendation.

They should be decided through the work in [`NOW.md`](NOW.md), not buried in a
change log.

## Outside the MVP

- Commerce and nursery availability
- Accounts and collaboration
- Ongoing garden management
- National coverage
- Image-based site measurement
- Irregular or multi-level beds

Git is the project history. This brief contains only decisions that still
shape the product.
