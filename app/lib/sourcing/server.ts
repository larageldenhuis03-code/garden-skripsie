import { plants } from "../../data/plants.ts";
import type { ParsedCatalogue } from "./catalogues.ts";
import { geocodeBranch } from "./geo.ts";
import type { PoliteClient } from "./http.ts";
import { buildNameIndex, type NameIndex } from "./matching.ts";
import {
  gatherBase,
  gatherNursery,
  liveNurseries,
  runSourcing,
  type BasePart,
  type NurseryPart,
  type SourcingReport,
} from "./run.ts";
import type { SourcingSpec } from "./spec.ts";

/**
 * The request handler both servers share: the dev server (live workbook on
 * this laptop) and the deployed worker (workbook snapshot from the last
 * build). It only needs the layout's species and quantities - sourcing runs
 * AFTER the layout and never changes it.
 *
 * Modes (the deployed worker allows 50 subrequests per request, so the
 * panel splits a run - see orchestrate.ts):
 *   "spec"     the settings and the list of live nurseries, no network;
 *   "base"     the geocode, nursery distances and the PDF lists;
 *   "nursery"  one live nursery (sourceIds: [id]) for the given plants;
 *   (none)     the whole run in one request, as before - dev server only.
 */

export type SourcingRequest = {
  items: { plantId: string; n: number }[];
  place: string | null;
  mode?: "spec" | "base" | "nursery";
  sourceIds?: string[];
};

export type SourcingResponse =
  | { ok: true; report: SourcingReport; specVersion: string; specWarning: string | null }
  | { ok: false; error: string; specWarning: string | null };

export type SpecResponse =
  | { ok: true; spec: SourcingSpec; nurseries: { id: string; nursery: string }[]; specVersion: string; specWarning: string | null }
  | { ok: false; error: string; specWarning: string | null };

export type PartResponse<T> = { ok: true; part: T } | { ok: false; error: string; specWarning: string | null };

let index: NameIndex | null = null;
const plantsById = new Map(plants.map((plant) => [plant.id, plant]));

type Deps = {
  spec: SourcingSpec | null;
  specVersion: string;
  specWarning: string | null;
  catalogues: Map<string, ParsedCatalogue>;
  client: PoliteClient;
  now?: Date;
};

export async function handleSourcing(request: SourcingRequest & { mode: "spec" }, deps: Deps): Promise<SpecResponse>;
export async function handleSourcing(request: SourcingRequest & { mode: "base" }, deps: Deps): Promise<PartResponse<BasePart>>;
export async function handleSourcing(request: SourcingRequest & { mode: "nursery" }, deps: Deps): Promise<PartResponse<NurseryPart>>;
export async function handleSourcing(request: SourcingRequest, deps: Deps): Promise<SourcingResponse>;
export async function handleSourcing(
  request: SourcingRequest,
  deps: Deps,
): Promise<SourcingResponse | SpecResponse | PartResponse<BasePart> | PartResponse<NurseryPart>> {
  if (!deps.spec) {
    return { ok: false, error: "No valid sourcing settings are available yet.", specWarning: deps.specWarning };
  }
  if (request?.mode === "spec") {
    return { ok: true, spec: deps.spec, nurseries: liveNurseries(deps.spec), specVersion: deps.specVersion, specWarning: deps.specWarning };
  }
  if (!Array.isArray(request?.items)) return { ok: false, error: "Bad request.", specWarning: deps.specWarning };
  index ??= buildNameIndex(plants);
  const species = request.items.flatMap((item) => {
    const plant = plantsById.get(item.plantId);
    return plant && item.n > 0
      ? [{ plantId: plant.id, scientificName: plant.scientificName, commonName: plant.commonName, plantType: plant.plantType, n: item.n }]
      : [];
  });
  const ctx = { spec: deps.spec, catalogues: deps.catalogues, client: deps.client, index, now: deps.now ?? new Date() };
  const place = request.place?.trim() || null;
  if (request.mode === "base") {
    return { ok: true, part: await gatherBase({ species, place }, ctx) };
  }
  if (request.mode === "nursery") {
    const [sourceId] = request.sourceIds ?? [];
    if (!sourceId) return { ok: false, error: "Bad request: no nursery given.", specWarning: deps.specWarning };
    return { ok: true, part: await gatherNursery({ species }, sourceId, ctx) };
  }
  const report = await runSourcing({ species, place }, ctx);
  return { ok: true, report, specVersion: deps.specVersion, specWarning: deps.specWarning };
}

// ---------------------------------------------------------------------------
// Nursery locations for the step 1 map
// ---------------------------------------------------------------------------

export type NurseryPin = {
  sourceId: string;
  nursery: string;
  branch: string;
  town: string;
  lat: number;
  lon: number;
  /** The street address was not found, so the pin is at the town. */
  approximate: boolean;
  kind: "priced" | "walk-in" | "availability";
};

export type NurseryLocations = {
  pins: NurseryPin[];
  /** Nurseries the tool uses that cannot be shown on the map, and why. */
  notMapped: { nursery: string; reason: string }[];
};

/** Every enabled nursery's branches from 2_Branches, geocoded (cached per
 * address). Online-only shops and sources with no address are listed
 * separately so the map can say they exist. */
export async function nurseryLocations(spec: SourcingSpec, client: PoliteClient): Promise<NurseryLocations> {
  const enabled = spec.sources.filter((s) => s.enabled && s.role !== "skip");
  const kindOf = (role: string): NurseryPin["kind"] =>
    role === "accessibility" ? "walk-in" : role === "availability" ? "availability" : "priced";
  const pins: NurseryPin[] = [];
  const notMapped: NurseryLocations["notMapped"] = [];
  for (const source of enabled) {
    const branches = spec.branches.filter((b) => b.sourceId === source.id);
    if (branches.length === 0) {
      // A nursery with no branch row is either a delivery-only supplier
      // (Ferox, added 2026-09-30: Gauteng, ships nationwide) or one whose
      // address simply has not been filled in. Saying "no address yet"
      // for the first kind reads as an omission when it is the point.
      const delivers = source.deliversTo?.trim();
      notMapped.push({
        nursery: source.nursery,
        reason:
          delivers && delivers.toLowerCase() !== "walk-in"
            ? `delivers only — ${delivers}${source.region ? ` (based in ${source.region})` : ""}`
            : "no address in the settings file yet",
      });
      continue;
    }
    for (const branch of branches) {
      if (branch.online) {
        notMapped.push({
          nursery: branch.name,
          reason: `online only${source.deliversTo ? ` — ${source.deliversTo}` : ""}`,
        });
        continue;
      }
      const located =
        branch.lat !== null && branch.lon !== null
          ? { point: { lat: branch.lat, lon: branch.lon }, approximate: false }
          : await geocodeBranch(client, branch.address, branch.town);
      if (!located) {
        notMapped.push({ nursery: branch.name, reason: "address could not be found on the map" });
        continue;
      }
      pins.push({
        sourceId: source.id, nursery: source.nursery, branch: branch.name, town: branch.town,
        lat: located.point.lat, lon: located.point.lon, approximate: located.approximate, kind: kindOf(source.role),
      });
    }
  }
  return { pins, notMapped };
}
