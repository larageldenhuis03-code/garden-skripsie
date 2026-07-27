# Silly Goose MVP

A desktop-first Western Cape plant-discovery prototype and the foundation for
a measured garden-planning engine.

The product combines an editorial 48-plant starting collection with accepted
taxonomy, Western Cape occurrence evidence and regional trait data. Users can
complete a garden brief, receive a provisional plant shortlist, browse plant
profiles and save plants on their device.

The literature review’s AHP, Goal Programming, multidimensional-knapsack and 2D
layout stages are not implemented yet. The exact execution order is in
`docs/PROJECT.md`.

## Local development

Requires Node.js 22.13 or newer.

```powershell
npm install
npm run dev
```

Production validation:

```powershell
npm run build
npm test
```

## Project map

- `app/` — product interface, recommendation logic and MVP catalogue
- `docs/PROJECT.md` — canonical scope, status and next steps
- `docs/METHODOLOGY.md` — data provenance and target analytical model
- `docs/VISUAL_SYSTEM.md` — copy, typography, active GPT prompt and motion
- `docs/DECISIONS.md` — durable decisions and change history
- `data/processed/` — validated app-oriented source extracts
- `data/raw/` — locally downloaded source archives; intentionally gitignored
- `data/scripts/` — reproducible download and processing pipeline

Start with `docs/PROJECT.md`. Source versions, licences and limitations are
recorded in `data/sources.json`.
