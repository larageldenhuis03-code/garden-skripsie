# Sourcing before / after the per-nursery split

Before: https://53462cf1-silly-goose-mvp.larageldenhuis03.workers.dev (one request, 42-request budget). After: https://7022ed2f-silly-goose-mvp.larageldenhuis03.workers.dev (one request per nursery). Dev: http://localhost:3000 (no cap).

## A  Stellenbosch fynbos 6 x 4 (Stellenbosch): 6 species, 22 plants

| | budget Low / Typical / High | plants priced from live listings | species found / estimated / not found | nurseries checked | HTTP calls | seconds |
|---|---|---|---|---|---|---|
| before (deployed, 1 request) | R0 / R0 / R0 | 0% | 0 / 0 / 6 | 0 of 5 | 1 | 27 |
| after (preview, split) | R350 / R350 / R350 | 32% | 1 / 0 / 5 | 5 of 5 | 7 | 24 |
| dev server (no cap, split) | R350 / R350 / R350 | 32% | 1 / 0 / 5 | 5 of 5 | 7 | 5 |

- before (deployed, 1 request): ClicknPlant checked (some plants not checked - the request limit was reached); Plantify checked (some plants not checked - the request limit was reached); Cape Garden Centre checked (some plants not checked - the request limit was reached); Stodels checked (some plants not checked - the request limit was reached); Tulbagh Nursery skipped (not checked this time - the request limit was reached); Garden Route Botanical Garden — Indigenous Plant Nursery (George) skipped (no source id in 3_PDF_Sources); Kraaibosch (George) skipped (no source id in 3_PDF_Sources); Samgro (Wellington) skipped (no source id in 3_PDF_Sources); Prime Trees skipped (no source id in 3_PDF_Sources)
- after (preview, split): Stodels checked (platform detected: woocommerce); Tulbagh Nursery checked (platform detected: woocommerce); Garden Route Botanical Garden — Indigenous Plant Nursery (George) skipped (no source id in 3_PDF_Sources); Kraaibosch (George) skipped (no source id in 3_PDF_Sources); Samgro (Wellington) skipped (no source id in 3_PDF_Sources); Prime Trees skipped (no source id in 3_PDF_Sources)
- dev server (no cap, split): Stodels checked (platform detected: woocommerce); Tulbagh Nursery checked (platform detected: woocommerce); Garden Route Botanical Garden — Indigenous Plant Nursery (George) skipped (no source id in 3_PDF_Sources); Kraaibosch (George) skipped (no source id in 3_PDF_Sources); Samgro (Wellington) skipped (no source id in 3_PDF_Sources); Prime Trees skipped (no source id in 3_PDF_Sources)

## B  Cottage 10 x 6 clay (Hermanus): 10 species, 28 plants

| | budget Low / Typical / High | plants priced from live listings | species found / estimated / not found | nurseries checked | HTTP calls | seconds |
|---|---|---|---|---|---|---|
| before (deployed, 1 request) | R0 / R0 / R0 | 0% | 0 / 0 / 10 | 0 of 5 | 1 | 29 |
| after (preview, split) | R1,399 / R1,399 / R1,399 | 11% | 1 / 7 / 2 | 5 of 5 | 7 | 35 |
| dev server (no cap, split) | R1,399 / R1,399 / R1,399 | 11% | 1 / 7 / 2 | 5 of 5 | 7 | 24 |

- before (deployed, 1 request): Cape Garden Centre checked (some plants not checked - the request limit was reached); Plantify checked (some plants not checked - the request limit was reached); Stodels checked (some plants not checked - the request limit was reached); ClicknPlant checked (some plants not checked - the request limit was reached); Tulbagh Nursery skipped (not checked this time - the request limit was reached); Garden Route Botanical Garden — Indigenous Plant Nursery (George) skipped (no source id in 3_PDF_Sources); Kraaibosch (George) skipped (no source id in 3_PDF_Sources); Samgro (Wellington) skipped (no source id in 3_PDF_Sources); Prime Trees skipped (no source id in 3_PDF_Sources)
- after (preview, split): Stodels checked (platform detected: woocommerce); Tulbagh Nursery checked (platform detected: woocommerce); Garden Route Botanical Garden — Indigenous Plant Nursery (George) skipped (no source id in 3_PDF_Sources); Kraaibosch (George) skipped (no source id in 3_PDF_Sources); Samgro (Wellington) skipped (no source id in 3_PDF_Sources); Prime Trees skipped (no source id in 3_PDF_Sources)
- dev server (no cap, split): Stodels checked (platform detected: woocommerce); Tulbagh Nursery checked (platform detected: woocommerce); Garden Route Botanical Garden — Indigenous Plant Nursery (George) skipped (no source id in 3_PDF_Sources); Kraaibosch (George) skipped (no source id in 3_PDF_Sources); Samgro (Wellington) skipped (no source id in 3_PDF_Sources); Prime Trees skipped (no source id in 3_PDF_Sources)

