# Silly Goose MVP — design decisions

This document records material product and design choices, their rationale and
their consequences. It is a decision record, not a transcript of private
working notes.

## DD-001 — Desktop-first editorial composition

Decision: Design the primary experience for a 1280–1600 px planning viewport,
then adapt it responsively.

Rationale: The user explicitly chose desktop first. Garden planning benefits
from side-by-side comparison, generous text columns and visible filtering.

Consequence: Mobile remains functional, but the defining composition is the
desktop editorial grid.

## DD-002 — Editorial reference book, not dashboard

Decision: Use an editorial serif, a readable sans serif, cream paper tones,
tonal greens, thin rules, numbered specimens and asymmetrical grids.

Rationale: This directly interprets the supplied botanical posters and minimal
cream reference while avoiding the standard rounded-card AI product aesthetic.

Consequence: Borders, whitespace and typography carry hierarchy. Shadows,
gradients, glass effects, generic metric cards and excessive pill controls are
avoided.

## DD-003 — South African character through specificity

Decision: Express place through Western Cape species, local area names, local
data and botanical research conventions.

Rationale: This feels more specific and respectful than applying decorative
national motifs or clichés.

Consequence: The interface remains contemporary while the collection is
unmistakably rooted in the Western Cape.

## DD-004 — Deliberate image placeholders

Decision: Use art-directed placeholder frames with a prompt identifier rather
than stock imagery or generated art.

Rationale: The user will generate final images in GPT from prompts tailored to
the finished site.

Consequence: Every image slot has a stable aspect ratio and prompt reference.
Replacing assets later should not alter layout.

## DD-005 — One continuous application surface

Decision: Keep the MVP in a single fast application surface with distinct
landing, brief, results, saved and methodology states.

Rationale: It preserves context during comparison and lets the first release
prove the recommendation journey without premature routing complexity.

Consequence: Shareable plant URLs and server-backed history are deferred.

## DD-006 — Transparent matching

Decision: Show concrete reasons such as “fits a compact bed” or “matches full
sun” instead of presenting an unexplained AI score.

Rationale: Trust is more important than an appearance of precision.

Consequence: Scores are a deterministic ranking aid, not a claim of ecological
certainty.

## DD-007 — Curated starting collection

Decision: Present 48 plants selected from the verified 1,909-row integration
seed rather than exposing all records.

Rationale: The broader dataset lacks complete imagery and horticultural
attributes. A smaller, coherent collection creates a usable MVP without hiding
the evidence limitations.

Consequence: Catalogue expansion requires the same editorial review process.

## DD-008 — Local saved garden

Decision: Persist saved plant identifiers in browser storage.

Rationale: It proves collection behaviour without accounts, personal data or
backend operations.

Consequence: Saved plants are device-specific and can be cleared with browser
data.

## DD-009 — Current build is a plant-discovery prototype

Decision: Describe the current release as a plant-discovery prototype, not as
the completed research-paper MVP.

Rationale: The working product has the questionnaire, provisional ordering,
library, details and saving flow. It does not have the paper’s full hard
filters, AHP calibration, Goal Programming, multidimensional knapsack or 2D
layout.

Consequence: Product copy states the limitation directly. The next milestone is
the planning engine recorded in `implementation-roadmap.md`.

## DD-010 — Plain, specific product language

Decision: Remove decorative uppercase eyebrow headings and replace poetic,
abstract claims with direct descriptions of the user action, output and
limitation.

Rationale: The previous copy repeated a familiar AI-generated pattern: slogan,
contrasting negation, elevated metaphor and stacked micro-headings. The revised
voice uses specific nouns and verbs, sentence-case headings, short paragraphs
and one clear idea per section.

Consequence: Copy should not use claims such as “perfect garden”, “guaranteed
to thrive” or “AI-powered”. It should name the actual input, calculation and
output.

## DD-011 — Newsreader and Instrument Sans

Decision: Bundle Newsreader Variable for display and botanical names, and
Instrument Sans Variable for interface and body text.

Rationale: Newsreader was designed for sustained on-screen reading and gives
the product a recognisable editorial voice. Instrument Sans is clear without
looking like a default startup interface. Both are bundled locally through
Fontsource.

Consequence: Typography does more of the identity work, so ornamental labels,
extreme tracking and excessive all-caps styling are unnecessary.

## DD-012 — Tonal botanical palette

Decision: Keep the cream ground and deep fern ink, but replace orange and coral
with eucalyptus, moss, sage, lichen and blue-green accents.

Palette:

- Paper: `#EFEDE3`
- Light paper: `#F7F5ED`
- Fern ink: `#173C32`
- Eucalyptus: `#4F716C`
- Moss: `#607667`
- Sage: `#95A79B`
- Lichen: `#A6B493`

Rationale: The supplied references rely on natural green variation, paper and
botanical subject matter. A tonal palette lets generated plant images carry
the flower colour without forcing a green/orange brand combination.

Consequence: Functional states must remain distinguishable through contrast,
shape and wording, not hue alone.
