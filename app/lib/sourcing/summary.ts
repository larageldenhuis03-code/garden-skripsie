import { computeBudget, budgetText, median, type Budget, type BudgetItem } from "./budget.ts";
import { bandFor, type LatLon } from "./geo.ts";
import type { MatchRank } from "./matching.ts";
import { className } from "./sizes.ts";
import type { Platform, Source, SourcingSpec } from "./spec.ts";

/**
 * The second half of a sourcing run: merge what the nurseries returned and
 * summarise it once - sort, budget (Low / Typical / High), coverage, the
 * one-stop basket, walk-in nurseries and warnings. No network, no new
 * formulas: the budget is computeBudget() and budgetPrices() exactly as
 * before the run was split.
 *
 * It lives apart from run.ts so the browser can run it: on the deployed
 * worker each nursery is checked in its own request (Cloudflare allows 50
 * subrequests per request) and the panel merges the answers itself.
 *
 * ANNOTATE ONLY: nothing here can change which plants were selected or
 * where they were placed.
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

/** The nearest branch of a source to the user (distance null when the
 * user's area or the branch could not be placed on the map). */
export type SourceLocation = { branch: string | null; km: number | null; online: boolean; approximate: boolean };

/** The geocode-and-PDF part of a run. */
export type BasePart = {
  user: SourcingReport["user"];
  locations: Record<string, SourceLocation>;
  /** Retail PDF offers per plant id (location filled in by the summary). */
  offers: Record<string, Offer[]>;
  availability: Record<string, SpeciesReport["availability"]>;
  statuses: SourceStatus[];
  warnings: string[];
};

/** One live nursery's part of a run. */
export type NurseryPart = {
  sourceId: string;
  offers: Record<string, Offer[]>;
  status: SourceStatus;
  warnings: string[];
  /** Plants this request ran out of requests before checking. */
  unchecked: string[];
};

/** Location fields for an offer, filled in once the base part is known. */
export function locate(source: Pick<Source, "id">, spec: SourcingSpec, locations: Record<string, SourceLocation>) {
  const info = locations[source.id];
  const band = info?.km != null ? bandFor(info.km, spec.bands) : null;
  return {
    branch: info?.branch ?? null,
    distanceKm: info?.km ?? null,
    approximate: info?.approximate ?? false,
    band: band?.name ?? null,
    bandLabel: band?.label ?? null,
    online: info?.online ?? !spec.branches.some((b) => b.sourceId === source.id),
  };
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

/** Merge the parts and summarise them: 4_Search_Process steps 8-9. */
export function summariseSourcing(
  species: SourcingSpecies[],
  base: BasePart,
  nurseries: NurseryPart[],
  spec: SourcingSpec,
  now: Date,
): SourcingReport {
  const warnings = [...base.warnings];
  const statuses: SourceStatus[] = [];
  for (const part of nurseries) {
    warnings.push(...part.warnings);
    if (part.unchecked.length > 0) {
      const names = part.unchecked
        .map((id) => species.find((s) => s.plantId === id)?.scientificName ?? id)
        .join(", ");
      statuses.push({
        ...part.status,
        detail: `${part.unchecked.length} plant${part.unchecked.length === 1 ? "" : "s"} not checked - the request limit was reached`,
      });
      warnings.push(`${part.status.nursery}: not every plant could be checked this time (${names}).`);
    } else {
      statuses.push(part.status);
    }
  }
  statuses.push(...base.statuses);

  // Merge, then put every offer at its nursery's nearest branch.
  const sourceById = new Map(spec.sources.map((s) => [s.id, s]));
  const offers = new Map<string, Offer[]>(
    species.map((s) => [
      s.plantId,
      [...(base.offers[s.plantId] ?? []), ...nurseries.flatMap((part) => part.offers[s.plantId] ?? [])].map((offer) => ({
        ...offer,
        ...locate(sourceById.get(offer.sourceId) ?? { id: offer.sourceId }, spec, base.locations),
      })),
    ]),
  );

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
  const perSpecies = species.map((one) => {
    const { cls, perNursery } = budgetPrices(offers.get(one.plantId)!, spec);
    classFallback.set(one.plantId, perNursery.length && cls !== reference ? className(cls) : null);
    return { species: one, perNursery };
  });
  const items: BudgetItem[] = perSpecies.map(({ species: one, perNursery }) => {
    let estimate: number | null = null;
    if (perNursery.length === 0) {
      // Estimated: median per-plant price of the same plant type + class.
      const sameType = perSpecies
        .filter((other) => other.perNursery.length > 0 && (other.species.plantType ?? []).some((t) => (one.plantType ?? []).includes(t)))
        .flatMap((other) => other.perNursery.filter((o) => o.sizeClass === reference).map((o) => o.pricePerPlant!));
      estimate = sameType.length ? median(sameType) : null;
    }
    return {
      plantId: one.plantId, n: one.n, prices: perNursery.map((o) => o.pricePerPlant!),
      estimate, outdatedPrices: perNursery.filter((o) => o.outdated).length,
    };
  });
  const budget = computeBudget(items);

  // Single-nursery basket: the nearest nursery that stocks the most species.
  const stocked = new Map<string, { nursery: string; km: number | null; species: Set<string>; total: number }>();
  for (const { species: one, perNursery } of perSpecies) {
    for (const offer of perNursery) {
      const entry = stocked.get(offer.sourceId) ?? { nursery: offer.nursery, km: offer.distanceKm, species: new Set(), total: 0 };
      entry.species.add(one.plantId);
      entry.total += one.n * offer.pricePerPlant!;
      stocked.set(offer.sourceId, entry);
    }
  }
  const best = [...stocked.values()].sort(
    (a, b) => b.species.size - a.species.size || (a.km ?? Infinity) - (b.km ?? Infinity),
  )[0];

  // ------------------------------------------------ walk-in only nurseries
  const enabled = spec.sources.filter((s) => s.enabled && s.role !== "skip");
  const walkIn: WalkIn[] = enabled
    .filter((s) => s.role === "accessibility")
    .flatMap((source) =>
      spec.branches
        .filter((b) => b.sourceId === source.id)
        .map((b) => {
          const info = locate(source, spec, base.locations);
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
    checkedAt: now.toISOString(),
    user: base.user,
    species: species.map((one, i) => {
      const list = offers.get(one.plantId)!;
      const line = budget.lines[i];
      const label: SpeciesReport["label"] =
        line.status === "Found" ? "Found"
        : line.status === "Estimated" ? "Estimated"
        : list.some((o) => o.matchLabel === "Related plant") ? "Related plant"
        : list.length > 0 ? "Found" : "Not found";
      return {
        plantId: one.plantId, scientificName: one.scientificName, n: one.n, label,
        offers: list, availability: base.availability[one.plantId] ?? [], classFallback: classFallback.get(one.plantId) ?? null,
      };
    }),
    walkIn,
    budget,
    budgetText: budgetText(budget),
    basket: best ? { nursery: best.nursery, speciesStocked: best.species.size, speciesTotal: species.length, total: best.total } : null,
    warnings,
    sources: statuses,
    matchCounts,
    outputFields: spec.outputFields,
  };
}
