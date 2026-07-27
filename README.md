# Silly Goose

A Western Cape garden planner that turns site conditions and a measured
rectangular bed into a provisional plant group, integer quantities and a
coordinate layout.

> **Current reality:** the complete literature-review pipeline now runs in the
> app. The output remains provisional until horticultural tolerances, spacing,
> composition rules and expert AHP comparisons are reviewed.

## Start here

| Question | Document |
|---|---|
| What works and what remains uncertain? | [`docs/NOW.md`](docs/NOW.md) |
| What product are we building? | [`docs/PRODUCT.md`](docs/PRODUCT.md) |
| How do the data and mathematics work? | [`docs/ENGINE.md`](docs/ENGINE.md) |
| What should the site look and sound like? | [`docs/VISUAL.md`](docs/VISUAL.md) |

`NOW.md` is the concise human-facing status. `ENGINE.md` is the implementation
reference.

## What works

- Seven-part garden brief with local draft persistence
- Searchable 48-plant Western Cape pilot catalogue
- Automated audit against the 1,909-taxon mined seed catalogue
- Pass/fail/unknown feasibility trace for every plant
- AHP matrix audit and equal-weight baseline
- Goal Programming soft-goal penalties
- Capacity-checked binary species selection
- Integer plant quantities
- Boundary-safe rectangular canopy placement
- Clickable plan legend, assumptions and diagnostics
- Plant profiles and device-local saved plants

## Important limitations

- Soil and drainage compatibility are absent from the mined datasets.
- Sun, water, area and garden-use fields are provisional editorial groupings.
- BioSCape field-canopy measurements are spacing proxies, not nursery guidance.
- Equal AHP weights are a neutral baseline, not expert calibration.
- The deterministic group and layout algorithms are feasible constructors, not
  proofs of a global optimum.

The interface exposes these limitations instead of turning them into silent
compatibility claims.

## Local development

Requires Node.js 22.13 or newer.

```powershell
npm install
npm run dev
```

Full validation:

```powershell
npm test
npm run lint
npx tsc --noEmit
```

## Repository map

- `app/components/` - application interface
- `app/data/` - 48-plant pilot and labels
- `app/lib/planning/` - brief, feasibility, AHP, Goal Programming, selection,
  quantities and layout
- `tests/` - data-audit, mathematics and rendered-page tests
- `data/` - sources, processing scripts, validated extracts and quality report
- `docs/` - product, status, engine and visual references

Dataset versions, licences and limitations are recorded in
[`data/sources.json`](data/sources.json).
