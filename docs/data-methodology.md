# Silly Goose MVP — data methodology

## Source hierarchy

1. SANPC 2026 provides the accepted Western Cape taxonomic backbone.
2. BODATSA 2026 provides Western Cape preserved-specimen occurrence evidence.
3. BioSCape GCFR provides maximum height, growth form, phenology and measured
   canopy observations.
4. The SANBI alien checklist and current NEMBA notices provide warning and
   review evidence.
5. The 2018 Western Cape vegetation map provides a future spatial matching
   layer.

Full source, DOI, version and licence details are in `data/sources.json`.

## MVP catalogue selection

The visible 48 plants are an editorial subset of
`data/processed/garden_app_seed_catalog.csv`. Every selected taxon:

- is accepted by SANPC;
- is marked native or native-endemic for the Western Cape;
- has a canonical-name match in BODATSA;
- has a BioSCape trait record; and
- has no machine-detected regulatory-review flag in the current integration
  seed.

## Field provenance

Source-derived:

- Scientific name and family
- Maximum height
- Growth form
- Flowering period
- Western Cape occurrence count
- Measured median canopy axes when available

Editorial prototype attributes:

- Sun preference
- Water grouping
- Broad site affinity
- Garden uses
- Descriptive copy and common-name presentation

Editorial fields are intentionally labelled in the interface. They are useful
for testing the recommendation flow but require horticultural review before a
public production release.

## Ranking approach

The recommendation score is deterministic. It rewards:

- compatible sunlight;
- compatible water availability;
- size appropriate to the selected space;
- matching garden intentions;
- broad area affinity; and
- stronger occurrence evidence as a small tie-breaker.

Occurrence count never acts as proof of garden suitability. It contributes
less than the user’s observable site conditions.

## Known limitations

- Exact canonical-name joins do not resolve every synonym.
- Herbarium collecting effort is geographically uneven.
- BioSCape canopy measurements are field observations, not guaranteed nursery
  mature dimensions.
- Sun, water and site-affinity fields need expert review.
- Legal exclusion logic must be reviewed against Gazette text before it can
  block recommendations in production.

