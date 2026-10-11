# UI audit — readability and layout

**Audience:** the owner, and anyone picking this work up
**Date:** 2026-10-11
**Branch:** `ui-refinement` (baseline tagged `pre-refinement`)
**Engine:** untouched. Proven by `scripts/brief-fingerprint.ts`, which hashes
two briefs' three options, seeds, Z, species and every placement coordinate.

Measurements come from `scripts/a11y-audit.mjs`, which walks the app in Chrome
and reports computed font sizes, control heights, line lengths and contrast
ratios. Screenshots of every screen at 1280 px and 375 px are in
`docs/screenshots/before/`.

## What the measurements found

The checklist asks for body text ≥ 17 px, labels and buttons ≥ 16 px, nothing
below 14 px, lines ≤ ~70 characters, contrast ≥ 4.5:1, and controls ≥ 44 px
tall. Against that:

| Screen | Smallest text | Shortest control | Longest line | Worst contrast |
|---|---|---|---|---|
| Home | 11.5 px | 35 px | 127 ch | passes |
| Brief step 1 | 10.4 px | 35 px | 141 ch | passes |
| Plan output | **9.3 px** (144 elements) | **14 px** | **445 ch** | **1.18:1** |
| Plant library | **9.3 px** | 31 px | 308 ch | **1.18:1** |

The plan output — the screen that matters most — has 144 separate elements at
9.3 px and another 144 at 10.9 px. The 1.18:1 contrast is the photo credit
printed over the photograph; it is effectively invisible.

## Findings

| # | Screen | Problem | Checklist rule | Fix |
|---|---|---|---|---|
| 1 | All | Type scale bottoms out at 9.3 px; 8 distinct sizes below 14 px | Nothing below 14 px | One scale with 14 px as the floor, 17 px body, 16 px labels |
| 2 | All | Controls 14–41 px tall; card save/exclude 32 px | ≥ 44 px, ≥ 8 px apart | Minimum height on every control, gaps on card actions |
| 3 | All | Photo credit is white on a pale photo, 1.18:1 | ≥ 4.5:1 | Credit moves below the photo in body colour |
| 4 | Plan output | Bed drawing takes ~40 % of the width; the plant list sits beside it | Most important thing first and largest | Drawing fills the content area; plant list becomes a slide-out drawer |
| 5 | Plan output | The whole plant library is appended under the plan — the page is 10 478 px tall | Secondary detail below or collapsed | Library stays on its own screen |
| 6 | Plan output | Care summary runs 445 characters on one line | ≤ ~70 ch | Measure cap on all prose |
| 7 | Plan output | "scoring 98 out of 100", "score 98" on option tabs, "93 % match" on cards | No engine terms | Plain words: "suits your bed well" |
| 8 | Plan output | No plain summary row; counts are scattered | Most important first | One row: plants, species, bed size, guide price |
| 9 | Plan output | North marker is small; no viewpoint marker | — | Larger marker, plus a viewer marker on the brief's viewing edge |
| 10 | Option comparison | Tabs differ only by a score number | One-line plain description | Each option labelled by how it differs, using existing attributes |
| 11 | Brief | ~~No step counter or progress bar~~ **Wrong when written.** Both already exist (`.finder-progress`, "Step 1 of 5" plus segment bar) | "Step 2 of 5" plus a bar | Nothing to add; sizes raised by the type scale |
| 12 | Brief | "Not sure" options do not say what happens | Helper line under the option | Wording taken from the code — see below |
| 13 | Brief | Colour step does not say preferences can be overridden | — | One line added |
| 14 | Brief | Hover-only plant names on the layout | Never hover-only | Names in the legend and drawer, which are always visible |
| 15 | Favourites | Called "Saved plants"; heart and exclude read alike | Rename, make them distinct | "Favourite plants"; different icon, colour and label |
| 16 | Library | Search box and cards small; filters are chips | Larger, filters visible | Larger search and cards |
| 17 | Demo | No way to show the engine's working | `?trace=1` | One console group per stage |

## "Not sure" helper texts

Each one states what the code actually does, not what would be reassuring.

| Option | Helper line | What the code does |
|---|---|---|
| Soil — "Not sure" | "We will accept sandy, loam or clay, so no plant is left out for having the wrong soil. Plants with no soil recorded are still left out." | `acceptedSoils` returns all three soils when the brief says `not-sure`, so the soil check cannot fail a plant that has a soil recorded. A plant with **no** soil record still returns `unknown`, and unknown excludes. |
| Colour — "No preference" | "We will not favour any particular colour." | With no colours chosen, A2 scores `MIN(1, distinct colours / c_min)` and `c_min = 1`, so it reaches full marks as soon as the bed has one colour. Colour then has no practical effect on the choice. |
| Style — "Undecided" | "We will not favour a particular look. Your bed still gets a balanced mix of heights and a few different plant types." | Two different things happen, and only the first is "no preference". The Stage 1 style term switches off (`brief.style === "undecided"` makes it inactive, weight 0). But `styleKeyFor` maps undecided to the **Generic** profile, which still sets the composition: 75–85 % cover, 50/30/20 tall/medium/short, at least 3 plant types, at least 1 structural plant. |

A plant whose own sun, water or soil is **unrecorded** is a different case and
is excluded, not assumed to cope. That is stated on the plan rather than here.

## Not done, and why

Anything needing an engine change is out of scope by instruction. Nothing in
this list required one.
