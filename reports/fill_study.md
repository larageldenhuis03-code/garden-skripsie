# Ground-cover fill study

Measurement only. Rulebook as imported (`098c8d085f61`), with every style's
cover_min at 0.90 and cover_max at 1.0 in memory, and the contact bonus at 0.
100 garden briefs; medians over those that produced a plan.

| case | change | gardens | median bare | worst 10% bare | bare <= 20% | bare <= 10% | hard-rule failures | median Z | median A1 | median plants | time |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ref | no fill, target 90% | 93 | 0.325 | 0.519 | 8 | 0 | 0 | 0.9102 | 0.919 | 19 | 70s |
| F1 | + ground-cover fill | 93 | 0.323 | 0.486 | 10 | 0 | 0 | 0.9091 | 0.867 | 22 | 67s |
| F2 | + base layer exempt from H5 | 94 | 0.321 | 0.507 | 12 | 0 | 0 | 0.9032 | 0.815 | 25 | 1510s |
| F3 | + exempt from H3 | 94 | 0.266 | 0.407 | 20 | 3 | 0 | 0.8949 | 0.754 | 28 | 71s |
| F4 | + may tuck under taller plants | 94 | 0.229 | 0.359 | 35 | 7 | 0 | 0.8945 | 0.649 | 41 | 66s |
| F5 | + add a ground cover if none | 94 | 0.212 | 0.339 | 40 | 7 | 0 | 0.8903 | 0.605 | 42 | 66s |
