# Silly Goose MVP

A functional desktop-first indigenous plant recommender for Western Cape home
gardeners.

The product combines an editorial 48-plant starting collection with accepted
taxonomy, Western Cape occurrence evidence and regional trait data. Users can
complete a garden brief, receive explained recommendations, browse plant
profiles and save a shortlist on their device.

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
- `docs/` — product specification, design decisions, methodology and image prompts
- `data/processed/` — validated app-oriented source extracts
- `data/raw/` — locally downloaded source archives; intentionally gitignored
- `data/scripts/` — reproducible download and processing pipeline

Start with `docs/product-spec.md` and `docs/design-decisions.md`. Source versions,
licences and limitations are recorded in `data/sources.json`.

