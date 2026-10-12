# Coverage test - V0 / V1 / V2

**Measurement only. No engine change, no rulebook change, nothing deployed.**

Rulebook as imported: `098c8d085f61`. The workbook on disk was never
read or re-imported by this run.

| version | what it changes |
|---|---|
| **V0** | baseline, as imported |
| **V2** | contact-point preference 0 |
| **V5** | contact 0, cover_min a hard floor |
| **V6** | V5 plus the gap-fill pass |

V1 and V2 are in-memory overrides applied around each run and undone
afterwards - the same technique the Chapter 5 sensitivity study uses.

Every figure is the median with the 10th-90th percentile in brackets,
over the plans that produced a layout. Percentiles are PERCENTILE.INC.

## All 100 scenarios

| measure | V0 | V2 | V5 | V6 |
|---|---|---|---|---|
| cover | 0.665 (0.506-0.777) | 0.668 (0.528-0.773) | 0.666 (0.570-0.774) | 0.666 (0.529-0.767) |
| empty-cell share | 0.340 (0.238-0.493) | 0.338 (0.242-0.485) | 0.340 (0.238-0.426) | 0.340 (0.242-0.463) |
| largest empty patch | 0.165 (0.079-0.360) | 0.150 (0.073-0.321) | 0.150 (0.068-0.317) | 0.150 (0.073-0.318) |
| square metres >= 50% planted | 0.775 (0.508-0.980) | 0.778 (0.545-1.000) | 0.792 (0.612-1.000) | 0.778 (0.553-1.000) |
| quadrant CV | 0.212 (0.088-0.425) | 0.156 (0.074-0.376) | 0.141 (0.072-0.346) | 0.139 (0.066-0.360) |
| species | 6.0 (3.0-12.0) | 6.0 (4.0-12.0) | 6.0 (3.4-12.0) | 6.0 (3.4-12.0) |
| plants | 20.0 (9.4-44.6) | 19.0 (10.0-45.6) | 22.0 (11.0-48.0) | 24.0 (12.0-48.0) |
| Z | 0.9196 (0.8389-0.9790) | 0.9293 (0.8211-0.9788) | 0.9093 (0.8172-0.9743) | 0.9001 (0.8177-0.9672) |
| A1 height balance | 0.929 (0.738-0.990) | 0.900 (0.711-0.990) | 0.875 (0.631-0.990) | 0.850 (0.623-0.967) |
| A2 colour | 1.000 (0.750-1.000) | 1.000 (0.750-1.000) | 1.000 (0.667-1.000) | 1.000 (0.667-1.000) |
| A3 variety | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) |
| A4 ground cover | 0.914 (0.701-1.000) | 0.906 (0.705-1.000) | 0.932 (0.740-1.000) | 0.905 (0.729-1.000) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 30 (11-70) | 28 (12-79) | 35 (15-88) | 35 (15-90) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 460 (374-749) | 456 (378-707) | 452 (386-618) | 484 (398-743) |
| **feasible** | 95 / 100 | 95 / 100 | 95 / 100 | 95 / 100 |
| **hard violations** | 0 | 0 | 0 | 0 |
| **reached its target cover** | 32 / 95 | 33 / 95 | 39 / 95 | 34 / 95 |
| **flagged cover_short** | 0 / 95 | 0 / 95 | 52 / 95 | 56 / 95 |

## By style

### cottage

| measure | V0 | V2 | V5 | V6 |
|---|---|---|---|---|
| cover | 0.669 (0.559-0.757) | 0.679 (0.563-0.757) | 0.688 (0.589-0.750) | 0.688 (0.544-0.750) |
| empty-cell share | 0.343 (0.258-0.442) | 0.333 (0.256-0.439) | 0.314 (0.258-0.426) | 0.314 (0.258-0.462) |
| largest empty patch | 0.149 (0.067-0.350) | 0.111 (0.078-0.246) | 0.120 (0.079-0.227) | 0.119 (0.086-0.241) |
| square metres >= 50% planted | 0.722 (0.638-0.897) | 0.817 (0.667-1.000) | 0.833 (0.667-1.000) | 0.861 (0.550-1.000) |
| quadrant CV | 0.152 (0.075-0.366) | 0.133 (0.087-0.295) | 0.118 (0.075-0.257) | 0.118 (0.070-0.242) |
| species | 4.5 (3.0-10.8) | 5.0 (4.0-10.8) | 5.0 (3.3-11.7) | 5.0 (3.3-11.7) |
| plants | 18.0 (9.3-54.8) | 18.5 (10.0-44.1) | 21.5 (11.0-52.1) | 21.5 (12.3-45.1) |
| Z | 0.9084 (0.8503-0.9566) | 0.9257 (0.8251-0.9679) | 0.8984 (0.8317-0.9539) | 0.8975 (0.8340-0.9554) |
| A1 height balance | 0.867 (0.765-0.984) | 0.825 (0.737-0.961) | 0.800 (0.619-0.955) | 0.800 (0.609-0.941) |
| A2 colour | 1.000 (0.667-1.000) | 1.000 (0.692-1.000) | 1.000 (0.692-1.000) | 1.000 (0.692-1.000) |
| A3 variety | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) | 1.000 (0.922-1.000) |
| A4 ground cover | 0.787 (0.658-0.890) | 0.799 (0.663-0.890) | 0.809 (0.693-0.883) | 0.809 (0.641-0.883) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 30 (8-66) | 31 (15-53) | 40 (14-90) | 40 (16-90) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 457 (381-785) | 451 (378-673) | 455 (384-601) | 493 (405-705) |
| **feasible** | 24 / 26 | 24 / 26 | 24 / 26 | 24 / 26 |
| **hard violations** | 0 | 0 | 0 | 0 |
| **reached its target cover** | 1 / 24 | 1 / 24 | 1 / 24 | 0 / 24 |
| **flagged cover_short** | 0 / 24 | 0 / 24 | 19 / 24 | 20 / 24 |

### fynbos

| measure | V0 | V2 | V5 | V6 |
|---|---|---|---|---|
| cover | 0.656 (0.557-0.749) | 0.641 (0.515-0.755) | 0.657 (0.570-0.760) | 0.658 (0.571-0.760) |
| empty-cell share | 0.349 (0.247-0.442) | 0.359 (0.251-0.479) | 0.340 (0.251-0.423) | 0.338 (0.251-0.417) |
| largest empty patch | 0.164 (0.086-0.265) | 0.151 (0.067-0.385) | 0.122 (0.067-0.317) | 0.122 (0.067-0.309) |
| square metres >= 50% planted | 0.854 (0.589-1.000) | 0.813 (0.513-1.000) | 0.833 (0.609-1.000) | 0.833 (0.622-1.000) |
| quadrant CV | 0.179 (0.089-0.349) | 0.135 (0.064-0.319) | 0.160 (0.075-0.287) | 0.146 (0.075-0.287) |
| species | 4.5 (3.0-7.7) | 5.0 (3.0-7.7) | 5.0 (3.0-8.0) | 5.0 (3.0-8.0) |
| plants | 15.5 (9.0-34.0) | 15.0 (9.0-32.5) | 19.5 (9.0-45.0) | 19.5 (9.3-46.8) |
| Z | 0.9250 (0.8438-0.9821) | 0.9223 (0.8383-0.9783) | 0.9036 (0.8237-0.9797) | 0.8991 (0.8289-0.9797) |
| A1 height balance | 0.879 (0.700-0.974) | 0.872 (0.663-0.973) | 0.840 (0.617-0.977) | 0.836 (0.533-0.977) |
| A2 colour | 1.000 (0.750-1.000) | 1.000 (0.692-1.000) | 1.000 (0.667-1.000) | 1.000 (0.667-1.000) |
| A3 variety | 1.000 (0.889-1.000) | 1.000 (0.811-1.000) | 1.000 (0.656-1.000) | 1.000 (0.656-1.000) |
| A4 ground cover | 0.937 (0.796-1.000) | 0.916 (0.735-1.000) | 0.938 (0.815-1.000) | 0.940 (0.816-1.000) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 24 (10-57) | 24 (9-57) | 32 (10-137) | 32 (14-142) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 447 (376-645) | 478 (383-638) | 440 (397-596) | 493 (408-652) |
| **feasible** | 24 / 25 | 24 / 25 | 24 / 25 | 24 / 25 |
| **hard violations** | 0 | 0 | 0 | 0 |
| **reached its target cover** | 7 / 24 | 8 / 24 | 10 / 24 | 10 / 24 |
| **flagged cover_short** | 0 / 24 | 0 / 24 | 13 / 24 | 13 / 24 |

### mediterranean

| measure | V0 | V2 | V5 | V6 |
|---|---|---|---|---|
| cover | 0.634 (0.497-0.717) | 0.637 (0.521-0.694) | 0.634 (0.568-0.708) | 0.629 (0.472-0.708) |
| empty-cell share | 0.372 (0.286-0.516) | 0.367 (0.307-0.489) | 0.369 (0.305-0.421) | 0.372 (0.304-0.538) |
| largest empty patch | 0.251 (0.103-0.418) | 0.273 (0.111-0.358) | 0.235 (0.138-0.336) | 0.262 (0.138-0.370) |
| square metres >= 50% planted | 0.700 (0.501-0.874) | 0.682 (0.552-0.788) | 0.694 (0.603-0.773) | 0.677 (0.461-0.773) |
| quadrant CV | 0.258 (0.104-0.434) | 0.222 (0.125-0.433) | 0.249 (0.090-0.421) | 0.264 (0.089-0.438) |
| species | 6.5 (5.0-12.0) | 7.0 (5.1-12.0) | 6.0 (5.1-12.0) | 6.0 (5.1-12.0) |
| plants | 28.5 (14.2-41.6) | 26.0 (16.0-50.1) | 26.0 (15.1-42.0) | 26.5 (15.1-47.2) |
| Z | 0.9461 (0.8909-0.9866) | 0.9500 (0.8979-0.9946) | 0.9563 (0.8915-0.9808) | 0.9472 (0.8784-0.9709) |
| A1 height balance | 0.981 (0.901-0.990) | 0.987 (0.880-0.992) | 0.979 (0.705-0.992) | 0.915 (0.705-0.965) |
| A2 colour | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| A3 variety | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| A4 ground cover | 1.000 (0.829-1.000) | 1.000 (0.868-1.000) | 1.000 (0.947-1.000) | 1.000 (0.786-1.000) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 36 (16-59) | 37 (15-60) | 27 (16-72) | 24 (16-65) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 460 (385-687) | 485 (384-761) | 460 (385-618) | 476 (381-781) |
| **feasible** | 22 / 24 | 22 / 24 | 22 / 24 | 22 / 24 |
| **hard violations** | 0 | 0 | 0 | 0 |
| **reached its target cover** | 15 / 22 | 15 / 22 | 18 / 22 | 16 / 22 |
| **flagged cover_short** | 0 / 22 | 0 / 22 | 4 / 22 | 6 / 22 |

### undecided

| measure | V0 | V2 | V5 | V6 |
|---|---|---|---|---|
| cover | 0.733 (0.505-0.809) | 0.697 (0.519-0.809) | 0.735 (0.580-0.803) | 0.691 (0.558-0.798) |
| empty-cell share | 0.285 (0.208-0.492) | 0.305 (0.205-0.487) | 0.282 (0.206-0.427) | 0.307 (0.208-0.446) |
| largest empty patch | 0.140 (0.075-0.370) | 0.128 (0.043-0.297) | 0.128 (0.054-0.241) | 0.142 (0.059-0.263) |
| square metres >= 50% planted | 0.823 (0.502-0.866) | 0.833 (0.658-0.887) | 0.844 (0.654-1.000) | 0.844 (0.617-1.000) |
| quadrant CV | 0.213 (0.097-0.439) | 0.157 (0.084-0.382) | 0.139 (0.067-0.264) | 0.138 (0.053-0.318) |
| species | 7.0 (4.0-13.2) | 6.0 (4.0-13.6) | 8.0 (4.0-15.2) | 8.0 (4.0-14.0) |
| plants | 30.0 (10.0-45.2) | 28.0 (10.0-47.2) | 30.0 (14.4-47.2) | 30.0 (15.4-44.8) |
| Z | 0.9015 (0.7126-0.9651) | 0.8911 (0.7126-0.9614) | 0.8962 (0.6747-0.9514) | 0.8840 (0.6756-0.9514) |
| A1 height balance | 0.950 (0.800-0.995) | 0.944 (0.678-0.994) | 0.887 (0.669-0.990) | 0.867 (0.651-0.985) |
| A2 colour | 1.000 (0.750-1.000) | 1.000 (0.750-1.000) | 1.000 (0.700-1.000) | 1.000 (0.700-1.000) |
| A3 variety | 1.000 (0.822-1.000) | 1.000 (0.822-1.000) | 1.000 (0.933-1.000) | 1.000 (1.000-1.000) |
| A4 ground cover | 0.978 (0.673-1.000) | 0.929 (0.692-1.000) | 0.980 (0.773-1.000) | 0.921 (0.744-1.000) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 30 (14-99) | 31 (14-87) | 44 (21-91) | 39 (23-91) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 479 (372-659) | 437 (372-729) | 452 (388-653) | 477 (393-739) |
| **feasible** | 25 / 25 | 25 / 25 | 25 / 25 | 25 / 25 |
| **hard violations** | 0 | 0 | 0 | 0 |
| **reached its target cover** | 9 / 25 | 9 / 25 | 10 / 25 | 8 / 25 |
| **flagged cover_short** | 0 / 25 | 0 / 25 | 16 / 25 | 17 / 25 |

## By bed-size band

### small (<6 m2)

| measure | V0 | V2 | V5 | V6 |
|---|---|---|---|---|
| cover | 0.651 (0.560-0.684) | 0.665 (0.521-0.726) | 0.641 (0.573-0.726) | 0.641 (0.573-0.726) |
| empty-cell share | 0.352 (0.317-0.439) | 0.347 (0.280-0.471) | 0.367 (0.280-0.416) | 0.367 (0.280-0.416) |
| largest empty patch | 0.160 (0.105-0.233) | 0.147 (0.073-0.377) | 0.203 (0.073-0.305) | 0.203 (0.073-0.305) |
| square metres >= 50% planted | 1.000 (0.800-1.000) | 1.000 (0.700-1.000) | 1.000 (0.800-1.000) | 1.000 (0.800-1.000) |
| quadrant CV | 0.124 (0.060-0.260) | 0.113 (0.083-0.334) | 0.281 (0.083-0.287) | 0.281 (0.083-0.287) |
| species | 3.0 (3.0-3.0) | 3.0 (3.0-3.0) | 3.0 (3.0-3.0) | 3.0 (3.0-3.0) |
| plants | 9.0 (7.8-11.4) | 9.0 (7.8-13.4) | 9.0 (7.8-13.4) | 9.0 (7.8-13.4) |
| Z | 0.8756 (0.5604-0.8994) | 0.8774 (0.5449-0.9091) | 0.8774 (0.5388-0.8936) | 0.8774 (0.5388-0.8936) |
| A1 height balance | 0.700 (0.520-0.793) | 0.633 (0.384-0.856) | 0.633 (0.384-0.797) | 0.633 (0.384-0.797) |
| A2 colour | 1.000 (0.700-1.000) | 1.000 (0.800-1.000) | 1.000 (0.700-1.000) | 1.000 (0.700-1.000) |
| A3 variety | 0.778 (0.578-0.889) | 0.778 (0.489-0.956) | 0.778 (0.489-0.956) | 0.778 (0.489-0.956) |
| A4 ground cover | 0.887 (0.800-0.969) | 0.887 (0.744-0.998) | 0.915 (0.792-0.998) | 0.915 (0.792-0.998) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 25 (15-38) | 27 (13-46) | 27 (16-46) | 27 (16-46) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 448 (401-631) | 505 (459-654) | 442 (396-664) | 529 (423-600) |
| **feasible** | 5 / 5 | 5 / 5 | 5 / 5 | 5 / 5 |
| **hard violations** | 0 | 0 | 0 | 0 |
| **reached its target cover** | 0 / 5 | 1 / 5 | 1 / 5 | 1 / 5 |
| **flagged cover_short** | 0 / 5 | 0 / 5 | 4 / 5 | 4 / 5 |

### medium (6-30 m2)

| measure | V0 | V2 | V5 | V6 |
|---|---|---|---|---|
| cover | 0.660 (0.500-0.753) | 0.645 (0.535-0.755) | 0.657 (0.570-0.755) | 0.662 (0.570-0.755) |
| empty-cell share | 0.343 (0.251-0.505) | 0.350 (0.258-0.474) | 0.355 (0.259-0.432) | 0.352 (0.259-0.432) |
| largest empty patch | 0.165 (0.080-0.341) | 0.150 (0.081-0.318) | 0.138 (0.085-0.301) | 0.138 (0.084-0.281) |
| square metres >= 50% planted | 0.750 (0.500-0.967) | 0.778 (0.517-1.000) | 0.792 (0.610-1.000) | 0.833 (0.610-1.000) |
| quadrant CV | 0.183 (0.085-0.408) | 0.153 (0.066-0.351) | 0.139 (0.066-0.274) | 0.133 (0.065-0.265) |
| species | 5.0 (3.0-7.0) | 5.0 (4.0-7.0) | 5.0 (4.0-7.6) | 5.0 (4.0-7.6) |
| plants | 16.0 (9.4-34.0) | 18.0 (10.0-29.2) | 19.0 (11.0-40.4) | 19.0 (12.0-45.2) |
| Z | 0.9105 (0.8389-0.9784) | 0.9133 (0.8211-0.9765) | 0.8988 (0.8172-0.9693) | 0.8981 (0.8177-0.9693) |
| A1 height balance | 0.900 (0.752-0.963) | 0.867 (0.663-0.958) | 0.821 (0.622-0.964) | 0.800 (0.604-0.948) |
| A2 colour | 1.000 (0.700-1.000) | 1.000 (0.700-1.000) | 1.000 (0.567-1.000) | 1.000 (0.567-1.000) |
| A3 variety | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) |
| A4 ground cover | 0.864 (0.666-1.000) | 0.861 (0.664-1.000) | 0.870 (0.711-1.000) | 0.873 (0.711-1.000) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 23 (8-58) | 24 (10-53) | 28 (13-87) | 28 (14-95) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 466 (376-617) | 448 (377-624) | 452 (395-580) | 485 (405-656) |
| **feasible** | 55 / 60 | 55 / 60 | 55 / 60 | 55 / 60 |
| **hard violations** | 0 | 0 | 0 | 0 |
| **reached its target cover** | 11 / 55 | 12 / 55 | 15 / 55 | 15 / 55 |
| **flagged cover_short** | 0 / 55 | 0 / 55 | 35 / 55 | 35 / 55 |

### large (>=30 m2)

| measure | V0 | V2 | V5 | V6 |
|---|---|---|---|---|
| cover | 0.696 (0.513-0.809) | 0.678 (0.558-0.809) | 0.711 (0.584-0.798) | 0.680 (0.507-0.787) |
| empty-cell share | 0.328 (0.208-0.483) | 0.330 (0.207-0.453) | 0.302 (0.209-0.406) | 0.325 (0.222-0.498) |
| largest empty patch | 0.168 (0.075-0.429) | 0.150 (0.051-0.314) | 0.152 (0.064-0.317) | 0.160 (0.065-0.318) |
| square metres >= 50% planted | 0.771 (0.525-0.865) | 0.733 (0.574-0.865) | 0.775 (0.616-0.884) | 0.725 (0.508-0.865) |
| quadrant CV | 0.218 (0.104-0.431) | 0.175 (0.087-0.382) | 0.141 (0.084-0.373) | 0.148 (0.081-0.426) |
| species | 10.0 (6.0-14.0) | 10.0 (6.0-14.0) | 10.0 (6.0-15.2) | 10.0 (6.0-15.2) |
| plants | 35.0 (16.0-49.2) | 35.0 (16.0-51.0) | 33.0 (16.0-49.6) | 32.0 (16.8-52.2) |
| Z | 0.9426 (0.8629-0.9790) | 0.9436 (0.8629-0.9825) | 0.9459 (0.8567-0.9770) | 0.9284 (0.8557-0.9657) |
| A1 height balance | 0.984 (0.879-0.998) | 0.988 (0.830-0.998) | 0.981 (0.790-0.994) | 0.908 (0.770-0.985) |
| A2 colour | 1.000 (0.850-1.000) | 1.000 (0.850-1.000) | 1.000 (0.850-1.000) | 1.000 (0.850-1.000) |
| A3 variety | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| A4 ground cover | 1.000 (0.781-1.000) | 1.000 (0.849-1.000) | 1.000 (0.804-1.000) | 1.000 (0.748-1.000) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 46 (19-90) | 44 (18-86) | 48 (18-88) | 41 (18-88) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 444 (372-996) | 456 (381-872) | 458 (379-703) | 470 (385-892) |
| **feasible** | 35 / 35 | 35 / 35 | 35 / 35 | 35 / 35 |
| **hard violations** | 0 | 0 | 0 | 0 |
| **reached its target cover** | 21 / 35 | 20 / 35 | 23 / 35 | 18 / 35 |
| **flagged cover_short** | 0 / 35 | 0 / 35 | 13 / 35 | 17 / 35 |

## What stopped a plan reaching its target cover

`count` - even at the largest group size H3 allows for each species it
chose, the canopy could not add up to the target.

`placement` - it selected enough canopy, but Stage 4 could not fit it in.

`pool` - it used fewer species than H2 would have allowed.

Tested in that order, first match wins. The per-plan flags are in
`reports/coverage_test.csv` so overlaps stay visible.

| group | version | short of target | count | placement | pool | pool: exhausted | pool: stopped early |
|---|---|---|---|---|---|---|---|
| all | V0 | 63 | 5 | 0 | 50 | 0 | 50 |
| all | V2 | 62 | 4 | 0 | 53 | 0 | 53 |
| all | V5 | 56 | 4 | 0 | 46 | 0 | 46 |
| all | V6 | 61 | 5 | 0 | 50 | 0 | 50 |
| small (<6 m2) | V0 | 5 | 0 | 0 | 5 | 0 | 5 |
| small (<6 m2) | V2 | 4 | 0 | 0 | 4 | 0 | 4 |
| small (<6 m2) | V5 | 4 | 0 | 0 | 4 | 0 | 4 |
| small (<6 m2) | V6 | 4 | 0 | 0 | 4 | 0 | 4 |
| medium (6-30 m2) | V0 | 44 | 3 | 0 | 33 | 0 | 33 |
| medium (6-30 m2) | V2 | 43 | 2 | 0 | 36 | 0 | 36 |
| medium (6-30 m2) | V5 | 40 | 4 | 0 | 30 | 0 | 30 |
| medium (6-30 m2) | V6 | 40 | 4 | 0 | 30 | 0 | 30 |
| large (>=30 m2) | V0 | 14 | 2 | 0 | 12 | 0 | 12 |
| large (>=30 m2) | V2 | 15 | 2 | 0 | 13 | 0 | 13 |
| large (>=30 m2) | V5 | 12 | 0 | 0 | 12 | 0 | 12 |
| large (>=30 m2) | V6 | 17 | 1 | 0 | 16 | 0 | 16 |

## Figures

`reports/figures/coverage_test/` - one small, one medium and one large
bed, plus a Mediterranean and a Cottage example, each in V0, V1 and V2
on the same seed.

## What this says

**V2 is the best of the four, and it is the simplest.** Taking the
contact-point preference to 0 moves the median quadrant CV from
0.212 to 0.156 (-26%) and the median largest
empty patch from 0.165 to 0.150 (-9%).
Cover is unchanged at 0.668 against 0.665, the same
95 of 100 scenarios stay feasible, no hard rule breaks, and
median Z goes slightly up, 0.9196 to 0.9293. That bonus
was packing plants against the bed edge and against each other, which
is exactly what reads as a clump.

**V1 does not do what it was meant to do.** Raising cover_max to 1.0
and cover_min to 0.95 moves median cover from 0.665 to
- - no gain. Not one plan of 0 reached 0.95.
H1 was not what was holding cover down, so removing it changes little.
It costs: A4 falls from 0.914 to -, because A4 is
measured against cover_min and the target moved; median Z follows it
down, 0.9196 to -; and 95 scenarios that had a
plan in V0 have none in V1. On small beds it is clearly worse - the
largest empty patch and the quadrant CV both rise, because asking a
small bed for 95% cover pushes it towards fewer, bigger plants.

**V3 made things worse, not better.** Adding the emptiest-block
preference on top of V2 moves the largest empty patch from 0.150
to - (NaN%), the empty-cell share from 0.338
to -, and cover down from 0.668 to -.
Quadrant CV is a fraction worse too. The likely mechanism is visible in
the figures: pushing each group's anchor into an empty block scatters
the anchors, and the drift rule then pulls the rest of the group after
them, so the bed ends up with the same canopy in fewer, further-apart
clusters and bigger holes between them.

`scripts/block-weight-sweep.ts` ran the same 100 scenarios at weights
0.10, 0.25 and 0.50, and at 0.25 with the contact bonus left on. No
setting beat V2 on the largest empty patch. At 0.10 the term is a wash
- a shade better on quadrant CV and empty-cell share, a shade worse on
the patch. So this is not a weight that needs tuning; the preference
does not earn its place.

**V4 was not run.** The combination rules it needs do exist - 14 of
them, in 8_Species_Reference rows 5-18, and 55 of their 56 species are
in the catalogue. The Stage 4 rule is stated at row 23: members of the
same combo should be placed as neighbours. But a Stage 4 neighbour
bonus can only arrange pairs that Stage 2 has already selected, and
across all 100 scenarios only 4 neighbouring plant pairs
belonged to the same combo - they come from two species pairs, in two
plans out of 95.
The same-combo neighbour share is therefore 0.0000 in every version,
and a bonus acting on one or two pairs could not be measured against
the 2-percentage-point guard. The rulebook names the missing piece
itself: the Stage 2 combo preference at row 22 is also NOT IMPLEMENTED.
Stage 2 has to prefer combo members before Stage 4 can place them
together.

**What is actually holding cover down.** `placement` is zero in every
version - Stage 4 never failed to fit what it was given - and
`pool: exhausted` is zero too, so the candidate pool never ran out. Of
the 0 short plans in V1, 0 had species to spare and stopped
anyway. The limit is in what Stage 2 and Stage 3 choose to select, not
in the cover rule, not in the packer, and not in the pool.
