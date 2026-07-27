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

## DD-002 — Botanical field guide, not dashboard

Decision: Use large serif display type, quiet sans-serif utility text, cream
paper tones, ink green, thin rules, numbered specimens and asymmetrical grids.

Rationale: This directly interprets the supplied botanical posters and minimal
cream reference while avoiding the standard rounded-card AI product aesthetic.

Consequence: Borders, whitespace and typography carry hierarchy. Shadows,
gradients, glass effects, generic metric cards and excessive pill controls are
avoided.

## DD-003 — South African character through subject matter

Decision: Express place through fynbos species, local area names, veld language
and botanical research conventions.

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

