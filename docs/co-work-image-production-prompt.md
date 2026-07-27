# Co-work desktop-agent prompt — botanical image production

Copy the prompt below into Co-work. It is deliberately split into an approval
sample and a manual one-by-one production run.

---

You are producing the custom botanical imagery for the website repository at:

`C:\Users\Admin\Projects\garden-app`

Read these files before doing anything:

- `docs/image-prompts.md`
- `app/data/plants.ts`
- `app/globals.css`

The visual system is warm cream paper, deep fern green, eucalyptus, moss, sage
and lichen. Flower colour should be botanically accurate and restrained. Do not
introduce an orange/coral brand palette. The images must be original South
African editorial botanical **photographs** with an archival botanical-plate
composition. They must not look like stock photography, generic watercolour
clip art, fantasy plants or glossy AI renders.

## Phase 1 — make one approval sample

Create **one image only** for `P02 — Protea cynaroides` using the shared prompt
in `docs/image-prompts.md`.

Requirements:

- Aspect ratio: 4:5
- One recognisable complete young specimen
- Enough stem and leaf structure to identify the growth habit
- Warm uncoated cream background
- Soft directional natural light and real leaf texture
- Deep fern and tonal green foliage
- Botanically accurate, restrained King Protea flower colour
- Subtle large-format film grain and generous negative space
- No words, labels, logos, border, pot, vase, hands, landscape or cast shadow
- No fake Latin text
- No illustration, watercolour, engraving or 3D-rendered look

Save the original generated file outside the repository first. Then create a
web-ready copy at:

`public/images/plants/P02-protea-cynaroides.webp`

The web-ready asset must be sRGB, 1600 × 2000 px and visually checked after
export. Do not stretch the image to achieve the size.

Then stop. Show the sample and report:

1. the exact generation prompt;
2. the source file path;
3. the web-ready file path and dimensions; and
4. any botanical detail you are uncertain about.

Do not generate P01 or P03–P48 until I explicitly approve P02.

## Phase 2 — manual production after approval

After I approve the sample, create P01 and then P03–P48 **one at a time** in the
order listed in `docs/image-prompts.md`.

For each plant:

1. insert the scientific name into the approved base prompt;
2. confirm the plant’s distinctive flower, leaf and growth-form traits before
   generating;
3. generate one 4:5 image;
4. inspect it for malformed stems, repeated leaves, impossible flowers, text
   artefacts, border artefacts and style drift;
5. regenerate if it fails;
6. export a 1600 × 2000 px sRGB WebP;
7. save it as
   `public/images/plants/[ID]-[lowercase-scientific-name].webp`; and
8. append the ID, scientific name, exact prompt, filename, dimensions and
   status to `docs/image-production-log.md`.

Keep the approved paper tone, line quality, composition density and green
palette fixed across the set. Allow only real plant morphology and accurate
flower colour to vary. Never batch-generate several plants without inspecting
and logging each one.

Stop and ask me if:

- the scientific name in the data conflicts with the reference you find;
- a plant’s morphology is uncertain;
- a generated image cannot be made botanically plausible after two attempts;
  or
- the output style drifts from the approved P02 sample.

Do not edit application code or deploy the website. Your scope is image
generation, export and the production log only.

---
