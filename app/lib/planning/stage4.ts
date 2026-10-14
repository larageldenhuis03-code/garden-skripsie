import type { SpeciesInfo } from "./engineData.ts";
import {
  minCentreDistanceWith,
  type CanopyPlacement,
  type RectangularLayout,
  type UnplacedCanopy,
} from "./layout.ts";
import { RULES, type LayerId } from "./rules.ts";
import type { ViewingEdge } from "./brief.ts";
import {
  CLIMBERS_NEED_L1_HOST,
  LAYOUT_V2,
  P17_BALANCE_WEIGHT,
  P2_OVERLAP_TOLERANCE,
  PLACEMENT,
  ROW_PITCH_M,
} from "./engineConfig.ts";
import { canFormWindbreak, type Selection } from "./stage2.ts";

/**
 * Stage 4 - where each plant sits (6_Stage3_4_Rules rows 13-66).
 *
 * Coordinates: x runs along the bed width W from the west edge; y is the
 * distance from the FRONT (north) edge, so the back (south) edge is y = L.
 * The windward edges are the south and east edges (R009's prevailing
 * south-easter; engineConfig WINDWARD_EDGES).
 *
 * The bed is built one layer at a time, L1 first and L7 last; each layer
 * only uses the space earlier layers left. P1 (inside the bed) and P2 (no
 * overlap) are tested at every single placement.
 *
 * Windward profile (Option C, with the owner's no-wind decision):
 *   - no wind (W_site = 0):   standard depths - L1 at the back (0.8).
 *   - wind, deep bed (rows_available >= 3): the aerodynamic ramp - L1 at
 *     the front edge (0.0), the rest of the depth column inverted so height
 *     falls towards the windward edge.
 *   - wind, shallow bed (rows_available <= 2): R009 windbreak - a single-
 *     species row on the windward edge (P3, P6-P10), L1 at 0.8.
 */

export type WindProfile = "standard" | "ramp" | "windbreak";

export type PlacementCheck = {
  id: string;
  kind: "hard" | "soft" | "check";
  pass: boolean;
  detail: string;
};

export type Placement = CanopyPlacement & { layer: LayerId; windbreakRow?: boolean };

/** D29 height bands, front to back from the viewing edge. */
export type BandName = "front" | "middle" | "back";

export type PlacementResult = {
  status: "complete" | "failed";
  /** The species whose group could not be placed at any allowed size. */
  failedSpeciesId: string | null;
  /** n_i actually placed (a group may have shrunk to a smaller allowed
   * size - the rulebook's first fallback). */
  realised: Selection;
  layout: RectangularLayout;
  profile: WindProfile;
  checks: PlacementCheck[];
};

export type PlacementSite = {
  widthM: number;
  depthM: number;
  windSite: number;
  rowsAvailable: number;
  /**
   * TEST SEAM ONLY (scripts/band_eval.ts). An explicit depth interval per
   * layer, as a fraction of the viewing span, replacing the single
   * `depth_tol` band around that layer's target. Absent on every
   * production caller, and when absent the code takes exactly the
   * `depth_tol` path it always has - so this changes no behaviour and no
   * rulebook value. It exists so a candidate band rule can be measured
   * against the current one through the real placer rather than a copy.
   */
  bands?: Partial<Record<LayerId, { lo: number; hi: number }>>;
  /** Which edge the gardener looks from, and therefore which way the
   * layers step up in height. The rulebook assumes north, so that stays
   * the default. It moves ONLY the height ordering: the windward row and
   * every P-check stay on the true south and east edges, because wind
   * does not care where anyone is standing. */
  frontEdge?: ViewingEdge;
};

/**
 * The viewing axis: distance from the front edge, and how to build a
 * point at a given distance. Map coordinates never change - x is still
 * measured from the west edge and y from the north edge - so everything
 * compass-based keeps working untouched.
 */
export function viewingAxis(frontEdge: ViewingEdge | undefined, W: number, L: number) {
  const front = frontEdge ?? "north";
  const alongNorthSouth = front === "north" || front === "south";
  return {
    /** How deep the bed runs away from the viewer. */
    span: alongNorthSouth ? L : W,
    /** How wide the bed is across the viewer's line of sight. */
    across: alongNorthSouth ? W : L,
    depthOf: (x: number, y: number): number =>
      front === "north" ? y : front === "south" ? L - y : front === "west" ? x : W - x,
    /** How far along the bed's visible width a point sits - the mirror of
     * depthOf, used by P17 to divide the frontage into thirds. */
    acrossOf: (x: number, y: number): number => (alongNorthSouth ? x : y),
    /** A map point at `depth` from the viewer, `across` along the front. */
    pointAt: (depth: number, across: number): { x: number; y: number } =>
      front === "north" ? { x: across, y: depth }
      : front === "south" ? { x: across, y: L - depth }
      : front === "west" ? { x: depth, y: across }
      : { x: W - depth, y: across },
  };
}

const EPS = 1e-6;
const FINE_LEAVED_GENERA = ["Erica", "Agathosma"]; // P4: ericas and buchus

/** P2 at the engine's current tolerance: centres at least
 * r_i + r_j - delta * MIN(r_i, r_j) apart (rulebook 6_Stage3_4_Rules
 * C15:D15, revised 2026-10-05 - the allowance is a share of the smaller
 * plant). Placement and every overlap check go through here.
 *
 * Delta is read from RULES at call time rather than from the module
 * constant, so a study can vary it in memory (T4). */
export function minCentreDistance(ri: number, rj: number): number {
  return minCentreDistanceWith(ri, rj, RULES.stage4.overlapDelta);
}

/**
 * The axis layer depths are measured along: the gardener's, except under
 * the aerodynamic ramp. The ramp is a wind rule - low plants on the
 * windward south and east side rising to tall away from it - and
 * targetDepth writes it as depth 0 on the north axis. Measuring it from
 * the viewer instead would put a south-facing gardener's tallest plants
 * ON the windward edge, the opposite of what the ramp is for.
 */
export function depthAxisFor(
  profile: WindProfile,
  frontEdge: ViewingEdge | undefined,
  W: number,
  L: number,
) {
  // D24 option C (owner, 13 Oct 2026): the view beats the wind. Every
  // profile, the ramp included, measures depth from the viewing edge.
  void profile;
  return viewingAxis(frontEdge, W, L);
}

export function windProfile(site: PlacementSite): WindProfile {
  if (site.windSite <= 0) return "standard";
  return site.rowsAvailable >= 3 ? "ramp" : "windbreak";
}

/** Target depth as a fraction of L, or null where the layer has none
 * (L2 on supports, L3 scattered, L7 opportunistic). */
export function targetDepth(layer: LayerId, profile: WindProfile): number | null {
  const depth = RULES.stage4.depth[layer];
  if (depth === null) return null;
  // D24 option C (owner, 13 Oct 2026): the view beats the wind, so the
  // ramp no longer inverts the depth column (10_Open_Items row 47). Short
  // plants stand in front of the viewer and tall ones behind, in every
  // profile; wind is handled by the Stage 1 wind bonus, P13 and the
  // windbreak rows on the other windward edges, and the plan says so.
  void profile;
  return depth;
}

const LAYER_ORDER: LayerId[] = ["L1", "L2", "L3", "L4", "L5", "L6", "L7"];

/** Placement is sequential and cannot undo an earlier plant, so an
 * unlucky early spot can block a group that would otherwise fit. The whole
 * layer build is retried with growing randomness in the soft preferences
 * before the rulebook's fallbacks (shrink, then drop) are used. */
export function placeSelection(
  selection: Selection,
  infos: ReadonlyMap<string, SpeciesInfo>,
  site: PlacementSite,
  rng: () => number,
): PlacementResult {
  let best: PlacementResult | null = null;
  // D30 R8: one asymmetry a ~ U(-asym_max, asym_max) per plan seed, drawn
  // only when the curve is on (so it never shifts the random stream otherwise).
  const asym = LAYOUT_V2.curve ? (rng() * 2 - 1) * RULES.stage4.heightBands.curveAsymMax : 0;
  for (let attempt = 0; attempt < PLACEMENT.restarts; attempt += 1) {
    const result = placeOnce(selection, infos, site, rng, attempt * PLACEMENT.noiseStep, asym);
    const shrunk = [...selection].some(([id, n]) => (result.realised.get(id) ?? 0) < n);
    if (result.status === "complete" && !shrunk) return result;
    if (
      !best ||
      (result.status === "complete" && best.status !== "complete") ||
      (result.status === best.status && result.layout.placements.length > best.layout.placements.length)
    ) {
      best = result;
    }
  }
  return best as PlacementResult;
}

function placeOnce(
  selection: Selection,
  infos: ReadonlyMap<string, SpeciesInfo>,
  site: PlacementSite,
  rng: () => number,
  noise: number,
  asym = 0,
): PlacementResult {
  const { widthM: W, depthM: L } = site;
  const profile = windProfile(site);
  const placed: Placement[] = [];
  const realised: Selection = new Map();
  const checks: PlacementCheck[] = [];
  const diagnostics: string[] = [];
  const unplaced: UnplacedCanopy[] = [];
  // The windward row bands: one row pitch in from the south and east edges.
  const inWindwardBand = (x: number, y: number): boolean =>
    y > L - ROW_PITCH_M || x > W - ROW_PITCH_M;
  const isTree = (plantId: string) => infos.get(plantId)?.types.includes("tree") ?? false;

  const fits = (x: number, y: number, r: number, info?: SpeciesInfo): boolean => {
    if (x < r - EPS || x > W - r + EPS || y < r - EPS || y > L - r + EPS) return false; // P1
    for (const other of placed) {
      const gap = Math.hypot(other.xM - x, other.yM - y);
      if (gap < minCentreDistance(other.radiusM, r) - EPS) return false; // P2
      // P5: the P2 tolerance lets circles overlap a little, so a plant that
      // does not take shade must not overlap a tree canopy at all.
      if (info && !info.shade && isTree(other.plantId) && gap < other.radiusM + r - EPS) {
        return false;
      }
    }
    return true;
  };

  // P4 (hard, wind sites): ericas and buchus never in the windward row.
  const breaksP4 = (info: SpeciesInfo, x: number, y: number): boolean =>
    site.windSite > 0 &&
    FINE_LEAVED_GENERA.includes(info.genus) &&
    inWindwardBand(x, y);


  const record = (info: SpeciesInfo, x: number, y: number, sequence: number, extra: Partial<Placement> = {}) => {
    placed.push({
      instanceId: `${info.id}-${sequence}`,
      plantId: info.id,
      sequence,
      xM: x,
      yM: y,
      radiusM: info.diameterM / 2,
      layer: info.layer,
      ...extra,
    });
  };

  // ------------------------------------------------------- D29 skeleton
  // Bands by height (R3), edges from the rulebook (R4); within a band the
  // target depth rises with height rank (R5). Plant type only breaks ties in
  // the two overlap zones. Climbers (L2) follow their host; a species with
  // no recorded height keeps its type layer and is logged.
  const hb = RULES.stage4.heightBands;
  const d29 = LAYOUT_V2.d29;
  const viewer = viewingAxis(site.frontEdge, W, L);
  const BAND_EDGES: Record<BandName, [number, number]> = {
    front: [0, hb.edgeFrontMid],
    middle: [hb.edgeFrontMid, hb.edgeMidBack],
    back: [hb.edgeMidBack, 1],
  };
  const heightOf = (info: SpeciesInfo): number | null =>
    Number.isFinite(info.heightCm) && info.heightCm > 0 ? info.heightCm : null;
  const bandOf = new Map<string, BandName>();
  const tiebroken: string[] = [];
  const noHeight: string[] = [];
  if (d29) {
    for (const id of selection.keys()) {
      const info = infos.get(id) as SpeciesInfo;
      if (info.layer === "L2") continue; // climbers follow their host
      const h = heightOf(info);
      if (h === null) {
        noHeight.push(id);
        continue;
      }
      let band: BandName;
      if (h < hb.hMiddleMin) band = "front";
      else if (h <= hb.hFrontMax) {
        band = info.layer === "L6" || info.layer === "L5" ? "front" : "middle";
        tiebroken.push(id);
      } else if (h < hb.hBackMin) band = "middle";
      else if (h <= hb.hMiddleMax) {
        band = info.layer === "L1" ? "back" : "middle";
        tiebroken.push(id);
      } else band = "back";
      bandOf.set(id, band);
    }
    if (tiebroken.length > 0) {
      diagnostics.push(`D29: ${tiebroken.length} species placed in their band by plant type (overlap zone): ${tiebroken.join(", ")}.`);
    }
    if (noHeight.length > 0) {
      diagnostics.push(`D29: no recorded height, so placed by plant type: ${noHeight.join(", ")}.`);
    }
  }
  // R5: d* = e_f + (r - 0.5) / n x (e_b - e_f), r = height rank in the band
  // (1 = shortest, plants counted, equal heights share their mean rank),
  // n = plants in the band. Without the gradient, the band's centre.
  const bandTarget = new Map<string, number>();
  for (const band of ["front", "middle", "back"] as BandName[]) {
    const members = [...bandOf]
      .filter(([, b]) => b === band)
      .map(([id]) => infos.get(id) as SpeciesInfo)
      .sort((a, b) => a.heightCm - b.heightCm || a.id.localeCompare(b.id));
    const n = members.reduce((sum, info) => sum + (selection.get(info.id) ?? 0), 0);
    const [ef, eb] = BAND_EDGES[band];
    let before = 0;
    for (let k = 0; k < members.length; ) {
      let j = k;
      let block = 0;
      while (j < members.length && members[j].heightCm === members[k].heightCm) {
        block += selection.get(members[j].id) ?? 0;
        j += 1;
      }
      const meanRank = before + (block + 1) / 2;
      for (let m = k; m < j; m += 1) {
        bandTarget.set(
          members[m].id,
          LAYOUT_V2.inBandGradient && n > 0 ? ef + ((meanRank - 0.5) / n) * (eb - ef) : (ef + eb) / 2,
        );
      }
      before += block;
      k = j;
    }
  }
  /** Depth of a point from the viewing edge, as a fraction of the bed. */
  const depthFraction = (x: number, y: number) => viewer.depthOf(x, y) / viewer.span;
  // D30 R8: curved band edges. d_eff = d + k_s u^2, u = |x - x_c| / (W/2)
  // along the viewing edge, k_s = k(1 + a) on the left half, k(1 - a) on
  // the right. Used for band membership and depth scoring; the hard rules
  // keep the real depth.
  const curveK = LAYOUT_V2.curve ? hb.curveK : 0;
  const curveLift = (across: number): number => {
    if (!curveK || viewer.across <= 0) return 0;
    const c = viewer.across / 2;
    const u = Math.abs(across - c) / c;
    return (across < c ? curveK * (1 + asym) : curveK * (1 - asym)) * u * u;
  };
  const effDepth = (x: number, y: number) => depthFraction(x, y) + curveLift(viewer.acrossOf(x, y));
  const BAND_ORDER: BandName[] = ["front", "middle", "back"];
  const bandAt = (d: number): BandName => (d < hb.edgeFrontMid ? "front" : d < hb.edgeMidBack ? "middle" : "back");
  /** R10: the heights each band is meant for. */
  const inRange = (h: number, band: BandName) =>
    band === "front" ? h <= hb.hFrontMax : band === "middle" ? h >= hb.hMiddleMin && h <= hb.hMiddleMax : h >= hb.hBackMin;
  /** R11 zones in sweep order: back corners, sides, back centre, middle,
   * front centre. "Corners" and "sides" are the outer thirds of the width
   * (the same thirds P17 balances). */
  const zoneOf = (x: number, y: number): number => {
    const across = viewer.acrossOf(x, y);
    const outer = viewer.across > 0 && Math.abs(across - viewer.across / 2) >= viewer.across / 6;
    const b = bandAt(effDepth(x, y));
    return outer ? (b === "back" ? 0 : 1) : b === "back" ? 2 : b === "middle" ? 3 : 4;
  };
  /** R12: a 3 x 3 grid over the bed, for measuring only. */
  const cellOf = (x: number, y: number): number => {
    const col = Math.min(2, Math.floor((viewer.acrossOf(x, y) / viewer.across) * 3));
    const row = Math.min(2, Math.floor(depthFraction(x, y) * 3));
    return row * 3 + col;
  };
  /** Plants that met no modifier and took their skeleton position (R15). */
  const modifierFallbacks = new Set<string>();
  // Hard rules, before anything else (R15): R2 nothing over h_back_min
  // centred in the front band; R14 a feature plant over h_front_max never in
  // the front band; R6 grasses and restios over h_grass_front_half_max stay
  // out of the front half of the bed (depth < 0.50, the rule's own words).
  const GRASS_TYPES = ["restio", "graminoid", "grass"];
  const hardOk = (info: SpeciesInfo, x: number, y: number): boolean => {
    if (!d29) return true;
    const h = heightOf(info);
    if (h === null) return true;
    const d = depthFraction(x, y);
    if (h > hb.hBackMin && d < hb.edgeFrontMid - 1e-9) return false; // R2
    if (info.feature && h > hb.hFrontMax && d < hb.edgeFrontMid - 1e-9) return false; // R14
    if (h > hb.hGrassFrontHalfMax && info.types.some((t) => GRASS_TYPES.includes(t)) && d < 0.5 - 1e-9) return false; // R6
    return true;
  };

  // ---------------------------------------------------------------- P3 row
  let windbreakId: string | null = null;
  if (profile === "windbreak") {
    const candidates = [...selection.keys()]
      .map((id) => infos.get(id) as SpeciesInfo)
      .filter(canFormWindbreak)
      .sort(
        (left, right) =>
          Number(right.hedge) - Number(left.hedge) ||
          Number((selection.get(right.id) ?? 0) >= RULES.stage4.minGroupWindbreakRow) -
            Number((selection.get(left.id) ?? 0) >= RULES.stage4.minGroupWindbreakRow) ||
          right.heightCm - left.heightCm ||
          left.id.localeCompare(right.id),
      );
    const chosen = candidates[0];
    if (chosen) {
      windbreakId = chosen.id;
      const n = selection.get(chosen.id) as number;
      const d = chosen.diameterM;
      // P6 / P10: informal-row centres, spaced for the target porosity,
      // never closer than the canopy itself (P2 wins).
      const [minCm, maxCm] = RULES.stage4.hedgeSpacingInformalCm;
      const porous = d / (1 - RULES.stage4.windbreakPorosity.target);
      const spacing = Math.max(
        minCentreDistance(d / 2, d / 2),
        Math.min(maxCm / 100, Math.max(minCm / 100, porous)),
      );
      // The row runs along the south edge and on up the east edge (the two
      // windward edges); leftover plants form further south rows, each
      // stepped leeward and offset by half the spacing (P8 stagger).
      // D24 option C (owner, 13 Oct 2026): no windbreak on the viewing
      // edge. If the gardener stands on the south or east edge, that edge
      // gets no row; and every row stops one spacing short of the viewing
      // edge, so not even a corner plant of a windbreak stands on it.
      const view = site.frontEdge ?? "north";
      const southRow = view !== "south";
      const eastRow = view !== "east";
      const southStart = view === "west" ? d / 2 + spacing : d / 2;
      const southEnd = eastRow ? W - d / 2 : W - d / 2 - spacing;
      const eastEnd = view === "north" ? d / 2 + spacing : d / 2;
      const spots: { x: number; y: number; edge: "south" | "east" }[] = [];
      if (southRow) {
        for (let x = southStart; x <= southEnd + EPS; x += spacing) {
          spots.push({ x, y: L - d / 2, edge: "south" });
        }
      }
      if (eastRow) {
        const lastSouthX = spots.length > 0 ? spots[spots.length - 1].x : null;
        const eastStart = !southRow
          ? L - d / 2 - spacing
          : lastSouthX !== null && Math.abs(lastSouthX - (W - d / 2)) < EPS
            ? L - d / 2 - spacing
            : L - d / 2;
        for (let y = eastStart; y >= eastEnd - EPS; y -= spacing) {
          spots.push({ x: W - d / 2, y, edge: "east" });
        }
      }
      const rowDrop = Math.max(
        d * Math.sin(Math.PI / 3),
        Math.sqrt(Math.max(0, minCentreDistance(d / 2, d / 2) ** 2 - (spacing / 2) ** 2)),
      );
      // Further rows stacked leeward of the south row belong to it.
      for (let row = 1; southRow && L - d / 2 - row * rowDrop >= d / 2 - EPS; row += 1) {
        for (let x = southStart + (row % 2 === 1 ? spacing / 2 : 0); x <= southEnd + EPS; x += spacing) {
          spots.push({ x, y: L - d / 2 - row * rowDrop, edge: "south" });
        }
      }
      let sequence = 0;
      const edgesUsed = new Set<"south" | "east">();
      for (const spot of spots) {
        if (sequence >= n) break;
        if (!fits(spot.x, spot.y, d / 2, chosen)) continue;
        if (!hardOk(chosen, spot.x, spot.y)) continue; // R2: not even a windbreak stands tall in front
        // D24: no windbreak plant on the viewing edge - in a bed shallower
        // than the row plant is wide, a south-row canopy can reach a north
        // viewer's edge; such a spot is skipped.
        if (viewer.depthOf(spot.x, spot.y) - d / 2 <= 1e-6) continue;
        record(chosen, spot.x, spot.y, sequence, { windbreakRow: true });
        edgesUsed.add(spot.edge);
        sequence += 1;
      }
      realised.set(chosen.id, sequence);
      const porosity = 1 - d / spacing;
      checks.push({
        id: "P3",
        kind: "hard",
        pass: sequence > 0,
        detail:
          sequence > 0
            ? `Windward row of ${chosen.id} along the ${[...edgesUsed].join(" and ")} edge${edgesUsed.size > 1 ? "s" : ""}.`
            : "No windward row could be placed.",
      });
      checks.push({ id: "P6", kind: "soft", pass: true, detail: `Row centres ${(spacing * 100).toFixed(0)} cm apart.` });
      checks.push({ id: "P7", kind: "soft", pass: true, detail: "One species in the windward row." });
      checks.push({
        id: "P9",
        kind: "soft",
        pass: n >= RULES.stage4.minGroupWindbreakRow,
        detail: `Windbreak group of ${n} (target at least ${RULES.stage4.minGroupWindbreakRow}).`,
      });
      checks.push({
        id: "P10",
        kind: "soft",
        pass:
          porosity >= RULES.stage4.windbreakPorosity.min - EPS &&
          porosity <= RULES.stage4.windbreakPorosity.max + EPS,
        detail: `Row porosity about ${Math.round(porosity * 100)}% (band ${RULES.stage4.windbreakPorosity.min * 100}-${RULES.stage4.windbreakPorosity.max * 100}%).`,
      });
      // P11 (length test only - the angle test is removed): an edge counts
      // as a windbreak when it is at least windbreak_min_length_ratio times
      // the row's height.
      const heightM = chosen.heightCm / 100;
      const needed = RULES.stage4.windbreakMinLengthRatio * heightM;
      const edgeLength = { south: W, east: L };
      const qualifying = [...edgesUsed].filter((edge) => edgeLength[edge] >= needed - EPS);
      const longEnough = qualifying.length > 0;
      checks.push({
        id: "P11",
        kind: "check",
        pass: longEnough,
        detail: longEnough
          ? `The ${qualifying.join(" and ")} edge${qualifying.length > 1 ? "s are" : " is"} at least ${RULES.stage4.windbreakMinLengthRatio}x the row's ${heightM} m height, so the row counts as a windbreak.`
          : `No windward edge is ${RULES.stage4.windbreakMinLengthRatio}x the row's ${heightM} m height (${needed.toFixed(1)} m), so no wind protection is claimed.`,
      });
      if (longEnough) {
        checks.push({
          id: "P12",
          kind: "soft",
          pass: true,
          detail: `Sheltered zone about ${(RULES.stage4.shelterDepthH * heightM).toFixed(1)} m leeward of the row - the whole bed when that exceeds its ${L} m depth.`,
        });
      }
      if (sequence < n) {
        diagnostics.push(
          `${n - sequence} of ${chosen.id} did not fit in the windward row and are placed with the structure layer.`,
        );
      }
    } else {
      checks.push({ id: "P3", kind: "hard", pass: false, detail: "No hedge or tall species was selected for the windward row." });
    }
  }

  // ------------------------------------------------------------ layers
  // Candidate centres. Random draws alone jam at roughly 55% cover, well
  // short of the 50-90% the styles ask for, so candidates also come from
  // contact points: tangent to a bed edge and a placed plant, to two placed
  // plants, or into a corner - the positions that pack circles densely.
  const contactCandidates = (r: number, near: Placement[] | null): { x: number; y: number }[] => {
    const out: { x: number; y: number }[] = [
      { x: r, y: r }, { x: W - r, y: r }, { x: r, y: L - r }, { x: W - r, y: L - r },
    ];
    const pool = near ?? placed;
    for (const c of pool) {
      const R = minCentreDistance(c.radiusM, r);
      // Tangent to c and to each wall line.
      for (const wallX of [r, W - r]) {
        const dx = wallX - c.xM;
        if (Math.abs(dx) <= R) {
          const dy = Math.sqrt(R * R - dx * dx);
          out.push({ x: wallX, y: c.yM + dy }, { x: wallX, y: c.yM - dy });
        }
      }
      for (const wallY of [r, L - r]) {
        const dy = wallY - c.yM;
        if (Math.abs(dy) <= R) {
          const dx = Math.sqrt(R * R - dy * dy);
          out.push({ x: c.xM + dx, y: wallY }, { x: c.xM - dx, y: wallY });
        }
      }
    }
    // Tangent to two placed plants (only pairs close enough to share one).
    for (let i = 0; i < pool.length; i += 1) {
      const a = pool[i];
      const Ra = minCentreDistance(a.radiusM, r);
      for (let j = i + 1; j < pool.length; j += 1) {
        const b = pool[j];
        const Rb = minCentreDistance(b.radiusM, r);
        const dx = b.xM - a.xM;
        const dy = b.yM - a.yM;
        const dist = Math.hypot(dx, dy);
        if (dist > Ra + Rb || dist < Math.abs(Ra - Rb) || dist === 0) continue;
        const along = (Ra * Ra - Rb * Rb + dist * dist) / (2 * dist);
        const h = Math.sqrt(Math.max(0, Ra * Ra - along * along));
        const mx = a.xM + (along * dx) / dist;
        const my = a.yM + (along * dy) / dist;
        out.push(
          { x: mx + (h * dy) / dist, y: my - (h * dx) / dist },
          { x: mx - (h * dy) / dist, y: my + (h * dx) / dist },
        );
      }
    }
    return out;
  };

  const choose = (info: SpeciesInfo, drift: Placement[], fillPass = false): { x: number; y: number } | null => {
    const r = info.diameterM / 2;
    const band = bandOf.get(info.id) ?? null;
    // D29: a banded species aims at its in-band target; everything else keeps
    // the type layer's target (climbers have none and follow their host).
    const targetDepthFraction = band ? (bandTarget.get(info.id) as number) : targetDepth(info.layer, profile);
    // Layer depths are measured from the viewing edge, so the heights step
    // up away from wherever the gardener stands - with one exception. The
    // aerodynamic ramp is a WIND rule: it puts L1 furthest from the
    // windward south and east edges, and targetDepth expresses that as
    // depth 0 on the north axis. Measured from the viewer instead, a
    // south-facing gardener would get the tallest plants ON the windward
    // edge, the opposite of what the ramp is for. So the ramp keeps the
    // north axis, as AGENTS.md says of every wind rule.
    const axis = depthAxisFor(profile, site.frontEdge, W, L);
    // P17 balances across what the gardener actually looks at, so it always
    // uses the viewer's axis, ramp or not.
    const viewAxis = viewingAxis(site.frontEdge, W, L);
    // Default: the rulebook's single band, target +- depth_tol. A band
    // override (test seam) supplies its own interval instead; the centre
    // and half-width are read off it so the maths below is identical.
    const override = targetDepthFraction === null || band ? undefined : site.bands?.[info.layer];
    const target = override ? (override.lo + override.hi) / 2 : targetDepthFraction;
    const halfWidth = override ? (override.hi - override.lo) / 2 : RULES.stage4.depthTol;
    const tol = halfWidth * axis.span;
    const l1 = placed.filter((p) => p.layer === "L1");
    const raw: { x: number; y: number }[] = [];
    let firstContact = Number.POSITIVE_INFINITY;

    if (info.layer === "L2") {
      // Climbers only on an L1 plant (owner decision; no trellis input).
      if (CLIMBERS_NEED_L1_HOST && l1.length === 0) return null;
      for (let k = 0; k < PLACEMENT.randomDraws; k += 1) {
        const host = l1[Math.floor(rng() * l1.length)];
        const angle = rng() * 2 * Math.PI;
        raw.push({
          x: host.xM + minCentreDistance(host.radiusM, r) * Math.cos(angle),
          y: host.yM + minCentreDistance(host.radiusM, r) * Math.sin(angle),
        });
      }
      // Contact points that also touch a host: snug against the host and
      // an edge or a neighbour.
      raw.push(
        ...contactCandidates(r, null).filter((spot) =>
          l1.some((host) => Math.abs(Math.hypot(host.xM - spot.x, host.yM - spot.y) - minCentreDistance(host.radiusM, r)) < 1e-4),
        ),
      );
    } else {
      // Random draws, mostly inside the layer's depth band (depth_tol
      // scatter), the rest anywhere - or, for a banded species (D29),
      // anywhere inside the depths it is allowed.
      const [allowLo, allowHi] = allowedFor(info, band, fillPass);
      const lo = Math.max(r, allowLo * axis.span);
      const hi = Math.min(axis.span - r, allowHi * axis.span);
      if (band && hi < lo - EPS) return null; // the band is too shallow for this canopy
      for (let k = 0; k < PLACEMENT.randomDraws; k += 1) {
        const inBand = target !== null && k < PLACEMENT.randomDraws * PLACEMENT.inBandShare;
        const across = r + rng() * Math.max(0, axis.across - 2 * r);
        const depth = inBand
          ? Math.min(Math.max(target * axis.span + (rng() * 2 - 1) * tol, band ? lo : r), band ? hi : axis.span - r)
          : band
            ? lo + rng() * Math.max(0, hi - lo)
            : r + rng() * Math.max(0, axis.span - 2 * r);
        // With the curve on, the draw is a d_eff depth; the real depth sits
        // that much nearer the viewer at the sides.
        const real = band ? Math.min(Math.max(depth - curveLift(across) * axis.span, r), axis.span - r) : depth;
        raw.push(axis.pointAt(real, across));
      }
      // Contact points: around the drift for drift members, else anywhere.
      const near = drift.length > 0
        ? placed.filter((p) => drift.some((m) => Math.hypot(m.xM - p.xM, m.yM - p.yM) <= m.radiusM + p.radiusM + 2 * r + EPS))
        : null;
      const contacts = contactCandidates(r, near);
      firstContact = raw.length;
      raw.push(...contacts);
    }

    // D29 skeleton (R3/R4, replacing D28): a banded species' centre must lie
    // in the depths it is allowed; if no spot there fits, choose() returns
    // null and the existing fail rule takes over.
    const [allowLo, allowHi] = band ? allowedFor(info, band, fillPass) : [0, 1];
    const inAllowedAt = (d: number) => d >= allowLo - 1e-9 && d <= allowHi + 1e-9;
    // The skeleton: straight bands, the real depth.
    const skeletonOk = (x: number, y: number) => !band || inAllowedAt(depthFraction(x, y));
    // The modifiers (D30): curved membership (R8), straddle (R9), shares (R10).
    const h = heightOf(info);
    const bandCounts = new Map<BandName, { inRange: number; total: number }>();
    if (LAYOUT_V2.shares) {
      for (const b of BAND_ORDER) bandCounts.set(b, { inRange: 0, total: 0 });
      for (const p of placed) {
        const hp = infos.get(p.plantId)?.heightCm ?? 0;
        const c = bandCounts.get(bandAt(effDepth(p.xM, p.yM))) as { inRange: number; total: number };
        c.total += 1;
        if (inRange(hp, bandAt(effDepth(p.xM, p.yM)))) c.inRange += 1;
      }
    }
    const modifiersOk = (x: number, y: number): boolean => {
      const de = effDepth(x, y);
      if (band && !inAllowedAt(de)) return false; // R8: membership by d_eff
      if (LAYOUT_V2.straddle && band) {
        const idx = BAND_ORDER.indexOf(band);
        const reach = BAND_EDGES[BAND_ORDER[Math.max(0, idx - hb.canopyOverlapMax)]][0];
        if (de - r / viewer.span < reach - 1e-9) return false; // R9
      }
      if (LAYOUT_V2.shares && h !== null) {
        const b = bandAt(de);
        if (!inRange(h, b)) {
          const ib = BAND_ORDER.indexOf(b);
          const adjacent = BAND_ORDER.some((o, io) => Math.abs(io - ib) === 1 && inRange(h, o));
          if (!adjacent) return false;
          if (b === "front" && h > hb.hBackMin) return false;
          const c = bandCounts.get(b) as { inRange: number; total: number };
          if (c.inRange / (c.total + 1) < hb.shareMin - 1e-9) return false; // R10
        }
      }
      return true;
    };

    let best: { x: number; y: number; pref: number } | null = null;
    const scored: { x: number; y: number; pref: number; modOk: boolean; zone: number; cell: number }[] = [];
    const cx = drift.length > 0 ? drift.reduce((sum, p) => sum + p.xM, 0) / drift.length : 0;
    const cy = drift.length > 0 ? drift.reduce((sum, p) => sum + p.yM, 0) / drift.length : 0;
    const scale = Math.max(W, L);

    // P17 lateral balance (C2, 2026-10-05): how much canopy already sits in
    // each third of the viewer-facing width. Computed once per call - it
    // depends only on what is already placed - then read per candidate, so
    // the cost stays linear in `placed` rather than multiplying by the
    // number of draws. See engineConfig for why this counts all layers
    // together and applies to every plant rather than only drift starts.
    const thirdOf = (x: number, y: number): number =>
      Math.min(2, Math.floor((viewAxis.acrossOf(x, y) / viewAxis.across) * 3));
    let thirdArea: [number, number, number] | null = null;
    if (P17_BALANCE_WEIGHT > 0 && axis.across > 0) {
      const areas: [number, number, number] = [0, 0, 0];
      let any = false;
      for (const p of placed) {
        areas[thirdOf(p.xM, p.yM)] += Math.PI * p.radiusM ** 2;
        any = true;
      }
      if (any) thirdArea = areas;
    }
    const fullestThird = thirdArea ? Math.max(...thirdArea) : 0;
    // D27 sweep packing (sweep_weight, rulebook; the W2 / W2p study,
    // 13 Oct 2026). Contact points first: when one fits and sits inside
    // the layer's depth band, the random draws are not scored at all - they
    // are used only to seed an empty area. An in-band contact spot gets
    // sweep_weight, which is above the largest depth-scatter penalty a spot
    // inside the band can carry (depth_tol), so a snug spot wins anywhere
    // in the band; one outside the band gets nothing, so the weight never
    // pulls a plant out of its band. While it is on it replaces
    // contact_bonus.
    const sweep = RULES.stage4.sweepWeight;
    const inDepthBand = (x: number, y: number) =>
      target === null || Math.abs(axis.depthOf(x, y) - target * axis.span) <= tol + EPS;
    let startIndex = 0;
    if (sweep > 0 && Number.isFinite(firstContact)) {
      for (let index = firstContact; index < raw.length; index += 1) {
        const { x, y } = raw[index];
        if (inDepthBand(x, y) && fits(x, y, r, info) && !breaksP4(info, x, y)) {
          startIndex = firstContact;
          break;
        }
      }
    }
    for (let index = startIndex; index < raw.length; index += 1) {
      const { x, y } = raw[index];
      if (!fits(x, y, r, info) || breaksP4(info, x, y)) continue;
      if (!hardOk(info, x, y)) continue; // R2, R14, R6
      const modOk = modifiersOk(x, y);
      if (!modOk && !skeletonOk(x, y)) continue; // neither the curved nor the straight band
      let pref = rng() * (1e-3 + noise); // seeded tie-break; wider on restarts
      // contact_bonus (D26, rulebook): a snug contact spot packs the bed,
      // but the preference also pulls plants into clumps. It was a bare
      // +0.05 here until 13 Oct 2026; the rulebook now sets it. Under
      // sweep packing only an in-band contact spot is preferred, with
      // sweep_weight instead.
      if (index >= firstContact) {
        if (sweep > 0) {
          if (inDepthBand(x, y)) pref += sweep;
        } else {
          pref += RULES.stage4.contactBonus;
        }
      }
      if (target !== null) {
        const off = Math.abs((band ? effDepth(x, y) * axis.span : axis.depthOf(x, y)) - target * axis.span);
        pref -= off / axis.span + 2 * Math.max(0, off - tol) / axis.span; // depth target +- depth_tol
      }
      if (drift.length > 0) {
        pref -= (3 * Math.hypot(x - cx, y - cy)) / scale; // keep the drift together (R002)
      } else if (info.layer === "L1" && l1.length > 0) {
        // L1 groups spaced apart: the first plant of each structure group
        // keeps its distance from the others; its group then clusters.
        pref += (0.5 * Math.min(...l1.map((p) => Math.hypot(p.xM - x, p.yM - y)))) / scale;
      } else if (info.layer !== "L1" && info.layer !== "L3" && info.layer !== "L7") {
        // First plant of a drift: prefer snug spots so the bed packs.
        pref -= 0.2 * (Math.min(x - r, W - r - x, y - r, L - r - y) / scale);
      }
      if (thirdArea && fullestThird > 0) {
        // 1 in an empty third, 0 in the fullest one.
        pref +=
          P17_BALANCE_WEIGHT * ((fullestThird - thirdArea[thirdOf(x, y)]) / fullestThird);
      }
      if (site.windSite > 0 && inWindwardBand(x, y)) {
        pref += info.windres ? 0.5 : -0.5; // P13: exposed band takes windres forms
      }
      scored.push({ x, y, pref, modOk, zone: zoneOf(x, y), cell: cellOf(x, y) });
    }
    if (scored.length === 0) return null;
    // R15: modifiers first; if none can be met, the skeleton position.
    let pool = scored.filter((s) => s.modOk);
    if (pool.length === 0) {
      pool = scored;
      if (!modifierFallbacks.has(info.id)) {
        modifierFallbacks.add(info.id);
        diagnostics.push(`D30: ${info.id} could not meet the band modifiers, so it took its skeleton position (R15).`);
      }
    }
    // R11: a group's first plant takes the earliest zone of the sweep that
    // still has room; its group then clusters round it as before.
    if (LAYOUT_V2.order && d29 && drift.length === 0 && !fillPass) {
      const first = Math.min(...pool.map((s) => s.zone));
      pool = pool.filter((s) => s.zone === first);
    }
    // R12: the fill pass starts each group in the emptiest of 9 cells.
    if (LAYOUT_V2.fill && d29 && fillPass && drift.length === 0) {
      const canopy = new Array<number>(9).fill(0);
      for (const p of placed) canopy[cellOf(p.xM, p.yM)] += Math.PI * p.radiusM ** 2;
      const emptiest = Math.min(...pool.map((s) => canopy[s.cell]));
      pool = pool.filter((s) => canopy[s.cell] === emptiest);
    }
    for (const s of pool) if (!best || s.pref > best.pref) best = { x: s.x, y: s.y, pref: s.pref };
    return best;
  };

  const byFeatureThenSize = (left: SpeciesInfo, right: SpeciesInfo) =>
    Number(right.feature) - Number(left.feature) || // feature plant first
    right.diameterM - left.diameterM ||
    left.id.localeCompare(right.id);
  const all = [...selection.keys()].map((id) => infos.get(id) as SpeciesInfo);
  // D29 order: back band, middle band, anything placed by type, climbers
  // (their hosts are down by then), then the front fill pass - the front
  // band's species, and middle-band species no taller than h_front_max,
  // which may also use the front band. No plants are added: the fill pass
  // only places plants already selected. Without D29: layer by layer.
  const fillMiddle = (info: SpeciesInfo) =>
    bandOf.get(info.id) === "middle" && info.heightCm <= hb.hFrontMax && !info.feature;
  const sequenceOf: { info: SpeciesInfo; fill: boolean }[] = d29
    ? [
        ...all.filter((i) => bandOf.get(i.id) === "back").sort(byFeatureThenSize),
        ...all.filter((i) => bandOf.get(i.id) === "middle" && !fillMiddle(i)).sort(byFeatureThenSize),
        ...all
          .filter((i) => i.layer !== "L2" && !bandOf.has(i.id))
          .sort((a, b) => LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer) || byFeatureThenSize(a, b)),
        ...all.filter((i) => i.layer === "L2").sort(byFeatureThenSize),
      ]
        .map((info) => ({ info, fill: false }))
        .concat(
          [
            ...all.filter((i) => bandOf.get(i.id) === "front").sort(byFeatureThenSize),
            ...all.filter(fillMiddle).sort(byFeatureThenSize),
          ].map((info) => ({ info, fill: true })),
        )
    : LAYER_ORDER.flatMap((layer) =>
        all.filter((i) => i.layer === layer).sort(byFeatureThenSize).map((info) => ({ info, fill: false })),
      );

  {
    for (const { info, fill } of sequenceOf) {
      const layer = info.layer;
      const wanted = selection.get(info.id) as number;
      const already = info.id === windbreakId ? (realised.get(info.id) ?? 0) : 0;
      const remaining = wanted - already;
      if (remaining <= 0) continue;

      // Fallback 1: shrink to the next smaller allowed n_i.
      const sizes = info.allowedN
        .filter((size) => size <= wanted && size > already)
        .sort((left, right) => right - left);
      let success = false;
      for (const size of sizes) {
        const start = placed.length;
        const drift: Placement[] = [];
        let ok = true;
        for (let sequence = already; sequence < size; sequence += 1) {
          const spot = choose(info, drift, fill);
          if (!spot) {
            ok = false;
            break;
          }
          record(info, spot.x, spot.y, sequence);
          drift.push(placed[placed.length - 1]);
        }
        if (ok) {
          if (size < wanted) {
            diagnostics.push(`${info.id}: group reduced from ${wanted} to ${size} so it fits.`);
          }
          realised.set(info.id, size);
          success = true;
          break;
        }
        placed.splice(start);
      }
      if (!success) {
        if (info.id === windbreakId && already > 0) {
          realised.set(info.id, already);
          continue;
        }
        if (layer === "L2" && !placed.some((p) => p.layer === "L1")) {
          diagnostics.push(`${info.id}: no structure plant to climb on, so the climber is skipped.`);
        }
        unplaced.push({
          instanceId: `${info.id}-0`,
          plantId: info.id,
          sequence: 0,
          diameterM: info.diameterM,
          reason: "No position satisfied P1/P2 at any allowed group size.",
        });
        return finish("failed", info.id);
      }
    }
  }
  // Front fill pass: did it run out of candidates? True when, after every
  // fill candidate is placed, a plant the size of the smallest of them
  // would still fit somewhere in the front band.
  if (d29) {
    const fillers = sequenceOf.filter((s) => s.fill).map((s) => s.info);
    if (fillers.length > 0) {
      const r = Math.min(...fillers.map((f) => f.diameterM)) / 2;
      const spanFront = hb.edgeFrontMid * viewer.span;
      let room = false;
      const step = Math.max(r / 2, 0.05);
      for (let depth = r; depth <= spanFront + EPS && !room; depth += step) {
        for (let across = r; across <= viewer.across - r + EPS && !room; across += step) {
          const p = viewer.pointAt(depth, across);
          if (fits(p.x, p.y, r)) room = true;
        }
      }
      if (room) diagnostics.push("D29: the front fill pass ran out of candidates - the front band still has room.");
    }
  }
  return finish("complete", null);

  /** D29: the depths (fractions from the viewing edge) a banded species'
   * centre may use: its band, plus the front band for a middle-band species
   * no taller than h_front_max during the fill pass. */
  function allowedFor(info: SpeciesInfo, band: BandName | null, fillPass: boolean): [number, number] {
    if (!band) return [0, 1];
    const [lo, hi] = BAND_EDGES[band];
    if (fillPass && band === "middle" && info.heightCm <= hb.hFrontMax) return [0, hi];
    return [lo, hi];
  }

  function finish(status: "complete" | "failed", failedSpeciesId: string | null): PlacementResult {
    if (d29) {
      // layout-v2 measures, for the comparison (one parseable line).
      let straddling = 0;
      const perBand = new Map<BandName, { inRange: number; out: number; farOut: number; tallFront: number }>(
        BAND_ORDER.map((b) => [b, { inRange: 0, out: 0, farOut: 0, tallFront: 0 }]),
      );
      for (const p of placed) {
        const b = bandOf.get(p.plantId);
        const de = effDepth(p.xM, p.yM);
        if (b && de - p.radiusM / viewer.span < BAND_EDGES[b][0] - 1e-9) straddling += 1;
        const hp = infos.get(p.plantId)?.heightCm ?? 0;
        const at = bandAt(de);
        const c = perBand.get(at) as { inRange: number; out: number; farOut: number; tallFront: number };
        if (inRange(hp, at)) c.inRange += 1;
        else {
          c.out += 1;
          const ia = BAND_ORDER.indexOf(at);
          if (!BAND_ORDER.some((o, io) => Math.abs(io - ia) === 1 && inRange(hp, o))) c.farOut += 1;
        }
        if (at === "front" && hp > hb.hBackMin) c.tallFront += 1;
      }
      let shareViolations = 0;
      for (const c of perBand.values()) {
        const total = c.inRange + c.out;
        if (total > 0 && c.inRange / total < hb.shareMin - 1e-9) shareViolations += 1;
        shareViolations += c.farOut + c.tallFront;
      }
      diagnostics.push(
        `layout-v2 measures: tiebreaks=${tiebroken.length}; fallbacks=${modifierFallbacks.size}; straddling=${straddling}; shareViolations=${shareViolations}; asym=${asym.toFixed(3)}`,
      );
    }
    // P5 (hard): nothing overlapping a tree canopy unless it takes shade.
    // Enforced during placement (P2 now allows a small overlap); re-checked
    // here on the finished layout.
    const trees = placed.filter((p) => infos.get(p.plantId)?.types.includes("tree"));
    const p5Breaks = placed.filter(
      (p) =>
        !infos.get(p.plantId)?.shade &&
        trees.some(
          (tree) => tree.plantId !== p.plantId && Math.hypot(tree.xM - p.xM, tree.yM - p.yM) < tree.radiusM + p.radiusM - EPS,
        ),
    ).length;
    const p1 = placed.every(
      (p) => p.xM >= p.radiusM - EPS && p.xM <= W - p.radiusM + EPS && p.yM >= p.radiusM - EPS && p.yM <= L - p.radiusM + EPS,
    );
    const p2 = placed.every((p, index) =>
      placed.slice(index + 1).every((q) => Math.hypot(p.xM - q.xM, p.yM - q.yM) >= minCentreDistance(p.radiusM, q.radiusM) - EPS),
    );
    const allChecks: PlacementCheck[] = [
      { id: "P1", kind: "hard", pass: p1, detail: "Every plant sits fully inside the bed." },
      { id: "P2", kind: "hard", pass: p2, detail: `Plant circles overlap by no more than ${Math.round(P2_OVERLAP_TOLERANCE * 100)}% of the smaller plant's radius.` },
      ...checks,
      ...(site.windSite > 0
        ? [{
            id: "P4",
            kind: "hard" as const,
            pass: true,
            detail: "No erica or buchu placed in the windward (south or east) row.",
          }]
        : []),
      { id: "P5", kind: "hard", pass: p5Breaks === 0, detail: "Anything under a tree canopy tolerates shade." },
      ...(d29
        ? (() => {
            const tallInFront = placed.filter((p) => {
              const h = infos.get(p.plantId)?.heightCm ?? 0;
              return h > hb.hBackMin && depthFraction(p.xM, p.yM) < hb.edgeFrontMid - 1e-9;
            }).length;
            return [{
              id: "R2",
              kind: "hard" as const,
              pass: tallInFront === 0,
              detail: `No plant over ${hb.hBackMin} cm has its centre in the front band (${tallInFront} do).`,
            }];
          })()
        : []),
    ];
    const canopyAreaM2 = placed.reduce((sum, p) => sum + Math.PI * p.radiusM ** 2, 0);
    return {
      status,
      failedSpeciesId,
      realised,
      profile,
      checks: allChecks,
      layout: {
        status: status === "complete" ? "complete" : "partial",
        bedWidthM: W,
        bedLengthM: L,
        placements: placed,
        unplaced,
        canopyAreaM2,
        bedAreaM2: W * L,
        realisedOpenSpaceRatio: Math.max(0, 1 - canopyAreaM2 / (W * L)),
        diagnostics,
      },
    };
  }
}
