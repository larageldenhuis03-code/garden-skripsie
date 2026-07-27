# Silly Goose MVP — decisions

This file records durable product, technical and visual decisions. It contains
rationale and consequences, not private working notes.

Updated: 2026-07-27

## D-001 — Desktop-first planning surface

Decision: Design primarily for 1280–1600 px desktop planning sessions, then
adapt responsively.

Why: Comparison, filtering and future bed-layout work benefit from a wide
surface.

Consequence: Mobile remains functional, but desktop defines the composition.

## D-002 — Current release is a discovery prototype

Decision: Describe the current build as a plant-discovery prototype, not the
completed research-paper MVP.

Why: It has a garden brief, plant ordering, library, details and local saving.
It does not have complete hard filters, AHP calibration, Goal Programming,
group selection or layout.

Consequence: Product copy and documentation state the gap directly.

## D-003 — One continuous application

Decision: Keep home, finder, results, library, saved plants and methodology in
one fast application surface for this phase.

Why: It preserves comparison context without premature routing complexity.

Consequence: Shareable plant URLs and server-backed history are deferred.

## D-004 — Device-local saved plants

Decision: Store saved plant identifiers in browser storage.

Why: It proves collection behaviour without accounts or personal data.

Consequence: Saved plants are device-specific.

## D-005 — Curated 48-plant library

Decision: Show 48 reviewed plants from the 1,909-row integration seed.

Why: The wider seed lacks complete horticultural attributes and coherent
imagery.

Consequence: Expansion requires the same provenance and review process.

## D-006 — SANPC-led data hierarchy

Decision: Use SANPC as the taxonomic backbone, BODATSA as occurrence evidence,
BioSCape for regional traits, and current legal sources for exclusions.

Why: No one dataset covers taxonomy, occurrence, dimensions and regulation.

Consequence: Exact joins, source identifiers, confidence and limitations must
remain visible.

## D-007 — Current heuristic is temporary

Decision: Keep the hand-set score only as interaction scaffolding.

Why: Its values were not derived from experts and have no AHP consistency
result.

Consequence: It cannot be described as scientific optimisation. The target
pipeline is hard filtering, AHP calibration, Goal Programming, group selection
and 2D layout.

## D-008 — Transparent decisions

Decision: Every rejection, penalty, ranking contribution and later layout
selection must be explainable.

Why: Apparent precision without a trace reduces trust and makes review
impossible.

Consequence: Explanation data is a required engine output, not optional copy.

## D-009 — Cape Print Cabinet visual direction

Decision: Use hand-coloured Western Cape botanical prints on cotton-rag paper,
imperfect archival grids and one rare goose marginalia motif.

Why: The supplied references derive their character from printed material,
botanical specificity and slight disorder—not a generic cream palette.

Consequence: No glossy stock imagery, modern vector foliage, fake Latin,
heavy-sepia parchment or generic AI collage.

## D-010 — Plain product language

Decision: Use direct, specific language and sentence-case headings.

Why: Decorative micro-headings, abstract slogans and AI-era filler obscured the
product’s actual capability.

Consequence: Questions act as headings. Claims name the real input, action,
output and limitation.

## D-011 — Newsreader and Instrument Sans

Decision: Use Newsreader Variable for display and botanical names, and
Instrument Sans Variable for body and interface text.

Why: The pairing is editorial and readable without looking like default product
UI.

Consequence: Typography and whitespace carry hierarchy; excessive tracking and
all caps are excluded.

## D-012 — Tonal botanical palette

Decision: Use warm paper, deep fern ink, eucalyptus, moss, sage and lichen.
Flower colour belongs mainly to the specimen artwork.

Why: This blends with the botanical imagery and avoids the rejected
green/orange pairing.

Consequence: State changes also use wording, contrast and form rather than hue
alone.

## D-013 — Physical-print motion

Decision: Motion imitates printing and paper: press reveals, page slides,
hand-drawn rules, stamp presses and very small parallax.

Why: It supports the visual concept without becoming a generic animation
layer.

Consequence: Floating blobs, continuous bouncing, generic fade-up grids and
full-screen parallax are excluded. Reduced-motion is mandatory.

## D-014 — One image at a time

Decision: The user manually generates one active GPT design, returns it for
review, and approves it in the deployed site before the next prompt is
activated.

Why: The user is the taste filter. Batch generation would amplify style drift
and waste work before crop and placement are proven.

Consequence: V01 hero is active. V02 and every later asset are blocked until
the previous one passes in-context approval. The 48 plant portraits are
deferred.

## D-015 — Four canonical documents

Decision: Maintain only:

- `PROJECT.md`
- `METHODOLOGY.md`
- `VISUAL_SYSTEM.md`
- `DECISIONS.md`

Why: Separate specs, roadmaps, prompt packs and logs had begun to contradict
one another.

Consequence: Superseded documents are deleted rather than archived. Operational
dataset notes remain under `data/`.

## Change history

### 2026-07-27

- Established and validated the Western Cape data foundation.
- Built the desktop-first plant-discovery prototype.
- Audited the heuristic against the literature-review methodology.
- Corrected the product claim and documented the planning-engine gap.
- Rewrote the copy and replaced the green/orange direction.
- Added Newsreader and Instrument Sans.
- Established the Cape Print Cabinet direction.
- Changed image production from batches to one user-approved design at a time.
- Consolidated nine overlapping documents into four canonical sources.

