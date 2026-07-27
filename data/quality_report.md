# Data quality report

Validated on 2026-07-27 after downloading and processing the selected sources.

## Coverage

| Layer | Validated coverage |
|---|---|
| SANPC 2026 v1.3 | 64,644 distribution rows in the archive; 13,491 accepted Western Cape plant taxa in the extract: 11,501 species, 985 subspecies, 988 varieties and 17 forms. Of these, 10,021 are marked `nativeEndemic`, 2,690 `native`, 777 introduced and 3 uncertain. |
| BODATSA 2026 v1.32 | 1,352,487 preserved-specimen records nationally; 362,384 South African Western Cape records. The extract contains 17,613 taxon-level rows / 16,674 canonical names. |
| BioSCape GCFR traits v1 | 2,213 unique species-level trait rows with maximum height; 1,335 taxa with measured canopy-axis pairs. |
| SANBI alien taxa 2025 | 6,198 total workbook records and 103 source fields; 3,832 plant records in the focused extract. Plant regulatory values include 42 category 1a, 209 category 1b, 14 category 2, 37 category 3 and 81 context-specific rows. |
| Vegetation Map 2018 clip | 10,601 valid GeoJSON polygons, 179 vegetation names and 173 map codes. |

All three Darwin Core archives pass ZIP integrity checks. The Zenodo workbook
matches its published MD5 checksum (`348ef9c999319493354b8b6d15f016a6`).
The legal downloads have valid PDF signatures. SHA-256 hashes for every raw file
are generated in `checksums.sha256`.

## Join coverage

Canonical-name normalization is necessary because BODATSA embeds authorship in
`scientificName` while SANPC stores authorship separately.

| Exact canonical-name intersection | Taxa |
|---|---:|
| SANPC Western Cape × BODATSA Western Cape | 11,030 |
| SANPC Western Cape × BioSCape species traits | 1,967 |
| BODATSA Western Cape × BioSCape species traits | 2,100 |
| SANPC Western Cape × SANBI alien checklist | 492 |

The conservative `garden_app_seed_catalog.csv` contains 1,909 taxa marked
native/native-endemic by SANPC and found in both BODATSA and BioSCape. Of those,
1,135 have canopy measurements. Its joins are intentionally exact after
canonical-name normalization; synonym resolution should be added before
production.

## Known gaps and safeguards

- No selected source gives comprehensive plant-level sun, shade, soil texture,
  soil pH and irrigation tolerances. These must be curated with provenance.
- BODATSA occurrence density is biased by collecting effort and is not a
  garden-performance score.
- BioSCape field canopy measurements are not guaranteed mature nursery
  dimensions.
- SANPC's `threatStatus` field is almost empty. Use the current SANBI Red List
  as a separate conservation authority.
- The Western Cape spatial service exposes the 2018 vegetation map. SANBI's
  2024 national map is newer; migrate when a practical download and hosting
  format is chosen.
- The full vegetation GeoJSON is about 254 MB. It belongs in a spatial database
  or vector-tile pipeline for production, not in the browser bundle.
- Alien-checklist categories are evidence, not legal advice. Production
  exclusion rules need a reviewed machine-readable transcription of the current
  NEMBA list and regulations, retaining Gazette citations and effective dates.

