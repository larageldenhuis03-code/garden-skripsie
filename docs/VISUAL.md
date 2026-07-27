# Visual direction and image workflow

**Audience:** the user, GPT image generation and implementation work

**Purpose:** the approved visual language and image workflow

**Updated:** 2026-07-27

> **Current asset:** the public home page uses `hero.png`, optimised as
> `public/images/editorial/home-hero.avif` with WebP and JPEG fallbacks. The
> earlier V01 botanical cabinet is retained as a reference but is not the active
> hero.

## The Cape Print Cabinet

The site should feel as if an eccentric Western Cape gardener inherited a box
of botanical plates, field notes, seed packets and museum labels, then arranged
them into a modern garden planner.

| Element | Direction |
|---|---|
| Paper | Sun-warmed cotton rag, fine fibres, restrained foxing and faint press marks |
| Plants | Recognisable Western Cape specimens in hand-coloured engravings |
| Composition | Museum grid with one or two details escaping the rules |
| Colour | Cream, fern, eucalyptus, moss, sage and real flower colour |
| Type | Bodoni Moda for major headings; Newsreader for editorial copy; Instrument Sans for controls |
| Personality | One rare, curious goose used as marginalia |
| Motion | Physical print and paper behaviour, brief and restrained |
| Voice | Plain, specific and honest about limitations |

The result should feel collected and printed—not filtered beige, generic
“eco”, glossy or nostalgic for its own sake.

## Non-negotiable visual rules

Use:

- late nineteenth-century chromolithography and copperplate engraving;
- uneven archival grids and hand-ruled borders;
- credible Cape morphology;
- softly faded colour and slight ink misregistration;
- live HTML for all meaningful words; and
- quiet areas deliberately composed for responsive text and cropping.

Avoid:

- tropical or fantasy foliage;
- stock photography, glossy 3D or modern vector leaves;
- fake Latin and generated labels;
- burnt parchment, coffee stains or theatrical grunge;
- generic watercolour clip art; and
- decorative all-caps micro-headings.

## Typography and palette

| Role | Value |
|---|---|
| Major display headings | Bodoni Moda Variable |
| Editorial copy and botanical names | Newsreader Variable |
| Controls and factual metadata | Instrument Sans Variable |
| Desktop body | 16 px, approximately 155% line height |
| Long-form measure | Approximately 45–90 characters |
| Paper | `#EFEDE3` |
| Light paper | `#F7F5ED` |
| Fern ink | `#173C32` |
| Olive accent | `#687044` |
| Deep olive | `#555D36` |
| Soft olive | `#858D5D` |
| Sage | `#95A79B` |

Primary page titles may use restrained capitals in the manner of a botanical
catalogue masthead. Long headings remain mixed case. Use size, weight and
whitespace before tracking or colour. Flower colour comes from the specimens
rather than an orange brand accent.

## Voice

Write like a practical Western Cape garden planner:

- make questions the headings;
- name the input, action and result;
- use ordinary words and active voice;
- keep one idea per paragraph; and
- state limitations specifically.

Do not use “unlock”, “seamless”, “reimagined”, “elevate”, “where X meets Y”,
stacked slogans, or claims such as “perfect” and “will thrive”.

Useful references:

- [GOV.UK clear language](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/)
- [GOV.UK headings](https://design-system.service.gov.uk/styles/headings/)
- [Butterick on body text](https://practicaltypography.com/body-text.html)

## One-image workflow

1. Codex makes one prompt active.
2. The user generates and selects the strongest version in GPT.
3. The user attaches the untouched full-resolution file.
4. Codex checks subject, crop, safe space and style.
5. Codex integrates and deploys it in the real page.
6. The user approves it or requests one focused revision.
7. Only then does Codex activate the next prompt.

The user is the taste filter. GPT is the image studio. Codex handles art
direction, placement, optimisation, accessibility and motion.

## Asset queue

| ID | Status | Asset |
|---|---|---|
| V01 | Archived reference | Home botanical cabinet |
| V02 | Blocked | Seamless cotton-rag paper texture |
| V03 | Blocked | Transparent goose marginalia |
| V04 | Later | Plant-library herbarium wall |
| V05 | Later | Method roots-to-canopy diagram |
| V06 | Later | Saved-plants scrapbook |
| V07–V11 | Later | Finder plates for place, sun, water, space and intention |
| Plant portraits | Later | Begin with one `Protea cynaroides` card; never batch first |

Approved editorial assets belong in `public/images/editorial/`. Plant portraits
belong in `public/images/plants/`. The catalogue in `app/data/plants.ts` is the
canonical plant manifest; do not duplicate its 48 names here.

The V01 source is retained at `assets/source/home-cape-cabinet.png`. It is not
used by the current interface.

## V01 prompt record

Use this prompt only if deliberately revisiting the archived V01 direction:

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

## Later asset briefs

- **V02 paper:** seamless, extremely low-contrast cotton rag; no plants, text,
  vignette, stains or directional shadow.
- **V03 goose:** transparent copperplate marginal drawing; mid-waddle, curious,
  one buchu sprig, no clothing.
- **V04 library:** irregular Western Cape herbarium wall with a sparse text
  zone and denser specimen cabinet.
- **V05 method:** roots transforming into canopy circles and a bed grid; no
  equations or labels.
- **V06 saved:** front-on scrapbook with empty specimen pockets.
- **V07–V11 finder:** separate Cape place, light, water, canopy and design-role
  studies without generated words.

## Motion

- Hero: keep the botanical background still; no pointer movement or parallax.
- Finder: lateral page slide, progress rule drawn like ink.
- Library: half-degree card irregularity; 5 px hover lift.
- Save: brief stamp press.
- Method: CSS canopy circles draw over still artwork.
- Goose: one short movement, then still.

All decorative motion stops under `prefers-reduced-motion`. Do not use floating
blobs, continuous bouncing, generic fade-up grids or full-screen parallax.

## Approval checklist

- Western Cape subject matter is recognisable.
- Morphology is plausible.
- No generated words or fake Latin appear.
- Desktop and mobile crops retain the main composition.
- Live text has sufficient quiet space and contrast.
- No essential detail sits on a crop edge.
- Paper treatment matches the approved material language.
- The page feels specific, useful and slightly eccentric—not synthetic.

For an approved asset, retain the original, exact prompt, source dimensions,
approved crop and web-ready export. Codex handles the final format, filename
and repository placement.
