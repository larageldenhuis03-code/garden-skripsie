# Retired scripts

Kept for provenance, not run. Nothing in the live pipeline reads their
output any more.

## combine_plant_database.R — retired 2026-09-18

Merged the BioSCape trait set with PlantZAfrica horticultural profiles and
filtered the result to Western Cape scope, producing
`data/processed/plant_database_western_cape.csv` (and the national archive
`plant_database_full.csv`).

**Superseded by `FINAL.DATASET.FINAL.xlsx`**, imported by
`data/scripts/import_final_dataset.py`. The workbook is the same 2,843
species, but with the sparse measurement fields completed and every value's
provenance recorded (`spread_source`, `height_source`, `sun_source`, …).
Running this script again would overwrite that import with the older,
sparser data — which is why it no longer sits in `data/scripts/`.

It remains readable as the record of how the original catalogue was built:
the PlantZAfrica token mappings, the Western Cape scope rule
(`bioregion` resolved directly **or** coarse `biome` shared with the
Western Cape), and the invasive-species exclusion pass.

## sourcing/ — weekly nursery scrape, retired 2026-09-22

`scrape.py` and its adapters scraped nursery sites once a week (GitHub
workflow `nursery-sourcing.yml`) into `nursery_sourcing.csv`, which
`generate_plants_json.py` baked into every plant as a `sourcing` field
("Listed at … from R…").

**Superseded by live sourcing** (`app/lib/sourcing/`, driven by
`Nursery_Sourcing_Search_Spec.xlsx`): prices, sizes and stock are fetched
live for each layout and never stored as a dataset. The stored CSV was the
kind of dataset the new specification forbids. The match rules in
`matching.py` were ported to `app/lib/sourcing/matching.ts`; the PDF column
logic in `pdf_adapter.py` informed `data/scripts/ingest_catalogues.py`.

## Still live, deliberately not retired

- `data/scripts/build_bioscape_traits.R` — its plant-trait half is
  superseded, but it is still the **only** producer of the spatial layers
  the app uses: `western_cape_bioregions.geojson`,
  `western_cape_outline.geojson` and `south_africa_biome_regions.geojson`,
  consumed by `generate_western_cape_map_svg.py`,
  `generate_biome_map_svg.py` and `assign_place_bioregions.R`.
- `data/scripts/assign_place_bioregions.R` — builds
  `western_cape_places.csv`, the location picker's data. Unrelated to the
  species dataset.
- `data/scripts/data_quality_report.R` — reads the current dataset to
  profile it; an analysis tool, not part of the build.
