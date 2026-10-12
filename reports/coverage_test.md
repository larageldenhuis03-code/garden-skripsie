# Coverage test - V0 / V1 / V2

**Measurement only. No engine change, no rulebook change, nothing deployed.**

Rulebook as imported: `098c8d085f61`. The workbook on disk was never
read or re-imported by this run.

| version | what it changes |
|---|---|
| **V0** | baseline, as imported |
| **V1** | cover_max 1.0, cover_min 0.95 |
| **V2** | contact-point preference 0 |
| **V3** | contact 0, plus the emptiest-block preference (weight 0.25) |

V1 and V2 are in-memory overrides applied around each run and undone
afterwards - the same technique the Chapter 5 sensitivity study uses.

Every figure is the median with the 10th-90th percentile in brackets,
over the plans that produced a layout. Percentiles are PERCENTILE.INC.

## All 100 scenarios

| measure | V0 | V1 | V2 | V3 |
|---|---|---|---|---|
| cover | 0.665 (0.506-0.777) | 0.654 (0.524-0.787) | 0.668 (0.528-0.773) | 0.658 (0.518-0.767) |
| empty-cell share | 0.340 (0.238-0.493) | 0.340 (0.226-0.483) | 0.338 (0.242-0.485) | 0.345 (0.241-0.492) |
| largest empty patch | 0.165 (0.079-0.360) | 0.170 (0.066-0.404) | 0.150 (0.073-0.321) | 0.195 (0.068-0.337) |
| quadrant CV | 0.212 (0.088-0.425) | 0.179 (0.077-0.457) | 0.156 (0.074-0.376) | 0.161 (0.064-0.402) |
| species | 6.0 (3.0-12.0) | 5.0 (3.0-12.0) | 6.0 (4.0-12.0) | 6.0 (3.0-12.0) |
| plants | 20.0 (9.4-44.6) | 21.0 (11.0-44.6) | 19.0 (10.0-45.6) | 19.0 (10.0-43.2) |
| Z | 0.9196 (0.8389-0.9790) | 0.9095 (0.8054-0.9578) | 0.9293 (0.8211-0.9788) | 0.9265 (0.8276-0.9788) |
| A1 height balance | 0.929 (0.738-0.990) | 0.900 (0.700-0.986) | 0.900 (0.711-0.990) | 0.928 (0.734-0.992) |
| A2 colour | 1.000 (0.750-1.000) | 1.000 (0.750-1.000) | 1.000 (0.750-1.000) | 1.000 (0.750-1.000) |
| A3 variety | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) |
| A4 ground cover | 0.914 (0.701-1.000) | 0.689 (0.551-0.829) | 0.906 (0.705-1.000) | 0.904 (0.667-1.000) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 30 (11-70) | 28 (13-72) | 28 (12-79) | 29 (11-73) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 535 (419-755) | 516 (410-820) | 503 (430-702) | 500 (415-749) |
| **feasible** | 95 / 100 | 93 / 100 | 95 / 100 | 95 / 100 |
| **hard violations** | 0 | 0 | 0 | 0 |
| **reached its target cover** | 32 / 95 | 0 / 93 | 33 / 95 | 30 / 95 |

## By style

### cottage

| measure | V0 | V1 | V2 | V3 |
|---|---|---|---|---|
| cover | 0.669 (0.559-0.757) | 0.711 (0.594-0.764) | 0.679 (0.563-0.757) | 0.654 (0.559-0.757) |
| empty-cell share | 0.343 (0.258-0.442) | 0.300 (0.217-0.406) | 0.333 (0.256-0.439) | 0.349 (0.244-0.465) |
| largest empty patch | 0.149 (0.067-0.350) | 0.116 (0.061-0.239) | 0.111 (0.078-0.246) | 0.158 (0.081-0.269) |
| quadrant CV | 0.152 (0.075-0.366) | 0.151 (0.077-0.248) | 0.133 (0.087-0.295) | 0.161 (0.065-0.257) |
| species | 4.5 (3.0-10.8) | 4.5 (4.0-11.1) | 5.0 (4.0-10.8) | 5.0 (4.0-10.8) |
| plants | 18.0 (9.3-54.8) | 21.5 (12.0-44.4) | 18.5 (10.0-44.1) | 18.5 (10.0-49.2) |
| Z | 0.9084 (0.8503-0.9566) | 0.9239 (0.8388-0.9614) | 0.9257 (0.8251-0.9679) | 0.9204 (0.8251-0.9611) |
| A1 height balance | 0.867 (0.765-0.984) | 0.877 (0.679-0.968) | 0.825 (0.737-0.961) | 0.800 (0.737-0.962) |
| A2 colour | 1.000 (0.667-1.000) | 1.000 (0.750-1.000) | 1.000 (0.692-1.000) | 1.000 (0.692-1.000) |
| A3 variety | 1.000 (0.889-1.000) | 1.000 (1.000-1.000) | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) |
| A4 ground cover | 0.787 (0.658-0.890) | 0.748 (0.625-0.805) | 0.799 (0.663-0.890) | 0.769 (0.658-0.890) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 30 (8-66) | 37 (17-76) | 31 (15-53) | 35 (15-85) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 524 (425-706) | 485 (414-715) | 489 (433-654) | 494 (431-703) |
| **feasible** | 24 / 26 | 24 / 26 | 24 / 26 | 24 / 26 |
| **hard violations** | 0 | 0 | 0 | 0 |
| **reached its target cover** | 1 / 24 | 0 / 24 | 1 / 24 | 1 / 24 |

### fynbos

| measure | V0 | V1 | V2 | V3 |
|---|---|---|---|---|
| cover | 0.656 (0.557-0.749) | 0.629 (0.551-0.740) | 0.641 (0.515-0.755) | 0.648 (0.565-0.752) |
| empty-cell share | 0.349 (0.247-0.442) | 0.375 (0.271-0.440) | 0.359 (0.251-0.479) | 0.359 (0.261-0.435) |
| largest empty patch | 0.164 (0.086-0.265) | 0.175 (0.090-0.375) | 0.151 (0.067-0.385) | 0.194 (0.067-0.330) |
| quadrant CV | 0.179 (0.089-0.349) | 0.210 (0.087-0.457) | 0.135 (0.064-0.319) | 0.155 (0.061-0.397) |
| species | 4.5 (3.0-7.7) | 4.0 (3.0-7.0) | 5.0 (3.0-7.7) | 4.5 (3.0-7.7) |
| plants | 15.5 (9.0-34.0) | 16.0 (9.0-30.4) | 15.0 (9.0-32.5) | 14.5 (9.0-27.9) |
| Z | 0.9250 (0.8438-0.9821) | 0.8942 (0.8054-0.9540) | 0.9223 (0.8383-0.9783) | 0.9185 (0.8397-0.9797) |
| A1 height balance | 0.879 (0.700-0.974) | 0.900 (0.677-0.957) | 0.872 (0.663-0.973) | 0.900 (0.700-0.973) |
| A2 colour | 1.000 (0.750-1.000) | 1.000 (0.667-1.000) | 1.000 (0.692-1.000) | 1.000 (0.750-1.000) |
| A3 variety | 1.000 (0.889-1.000) | 1.000 (0.800-1.000) | 1.000 (0.811-1.000) | 1.000 (0.811-1.000) |
| A4 ground cover | 0.937 (0.796-1.000) | 0.663 (0.580-0.779) | 0.916 (0.735-1.000) | 0.925 (0.807-1.000) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 24 (10-57) | 22 (7-49) | 24 (9-57) | 25 (10-41) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 544 (415-750) | 521 (400-808) | 523 (427-704) | 476 (407-733) |
| **feasible** | 24 / 25 | 23 / 25 | 24 / 25 | 24 / 25 |
| **hard violations** | 0 | 0 | 0 | 0 |
| **reached its target cover** | 7 / 24 | 0 / 23 | 8 / 24 | 6 / 24 |

### mediterranean

| measure | V0 | V1 | V2 | V3 |
|---|---|---|---|---|
| cover | 0.634 (0.497-0.717) | 0.697 (0.524-0.788) | 0.637 (0.521-0.694) | 0.637 (0.517-0.688) |
| empty-cell share | 0.372 (0.286-0.516) | 0.310 (0.225-0.475) | 0.367 (0.307-0.489) | 0.369 (0.321-0.494) |
| largest empty patch | 0.251 (0.103-0.418) | 0.180 (0.072-0.390) | 0.273 (0.111-0.358) | 0.269 (0.144-0.390) |
| quadrant CV | 0.258 (0.104-0.434) | 0.194 (0.089-0.317) | 0.222 (0.125-0.433) | 0.245 (0.113-0.439) |
| species | 6.5 (5.0-12.0) | 7.0 (5.0-12.0) | 7.0 (5.1-12.0) | 6.0 (5.0-12.0) |
| plants | 28.5 (14.2-41.6) | 25.0 (15.0-43.0) | 26.0 (16.0-50.1) | 23.5 (15.1-38.0) |
| Z | 0.9461 (0.8909-0.9866) | 0.9291 (0.8694-0.9573) | 0.9500 (0.8979-0.9946) | 0.9434 (0.9057-0.9922) |
| A1 height balance | 0.981 (0.901-0.990) | 0.958 (0.858-0.988) | 0.987 (0.880-0.992) | 0.974 (0.881-0.990) |
| A2 colour | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| A3 variety | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| A4 ground cover | 1.000 (0.829-1.000) | 0.733 (0.552-0.830) | 1.000 (0.868-1.000) | 1.000 (0.862-1.000) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 36 (16-59) | 33 (14-72) | 37 (15-60) | 31 (15-51) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 544 (425-785) | 559 (448-991) | 517 (446-683) | 557 (417-743) |
| **feasible** | 22 / 24 | 21 / 24 | 22 / 24 | 22 / 24 |
| **hard violations** | 0 | 0 | 0 | 0 |
| **reached its target cover** | 15 / 22 | 0 / 21 | 15 / 22 | 14 / 22 |

### undecided

| measure | V0 | V1 | V2 | V3 |
|---|---|---|---|---|
| cover | 0.733 (0.505-0.809) | 0.633 (0.469-0.813) | 0.697 (0.519-0.809) | 0.680 (0.502-0.809) |
| empty-cell share | 0.285 (0.208-0.492) | 0.367 (0.200-0.534) | 0.305 (0.205-0.487) | 0.313 (0.203-0.498) |
| largest empty patch | 0.140 (0.075-0.370) | 0.220 (0.047-0.484) | 0.128 (0.043-0.297) | 0.150 (0.054-0.420) |
| quadrant CV | 0.213 (0.097-0.439) | 0.245 (0.085-0.673) | 0.157 (0.084-0.382) | 0.152 (0.069-0.365) |
| species | 7.0 (4.0-13.2) | 6.0 (4.0-14.2) | 6.0 (4.0-13.6) | 7.0 (4.0-13.2) |
| plants | 30.0 (10.0-45.2) | 22.0 (13.4-46.2) | 28.0 (10.0-47.2) | 28.0 (10.0-45.2) |
| Z | 0.9015 (0.7126-0.9651) | 0.8873 (0.6797-0.9378) | 0.8911 (0.7126-0.9614) | 0.8869 (0.7126-0.9620) |
| A1 height balance | 0.950 (0.800-0.995) | 0.931 (0.658-0.985) | 0.944 (0.678-0.994) | 0.944 (0.790-0.995) |
| A2 colour | 1.000 (0.750-1.000) | 1.000 (0.750-1.000) | 1.000 (0.750-1.000) | 1.000 (0.750-1.000) |
| A3 variety | 1.000 (0.822-1.000) | 1.000 (0.933-1.000) | 1.000 (0.822-1.000) | 1.000 (0.889-1.000) |
| A4 ground cover | 0.978 (0.673-1.000) | 0.667 (0.493-0.856) | 0.929 (0.692-1.000) | 0.907 (0.670-1.000) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 30 (14-99) | 34 (15-61) | 31 (14-87) | 34 (12-85) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 559 (419-864) | 518 (422-916) | 498 (424-727) | 518 (414-809) |
| **feasible** | 25 / 25 | 25 / 25 | 25 / 25 | 25 / 25 |
| **hard violations** | 0 | 0 | 0 | 0 |
| **reached its target cover** | 9 / 25 | 0 / 25 | 9 / 25 | 9 / 25 |

## By bed-size band

### small (<6 m2)

| measure | V0 | V1 | V2 | V3 |
|---|---|---|---|---|
| cover | 0.651 (0.560-0.684) | 0.590 (0.552-0.644) | 0.665 (0.521-0.726) | 0.665 (0.596-0.726) |
| empty-cell share | 0.352 (0.317-0.439) | 0.401 (0.335-0.440) | 0.347 (0.280-0.471) | 0.347 (0.280-0.395) |
| largest empty patch | 0.160 (0.105-0.233) | 0.216 (0.136-0.355) | 0.147 (0.073-0.377) | 0.147 (0.075-0.282) |
| quadrant CV | 0.124 (0.060-0.260) | 0.193 (0.075-0.386) | 0.113 (0.083-0.334) | 0.132 (0.088-0.236) |
| species | 3.0 (3.0-3.0) | 3.0 (3.0-3.0) | 3.0 (3.0-3.0) | 3.0 (3.0-3.0) |
| plants | 9.0 (7.8-11.4) | 9.0 (7.6-10.4) | 9.0 (7.8-13.4) | 9.0 (7.8-10.2) |
| Z | 0.8756 (0.5604-0.8994) | 0.7332 (0.5197-0.8256) | 0.8774 (0.5449-0.9091) | 0.8589 (0.5449-0.8994) |
| A1 height balance | 0.700 (0.520-0.793) | 0.723 (0.680-0.854) | 0.633 (0.384-0.856) | 0.700 (0.384-0.780) |
| A2 colour | 1.000 (0.700-1.000) | 0.833 (0.550-1.000) | 1.000 (0.800-1.000) | 1.000 (0.700-1.000) |
| A3 variety | 0.778 (0.578-0.889) | 0.833 (0.778-0.889) | 0.778 (0.489-0.956) | 0.778 (0.489-0.844) |
| A4 ground cover | 0.887 (0.800-0.969) | 0.621 (0.581-0.678) | 0.887 (0.744-0.998) | 0.930 (0.835-0.998) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 25 (15-38) | 20 (9-35) | 27 (13-46) | 24 (15-31) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 620 (460-633) | 521 (417-588) | 639 (476-697) | 561 (429-668) |
| **feasible** | 5 / 5 | 4 / 5 | 5 / 5 | 5 / 5 |
| **hard violations** | 0 | 0 | 0 | 0 |
| **reached its target cover** | 0 / 5 | 0 / 4 | 1 / 5 | 1 / 5 |

### medium (6-30 m2)

| measure | V0 | V1 | V2 | V3 |
|---|---|---|---|---|
| cover | 0.660 (0.500-0.753) | 0.663 (0.552-0.758) | 0.645 (0.535-0.755) | 0.639 (0.506-0.742) |
| empty-cell share | 0.343 (0.251-0.505) | 0.339 (0.244-0.462) | 0.350 (0.258-0.474) | 0.362 (0.259-0.517) |
| largest empty patch | 0.165 (0.080-0.341) | 0.158 (0.061-0.337) | 0.150 (0.081-0.318) | 0.203 (0.081-0.334) |
| quadrant CV | 0.183 (0.085-0.408) | 0.154 (0.078-0.365) | 0.153 (0.066-0.351) | 0.161 (0.059-0.402) |
| species | 5.0 (3.0-7.0) | 5.0 (3.0-7.0) | 5.0 (4.0-7.0) | 5.0 (3.4-7.0) |
| plants | 16.0 (9.4-34.0) | 16.5 (10.3-31.4) | 18.0 (10.0-29.2) | 16.0 (10.0-29.6) |
| Z | 0.9105 (0.8389-0.9784) | 0.8986 (0.8140-0.9573) | 0.9133 (0.8211-0.9765) | 0.9136 (0.8276-0.9777) |
| A1 height balance | 0.900 (0.752-0.963) | 0.870 (0.654-0.937) | 0.867 (0.663-0.958) | 0.886 (0.752-0.967) |
| A2 colour | 1.000 (0.700-1.000) | 1.000 (0.750-1.000) | 1.000 (0.700-1.000) | 1.000 (0.750-1.000) |
| A3 variety | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) | 1.000 (0.889-1.000) |
| A4 ground cover | 0.864 (0.666-1.000) | 0.698 (0.581-0.798) | 0.861 (0.664-1.000) | 0.864 (0.623-1.000) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 23 (8-58) | 23 (10-53) | 24 (10-53) | 24 (10-53) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 535 (419-721) | 513 (408-672) | 498 (418-662) | 496 (421-700) |
| **feasible** | 55 / 60 | 54 / 60 | 55 / 60 | 55 / 60 |
| **hard violations** | 0 | 0 | 0 | 0 |
| **reached its target cover** | 11 / 55 | 0 / 54 | 12 / 55 | 9 / 55 |

### large (>=30 m2)

| measure | V0 | V1 | V2 | V3 |
|---|---|---|---|---|
| cover | 0.696 (0.513-0.809) | 0.697 (0.505-0.805) | 0.678 (0.558-0.809) | 0.676 (0.574-0.796) |
| empty-cell share | 0.328 (0.208-0.483) | 0.310 (0.206-0.496) | 0.330 (0.207-0.453) | 0.330 (0.209-0.419) |
| largest empty patch | 0.168 (0.075-0.429) | 0.180 (0.072-0.445) | 0.150 (0.051-0.314) | 0.195 (0.060-0.326) |
| quadrant CV | 0.218 (0.104-0.431) | 0.217 (0.097-0.589) | 0.175 (0.087-0.382) | 0.162 (0.082-0.407) |
| species | 10.0 (6.0-14.0) | 10.0 (5.0-15.0) | 10.0 (6.0-14.0) | 10.0 (6.0-14.0) |
| plants | 35.0 (16.0-49.2) | 31.0 (16.0-48.0) | 35.0 (16.0-51.0) | 31.0 (16.0-49.2) |
| Z | 0.9426 (0.8629-0.9790) | 0.9194 (0.8322-0.9658) | 0.9436 (0.8629-0.9825) | 0.9428 (0.8629-0.9812) |
| A1 height balance | 0.984 (0.879-0.998) | 0.978 (0.812-0.989) | 0.988 (0.830-0.998) | 0.986 (0.867-1.000) |
| A2 colour | 1.000 (0.850-1.000) | 1.000 (0.850-1.000) | 1.000 (0.850-1.000) | 1.000 (0.850-1.000) |
| A3 variety | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| A4 ground cover | 1.000 (0.781-1.000) | 0.733 (0.532-0.847) | 1.000 (0.849-1.000) | 1.000 (0.829-1.000) |
| A5 flowering | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) | 1.000 (1.000-1.000) |
| neighbour pairs | 46 (19-90) | 41 (17-77) | 44 (18-86) | 37 (18-80) |
| same-combo neighbour share | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) | 0.0000 (0.0000-0.0000) |
| unplaced plants | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) | 0.0 (0.0-0.0) |
| run time (ms) | 529 (420-1117) | 559 (437-1319) | 498 (438-1068) | 562 (413-962) |
| **feasible** | 35 / 35 | 35 / 35 | 35 / 35 | 35 / 35 |
| **hard violations** | 0 | 0 | 0 | 0 |
| **reached its target cover** | 21 / 35 | 0 / 35 | 20 / 35 | 20 / 35 |

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
| all | V1 | 93 | 8 | 0 | 81 | 0 | 81 |
| all | V2 | 62 | 4 | 0 | 53 | 0 | 53 |
| all | V3 | 65 | 2 | 0 | 58 | 0 | 58 |
| small (<6 m2) | V0 | 5 | 0 | 0 | 5 | 0 | 5 |
| small (<6 m2) | V1 | 4 | 0 | 0 | 4 | 0 | 4 |
| small (<6 m2) | V2 | 4 | 0 | 0 | 4 | 0 | 4 |
| small (<6 m2) | V3 | 4 | 0 | 0 | 4 | 0 | 4 |
| medium (6-30 m2) | V0 | 44 | 3 | 0 | 33 | 0 | 33 |
| medium (6-30 m2) | V1 | 54 | 5 | 0 | 45 | 0 | 45 |
| medium (6-30 m2) | V2 | 43 | 2 | 0 | 36 | 0 | 36 |
| medium (6-30 m2) | V3 | 46 | 2 | 0 | 39 | 0 | 39 |
| large (>=30 m2) | V0 | 14 | 2 | 0 | 12 | 0 | 12 |
| large (>=30 m2) | V1 | 35 | 3 | 0 | 32 | 0 | 32 |
| large (>=30 m2) | V2 | 15 | 2 | 0 | 13 | 0 | 13 |
| large (>=30 m2) | V3 | 15 | 0 | 0 | 15 | 0 | 15 |

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
0.654 - no gain. Not one plan of 93 reached 0.95.
H1 was not what was holding cover down, so removing it changes little.
It costs: A4 falls from 0.914 to 0.689, because A4 is
measured against cover_min and the target moved; median Z follows it
down, 0.9196 to 0.9095; and 2 scenarios that had a
plan in V0 have none in V1. On small beds it is clearly worse - the
largest empty patch and the quadrant CV both rise, because asking a
small bed for 95% cover pushes it towards fewer, bigger plants.

**V3 made things worse, not better.** Adding the emptiest-block
preference on top of V2 moves the largest empty patch from 0.150
to 0.195 (+30%), the empty-cell share from 0.338
to 0.345, and cover down from 0.668 to 0.658.
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
the 93 short plans in V1, 89 had species to spare and stopped
anyway. The limit is in what Stage 2 and Stage 3 choose to select, not
in the cover rule, not in the packer, and not in the pool.
