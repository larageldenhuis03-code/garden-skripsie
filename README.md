# Silly Goose

A Western Cape garden planner that turns real site conditions and a measured
bed into a suitable plant group, quantities and a practical layout.

> **Current reality:** the live product is a plant-discovery prototype. The
> planning mathematics exists and is tested, but it is not yet calibrated or
> connected to recommendations.

## Start here

| If you want to know… | Read |
|---|---|
| What works, what is next and what needs input | [`docs/NOW.md`](docs/NOW.md) |
| What product we are building and what is out of scope | [`docs/PRODUCT.md`](docs/PRODUCT.md) |
| How the data and planning mathematics work | [`docs/ENGINE.md`](docs/ENGINE.md) |
| What the site should look and sound like | [`docs/VISUAL.md`](docs/VISUAL.md) |

`NOW.md` is the human-facing source of truth for status. The other documents
are stable references and should change less often.

## What already works

- Desktop-first garden brief
- Provisional plant recommendations
- Searchable 48-plant Western Cape catalogue
- Plant details, evidence notes and device-local saving
- Reproducible SANBI-led data foundation
- Tested AHP, hard-constraint, Goal Programming and group-selection modules

The current recommendations still use a hand-set heuristic. They must not be
described as scientific optimisation.

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

- `app/` — interface, current heuristic, catalogue and planning modules
- `tests/` — mathematical and rendered-page tests
- `data/` — sources, processing scripts, validated extracts and quality report
- `docs/` — product, status, engine and visual references
- `.openai/hosting.json` — private Sites project binding

Dataset versions, licences and limitations are recorded in
[`data/sources.json`](data/sources.json).
