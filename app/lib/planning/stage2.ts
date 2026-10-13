import type { SpeciesInfo, Season } from "./engineData.ts";
import type { ViewingEdge } from "./brief.ts";
import { RULES, type StyleRules } from "./rules.ts";
import {
  H7_FOOTPRINT_CAP,
  K_HEADROOM,
  MIN_GROUPED_SHARE,
  SINGLETON_K_BY_BAND,
  SIZE_VAR_MIN,
  SEARCH,
} from "./engineConfig.ts";

/**
 * Stage 2 - which species and how many (5_Stage2_Constraints).
 *
 * Hard constraints H1-H5 must hold; goals A1-A5 are scored 0..1 and
 * combined with the plant-weighted mean Stage 1 score into
 *
 *   Z = lambda S_bar + (1 - lambda) sum_r w_r A_r
 *
 * `SelectionState` keeps running totals so the Stage 3 search can try a
 * move, read Z and the constraints, and undo it cheaply.
 */

export type EngineSite = {
  widthM: number;
  depthM: number;
  areaM2: number;
  style: StyleRules;
  /** H2 band for this bed's area. */
  sMin: number;
  sMax: number;
  /** C_user: the atomic colours the user asked for (empty = none). */
  userColours: string[];
  windSite: number;
  rowsAvailable: number;
  /** P3 applies (wind-affected shallow bed): the selection must contain a
   * species able to form the windward row. */
  windbreakRequired: boolean;
  /** Passed through to Stage 4: which edge the gardener looks from. It
   * changes nothing about the selection, only how the layers are laid
   * out, so Stage 2 simply carries it. */
  frontEdge?: ViewingEdge;
  /** Search-only tightening of H1 after a placement failure: the retry is
   * told the cover fraction placement could not reach, so it stops asking
   * for a denser bed than circles can physically pack. Reports always use
   * the rulebook's cover_max. */
  packingCap?: number;
  /** H5 headroom for this run; defaults to engineConfig K_HEADROOM. Set
   * only by the sensitivity test. */
  kHeadroom?: number;
};

export type Selection = Map<string, number>;

/** Ground cover and matrix: the base layer a bed is closed with. */
export function isBaseLayer(info: { layer: string }): boolean {
  return info.layer === "L6" || info.layer === "L3";
}

export type Goals = { A1: number; A2: number; A3: number; A4: number; A5: number };

export type HardCheck = {
  id: "H1" | "H2" | "H3" | "H3b" | "H4" | "H5" | "H7";
  pass: boolean;
  value: number;
  limit: string;
  detail: string;
};

export type SelectionEvaluation = {
  z: number;
  sBar: number;
  goals: Goals;
  hard: HardCheck[];
  feasible: boolean;
  totalPlants: number;
  speciesCount: number;
  plantedAreaM2: number;
  rMaxEffective: number;
};

/** Which bed-area band an area falls in, using bandFor's own boundaries.
 * Kept separate from bandFor so its returned shape stays unchanged. */
export function areaBandIndex(areaM2: number): 0 | 1 | 2 {
  const bands = RULES.stage2.speciesBands;
  if (areaM2 < bands[0].maxAreaM2) return 0;
  if (areaM2 <= bands[1].maxAreaM2) return 1;
  return 2;
}

export function bandFor(areaM2: number): { sMin: number; sMax: number } {
  const bands = RULES.stage2.speciesBands;
  // band 1: area < band_1_max; band 2: band_1_max <= area <= band_2_max;
  // band 3: above.
  if (areaM2 < bands[0].maxAreaM2) return bands[0];
  if (areaM2 <= bands[1].maxAreaM2) return bands[1];
  return bands[2];
}

/** H7 (5_Stage2_Constraints row 11, 2026-10-05): the largest share of the
 * bed one L1 plant's canopy may cover, as an absolute area.
 * `null` when the rulebook sets no cap. */
export function footprintCapM2(bedAreaM2: number): number | null {
  return H7_FOOTPRINT_CAP === null ? null : H7_FOOTPRINT_CAP * bedAreaM2;
}

/** H7: true when this species may not be planted in a bed of this size -
 * an L1 species whose own canopy would cover more than phi of the bed.
 *
 * L1 only, by the rulebook's reasoning: the rule exists so one tree cannot
 * swallow a small bed, and the lower layers are already held by H1 (total
 * cover) and H5 (no species dominates). A species this rejects gets
 * y_i = 0 - it is never offered to Stage 3 - rather than being penalised. */
export function exceedsFootprintCap(
  info: SpeciesInfo,
  bedAreaM2: number,
): boolean {
  if (info.layer !== "L1") return false;
  const cap = footprintCapM2(bedAreaM2);
  return cap !== null && info.areaM2 > cap + 1e-9;
}

/** The equivalent maximum spread, for messages: s_i <= 2 sqrt(phi W L / pi). */
export function footprintCapSpreadM(bedAreaM2: number): number | null {
  const cap = footprintCapM2(bedAreaM2);
  return cap === null ? null : 2 * Math.sqrt(cap / Math.PI);
}

/** A windward-row species: tagged Hedge/screen, or in the Tall tier. */
export function canFormWindbreak(info: SpeciesInfo): boolean {
  return info.hedge || info.tier === "tall";
}

function bump<K>(map: Map<K, number>, key: K, delta: number): void {
  const next = (map.get(key) ?? 0) + delta;
  if (next <= 0) map.delete(key);
  else map.set(key, next);
}

export class SelectionState {
  readonly counts: Selection = new Map();
  private readonly infos = new Map<string, SpeciesInfo>();
  totalPlants = 0;
  private scoreSum = 0;
  plantedAreaM2 = 0;
  private readonly tierPlants = { tall: 0, medium: 0, short: 0 };
  private readonly colourSpecies = new Map<string, number>();
  private readonly typeSpecies = new Map<string, number>();
  private readonly seasonSpecies = new Map<Season, number>();
  l1Species = 0;
  l2Species = 0;
  /** H7: selected species whose footprint exceeds phi x bed area. The
   * search should never produce one, because such a species is filtered
   * out before Stage 3; this counter is what makes that guarantee
   * checkable rather than assumed. */
  oversizedL1Species = 0;
  featureSpecies = 0;
  windbreakSpecies = 0;

  readonly site: EngineSite;

  constructor(site: EngineSite) {
    this.site = site;
  }

  get speciesCount(): number {
    return this.counts.size;
  }

  has(id: string): boolean {
    return this.counts.has(id);
  }

  info(id: string): SpeciesInfo {
    const info = this.infos.get(id);
    if (!info) throw new Error(`Species ${id} is not in the selection.`);
    return info;
  }

  /** Adds a species at n, or changes its n when already selected. */
  set(info: SpeciesInfo, n: number): void {
    const previous = this.counts.get(info.id);
    if (previous !== undefined) this.remove(info.id);
    if (n <= 0) return;
    this.counts.set(info.id, n);
    this.infos.set(info.id, info);
    this.totalPlants += n;
    this.scoreSum += info.score * n;
    this.plantedAreaM2 += info.areaM2 * n;
    this.tierPlants[info.tier] += n;
    for (const colour of info.colours) bump(this.colourSpecies, colour, 1);
    for (const type of info.types) bump(this.typeSpecies, type, 1);
    for (const season of info.seasons) bump(this.seasonSpecies, season, 1);
    if (info.layer === "L1") this.l1Species += 1;
    if (info.layer === "L2") this.l2Species += 1;
    if (exceedsFootprintCap(info, this.site.areaM2)) this.oversizedL1Species += 1;
    if (info.feature) this.featureSpecies += 1;
    if (canFormWindbreak(info)) this.windbreakSpecies += 1;
  }

  remove(id: string): void {
    const n = this.counts.get(id);
    if (n === undefined) return;
    const info = this.info(id);
    this.counts.delete(id);
    this.infos.delete(id);
    this.totalPlants -= n;
    this.scoreSum -= info.score * n;
    this.plantedAreaM2 -= info.areaM2 * n;
    this.tierPlants[info.tier] -= n;
    for (const colour of info.colours) bump(this.colourSpecies, colour, -1);
    for (const type of info.types) bump(this.typeSpecies, type, -1);
    for (const season of info.seasons) bump(this.seasonSpecies, season, -1);
    if (info.layer === "L1") this.l1Species -= 1;
    if (info.layer === "L2") this.l2Species -= 1;
    if (exceedsFootprintCap(info, this.site.areaM2)) this.oversizedL1Species -= 1;
    if (info.feature) this.featureSpecies -= 1;
    if (canFormWindbreak(info)) this.windbreakSpecies -= 1;
  }

  snapshot(): Selection {
    return new Map(this.counts);
  }

  get sBar(): number {
    return this.totalPlants > 0 ? this.scoreSum / this.totalPlants : 0;
  }

  goals(): Goals {
    const { style, userColours, widthM, depthM } = this.site;
    const { fMin, cMin } = RULES.stage2;
    const n = this.totalPlants;

    // G1 height balance: 1 - 0.5 sum_t |p_t - tau_t|.
    const A1 =
      n > 0
        ? 1 -
          0.5 *
            (Math.abs(this.tierPlants.tall / n - style.tau.tall) +
              Math.abs(this.tierPlants.medium / n - style.tau.medium) +
              Math.abs(this.tierPlants.short / n - style.tau.short))
        : 0;

    // G2 colour coverage.
    const A2 =
      userColours.length > 0
        ? userColours.filter((colour) => this.colourSpecies.has(colour)).length /
          userColours.length
        : Math.min(1, this.colourSpecies.size / cMin);

    // G3 in thirds (rulebook G3, test run 1): type variety, structural
    // presence, and group-size variety.
    const structure =
      style.structMin === 0 ? 1 : Math.min(1, this.l1Species / style.structMin);
    const A3 =
      (1 / 3) * Math.min(1, this.typeSpecies.size / style.tMin) +
      (1 / 3) * structure +
      (1 / 3) * this.sizeVarietyTerm();

    // G4 ground coverage against cover_min.
    const A4 = Math.min(1, this.plantedAreaM2 / (style.coverMin * widthM * depthM));

    // G5 flowering spread.
    const A5 = Math.min(1, this.seasonSpecies.size / fMin);

    return { A1, A2, A3, A4, A5 };
  }

  /** size_variety_term = MIN(1, distinct n_i among non-feature species /
   * D_min_effective), D_min_effective = MIN(size_var_min, distinct group
   * sizes available to those species); 1 when D_min_effective <= 1. */
  sizeVarietyTerm(): number {
    const used = new Set<number>();
    const available = new Set<number>();
    for (const [id, n] of this.counts) {
      const info = this.info(id);
      if (info.feature) continue;
      used.add(n);
      for (const size of info.allowedN) available.add(size);
    }
    const dMinEffective = Math.min(SIZE_VAR_MIN, available.size);
    if (dMinEffective <= 1) return 1;
    return Math.min(1, used.size / dMinEffective);
  }

  z(): number {
    const { lambda, goalWeights } = RULES.stage2;
    const { A1, A2, A3, A4, A5 } = this.goals();
    const goalBlock =
      goalWeights[0] * A1 +
      goalWeights[1] * A2 +
      goalWeights[2] * A3 +
      goalWeights[3] * A4 +
      goalWeights[4] * A5;
    return lambda * this.sBar + (1 - lambda) * goalBlock;
  }

  /** n1: species planted as a single plant, the feature plant included. */
  get singletonSpecies(): number {
    let count = 0;
    for (const n of this.counts.values()) if (n === 1) count += 1;
    return count;
  }

  /** H3b: MIN(k_band, FLOOR((1 - min_grouped_share) x S)). */
  singletonLimit(): number {
    const k = SINGLETON_K_BY_BAND[areaBandIndex(this.site.areaM2)] ?? 0;
    return Math.min(k, Math.floor((1 - MIN_GROUPED_SHARE) * this.speciesCount));
  }

  rMaxEffective(): number {
    const count = Math.max(1, this.speciesCount);
    return Math.max(this.site.style.rMax, (this.site.kHeadroom ?? K_HEADROOM) / count);
  }

  /** Largest share any capped species takes of all plants (H5). */
  largestCappedShare(): number {
    if (this.totalPlants === 0) return 0;
    let largest = 0;
    for (const [id, n] of this.counts) {
      if (RULES.stage2.featureExemptH5 && this.info(id).feature) continue;
      if (SEARCH.fillExemptH5 && isBaseLayer(this.info(id))) continue;
      largest = Math.max(largest, n / this.totalPlants);
    }
    return largest;
  }

  /** H1 as the search applies it (rulebook cap, or a tighter packing cap
   * learnt from a failed placement). */
  coverCapM2(): number {
    const fraction = Math.min(this.site.style.coverMax, this.site.packingCap ?? 1);
    return fraction * this.site.widthM * this.site.depthM;
  }

  /** H1 exactly as the rulebook states it. */
  rulebookCoverCapM2(): number {
    return this.site.style.coverMax * this.site.widthM * this.site.depthM;
  }

  /** Constraints that must hold at every step of the search: H1, the H2
   * ceiling, H4, H5, and climbers only with something to climb (L2 needs
   * an L1 plant - 6_Stage3_4_Rules row 42). */
  withinLimits(): boolean {
    return (
      this.plantedAreaM2 <= this.coverCapM2() + 1e-9 &&
      this.speciesCount <= this.site.sMax &&
      this.featureSpecies <= 1 &&
      this.largestCappedShare() <= this.rMaxEffective() + 1e-9 &&
      this.singletonSpecies <= this.singletonLimit() &&
      this.oversizedL1Species === 0 &&
      (this.l2Species === 0 || this.l1Species > 0)
    );
  }

  /** The style's cover_min as an area, i.e. what goal A4 measures against
   * and what SEARCH.coverMinHard turns into a floor. */
  coverFloorM2(): number {
    return this.site.style.coverMin * this.site.widthM * this.site.depthM;
  }

  /** Conditions only a finished selection must meet: the H2 floor, and a
   * windward-row species when P3 applies. Unaffected by the cover floor,
   * so Stage 3 can still tell "no mix exists" from "no mix is dense
   * enough". */
  baseComplete(): boolean {
    return (
      this.speciesCount >= this.site.sMin &&
      (!this.site.windbreakRequired || this.windbreakSpecies > 0)
    );
  }

  /** As baseComplete, plus the cover floor when the study seam is on. */
  complete(): boolean {
    return (
      this.baseComplete() &&
      (!SEARCH.coverMinHard ||
        this.site.widthM * this.site.depthM < SEARCH.coverMinHardFromM2 ||
        this.plantedAreaM2 >= this.coverFloorM2() - 1e-9)
    );
  }
}

export function stateFrom(
  selection: Selection,
  infos: ReadonlyMap<string, SpeciesInfo>,
  site: EngineSite,
): SelectionState {
  const state = new SelectionState(site);
  for (const [id, n] of selection) {
    const info = infos.get(id);
    if (!info) throw new Error(`Unknown species ${id}.`);
    state.set(info, n);
  }
  return state;
}

/** The full Stage 2 report for a finished selection. */
export function evaluateSelection(state: SelectionState): SelectionEvaluation {
  const { site } = state;
  const rEff = state.rMaxEffective();
  const share = state.largestCappedShare();
  const badGroups = [...state.counts].filter(
    ([id, n]) =>
      !(SEARCH.fillExemptH3 && isBaseLayer(state.info(id))) &&
      !state.info(id).allowedN.includes(n),
  );
  const hard: HardCheck[] = [
    {
      id: "H1",
      pass: state.plantedAreaM2 <= state.rulebookCoverCapM2() + 1e-9,
      value: state.plantedAreaM2,
      limit: `<= ${state.rulebookCoverCapM2().toFixed(2)} m2 (cover_max ${site.style.coverMax} x bed)`,
      detail: "The planting must fit the bed.",
    },
    {
      id: "H2",
      pass: state.speciesCount >= site.sMin && state.speciesCount <= site.sMax,
      value: state.speciesCount,
      limit: `${site.sMin} to ${site.sMax} species`,
      detail: "Species count inside the bed-area band.",
    },
    {
      id: "H3",
      pass: badGroups.length === 0,
      value: badGroups.length,
      limit: "every n_i from its allowed sizes",
      detail:
        badGroups.length === 0
          ? "Every group size is allowed for its spread band."
          : `Not allowed: ${badGroups.map(([id, n]) => `${id} x${n}`).join(", ")}`,
    },
    {
      id: "H3b",
      pass: state.singletonSpecies <= state.singletonLimit(),
      value: state.singletonSpecies,
      limit: `<= ${state.singletonLimit()} single-plant groups (k_band and ${MIN_GROUPED_SHARE} grouped share)`,
      detail:
        state.singletonSpecies <= state.singletonLimit()
          ? "Enough species are planted in groups rather than as lone plants."
          : `${state.singletonSpecies} species are single plants; at most ${state.singletonLimit()} may be.`,
    },
    {
      id: "H4",
      pass: state.featureSpecies <= 1,
      value: state.featureSpecies,
      limit: "<= 1 feature plant",
      detail: "At most one feature plant in the bed.",
    },
    {
      id: "H5",
      pass: share <= rEff + 1e-9,
      value: share,
      limit: `<= ${rEff.toFixed(3)} (r_max_effective)`,
      detail: "No single non-feature species dominates.",
    },
    {
      id: "H7",
      pass: state.oversizedL1Species === 0,
      value: state.oversizedL1Species,
      limit:
        H7_FOOTPRINT_CAP === null
          ? "no footprint cap set"
          : `each L1 canopy <= ${H7_FOOTPRINT_CAP} x bed (${(footprintCapM2(site.areaM2) ?? 0).toFixed(2)} m2, spread <= ${(footprintCapSpreadM(site.areaM2) ?? 0).toFixed(2)} m)`,
      detail:
        state.oversizedL1Species === 0
          ? "No structural plant covers too much of the bed on its own."
          : `${state.oversizedL1Species} structural species cover more than ${H7_FOOTPRINT_CAP} of the bed on their own.`,
    },
  ];
  return {
    z: state.z(),
    sBar: state.sBar,
    goals: state.goals(),
    hard,
    feasible: hard.every((check) => check.pass),
    totalPlants: state.totalPlants,
    speciesCount: state.speciesCount,
    plantedAreaM2: state.plantedAreaM2,
    rMaxEffective: rEff,
  };
}
