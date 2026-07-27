# Silly Goose MVP — product specification

Status: plant-discovery prototype
Updated: 2026-07-27

## Product promise

Silly Goose will turn a gardener’s site conditions, bed dimensions and design
preferences into a practical Western Cape planting plan.

The current build proves the first part of that promise: a user can describe a
few broad conditions, review a provisional plant shortlist, inspect the
supporting fields and save plants. It does not yet calculate quantities or
placement.

## Primary user

A beginner or intermediate home gardener in the Western Cape who wants to use
indigenous plants but does not know which plants fit the site or how many to
plant. Desktop is the primary planning surface; narrower screens remain
supported.

## Current journey

1. Choose a broad Western Cape area.
2. Describe sunlight, water availability and approximate growing space.
3. Choose one or more garden intentions.
4. Receive a provisionally ordered plant list.
5. Open plant details and see which fields are sourced or editorial.
6. Save plants on the current device.

## Current functionality

- Desktop-first landing page
- Five-question plant finder
- Provisional, explained plant ordering
- Searchable and filterable 48-plant library
- Plant detail drawer
- Device-local saved list
- Honest methodology/status page

## What the current build is not

- It is not the complete research-paper MVP.
- It does not implement AHP-derived weights or their consistency check.
- It does not implement Goal Programming.
- It does not apply a complete hard environmental or legal filter.
- It does not collect exact bed geometry or soil conditions.
- It does not calculate plant quantities or produce a 2D layout.

## Next product milestone: the planning engine

The next milestone starts after the plant data and constraint rules are
reviewed. It will:

1. collect soil, exact bed dimensions/shape and design direction;
2. reject plants that violate hard geographic, legal or environmental rules;
3. rank feasible plants with expert-calibrated AHP weights inside a Goal
   Programming model;
4. select a balanced plant group under bed-area and category constraints;
5. calculate quantities from mature canopy and open-space allowance; and
6. return a measured 2D planting layout, legend, assumptions and care notes.

The implementation sequence is recorded in
`docs/implementation-roadmap.md`.

## Acceptance criteria for the planning-engine milestone

- No plant that fails a reviewed hard constraint reaches the candidate pool.
- The AHP comparison matrix passes the documented consistency threshold.
- Every soft-ranking contribution can be explained in plain language.
- Selected canopy area and category ratios satisfy the model constraints.
- The layout remains inside the user’s bed boundary and avoids overlap at the
  modelled mature spread.
- The result states assumptions, data gaps and fields that still require local
  nursery or horticultural verification.

## Out of scope until the planning engine is credible

- Accounts and cross-device persistence
- Nursery stock and pricing
- Automated purchasing
- Precise maintenance schedules
- Nationwide rollout
- Computer-vision site surveys
