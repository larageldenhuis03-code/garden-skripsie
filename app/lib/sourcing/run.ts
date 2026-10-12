import { adapters, detectPlatform, type Product } from "./adapters.ts";
import { computeBudget, budgetText, median, type Budget, type BudgetItem } from "./budget.ts";
import { catalogueStatus, snapshotNote, WHOLESALE_NOTE, type ParsedCatalogue } from "./catalogues.ts";
import { bandFor, geocode, geocodeBranch, haversineKm, type LatLon } from "./geo.ts";
import type { PoliteClient } from "./http.ts";
import { classifyListing, commonNamesOf, matchLabel, type MatchRank, type NameIndex } from "./matching.ts";
import { className, parseSize, perPlant, sizeClassOf, type ParsedSize } from "./sizes.ts";
import type { Platform, Source, SourcingSpec } from "./spec.ts";

/**
 * 4_Search_Process - the run-time flow, every layout:
 *   read enabled sources -> geocode the user's area -> query each site per
 *   species (scientific name -> synonyms -> common name) -> match -> parse
 *   size and pack -> per-plant price -> size class -> distance -> budget.
 *
 * ANNOTATE ONLY: this reads the layout's species and quantities and never
 * changes which plants were selected or where they were placed.
 */

export type SourcingSpecies = {
  plantId: string;
  scientificName: string;
  commonName: string;
  plantType: string[] | null;
  n: number;
};

export type Offer = {
  sourceId: string;
  nursery: string;
  branch: string | null;
  distanceKm: number | null;
  /** The branch address was not found, so the distance is to its town. */
  approximate: boolean;
  band: string | null;
  bandLabel: string | null;
  /** Online-only nursery: "online, delivers <area>". */
  online: boolean;
  deliversTo: string;
  title: string;
  size: string;
  sizeClass: string | null;
  pricePerPlant: number | null;
  packPrice: number | null;
  pack: number;
  stock: string | null;
  link: string | null;
  checked: string;
  rank: MatchRank;
  matchLabel: "Found" | "Related plant";
  snapshotNote: string | null;
  channel: "live" | "pdf-retail";
  outdated: boolean;
};

export type SpeciesReport = {
  plantId: string;
  scientificName: string;
  n: number;
  label: "Found" | "Related plant" | "Estimated" | "Not found";
  offers: Offer[];
  /** Wholesale lists that carry it: availability only, never priced. */
  availability: { nursery: string; note: string; snapshotNote: string }[];
  /** True when the budget had to use a class other than the reference. */
  classFallback: string | null;
};

export type WalkIn = { nursery: string; branch: string; town: string; contact: string; distanceKm: number | null; bandLabel: string | null };

export type SourceStatus = {
  id: string;
  nursery: string;
  platform: Platform | "pdf";
  status: "checked" | "failed" | "skipped";
  detail: string;
};

export type SourcingReport = {
  checkedAt: string;
  user: { query: string; point: LatLon | null } | null;
  species: SpeciesReport[];
  walkIn: WalkIn[];
  budget: Budget;
  budgetText: string;
  basket: { nursery: string; speciesStocked: number; speciesTotal: number; total: number } | null;
  warnings: string[];
  sources: SourceStatus[];
  matchCounts: Record<MatchRank, number>;
  outputFields: string[];
};

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

/**
 * 8_Budget / 6_Size_Classes: the prices a species contributes to the budget.
 * Retail "Found" listings only (never related plants, never wholesale), in
 * the reference class; if the species is not sold in that class, the
 * smallest fallback class found is used and flagged. One price per nursery:
 * its lowest per-plant price in that class.
 */
export function budgetPrices(list: Offer[], spec: SourcingSpec): { cls: string; perNursery: Offer[] } {
  const reference = spec.referenceClass;
  const fallbackClasses = spec.sizeClasses
    .filter((c) => c.use === "fallback")
    .sort((a, b) => (a.dMin ?? 0) - (b.dMin ?? 0));
  const priced = list.filter((o) => o.matchLabel === "Found" && o.pricePerPlant !== null && o.sizeClass);
  let cls = reference;
  let chosen = priced.filter((o) => o.sizeClass === reference);
  if (chosen.length === 0) {
    const fallback = fallbackClasses.find((c) => priced.some((o) => o.sizeClass === c.name));
    if (fallback) {
      cls = fallback.name;
      chosen = priced.filter((o) => o.sizeClass === fallback.name);
    }
  }
  const byNursery = new Map<string, Offer>();
  for (const offer of chosen) {
    const best = byNursery.get(offer.sourceId);
    if (!best || offer.pricePerPlant! < best.pricePerPlant!) byNursery.set(offer.sourceId, offer);
  }
  return { cls, perNursery: [...byNursery.values()] };
}

export async function runSourcing(
  input: { species: SourcingSpecies[]; place: string | null },
  ctx: RunContext,
): Promise<SourcingReport> {
  const { spec, client, index } = ctx;
  const warnings: string[] = [];
  const statuses: SourceStatus[] = [];
  const enabled = spec.sources.filter((s) => s.enabled && s.role !== "skip");
  for (const source of enabled) await configChanged(client, source);

  // ------------------------------------------------ 2. geocode the user's area
  let user: SourcingReport["user"] = null;
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
  const nearest = new Map<string, { branch: string; km: number | null; online: boolean; approximate: boolean }>();
  await Promise.all(
    spec.branches
      .filter((b) => enabled.some((s) => s.id === b.sourceId))
      .map(async (branch) => {
        if (branch.online) {
          nearest.set(branch.sourceId, { branch: branch.name, km: null, online: true, approximate: false });
          return;
        }
        if (!user?.point) {
          if (!nearest.has(branch.sourceId)) nearest.set(branch.sourceId, { branch: branch.name, km: null, online: false, approximate: false });
          return;
        }
        const located =
          branch.lat !== null && branch.lon !== null
            ? { point: { lat: branch.lat, lon: branch.lon }, approximate: false }
            : await geocodeBranch(client, branch.address, branch.town);
        const km = located ? haversineKm(user.point, located.point, spec.earthRadiusKm) : null;
        const current = nearest.get(branch.sourceId);
        if (!current || (km !== null && (current.km === null || km < current.km))) {
          nearest.set(branch.sourceId, { branch: branch.name, km, online: false, approximate: located?.approximate ?? false });
        }
      }),
  );
  const where = (source: Source) => {
    const info = nearest.get(source.id);
    const band = info?.km != null ? bandFor(info.km, spec.bands) : null;
    return {
      branch: info?.branch ?? null,
      distanceKm: info?.km ?? null,
      approximate: info?.approximate ?? false,
      band: band?.name ?? null,
      bandLabel: band?.label ?? null,
      online: info?.online ?? !spec.branches.some((b) => b.sourceId === source.id),
    };
  };

  // Cloudflare Workers allows 50 subrequests per request on the free
  // plan. A full run wants roughly 70: five nurseries x six species x up
  // to two queries, plus robots.txt for each and the geocode. Going over
  // throws "too many subrequests", which the gardener saw as "couldn't
  // check Stodels" - a real nursery blamed for a platform limit.
  //
  // So the run keeps a budget and stops cleanly when it is nearly spent,
  // reporting which nurseries it got to. A short honest answer beats a
  // long one that dies halfway.
  const SUBREQUEST_BUDGET = 42;
  const budgetSpent = () => client.requests >= SUBREQUEST_BUDGET;

  const offers = new Map<string, Offer[]>(input.species.map((s) => [s.plantId, []]));
  const availability = new Map<string, SpeciesReport["availability"]>(input.species.map((s) => [s.plantId, []]));

  // ------------------------------------------------ 3-7. live websites
  const webSources = enabled.filter((s) => s.role === "pricing" && s.website);
  await Promise.all(
    webSources.map(async (source) => {
      let platform = source.platform;
      if (platform === "unconfirmed") {
        platform = await detectPlatform(client, source);
        if (platform === "none") {
          statuses.push({ id: source.id, nursery: source.nursery, platform, status: "failed", detail: "platform could not be detected" });
          warnings.push(`Couldn't check ${source.nursery}.`);
          return;
        }
      }
      if (platform !== "shopify" && platform !== "woocommerce") {
        statuses.push({ id: source.id, nursery: source.nursery, platform, status: "skipped", detail: `no adapter for ${source.platformText}` });
        return;
      }
      const adapter = adapters[platform];
      let failure: string | null = null;
      if (budgetSpent()) {
        statuses.push({
          id: source.id,
          nursery: source.nursery,
          platform,
          status: "skipped",
          detail: "not checked this time - the request limit was reached",
        });
        return;
      }
      let stoppedEarly = false;
      for (const species of input.species) {
        if (budgetSpent()) {
          stoppedEarly = true;
          break;
        }
        // The common-name fallback doubles the request count for a
        // small gain, so it only runs while there is budget to spare.
        const queries = [
          binomial(species.scientificName),
          ...(client.requests < SUBREQUEST_BUDGET - 12
            ? commonNamesOf(species).slice(0, 1)
            : []),
        ];
        let matched: { product: Product; rank: MatchRank }[] = [];
        for (const query of queries) {
          const result = await adapter.search(client, source, query);
          if (!result.ok) {
            failure = result.error;
            break;
          }
          matched = result.products
            .map((product) => ({ product, rank: classifyListing(product.title, species, index) }))
            .filter((m) => m.rank !== "unresolved");
          if (matched.length > 0) break;
        }
        if (failure) break;
        for (const { product, rank } of matched.slice(0, MAX_PRODUCTS_PER_SPECIES)) {
          const variants = await adapter.variants(client, source, product);
          for (const v of variants) {
            const size = sizeOf(v.title, v.variant, v.description, spec);
            const cls = sizeClassOf(size, spec.sizeClasses);
            offers.get(species.plantId)!.push({
              sourceId: source.id, nursery: source.nursery, ...where(source), deliversTo: source.deliversTo,
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
      if (failure) {
        statuses.push({ id: source.id, nursery: source.nursery, platform, status: "failed", detail: failure });
        warnings.push(`Couldn't check ${source.nursery} (${failure}).`);
      } else {
        statuses.push({
          id: source.id,
          nursery: source.nursery,
          platform,
          status: "checked",
          detail: stoppedEarly
            ? "some plants not checked - the request limit was reached"
            : source.platform === "unconfirmed"
              ? `platform detected: ${platform}`
              : "",
        });
      }
    }),
  );

  // ------------------------------------------------ PDFs (snapshot sources)
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
          const list = availability.get(species.plantId)!;
          if (!list.some((a) => a.nursery === source.nursery)) list.push({ nursery: source.nursery, note: WHOLESALE_NOTE, snapshotNote: note });
          continue;
        }
        const size = parseSize(row.sizeText ?? "", spec);
        const cls = sizeClassOf(size, spec.sizeClasses);
        offers.get(species.plantId)!.push({
          sourceId: source.id, nursery: source.nursery, ...where(source), deliversTo: source.deliversTo,
          title: row.name, size: describeSize(size, cls?.name ?? null), sizeClass: cls?.name ?? null,
          pricePerPlant: row.price !== null ? perPlant(row.price, size.pack) : null, packPrice: row.price, pack: size.pack,
          stock: row.qty !== null ? `${row.qty} listed${row.limited ? " (limited)" : ""}` : null,
          link: null, checked: pdf.catalogueDate, rank, matchLabel: matchLabel(rank)!,
          snapshotNote: note, channel: "pdf-retail", outdated: status.outdated,
        });
      }
    }
  }

  // ------------------------------------------------ sort: stocks -> band -> price
  const bandOrder = (name: string | null) => (name ? spec.bands.findIndex((b) => b.name === name) : spec.bands.length);
  for (const list of offers.values()) {
    list.sort(
      (a, b) =>
        Number(b.stock?.startsWith("In stock") || b.channel === "pdf-retail") -
          Number(a.stock?.startsWith("In stock") || a.channel === "pdf-retail") ||
        Number(a.matchLabel !== "Found") - Number(b.matchLabel !== "Found") ||
        bandOrder(a.band) - bandOrder(b.band) ||
        (a.pricePerPlant ?? Infinity) - (b.pricePerPlant ?? Infinity),
    );
  }

  // ------------------------------------------------ 9. budget
  const reference = spec.referenceClass;
  const classFallback = new Map<string, string | null>();
  const pricesFor = (list: Offer[]) => budgetPrices(list, spec);

  const perSpecies = input.species.map((species) => {
    const { cls, perNursery } = pricesFor(offers.get(species.plantId)!);
    classFallback.set(species.plantId, perNursery.length && cls !== reference ? className(cls) : null);
    return { species, perNursery };
  });
  const items: BudgetItem[] = perSpecies.map(({ species, perNursery }) => {
    let estimate: number | null = null;
    if (perNursery.length === 0) {
      // Estimated: median per-plant price of the same plant type + class.
      const sameType = perSpecies
        .filter((other) => other.perNursery.length > 0 && (other.species.plantType ?? []).some((t) => (species.plantType ?? []).includes(t)))
        .flatMap((other) => other.perNursery.filter((o) => o.sizeClass === reference).map((o) => o.pricePerPlant!));
      estimate = sameType.length ? median(sameType) : null;
    }
    return {
      plantId: species.plantId, n: species.n, prices: perNursery.map((o) => o.pricePerPlant!),
      estimate, outdatedPrices: perNursery.filter((o) => o.outdated).length,
    };
  });
  const budget = computeBudget(items);

  // Single-nursery basket: the nearest nursery that stocks the most species.
  const stocked = new Map<string, { nursery: string; km: number | null; species: Set<string>; total: number }>();
  for (const { species, perNursery } of perSpecies) {
    for (const offer of perNursery) {
      const entry = stocked.get(offer.sourceId) ?? { nursery: offer.nursery, km: offer.distanceKm, species: new Set(), total: 0 };
      entry.species.add(species.plantId);
      entry.total += species.n * offer.pricePerPlant!;
      stocked.set(offer.sourceId, entry);
    }
  }
  const best = [...stocked.values()].sort(
    (a, b) => b.species.size - a.species.size || (a.km ?? Infinity) - (b.km ?? Infinity),
  )[0];

  // ------------------------------------------------ walk-in only nurseries
  const walkIn: WalkIn[] = enabled
    .filter((s) => s.role === "accessibility")
    .flatMap((source) =>
      spec.branches
        .filter((b) => b.sourceId === source.id)
        .map((b) => {
          const info = where(source);
          return {
            nursery: source.nursery, branch: b.name, town: b.town,
            contact: /0\d{2}\s?\d{3}\s?\d{4}/.exec(source.notes)?.[0] ?? source.website ?? "",
            distanceKm: info.distanceKm, bandLabel: info.bandLabel,
          };
        }),
    );

  const matchCounts: Record<MatchRank, number> = { exact: 0, cultivar: 0, hybrid: 0, common: 0, unresolved: 0 };
  for (const list of offers.values()) for (const offer of list) matchCounts[offer.rank] += 1;

  return {
    checkedAt: ctx.now.toISOString(),
    user,
    species: input.species.map((species, i) => {
      const list = offers.get(species.plantId)!;
      const line = budget.lines[i];
      const label: SpeciesReport["label"] =
        line.status === "Found" ? "Found"
        : line.status === "Estimated" ? "Estimated"
        : list.some((o) => o.matchLabel === "Related plant") ? "Related plant"
        : list.length > 0 ? "Found" : "Not found";
      return {
        plantId: species.plantId, scientificName: species.scientificName, n: species.n, label,
        offers: list, availability: availability.get(species.plantId)!, classFallback: classFallback.get(species.plantId) ?? null,
      };
    }),
    walkIn,
    budget,
    budgetText: budgetText(budget),
    basket: best ? { nursery: best.nursery, speciesStocked: best.species.size, speciesTotal: input.species.length, total: best.total } : null,
    warnings,
    sources: statuses,
    matchCounts,
    outputFields: spec.outputFields,
  };
}
