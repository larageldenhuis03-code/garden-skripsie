# Silly Goose MVP — visual system

This is the canonical source for visual direction, content voice, typography,
image production and motion.

Updated: 2026-07-27  
Active image prompt: **V01 — home hero**

## Production rule: one design at a time

The user generates each design manually in GPT.

For every design:

1. Codex activates one prompt in this document.
2. The user copies that prompt into GPT.
3. The user generates one or more versions there.
4. The user attaches the preferred full-resolution result here.
5. Codex checks botanical plausibility, crop, safe space, text contrast and
   consistency.
6. The user revises it in GPT or approves it.
7. Codex integrates, optimises and deploys it.
8. The user approves it in context.
9. Codex activates the next prompt.

No batch is active. Do not generate a future asset because its specification is
visible below.

## Roles

- **User:** taste filter and final visual approval
- **GPT:** image studio
- **Codex:** art direction, prompt specification, responsive placement,
  optimisation, accessibility and motion

## Visual concept: The Cape Print Cabinet

The site should feel as if an eccentric Western Cape gardener inherited a box
of botanical plates, field notes, seed packets and museum labels, then arranged
them into a modern digital garden planner.

The useful tensions are:

- old paper and modern interaction;
- scientific observation and playful composition;
- an ordered grid with one or two things escaping it;
- quiet cream and tonal greens with real flower colour; and
- credible Cape plants with one rare wandering goose.

## Old-paper specification

The paper is material, not a flat beige fill.

- Sun-warmed cotton-rag stock between cream and pale straw
- Fine visible fibres
- Uneven tone and slightly darker plate edges
- Restrained foxing near edges and folds
- Faint press indentation
- Tiny red, blue or green ink misregistration
- Softly faded colour rather than a sepia overlay
- Occasional pencil registration mark or hand-ruled border

Never use:

- burnt or torn parchment edges;
- coffee rings;
- aggressive stains;
- heavy brown vignettes;
- theatrical grunge; or
- distressed “vintage” display fonts.

## Botanical image language

Use:

- late nineteenth-century chromolithography;
- copperplate botanical engraving;
- restrained hand colouring;
- imperfect museum-catalogue grids;
- recognisable Western Cape morphology;
- deep fern, moss, eucalyptus and lichen greens;
- dusty protea pink and faded blue-grey; and
- botanically accurate flower colour.

Avoid:

- generic tropical foliage;
- fantasy morphology;
- stock photography;
- glossy 3D rendering;
- modern vector art;
- generic watercolour clip art;
- fake Latin;
- embedded headings or labels; and
- pots, vases or hands unless a later prompt explicitly needs them.

## Content voice

Write as a practical garden planner speaking to a Western Cape homeowner.

- Name the input, action and result.
- Prefer active voice and ordinary words.
- Keep one idea per paragraph.
- Use sentence-case headings.
- Let a form question be its own heading.
- State limitations specifically.
- Keep claims proportionate to the data and implemented model.

Avoid:

- “unlock”, “seamless”, “reimagined”, “elevate” and “where X meets Y”;
- poetic “not X, but Y” formulas;
- stacked three-part slogans;
- decorative uppercase micro-headings;
- anthropomorphising the interface; and
- guarantees such as “perfect” or “will thrive”.

Research basis:

- [GOV.UK clear-language
  guidance](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/)
- [GOV.UK heading
  guidance](https://design-system.service.gov.uk/styles/headings/)
- [GOV.UK form-label
  guidance](https://design-system.service.gov.uk/get-started/labels-legends-headings/)

## Typography

- Display and botanical names: Newsreader Variable
- Body and interface: Instrument Sans Variable
- Desktop body size: 17 px
- Body line height: approximately 155%
- Long-form line length: approximately 45–90 characters
- Sentence case throughout the interface
- All caps only for conventional data, never decorative hierarchy
- Small text only for non-essential metadata

Typography should use size, weight and whitespace before tracking or colour.

Research basis:

- [Butterick: body
  text](https://practicaltypography.com/body-text.html)
- [Butterick: line
  length](https://practicaltypography.com/line-length.html)
- [Fontsource:
  Newsreader](https://fontsource.org/fonts/newsreader/install)
- [Fontsource: Instrument
  Sans](https://fontsource.org/fonts/instrument-sans)

## Palette

- Paper: `#EFEDE3`
- Light paper: `#F7F5ED`
- Fern ink: `#173C32`
- Eucalyptus: `#4F716C`
- Moss: `#607667`
- Sage: `#95A79B`
- Lichen: `#A6B493`

Flower colour comes from the specimen artwork rather than an orange/coral brand
accent.

## Typography inside generated images

Do not ask GPT to render headings, Latin names, numbers or labels. Generated
text is error-prone and prevents responsive layout.

Artwork may contain:

- blank title bands;
- empty label rules;
- unprinted cartouches; and
- border or registration marks.

All meaningful text is live HTML.

## Personality device: the wandering goose

The goose is marginalia, not a mascot.

- It appears at most once on a major surface.
- It is curious rather than cute.
- It does not wear clothing.
- It may carry one buchu sprig.
- It moves briefly, then becomes still.

Possible uses:

- peeking around the hero plate;
- following the finder progress line;
- appearing in the save-stamp reaction;
- studying canopy circles on the methodology view; and
- waddling once across the footer.

## Image queue

Only the active row may be generated.

| ID | Status | Page | File | Delivery format |
|---|---|---|---|---|
| V01 | **Active** | Home | `home-cape-cabinet.webp` | 1800 × 2250, 4:5 |
| V02 | Blocked | Global | `paper-rag-tile.webp` | 2048 × 2048, seamless |
| V03 | Blocked | Global motion | `goose-marginalia.png` | 1000 × 1000, transparent |
| V04 | Blocked | Plant library | `library-herbarium-wall.webp` | 2800 × 1200, 7:3 |
| V05 | Blocked | Method | `method-root-machine.webp` | 2400 × 1600, 3:2 |
| V06 | Blocked | Saved plants | `saved-scrapbook.webp` | 2400 × 1350, 16:9 |
| V07 | Blocked | Finder: place | `finder-place.webp` | 1400 × 1750, 4:5 |
| V08 | Blocked | Finder: sun | `finder-sun.webp` | 1400 × 1750, 4:5 |
| V09 | Blocked | Finder: water | `finder-water.webp` | 1400 × 1750, 4:5 |
| V10 | Blocked | Finder: space | `finder-space.webp` | 1400 × 1750, 4:5 |
| V11 | Blocked | Finder: intention | `finder-intention.webp` | 1400 × 1750, 4:5 |
| P01–P48 | Blocked | Plant cards | See plant manifest | 1600 × 2000, 4:5 |

Approved assets will be exported to `public/images/editorial/`. Plant portraits
will eventually go to `public/images/plants/`.

## Active prompt V01 — home hero

Placement:

- right side of the desktop hero;
- full-width plate below the hero copy on mobile; and
- cropped only within a quiet outer margin.

The asset must work without any embedded title.

Copy this prompt into GPT:

> Using the attached botanical references only as visual direction, create an
> original vertical botanical cabinet with no rendered words. The subject is
> the flora of the Western Cape, South Africa. Arrange a King Protea as the
> main specimen with Cape thatching reed, buchu, fire heath, pelargonium,
> watsonia and pincushion protea in unequal archival compartments. Combine late
> nineteenth-century chromolithography, copperplate botanical engraving and a
> well-used museum garden catalogue. Print on sun-warmed cotton-rag paper with
> fine visible fibres, faint foxing mainly near the edges, subtle plate
> pressure and tiny imperfect colour registration. Use deep fern, moss,
> eucalyptus and lichen greens, dusty protea pink, faded blue-grey and small
> botanically accurate yellow accents. The grid should be elegant but slightly
> unruly: let one protea leaf and one restio stem cross a panel rule. Hide one
> tiny hand-inked goose peeking from behind the lower-right frame,
> sophisticated and easy to miss. Keep the outer seven percent visually quiet
> for responsive cropping. No title, labels, fake Latin, watermark,
> photography, modern vector style, generic tropical leaves, burnt parchment,
> heavy sepia, pot, vase or landscape. Aspect ratio 4:5.

After generating:

1. choose the version that feels least synthetic;
2. do not resize or rename it;
3. attach the full-resolution original here; and
4. label it `V01 hero`.

The next prompt is not active until V01 is approved in the site.

## Future asset briefs

These are composition briefs, not active copy-paste prompts. Codex will turn
the relevant brief into a final GPT prompt only when its row becomes active.

- **V02 paper:** seamless, extremely low-contrast cotton-rag scan; no plants,
  text, vignette, stains or directional shadow.
- **V03 goose:** transparent copperplate marginal drawing; mid-waddle,
  curious, one buchu sprig; no clothing or cartoon expression.
- **V04 library:** irregular Western Cape herbarium wall; sparse left text
  zone, dense right specimen cabinet.
- **V05 method:** accurate roots transforming into canopy circles and a bed
  grid; no equations or labels.
- **V06 saved:** front-on scrapbook with empty specimen pockets and quiet
  card-placement zones.
- **V07 place:** diagrammatic Cape coast, mountain, sand, shale and fynbos; no
  place names.
- **V08 sun:** botanical sun study with leaf shadows crossing unnumbered arcs.
- **V09 water:** bulbs, roots and capillary water as engraved wave lines; no
  watering can.
- **V10 space:** mature canopy circles inside a rectangular bed; one branch
  escapes a circle.
- **V11 intention:** pollinator, flower, screening and aromatic forms arranged
  like four suits in a botanical card deck.

## Motion system

Artwork moves like paper and print, not like a technology demo.

### Home

- Slow vertical print-press reveal
- Pointer movement limited to 4–8 px
- Escaped botanical detail may overlap a rule
- Goose peeks once, then stays still

### Finder

- Plate changes use a lateral page slide and no more than 1.5° rotation
- Progress line draws like wet ink
- Leaf shadows move only on the sun step
- Engraved water lines move only on the water step

### Library

- Cards use alternating half-degree rotations
- Hover lifts a specimen by 5 px and squares its rotation
- Background scrolls more slowly than foreground cards

### Saved plants

- Save action uses a brief stamp press: down, ink ring, release
- Goose crosses one card width after the third save

### Method

- CSS canopy circles draw sequentially over the static artwork
- Roots remain still

### Global rules

- Section rules draw left to right
- Paper texture moves no more than 2 px
- Decorative motion stops under `prefers-reduced-motion`
- No floating blobs, continuous bouncing, generic fade-up grids or full-screen
  parallax

## Asset review checklist

Before approval, Codex checks:

- correct Western Cape subject matter;
- plausible morphology;
- no generated text;
- no fake Latin;
- no modern/tropical style drift;
- usable desktop and mobile crops;
- sufficient quiet space around live text;
- no essential detail at the crop edge;
- paper treatment consistent with the specification; and
- no unnecessary visual noise.

## Plant portrait system

Plant portraits are blocked until the page-level visual system is approved.

When activated, begin with one sample:

`P02 — Protea cynaroides`

The sample must be approved in a real plant card before any other portrait is
generated.

Shared plant direction:

> Create an original hand-coloured botanical print of [PLANT NAME], shown
> botanically accurately and recognisably. Combine late nineteenth-century
> chromolithography, copperplate botanical engraving and a slightly imperfect
> museum-garden catalogue. Print on the approved cotton-rag paper with the
> approved fibre, foxing, plate-pressure and ink-registration character. Use
> the approved tonal greens and botanically accurate flower colour. Show one
> complete young specimen where scale allows; for a large shrub or tree, show
> a representative branch plus enough structure to communicate growth habit.
> No photography, modern vector art, generic watercolour clip art, fantasy
> morphology, text, labels, logos, pots or hands. Aspect ratio 4:5.

### Plant manifest

| ID | Plant |
|---|---|
| P01 | Leucadendron salignum |
| P02 | Protea cynaroides |
| P03 | Protea nitida |
| P04 | Protea aurea |
| P05 | Leucospermum calligerum |
| P06 | Leucospermum cuneiforme |
| P07 | Leucospermum conocarpodendron |
| P08 | Leucadendron rubrum |
| P09 | Erica mammosa |
| P10 | Erica coccinea |
| P11 | Erica discolor |
| P12 | Erica cerinthoides |
| P13 | Erica plukenetii |
| P14 | Erica abietina |
| P15 | Salvia aurea |
| P16 | Pelargonium capitatum |
| P17 | Pelargonium cucullatum |
| P18 | Pelargonium peltatum |
| P19 | Elegia tectorum |
| P20 | Elegia capensis |
| P21 | Restio subverticillatus |
| P22 | Thamnochortus insignis |
| P23 | Carpobrotus edulis |
| P24 | Carpobrotus acinaciformis |
| P25 | Gazania krebsiana |
| P26 | Arctotis stoechadifolia |
| P27 | Lobostemon fruticosus |
| P28 | Helichrysum petiolare |
| P29 | Helichrysum odoratissimum |
| P30 | Eriocephalus africanus |
| P31 | Agathosma betulina |
| P32 | Agathosma crenulata |
| P33 | Bulbine frutescens |
| P34 | Watsonia meriana |
| P35 | Babiana sambucina |
| P36 | Lachenalia obscura |
| P37 | Virgilia oroboides |
| P38 | Kiggelaria africana |
| P39 | Olea capensis |
| P40 | Searsia lucida |
| P41 | Searsia glauca |
| P42 | Phylica ericoides |
| P43 | Metalasia muricata |
| P44 | Euryops abrotanifolius |
| P45 | Leonotis ocymifolia |
| P46 | Felicia filifolia |
| P47 | Athanasia trifurcata |
| P48 | Syncarpha vestita |

## File handoff

For an approved design, retain:

- the full-resolution original;
- the exact prompt used;
- the crop approved in context;
- source dimensions;
- the web-ready output;
- the canonical filename; and
- any detail that must survive the mobile crop.

Codex handles final resizing, WebP/PNG export, filenames and repository
placement.

