# Garden app data foundation

This folder contains a reproducible first data layer for a Western Cape
plant-recommendation prototype. Run:

```powershell
.\data\scripts\fetch_datasets.ps1
```

The command downloads the authoritative source files, the Western Cape
vegetation-map clip, compact app-oriented CSVs, and SHA-256 checksums. The raw
downloads stay local and are gitignored because the BODATSA archive is about
162 MB and licensing/attribution must travel with any redistribution.

## What the app should use

| Priority | Dataset | Role in the app | App-ready extract |
|---|---|---|---|
| 1 | SANPC 2026 | Canonical taxonomy and Western Cape eligibility | `processed/sanpc_western_cape_accepted_taxa.csv` |
| 2 | BODATSA 2026 | Verified Western Cape occurrence evidence | `processed/bodatsa_western_cape_species_summary.csv` |
| 3 | BioSCape GCFR traits 2026 | Height, growth form, phenology and measured canopy dimensions | `processed/bioscape_gcfr_species_traits.csv`, `processed/bioscape_gcfr_canopy_summary.csv` |
| 4 | SANBI alien taxa 2025 + NEMBA notices | Alien/invasive warning and legal exclusion layer | `processed/sanbi_alien_plants_2025.csv`, raw legal PDFs |
| 5 | SANBI Vegetation Map 2018 Western Cape clip | Garden location to vegetation type | raw GeoJSON, `processed/western_cape_vegetation_types_2018.csv` |

`processed/garden_app_seed_catalog.csv` is a conservative joined starting
catalog: 1,909 SANPC-native Western Cape taxa that also have an exact
canonical-name match in BODATSA and BioSCape. It is a data-integration seed,
not a finished recommendation list.

`sources.json` records versions, DOI/licence information, source URLs, intended
use and important limitations.

## Important modelling rules

- Use SANPC as the name backbone. Keep both the source name and the matched
  accepted SANPC identifier when joining other datasets.
- Treat a BODATSA record as evidence of occurrence, not proof that a plant will
  thrive in a garden.
- Present BioSCape dimensions as sourced estimates. Field canopy measurements
  and flora-derived maximum height are not exact nursery mature sizes.
- Do not turn the alien-species checklist into a legal rule by itself. The
  gazetted NEMBA list and commencement notice are the legal evidence.
- Do not invent soil, sun or watering tolerances from occurrence coordinates.
  Those fields need curated horticultural sources and a confidence level.

## Suggested first recommendation gate

For a safe prototype, begin with taxa that:

1. are accepted SANPC taxa recorded for the Western Cape;
2. have at least one Western Cape BODATSA record;
3. are not marked non-native/alien by the alien checklist;
4. are not on the applicable NEMBA prohibited/restricted list; and
5. have a usable growth form or height trait in BioSCape.

After this gate, rank—not filter—by occurrence evidence and trait completeness.
Add soil, light, water and precise mature spread only when those attributes have
an explicit source and confidence.

See `quality_report.md` for row counts, join coverage and known gaps.

