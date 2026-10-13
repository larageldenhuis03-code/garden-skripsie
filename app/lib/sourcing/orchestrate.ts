import { plants } from "../../data/plants.ts";
import type { PartResponse, SourcingRequest, SpecResponse } from "./server.ts";
import {
  summariseSourcing,
  type BasePart,
  type NurseryPart,
  type Offer,
  type SourcingReport,
  type SourcingSpecies,
} from "./summary.ts";

/**
 * A sourcing run split into requests the deployed worker can answer.
 *
 * Cloudflare allows a worker 50 subrequests per incoming request on the
 * free plan; a full run needs far more (five nurseries x every plant x up
 * to two searches, plus the product pages). So the browser asks for:
 *
 *   1. the settings and the list of live nurseries ("spec", no network);
 *   2. the geocode, nursery distances and PDF lists ("base"), and
 *   3. one request per live nursery ("nursery"), all in parallel.
 *
 * Inside a nursery request the plants are checked one after another, so a
 * site still sees at most one request a second. A request that runs out
 * returns the plants it did not reach; those are asked for again - only
 * those - up to ROUNDS times, a little over a second apart. Then the
 * answers are merged and summarised ONCE with summariseSourcing: the same
 * budget, coverage, basket and warnings as a run done in one go.
 */

export const ROUNDS = 3;
const PAUSE_BETWEEN_ROUNDS_MS = 1100;

export type Post = (body: SourcingRequest) => Promise<unknown>;

export type SplitResult =
  | { ok: true; report: SourcingReport; specWarning: string | null; requests: number }
  | { ok: false; error: string; specWarning: string | null; requests: number };

const plantsById = new Map(plants.map((plant) => [plant.id, plant]));

export async function runSplitSourcing(
  items: { plantId: string; n: number }[],
  place: string | null,
  post: Post,
  options: {
    onProgress?: (progress: { checked: number; total: number }) => void;
    sleep?: (ms: number) => Promise<void>;
    now?: () => Date;
  } = {},
): Promise<SplitResult> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let requests = 0;
  const send = async <T>(body: SourcingRequest): Promise<T> => {
    requests += 1;
    return (await post(body)) as T;
  };

  const settings = await send<SpecResponse>({ mode: "spec", items: [], place: null });
  if (!settings.ok) return { ok: false, error: settings.error, specWarning: settings.specWarning, requests };
  const { spec, nurseries, specWarning } = settings;

  const species: SourcingSpecies[] = items.flatMap((item) => {
    const plant = plantsById.get(item.plantId);
    return plant && item.n > 0
      ? [{ plantId: plant.id, scientificName: plant.scientificName, commonName: plant.commonName, plantType: plant.plantType, n: item.n }]
      : [];
  });
  const wanted = species.map(({ plantId, n }) => ({ plantId, n }));

  let checked = 0;
  options.onProgress?.({ checked, total: nurseries.length });

  const checkNursery = async (nursery: { id: string; nursery: string }): Promise<NurseryPart> => {
    const offers: Record<string, Offer[]> = Object.fromEntries(species.map((s) => [s.plantId, []]));
    let remaining = wanted;
    let last: NurseryPart | null = null;
    const warnings: string[] = [];
    for (let round = 0; round < ROUNDS && remaining.length > 0; round += 1) {
      if (round > 0) await sleep(PAUSE_BETWEEN_ROUNDS_MS);
      let response: PartResponse<NurseryPart>;
      try {
        response = await send<PartResponse<NurseryPart>>({ mode: "nursery", sourceIds: [nursery.id], items: remaining, place: null });
      } catch {
        response = { ok: false, error: "couldn't reach the sourcing service", specWarning: null };
      }
      if (!response.ok) {
        last = {
          sourceId: nursery.id, offers: {}, unchecked: remaining.map((r) => r.plantId), warnings: [`Couldn't check ${nursery.nursery} (${response.error}).`],
          status: { id: nursery.id, nursery: nursery.nursery, platform: "none", status: "failed", detail: response.error },
        };
        break;
      }
      last = response.part;
      warnings.push(...last.warnings);
      for (const [plantId, list] of Object.entries(last.offers)) {
        if (!last.unchecked.includes(plantId)) offers[plantId] = list;
      }
      if (last.status.status === "failed") break;
      remaining = remaining.filter((r) => last!.unchecked.includes(r.plantId));
    }
    checked += 1;
    options.onProgress?.({ checked, total: nurseries.length });
    const part = last as NurseryPart;
    return {
      sourceId: nursery.id,
      offers,
      unchecked: part.unchecked,
      warnings: part.status.status === "failed" ? part.warnings : warnings,
      // A nursery that ran out on round 1 and finished on round 2 is
      // simply "checked".
      status:
        part.status.status === "skipped" && part.unchecked.length < wanted.length
          ? { ...part.status, status: "checked", detail: "" }
          : part.status,
    };
  };

  const [base, ...parts] = await Promise.all([
    send<PartResponse<BasePart>>({ mode: "base", items: wanted, place }),
    ...nurseries.map(checkNursery),
  ]);
  if (!base.ok) return { ok: false, error: base.error, specWarning: base.specWarning ?? specWarning, requests };
  const now = options.now?.() ?? new Date();
  return {
    ok: true,
    report: summariseSourcing(species, base.part, parts as NurseryPart[], spec, now),
    specWarning,
    requests,
  };
}
