# Silly Goose MVP — GPT visual production brief

Status: art-direction gate before integration  
Updated: 2026-07-27

## The working relationship

The visual workflow has three roles:

1. **Codex is the art director and integrator.** It defines the job of each
   image, composition, safe space, crop, file format, responsive behaviour and
   motion.
2. **GPT is the image studio.** It makes the source artwork from the prompts in
   this brief.
3. **The user is the taste filter.** Nothing becomes the visual system until
   the user selects it.

Do not generate the whole image set at once. Approve a hero plate, paper texture
and goose motif first. Use those approved outputs as visual references for
every later image.

## Visual concept: The Cape Print Cabinet

The site should feel as if an eccentric Western Cape gardener inherited a box
of botanical plates, field notes, seed packets and museum labels, then arranged
them into a modern digital garden planner.

The tension is important:

- old paper, modern interaction;
- scientific observation, playful composition;
- ordered grid, one or two things escaping it;
- quiet cream and green, small flashes of real flower colour;
- credible Cape plants, one wandering silly goose.

## The old-paper recipe

The paper is part of the identity, not a beige background.

- Sun-warmed cotton-rag stock, between cream and pale straw
- Visible but fine paper fibres
- Uneven tone with slightly darker plate edges
- Restrained foxing, mostly at edges and folds
- Faint press indentation
- Tiny red/blue/green ink misregistration
- Softly faded colour rather than a sepia overlay
- Occasional pencil registration mark or hand-ruled border

Avoid theatrical “pirate parchment”: no burnt edges, scroll curls, coffee
rings, aggressive stains, heavy brown vignette or distressed-font text.

## Typography rule

Do not ask GPT to render headings, Latin names, numbers or labels. It will make
errors and flatten the responsive layout. Images may contain blank title bands,
empty label lines or unprinted cartouches. All real text will be added in HTML
using Newsreader and Instrument Sans.

## Recurring personality device: the wandering goose

A small hand-inked Cape goose can appear once on a major page. It should feel
like a marginal note by an illustrator, not a children’s mascot.

- Hero: peeks around a panel edge
- Finder: follows the progress line
- Results: appears inside the “saved” stamp for a moment
- Method: studies the canopy circles like a surveyor
- Footer: waddles a short distance, then settles

Keep it rare. One goose is charming; a flock becomes branding theatre.

## Asset map

| Page | Asset | Format | Composition job |
|---|---|---:|---|
| Global | `paper-rag-tile.webp` | 2048 × 2048, square seamless tile | Gives every page a real printed surface |
| Home | `home-cape-cabinet.webp` | 1800 × 2250, 4:5 | Main right-hand hero plate |
| Global motion | `goose-marginalia.png` | 1000 × 1000, transparent | Small animated personality motif |
| Finder | `finder-place.webp` | 1400 × 1750, 4:5 | Cape place and terrain |
| Finder | `finder-sun.webp` | 1400 × 1750, 4:5 | Sun and leaf-shadow study |
| Finder | `finder-water.webp` | 1400 × 1750, 4:5 | Roots, bulbs and water movement |
| Finder | `finder-space.webp` | 1400 × 1750, 4:5 | Canopy circles and bed measurements |
| Finder | `finder-intention.webp` | 1400 × 1750, 4:5 | Pollinators, flowers and structure |
| Library | `library-herbarium-wall.webp` | 2800 × 1200, 7:3 | Wide specimen-grid header; quiet left text zone |
| Saved | `saved-scrapbook.webp` | 2400 × 1350, 16:9 | Empty pockets and pressed-plant workspace |
| Method | `method-root-machine.webp` | 2400 × 1600, 3:2 | Roots transforming into model geometry |

All master files should be generated larger than the delivery size and kept
outside the repository. Export only the web-ready asset into
`public/images/editorial/`.

## Approval batch 1 — generate these three first

### 1. Home hero: Cape cabinet

Placement: right-hand side of the desktop hero; full-width plate below the copy
on mobile.

Safe area: keep the outer 7% relatively quiet so the image can be cropped.

Copy-paste prompt:

> Using the attached botanical references only as visual direction, create an
> original vertical botanical cabinet titled by composition only—do not render
> any words. The subject is the flora of the Western Cape, South Africa.
> Arrange a King Protea as the main specimen with Cape thatching reed, buchu,
> fire heath, pelargonium, watsonia and pincushion protea in unequal archival
> compartments. Combine late nineteenth-century chromolithography,
> copperplate botanical engraving and a well-used museum garden catalogue.
> Print on sun-warmed cotton-rag paper with fine visible fibres, faint foxing
> mainly near the edges, subtle plate pressure and tiny imperfect colour
> registration. Use deep fern, moss, eucalyptus and lichen greens, dusty
> protea pink, faded blue-grey and small botanically accurate yellow accents.
> The grid should be elegant but slightly unruly: let one protea leaf and one
> restio stem cross a panel rule. Hide one tiny hand-inked goose peeking from
> behind the lower-right frame, sophisticated and easy to miss. Keep the outer
> seven percent quiet for responsive cropping. No title, labels, fake Latin,
> watermark, photography, modern vector style, generic tropical leaves, burnt
> parchment, heavy sepia, pot, vase or landscape. Aspect ratio 4:5.

### 2. Global paper surface

Placement: very low-contrast repeating background beneath the interface.

This asset must not contain plants. It should support text rather than compete
with it.

Copy-paste prompt:

> Create a seamless square scan of genuine-looking late nineteenth-century
> cotton-rag botanical-book paper. Sun-warmed cream with pale straw undertones,
> fine visible fibres, extremely subtle uneven ink absorption, a few tiny
> foxing freckles and barely visible press marks. Flat, evenly lit, low
> contrast, no vignette and no directional shadow. It must tile seamlessly on
> every edge. No plants, writing, lines, labels, stains, tears, burnt edges,
> coffee rings, objects or dramatic grunge. The texture should be felt before
> it is noticed. Square, 1:1.

### 3. Wandering goose marginalia

Placement: a small overlay used for rare page and save interactions.

Copy-paste prompt:

> Create one small full-body hand-inked goose as if it were an eccentric
> marginal illustration discovered in a nineteenth-century South African
> botanical catalogue. Side view, mid-waddle, long neck slightly lowered,
> curious rather than cute, carrying one tiny buchu sprig under its wing. Fine
> copperplate linework, restrained hand-coloured cream, charcoal and muted moss
> ink, tiny imperfections and intelligent dry humour. Isolated figure only on a
> transparent background with clean alpha edges. No paper rectangle, caption,
> words, logo, hat, clothing, cartoon eyes, children’s-book style, photorealism,
> 3D rendering or drop shadow. Square canvas, 1:1.

## Approval batch 2 — page atmospheres

Generate these only after batch 1 is approved. Attach the approved hero and
paper outputs as style references.

### Plant library header

> Create a very wide Western Cape herbarium wall on the approved old
> cotton-rag paper. Use an irregular grid of unlabeled botanical specimens:
> protea, erica, restio, buchu, pelargonium, watsonia, gazania and
> leucospermum. Keep the left forty percent sparse with only faint stems and
> paper so live website headings remain readable; build a denser cabinet of
> unequal specimen panels on the right. Hand-coloured chromolithograph and
> copperplate linework, faded fern and eucalyptus greens, dusty pink, faded
> blue and restrained yellow. A few stems may cross the rules. No text, fake
> labels, modern collage, photography, tropical species, burnt edges or heavy
> grunge. Aspect ratio 7:3.

### Method page: the root machine

> Create an eccentric scientific botanical plate on the approved cotton-rag
> paper. On the left, accurate roots of three Western Cape plants descend
> through a fine soil cross-section. As the roots travel right, they gradually
> transform into hand-drawn circles, measured canopy footprints, a rectangular
> garden bed grid and small constraint marks, suggesting a garden-planning
> model without using any words or equations. A tiny hand-inked goose at the
> lower edge studies one circle like a surveyor. Elegant, credible and slightly
> strange; late nineteenth-century engraving with restrained hand colour,
> faded fern green, eucalyptus, pale blue-grey and soft red registration marks.
> No labels, letters, numbers, fake equations, modern infographic icons,
> photorealism, 3D rendering or fantasy roots. Aspect ratio 3:2.

### Saved garden scrapbook

> Create a wide botanical scrapbook workspace on old cotton-rag paper, viewed
> straight-on rather than as a perspective desk scene. Include several empty
> hand-ruled specimen pockets, faint pressed-leaf shadows, two blank seed
> envelopes, fine thread and subtle registration marks. Keep the middle and
> upper-left areas quiet so live saved-plant cards can occupy them. Add one
> small eucalyptus-green circular stamp with no words. Intimate and useful,
> not nostalgic clutter. No readable text, fake handwriting, hands, tools,
> coffee cup, dramatic shadows, photography or burnt paper. Aspect ratio 16:9.

## Approval batch 3 — five finder plates

Use the approved old-paper style and a consistent 4:5 composition. Each plate
should have its main detail around the outer edges and a quieter centre so the
question remains readable.

- **Place:** a loose Cape coastline, mountain profile, sand, shale and fynbos
  clusters; diagrammatic, not a real navigational map; no place names.
- **Sun:** a hand-coloured sun study with protea and restio leaf shadows moving
  across ruled hourly arcs; no numbers.
- **Water:** bulbs, roots and capillary water rendered as engraved wave-lines;
  no watering can.
- **Space:** top-down mature canopy circles inside a rectangular bed, with one
  branch escaping a circle; no measurements or equations.
- **Intention:** pollinator, flower, screening and edible/aromatic specimens
  arranged like four unusual suits in a botanical card deck.

## Motion and interaction plan

The artwork should move like paper and print, not like a tech demo.

### Home

- Reveal the hero with a slow vertical print-press wipe.
- Move the cabinet by 4–8 px against pointer position.
- Let the escaped protea leaf sit above the panel border with a CSS mask.
- The goose peeks in after the headline settles, then stays still.

### Finder

- Change plates with a lateral page-slide and 1.5° rotation.
- The progress line draws like wet ink.
- Leaf shadows drift only on the sunlight step.
- Water engraving lines rise slowly only on the water step.

### Library

- Cards enter with alternating half-degree rotations.
- Hovering lifts a specimen by 5 px and squares its rotation.
- The library background moves more slowly than the cards during scroll.

### Saved garden

- Saving a plant triggers a short “stamp press”: down, tiny ink ring, release.
- The goose crosses one card-width after the third saved plant.

### Method

- CSS canopy circles draw one after another over the static root-machine plate.
- Roots remain still; only the analytical overlay moves.

### Global

- Rules draw from left to right on section entry.
- Paper texture moves no more than 2 px during scroll.
- All decorative motion stops under `prefers-reduced-motion`.
- Avoid floating blobs, generic fade-up grids, continuous bouncing and
  full-screen parallax.

## Handoff checklist

For every approved asset, provide:

- the original generation;
- the final approved prompt;
- the crop the user approved;
- the source dimensions;
- a WebP export, except transparent goose PNG;
- the exact filename from the asset map; and
- any element that must remain visible on mobile.

Codex will then integrate the assets, add responsive art direction, preserve
text contrast, optimise file size and implement the approved motion.

