import { adapters, detectPlatform, type Product } from "./adapters.ts";
import { catalogueStatus, snapshotNote, WHOLESALE_NOTE, type ParsedCatalogue } from "./catalogues.ts";
import { geocode, geocodeBranch, haversineKm } from "./geo.ts";
import { OUT_OF_REQUESTS, type PoliteClient } from "./http.ts";
import { classifyListing, commonNamesOf, matchLabel, type MatchRank, type NameIndex } from "./matching.ts";
import { className, parseSize, perPlant, sizeClassOf, type ParsedSize } from "./sizes.ts";
import type { Source, SourcingSpec } from "./spec.ts";
import {
  summariseSourcing,
  type BasePart,
  type NurseryPart,
  type Offer,
  type SourceLocation,
  type SourcingReport,
  type SourcingSpecies,
} from "./summary.ts";

export { budgetPrices, summariseSourcing } from "./summary.ts";
export type {
  BasePart,
  NurseryPart,
  Offer,
  SourceStatus,
  SourcingReport,
  SourcingSpecies,
  SpeciesReport,
  WalkIn,
} from "./summary.ts";

/**
 * 4_Search_Process - the run-time flow, every layout:
 *   read enabled sources -> geocode the user's area -> query each site per
 *   species (scientific name -> synonyms -> common name) -> match -> parse
 *   size and pack -> per-plant price -> size class -> distance -> budget.
 *
 * It comes in parts so the deployed worker can do it within Cloudflare's
 * 50 subrequests per request: the geocode and the PDFs (gatherBase), each
 * live nursery on its own (gatherNursery), then one summary
 * (summariseSourcing, in summary.ts, which the browser can run). On the
 * dev server and in scripts runSourcing does all three in one go.
 *
 * ANNOTATE ONLY: this reads the layout's species and quantities and never
 * changes which plants were selected or where they were placed.
 */

export type RunContext = {
  spec: SourcingSpec;
  catalogues: Map<string, ParsedCatalogue>;
  client: PoliteClient;
  index: NameIndex;
  now: Date;
};

const MAX_PRODUCTS_PER_SPECIES = 4;
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const binomial = (name: string) => name.split(/\s+/).slice(0, 2).join(" ");
const SML = /^(x+-?small|small|medium|large|x+-?large|extra large|mini|jumbo|s|m|l|xl)$/i;

/** Location fields are filled in by the summary, once the geocode is known. */
const UNPLACED = { branch: null, distanceKm: null, approximate: false, band: null, bandLabel: null, online: false };

/** 5_Size_Parser "Small / Medium / Large": read the cm from the
 * description when it gives one for that variant, else not stated. */
function sizeOf(title: string, variant: string | null, description: string, spec: SourcingSpec): ParsedSize {
  const size = parseSize(`${title} ${variant ?? ""}`, spec);
  if (size.diameterCm === null && size.litres === null && variant && SML.test(variant.trim())) {
    const said = new RegExp(`${variant.trim()}[^0-9]{0,25}(\\d+(?:[.,]\\d+)?)\\s*cm`, "i").exec(description);
    if (said) return parseSize(`${said[1]}cm${size.pack > 1 ? ` pack of ${size.pack}` : ""}`, spec);
  }
  return size;
}

function describeSize(size: ParsedSize, cls: string | null): string {
  if (!size.label) return "size not stated";
  return cls ? `${size.label} (${className(cls)})` : size.label;
}

async function configChanged(client: PoliteClient, source: Source): Promise<void> {
  // 8: a config change for a source clears that source's cached results.
  const signature = JSON.stringify({ ...source, row: undefined });
  const key = `config|${source.id}`;
  if (client.cache.get(key)?.value !== signature) {
    client.cache.clear(`${source.id}|`);
    client.cache.set(key, { at: Date.now(), value: signature });
  }
}

const enabledSources = (spec: SourcingSpec) => spec.sources.filter((s) => s.enabled && s.role !== "skip");

/** The live nurseries: priced sources with a website. One request each on
 * the deployed worker. */
export function liveNurseries(spec: SourcingSpec): { id: string; nursery: string }[] {
  return enabledSources(spec)
    .filter((s) => s.role === "pricing" && s.website)
    .map((s) => ({ id: s.id, nursery: s.nursery }));
}

/** Steps 2 and the PDF sources: the user's area, each source's nearest
 * branch, and the snapshot (PDF) lists. */
export async function gatherBase(
  input: { species: SourcingSpecies[]; place: string | null },
  ctx: RunContext,
): Promise<BasePart> {
  const { spec, client, index } = ctx;
  const warnings: string[] = [];
  const statuses: BasePart["statuses"] = [];
  const enabled = enabledSources(spec);
  for (const source of enabled) await configChanged(client, source);

  // ------------------------------------------------ 2. geocode the user's area
  let user: BasePart["user"] = null;
  if (input.place) {
    const point = await geocode(client, `${input.place}, Western Cape, South Africa`);
    user = { query: input.place, point };
    // Many of the smaller rural places in the picker come from the
    // Department of Agriculture communities layer and simply are not in
    // OpenStreetMap. Nothing can be done about that here, and guessing a
    // looser query is worse than saying so: dropping the province from
    // the query returns matches on other continents.
    if (!point) {
      warnings.push(
        `OpenStreetMap has no record of "${input.place}", so we can't work out how far each nursery is. The prices below are still real — choose a nearby town in step 1 if you want distances too.`,
      );
    }
  }

  // Branches: nearest branch per source (geocoded, cached per address).
  const locations: Record<string, SourceLocation> = {};
  await Promise.all(
    spec.branches
      .filter((b) => enabled.some((s) => s.id === b.sourceId))
      .map(async (branch) => {
        if (branch.online) {
          locations[branch.sourceId] = { branch: branch.name, km: null, online: true, approximate: false };
          return;
        }
        if (!user?.point) {
          if (!locations[branch.sourceId]) locations[branch.sourceId] = { branch: branch.name, km: null, online: false, approximate: false };
          return;
        }
        const located =
          branch.lat !== null && branch.lon !== null
            ? { point: { lat: branch.lat, lon: branch.lon }, approximate: false }
            : await geocodeBranch(client, branch.address, branch.town);
        const km = located ? haversineKm(user.point, located.point, spec.earthRadiusKm) : null;
        const current = locations[branch.sourceId];
        if (!current || (km !== null && (current.km === null || km < current.km))) {
          locations[branch.sourceId] = { branch: branch.name, km, online: false, approximate: located?.approximate ?? false };
        }
      }),
  );

  // ------------------------------------------------ PDFs (snapshot sources)
  const offers: Record<string, Offer[]> = Object.fromEntries(input.species.map((s) => [s.plantId, []]));
  const availability: BasePart["availability"] = Object.fromEntries(input.species.map((s) => [s.plantId, []]));
  for (const pdf of spec.pdfSources) {
    const source = pdf.sourceId ? enabled.find((s) => s.id === pdf.sourceId) : undefined;
    const catalogue = ctx.catalogues.get(pdf.fileName);
    if (!pdf.sourceId || !source) {
      statuses.push({ id: pdf.sourceId ?? "?", nursery: pdf.nursery, platform: "pdf", status: "skipped", detail: pdf.sourceId ? "source not enabled" : "no source id in 3_PDF_Sources" });
      continue;
    }
    if (!catalogue) {
      statuses.push({ id: source.id, nursery: source.nursery, platform: "pdf", status: "failed", detail: `${pdf.fileName} has not been parsed` });
      warnings.push(`Couldn't check ${source.nursery} (catalogue ${pdf.fileName} not parsed).`);
      continue;
    }
    const status = catalogueStatus(pdf.catalogueDate, spec.pdfWindowDays, ctx.now);
    const note = snapshotNote(pdf.catalogueDate, status.outdated);
    statuses.push({ id: source.id, nursery: source.nursery, platform: "pdf", status: "checked", detail: `${catalogue.rows.length} rows, ${status.outdated ? "may be outdated" : "current"}` });
    for (const species of input.species) {
      for (const row of catalogue.rows) {
        const rank = classifyListing(`${row.name} ${row.commonName ?? ""}`, species, index);
        if (rank === "unresolved") continue;
        if (pdf.channel === "wholesale" || source.role === "availability") {
          const list = availability[species.plantId];
          if (!list.some((a) => a.nursery === source.nursery)) list.push({ nursery: source.nursery, note: WHOLESALE_NOTE, snapshotNote: note });
          continue;
        }
        const size = parseSize(row.sizeText ?? "", spec);
        const cls = sizeClassOf(size, spec.sizeClasses);
        offers[species.plantId].push({
          sourceId: source.id, nursery: source.nursery, ...UNPLACED, deliversTo: source.deliversTo,
          title: row.name, size: describeSize(size, cls?.name ?? null), sizeClass: cls?.name ?? null,
          pricePerPlant: row.price !== null ? perPlant(row.price, size.pack) : null, packPrice: row.price, pack: size.pack,
          stock: row.qty !== null ? `${row.qty} listed${row.limited ? " (limited)" : ""}` : null,
          link: null, checked: pdf.catalogueDate, rank, matchLabel: matchLabel(rank)!,
          snapshotNote: note, channel: "pdf-retail", outdated: status.outdated,
        });
      }
    }
  }

  return { user, locations, offers, availability, statuses, warnings };
}

/**
 * Steps 3-7 for one live nursery: query its site for each species, match,
 * parse size and pack, per-plant price, size class.
 *
 * Species are checked one after another, so the site still sees at most
 * one request a second. If the client's request cap is reached part-way
 * through a species, that species' partial results are dropped and it is
 * returned in `unchecked` together with every species after it, so the
 * next request checks it whole.
 */
export async function gatherNursery(
  input: { species: SourcingSpecies[] },
  sourceId: string,
  ctx: RunContext,
): Promise<NurseryPart> {
  const { spec, client, index } = ctx;
  const offers: Record<string, Offer[]> = Object.fromEntries(input.species.map((s) => [s.plantId, []]));
  const source = enabledSources(spec).find((s) => s.id === sourceId && s.role === "pricing" && s.website);
  if (!source) {
    return {
      sourceId, offers, warnings: [], unchecked: [],
      status: { id: sourceId, nursery: sourceId, platform: "none", status: "skipped", detail: "not an enabled live nursery" },
    };
  }
  await configChanged(client, source);
  const allUnchecked = () => input.species.map((s) => s.plantId);
  const outOfRequests = (): NurseryPart => ({
    sourceId, offers: Object.fromEntries(input.species.map((s) => [s.plantId, []])), warnings: [], unchecked: allUnchecked(),
    status: { id: source.id, nursery: source.nursery, platform: source.platform, status: "skipped", detail: "not checked this time - the request limit was reached" },
  });

  let platform = source.platform;
  if (platform === "unconfirmed") {
    platform = await detectPlatform(client, source);
    if (client.outOfRequests) return outOfRequests();
    if (platform === "none") {
      return {
        sourceId, offers, unchecked: [], warnings: [`Couldn't check ${source.nursery}.`],
        status: { id: source.id, nursery: source.nursery, platform, status: "failed", detail: "platform could not be detected" },
      };
    }
  }
  if (platform !== "shopify" && platform !== "woocommerce") {
    return {
      sourceId, offers, unchecked: [], warnings: [],
      status: { id: source.id, nursery: source.nursery, platform, status: "skipped", detail: `no adapter for ${source.platformText}` },
    };
  }
  const adapter = adapters[platform];
  let failure: string | null = null;
  const unchecked: string[] = [];

  for (let i = 0; i < input.species.length; i += 1) {
    const species = input.species[i];
    const found: Offer[] = [];
    const queries = [binomial(species.scientificName), ...commonNamesOf(species).slice(0, 1)];
    let matched: { product: Product; rank: MatchRank }[] = [];
    for (const query of queries) {
      const result = await adapter.search(client, source, query);
      if (!result.ok) {
        if (result.error !== OUT_OF_REQUESTS) failure = result.error;
        break;
      }
      matched = result.products
        .map((product) => ({ product, rank: classifyListing(product.title, species, index) }))
        .filter((m) => m.rank !== "unresolved");
      if (matched.length > 0) break;
    }
    if (!failure && !client.outOfRequests) {
      for (const { product, rank } of matched.slice(0, MAX_PRODUCTS_PER_SPECIES)) {
        const variants = await adapter.variants(client, source, product);
        for (const v of variants) {
          const size = sizeOf(v.title, v.variant, v.description, spec);
          const cls = sizeClassOf(size, spec.sizeClasses);
          found.push({
            sourceId: source.id, nursery: source.nursery, ...UNPLACED, deliversTo: source.deliversTo,
            title: v.variant ? `${v.title} - ${v.variant}` : v.title,
            size: describeSize(size, cls?.name ?? null), sizeClass: cls?.name ?? null,
            pricePerPlant: v.price !== null ? perPlant(v.price, size.pack) : null, packPrice: v.price, pack: size.pack,
            stock: v.inStock === null ? null : v.inStock ? "In stock online" : "Out of stock online",
            link: v.url, checked: day(product.at), rank, matchLabel: matchLabel(rank)!,
            snapshotNote: null, channel: "live", outdated: false,
          });
        }
      }
    }
    if (failure) break;
    if (client.outOfRequests) {
      // Ran out part-way through: this species and the rest go back.
      unchecked.push(...input.species.slice(i).map((s) => s.plantId));
      break;
    }
    offers[species.plantId] = found;
  }

  if (failure) {
    return {
      sourceId, offers, unchecked: [], warnings: [`Couldn't check ${source.nursery} (${failure}).`],
      status: { id: source.id, nursery: source.nursery, platform, status: "failed", detail: failure },
    };
  }
  return {
    sourceId, offers, unchecked, warnings: [],
    status: {
      id: source.id, nursery: source.nursery, platform, status: "checked",
      detail: source.platform === "unconfirmed" ? `platform detected: ${platform}` : "",
    },
  };
}

/** The whole run in one process (dev server, scripts, tests): the base,
 * every live nursery in parallel, then the summary. */
export async function runSourcing(
  input: { species: SourcingSpecies[]; place: string | null },
  ctx: RunContext,
): Promise<SourcingReport> {
  const [base, ...nurseries] = await Promise.all([
    gatherBase(input, ctx),
    ...liveNurseries(ctx.spec).map((n) => gatherNursery(input, n.id, ctx)),
  ]);
  return summariseSourcing(input.species, base, nurseries, ctx.spec, ctx.now);
}
