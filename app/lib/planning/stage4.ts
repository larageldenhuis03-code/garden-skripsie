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
  KEEP_PLACED,
  LAYOUT_V2B,
  P17_BALANCE_WEIGHT,
  P2_OVERLAP_TOLERANCE,
  PLACEMENT,
  RELAX,
  ROW_PITCH_M,
} from "./engineConfig.ts";
import { emptyGaps, relaxLayout, type RelaxPlant } from "./relax.ts";
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

export type Placement = CanopyPlacement & { layer: LayerId; windbreakRow?: boolean; gapFill?: boolean; openFill?: boolean };

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
  /** D33b v4: plants the gap fill added, per species. Not in `realised`,
   * which stays the Stage 2/3 selection that Z and H1-H7 are scored on. */
  added?: Selection;
  /** v10 (KEEP_PLACED): species left out because no room was left for
   * them after the plants placed before them; the rest was kept. */
  skipped?: string[];
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
  /** D33b v4: the H5 cap (r_max_effective) the gap fill must keep; the
   * engine passes it. Without it the gap fill does not run. */
  h5Cap?: number;
  /** v8 last fill (layout-v2g): H1 cover cap in m2 (cover_max x bed), the
   * H2 species ceiling, and the species the fail rule left out. The
   * engine passes them; without coverCapM2 the last fill does not run. */
  coverCapM2?: number;
  sMax?: number;
  excluded?: readonly string[];
  /** v9 open fill: the engine's check of every Stage 2 limit except the
   * H2 species ceiling, on the planted counts. Without it v9 does not run. */
  openFillOk?: (counts: Selection) => boolean;
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
const placedByStage4 = (result: PlacementResult): number =>
  result.layout.placements.filter((p) => !(p as Placement).gapFill).length;

export function placeSelection(
  selection: Selection,
  infos: ReadonlyMap<string, SpeciesInfo>,
  site: PlacementSite,
  rng: () => number,
): PlacementResult {
  let best: PlacementResult | null = null;
  // D29b part 2 (D30's asymmetry): one a ~ U(-asym_max, asym_max) per plan
  // seed, drawn only when the curve is on, so the random stream is
  // untouched otherwise.
  const asym = LAYOUT_V2B.d29b && LAYOUT_V2B.curve
    ? (rng() * 2 - 1) * RULES.stage4.heightBands.curveAsymMax
    : 0;
  for (let attempt = 0; attempt < PLACEMENT.restarts; attempt += 1) {
    const result = placeOnce(selection, infos, site, rng, attempt * PLACEMENT.noiseStep, asym);
    const shrunk = [...selection].some(([id, n]) => (result.realised.get(id) ?? 0) < n);
    if (result.status === "complete" && !shrunk) return result;
    if (
      !best ||
      (result.status === "complete" && best.status !== "complete") ||
      // Plants Stage 4 placed itself: D33b gap-fill additions must not
      // decide which restart is kept.
      (result.status === best.status && placedByStage4(result) > placedByStage4(best))
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
  /** D33b v4: plants added by the gap fill (not in realised). */
  const added: Selection = new Map();
  /** v10: species KEEP_PLACED left out. */
  const skipped: string[] = [];
  const checks: PlacementCheck[] = [];
  const diagnostics: string[] = [];
  /** Back-layer species that used the D28 middle-band fallback. */
  const bandFallbacks = new Set<string>();
  const unplaced: UnplacedCanopy[] = [];
  // The windward row bands: one row pitch in from the south and east edges.
  const inWindwardBand = (x: number, y: number): boolean =>
    y > L - ROW_PITCH_M || x > W - ROW_PITCH_M;
  const isTree = (plantId: string) => infos.get(plantId)?.types.includes("tree") ?? false;

  // ------------------------------------------------------------ D29b
  const v2b = LAYOUT_V2B.d29b;
  const hb = RULES.stage4.heightBands;
  const viewer = viewingAxis(site.frontEdge, W, L);
  /** Part 1: d* = (r - 0.5) / n per species. r is the mean height rank of
   * its plants among all the plan's plants bar climbers (ties share their
   * mean rank), n the number of those plants. Short plants rank first,
   * so they are nearest the viewer. */
  const dStar = new Map<string, number>();
  if (v2b) {
    const ranked = [...selection]
      .map(([id, n]) => ({ info: infos.get(id) as SpeciesInfo, n }))
      .filter((entry) => entry.info.layer !== "L2" && entry.n > 0)
      .sort((left, right) => left.info.heightCm - right.info.heightCm);
    const total = ranked.reduce((sum, entry) => sum + entry.n, 0);
    let start = 0;
    for (let i = 0; i < ranked.length; ) {
      let j = i;
      let m = 0;
      while (j < ranked.length && ranked[j].info.heightCm === ranked[i].info.heightCm) {
        m += ranked[j].n;
        j += 1;
      }
      const meanRank = start + (m + 1) / 2;
      for (let k = i; k < j; k += 1) dStar.set(ranked[k].info.id, (meanRank - 0.5) / total);
      start += m;
      i = j;
    }
  }
  /** Part 2: the curve lift k_s u^2 (a fraction of the depth), with
   * u = |across - centre| / (across / 2); k_s = k(1 + a) on the left half
   * and k(1 - a) on the right. Zero when the curve is off. */
  const curveK = v2b && LAYOUT_V2B.curve ? hb.curveK : 0;
  const curveLift = (across: number): number => {
    if (!curveK || viewer.across <= 0) return 0;
    const c = viewer.across / 2;
    const u = Math.abs(across - c) / c;
    return (across < c ? curveK * (1 + asym) : curveK * (1 - asym)) * u * u;
  };
  /** Depth from the viewer in metres, as compared with d*: d_eff with the
   * curve on, the plain depth otherwise. */
  const effDepthM = (x: number, y: number): number =>
    viewer.depthOf(x, y) + curveLift(viewer.acrossOf(x, y)) * viewer.span;
  /** Part 3, the only hard depth rule: no tree centred in front of
   * band_edge_front_mid. */
  const treeInFront = (info: SpeciesInfo, x: number, y: number): boolean =>
    v2b && LAYOUT_V2B.treeHard && info.types.includes("tree") &&
    effDepthM(x, y) < hb.edgeFrontMid * viewer.span - EPS;
  /** Parts 4 and 5: zones of the sweep, and the 3 x 3 cells. The band
   * edges only draw the zones; nothing is held to a band. */
  const zoneOf = (x: number, y: number): number => {
    const across = viewer.acrossOf(x, y);
    const outer = viewer.across > 0 && Math.abs(across - viewer.across / 2) >= viewer.across / 6;
    const d = effDepthM(x, y) / viewer.span;
    const back = d >= hb.edgeMidBack;
    if (outer) return back ? 0 : 1; // back corners, then sides
    return back ? 2 : d >= hb.edgeFrontMid ? 3 : 4; // back centre, middle, front centre
  };
  const cellOf = (x: number, y: number): number => {
    const col = Math.min(2, Math.floor((viewer.acrossOf(x, y) / viewer.across) * 3));
    const row = Math.min(2, Math.floor((viewer.depthOf(x, y) / viewer.span) * 3));
    return row * 3 + col;
  };
  let driftSplits = 0;

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
      // D29b part 3: a row place the tree rule removes still counts as
      // taken, so the plant meant for it joins the structure layer (placed
      // by height, so at the back) rather than spilling into a stacked row
      // off the windward edge. Zero unless a tree is in the row.
      let forgone = 0;
      const edgesUsed = new Set<"south" | "east">();
      for (const spot of spots) {
        if (sequence + forgone >= n) break;
        if (!fits(spot.x, spot.y, d / 2, chosen)) continue;
        if (treeInFront(chosen, spot.x, spot.y)) {
          forgone += 1;
          continue;
        }
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

  const choose = (info: SpeciesInfo, drift: Placement[]): { x: number; y: number } | null => {
    const r = info.diameterM / 2;
    const targetDepthFraction = targetDepth(info.layer, profile);
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
    const override = v2b || targetDepthFraction === null ? undefined : site.bands?.[info.layer];
    // D29b part 1: the relative target replaces the layer target (climbers
    // keep following their host).
    const target = v2b
      ? info.layer === "L2" ? null : (dStar.get(info.id) ?? null)
      : override ? (override.lo + override.hi) / 2 : targetDepthFraction;
    /** Depth as compared with the target: d_eff under D29b, else plain. */
    const depthM = (x: number, y: number) => (v2b ? effDepthM(x, y) : axis.depthOf(x, y));
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
      // scatter), the rest anywhere.
      for (let k = 0; k < PLACEMENT.randomDraws; k += 1) {
        const inBand = target !== null && k < PLACEMENT.randomDraws * PLACEMENT.inBandShare;
        const across = r + rng() * Math.max(0, axis.across - 2 * r);
        const depth = inBand
          ? Math.min(Math.max(target * axis.span + (rng() * 2 - 1) * tol - (v2b ? curveLift(across) * axis.span : 0), r), axis.span - r)
          : r + rng() * Math.max(0, axis.span - 2 * r);
        raw.push(axis.pointAt(depth, across));
      }
      // Contact points: around the drift for drift members, else anywhere.
      const near = drift.length > 0
        ? placed.filter((p) => drift.some((m) => Math.hypot(m.xM - p.xM, m.yM - p.yM) <= m.radiusM + p.radiusM + 2 * r + EPS))
        : null;
      const contacts = contactCandidates(r, near);
      firstContact = raw.length;
      raw.push(...contacts);
    }

    // D28 (owner, 13 Oct 2026): a back-layer plant never lands in front.
    // It may sit anywhere from the front edge of its own band to the back
    // of the bed; if no spot there fits, it steps forward ONE band - to
    // the middle layer's band - and no further. With no valid spot in
    // either, choose() returns null and the existing fail rule takes over
    // (shrink the group, then drop the species). Climbers stay with their
    // host and band-less layers (L2, L3, L7) are untouched.
    const middle = targetDepth("L4", profile);
    if (
      !v2b &&
      info.layer === "L1" &&
      target !== null &&
      middle !== null &&
      !override &&
      target > middle
    ) {
      const usable = (spot: { x: number; y: number }, from: number) =>
        axis.depthOf(spot.x, spot.y) >= from - EPS && fits(spot.x, spot.y, r, info) && !breaksP4(info, spot.x, spot.y);
      const backFrom = target * axis.span - tol;
      const middleFrom = middle * axis.span - tol;
      const keep = (from: number) => {
        const draws = raw.slice(0, firstContact).filter((spot) => axis.depthOf(spot.x, spot.y) >= from - EPS);
        const snug = raw.slice(firstContact).filter((spot) => axis.depthOf(spot.x, spot.y) >= from - EPS);
        raw.length = 0;
        raw.push(...draws, ...snug);
        firstContact = draws.length;
      };
      if (raw.some((spot) => usable(spot, backFrom))) {
        keep(backFrom);
      } else {
        // The back band is full: look one band forward, with fresh draws
        // spread over the whole allowed depth so the search is fair.
        const extra: { x: number; y: number }[] = [];
        for (let k = 0; k < PLACEMENT.randomDraws; k += 1) {
          const across = r + rng() * Math.max(0, axis.across - 2 * r);
          const depth = Math.max(middleFrom, r) + rng() * Math.max(0, axis.span - r - Math.max(middleFrom, r));
          extra.push(axis.pointAt(depth, across));
        }
        raw.splice(firstContact, 0, ...extra);
        firstContact += extra.length;
        keep(middleFrom);
        if (!raw.some((spot) => usable(spot, middleFrom))) return null;
        if (!bandFallbacks.has(info.id)) {
          bandFallbacks.add(info.id);
          diagnostics.push(`${info.id}: its back band was full, so it moved forward to the middle band (D28), never to the front.`);
        }
      }
    }

    let best: { x: number; y: number; pref: number } | null = null;
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
      target === null || Math.abs(depthM(x, y) - target * axis.span) <= tol + EPS;
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
    const scored: { x: number; y: number; pref: number }[] = [];
    for (let index = startIndex; index < raw.length; index += 1) {
      const { x, y } = raw[index];
      if (!fits(x, y, r, info) || breaksP4(info, x, y)) continue;
      if (treeInFront(info, x, y)) continue; // D29b part 3 (hard)
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
        const off = Math.abs(depthM(x, y) - target * axis.span);
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
      scored.push({ x, y, pref });
    }
    let pool = scored;
    // D29b parts 4 and 5 steer only a group's first plant, and only among
    // spots near its target depth (all valid spots when none is near).
    if (v2b && drift.length === 0 && target !== null && (LAYOUT_V2B.order || LAYOUT_V2B.fill)) {
      const near = pool.filter((s) => inDepthBand(s.x, s.y));
      if (near.length > 0) pool = near;
      if (LAYOUT_V2B.order) {
        const first = Math.min(...pool.map((s) => zoneOf(s.x, s.y)));
        pool = pool.filter((s) => zoneOf(s.x, s.y) === first);
      }
      if (LAYOUT_V2B.fill) {
        const canopy = new Array<number>(9).fill(0);
        for (const p of placed) canopy[cellOf(p.xM, p.yM)] += Math.PI * p.radiusM ** 2;
        const emptiest = Math.min(...pool.map((s) => canopy[cellOf(s.x, s.y)]));
        pool = pool.filter((s) => canopy[cellOf(s.x, s.y)] === emptiest);
      }
    }
    for (const s of pool) if (!best || s.pref > best.pref) best = s;
    return best;
  };

  const byLayer = new Map<LayerId, SpeciesInfo[]>();
  for (const id of selection.keys()) {
    const info = infos.get(id) as SpeciesInfo;
    if (!byLayer.has(info.layer)) byLayer.set(info.layer, []);
    byLayer.get(info.layer)!.push(info);
  }

  const sequence: SpeciesInfo[] = [];
  for (const layer of LAYER_ORDER) {
    sequence.push(
      ...(byLayer.get(layer) ?? []).sort(
        (left, right) =>
          Number(right.feature) - Number(left.feature) || // feature plant first
          right.diameterM - left.diameterM ||
          left.id.localeCompare(right.id),
      ),
    );
  }
  if (v2b && LAYOUT_V2B.order) {
    // D29b part 4: back to front by target depth class (the zone rows),
    // the feature plant first, then decreasing spread; climbers last so
    // their hosts are already in place.
    const rowOf = (info: SpeciesInfo) => {
      const d = dStar.get(info.id) ?? 0;
      return d >= hb.edgeMidBack ? 0 : d >= hb.edgeFrontMid ? 1 : 2;
    };
    sequence.sort(
      (left, right) =>
        Number(left.layer === "L2") - Number(right.layer === "L2") ||
        rowOf(left) - rowOf(right) ||
        Number(right.feature) - Number(left.feature) ||
        right.diameterM - left.diameterM ||
        left.id.localeCompare(right.id),
    );
  }

  {
    for (const info of sequence) {
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
        // D29b part 6: a group of more than 3 may be placed as 2 drifts.
        const splitAt = v2b && LAYOUT_V2B.driftSplit && size > 3 ? Math.ceil(size / 2) : -1;
        for (let sequence = already; sequence < size; sequence += 1) {
          if (sequence === splitAt) {
            drift.length = 0;
            driftSplits += 1;
          }
          const spot = choose(info, drift);
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
        // v10 (KEEP_PLACED): leave out only this species and keep the rest.
        if (KEEP_PLACED.on && info.id !== windbreakId && !info.feature) {
          realised.delete(info.id);
          skipped.push(info.id);
          diagnostics.push(`KP: ${info.id} left out - no room after the plants placed before it; the rest is kept`);
          continue;
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
  return finish("complete", null);

  /** D33 (engineConfig RELAX): the final relaxation pass on a complete
   * layout. Moves plants only; kept only if the largest empty patch shrinks
   * and every check holds (relax.ts). One diagnostic line either way. */
  function relaxPlaced(): void {
    const hostOf = (p: Placement): number | null => {
      if (p.layer !== "L2") return null;
      let best: number | null = null;
      let bestGap = Infinity;
      placed.forEach((h, k) => {
        if (h.layer !== "L1") return;
        const d = Math.hypot(h.xM - p.xM, h.yM - p.yM);
        if (d <= minCentreDistance(h.radiusM, p.radiusM) + 1e-3 && d < bestGap) {
          best = k;
          bestGap = d;
        }
      });
      return best;
    };
    const plants: RelaxPlant[] = placed.map((p) => {
      const info = infos.get(p.plantId) as SpeciesInfo;
      const hostIndex = hostOf(p);
      const target = v2b
        ? info.layer === "L2" ? null : (dStar.get(info.id) ?? null)
        : targetDepth(info.layer, profile);
      return {
        x: p.xM,
        y: p.yM,
        r: p.radiusM,
        plantId: p.plantId,
        // The feature plant and the windbreak row stay put; so does a
        // climber with no host to follow.
        fixed: info.feature || Boolean(p.windbreakRow) || (p.layer === "L2" && hostIndex === null),
        hostIndex,
        target,
        tree: info.types.includes("tree"),
        shade: info.shade,
        heightCm: info.heightCm,
      };
    });
    const result = relaxLayout(plants, {
      widthM: W,
      depthM: L,
      depthOf: (x, y) => (v2b ? effDepthM(x, y) : viewer.depthOf(x, y)),
      span: viewer.span,
      depthTol: RULES.stage4.depthTol,
      minCentreDistance,
      hardOk: (index, x, y) => {
        const info = infos.get(placed[index].plantId) as SpeciesInfo;
        return !breaksP4(info, x, y) && !treeInFront(info, x, y);
      },
    });
    if (result.accepted) {
      result.positions.forEach((pos, k) => {
        placed[k].xM = pos.x;
        placed[k].yM = pos.y;
      });
    }
    diagnostics.push(
      `D33 relax: ${result.accepted ? "accepted" : "rejected"}; patch ${result.patchBefore.toFixed(3)} -> ${result.patchAfter.toFixed(3)}; median move ${result.medianMoveCm.toFixed(1)} cm; moved ${result.movedCount} plants, median ${result.medianMovedCm.toFixed(1)} cm; swaps ${result.swaps ?? 0}; iterations ${result.iterations}; target gap ${(result.targetGapM * 100).toFixed(1)} cm; ${result.reason}`,
    );
    if (RELAX.gapFill && site.h5Cap !== undefined) gapFill(site.h5Cap);
    if (RELAX.lastFill && site.h5Cap !== undefined && site.coverCapM2 !== undefined) lastFill(site.h5Cap, site.coverCapM2);
    if (RELAX.openFill && site.openFillOk) openFill(site.openFillOk);
  }

  /** v9 (engineConfig RELAX.openFill): the open fill - see engineConfig. */
  function openFill(ok: (counts: Selection) => boolean): void {
    const counts = new Map(realised);
    for (const [id, n] of added) counts.set(id, (counts.get(id) ?? 0) + n);
    if (!ok(counts)) {
      diagnostics.push("v9 open fill: skipped - the planting as it stands already breaks a limit other than H2.");
      return;
    }
    const excluded = new Set(site.excluded ?? []);
    const usable = (info: SpeciesInfo) =>
      !info.feature && info.layer !== "L2" && info.id !== windbreakId && !excluded.has(info.id);
    // v9c: nothing narrower than openFillMinSpreadM is added.
    const pool = [...infos.values()].filter((info) => usable(info) && info.diameterM >= RELAX.openFillMinSpreadM - EPS);
    let newSpecies = 0;
    let capNoted = false;
    const ranked = [...dStar].map(([id, d]) => ({ h: (infos.get(id) as SpeciesInfo).heightCm, d })).sort((a, b) => a.h - b.h);
    const targetOf = (info: SpeciesInfo): number | null => {
      if (!v2b) return targetDepth(info.layer, profile);
      const known = dStar.get(info.id);
      if (known !== undefined) return known;
      if (!ranked.length) return null;
      // Height-led: interpolate d* linearly between the planted species
      // just shorter and just taller, so a mid-height newcomer stands in
      // the middle even when no planted species is mid-height.
      const h = info.heightCm;
      if (h <= ranked[0].h) return ranked[0].d;
      const last = ranked[ranked.length - 1];
      if (h >= last.h) return last.d;
      const k = ranked.findIndex((e) => e.h >= h);
      const lo = ranked[k - 1];
      const hi = ranked[k];
      return hi.h === lo.h ? hi.d : lo.d + ((h - lo.h) / (hi.h - lo.h)) * (hi.d - lo.d);
    };
    const roomAt = (x: number, y: number) =>
      Math.min(x, W - x, y, L - y, ...placed.map((p) => Math.hypot(p.xM - x, p.yM - y) - p.radiusM));
    const canStand = (info: SpeciesInfo, x: number, y: number): boolean => {
      const r = info.diameterM / 2;
      if (roomAt(x, y) < r - EPS) return false; // touches nothing, inside the bed
      if (!fits(x, y, r, info) || breaksP4(info, x, y) || treeInFront(info, x, y)) return false;
      // Owner 19 Oct: no added plant of h_back_min or taller centred in the front band
      // (straight depth from the viewer). Hard, like the tree rule.
      if (info.heightCm >= hb.hBackMin && viewer.depthOf(x, y) < hb.edgeFrontMid * viewer.span - EPS) return false;
      const target = targetOf(info);
      if (target === null) return true;
      const depth = v2b ? effDepthM(x, y) : viewer.depthOf(x, y);
      return Math.abs(depth - target * viewer.span) <= RULES.stage4.depthTol * viewer.span + EPS;
    };
    /** Points just outside each plant of `id` (gap 2 cm, every 15 degrees),
     * roomiest first: where a group-mate can stand. */
    const besideMates = (id: string, r: number) => {
      const out: { x: number; y: number; room: number }[] = [];
      for (const m of placed) {
        if (m.plantId !== id) continue;
        const dist = m.radiusM + r + 0.02;
        for (let a = 0; a < 24; a += 1) {
          const x = m.xM + dist * Math.cos((a * Math.PI) / 12);
          const y = m.yM + dist * Math.sin((a * Math.PI) / 12);
          out.push({ x, y, room: roomAt(x, y) });
        }
      }
      return out.filter((p) => p.room >= r - EPS).sort((a, b) => b.room - a.room);
    };
    const put = (info: SpeciesInfo, x: number, y: number) => {
      const n = counts.get(info.id) ?? 0;
      record(info, x, y, n, { gapFill: true, openFill: true }); // openFill marks v9's own plants
      counts.set(info.id, n + 1);
      added.set(info.id, (added.get(info.id) ?? 0) + 1);
    };
    const undo = (info: SpeciesInfo, k: number) => {
      placed.length -= k;
      counts.set(info.id, (counts.get(info.id) ?? 0) - k);
      if (counts.get(info.id) === 0) counts.delete(info.id);
      const a = (added.get(info.id) ?? 0) - k;
      if (a > 0) added.set(info.id, a);
      else added.delete(info.id);
    };
    /** Try to plant `info` with its first plant in this gap: one more of a
     * planted species (beside its group), or a whole new group. */
    const tryPlant = (info: SpeciesInfo, gapPoints: { x: number; y: number; room: number }[]): string | null => {
      const r = info.diameterM / 2;
      const n = counts.get(info.id) ?? 0;
      if (n > 0) {
        if (n + 1 > Math.max(...info.allowedN)) return null; // H3 max
        const spot = besideMates(info.id, r).find((p) => gapPoints.some((g) => Math.hypot(g.x - p.x, g.y - p.y) < r) && canStand(info, p.x, p.y));
        if (!spot) return null;
        put(info, spot.x, spot.y);
        if (ok(counts)) return `${info.id} (${n} -> ${n + 1})`;
        undo(info, 1);
        return null;
      }
      // v9c: at most openFillMaxNewSpecies species that were not in the plan.
      if (newSpecies >= RELAX.openFillMaxNewSpecies) {
        if (!capNoted) {
          capNoted = true;
          diagnostics.push(`v9 open fill: new-species cap (${RELAX.openFillMaxNewSpecies}) reached`);
        }
        return null;
      }
      const first = gapPoints.find((g) => g.room >= r - EPS && canStand(info, g.x, g.y));
      if (!first) return null;
      const sizes = [...info.allowedN].sort((a, b) => b - a);
      for (const size of sizes) {
        put(info, first.x, first.y);
        let k = 1;
        while (k < size) {
          const spot = besideMates(info.id, r).find((p) => canStand(info, p.x, p.y));
          if (!spot) break;
          put(info, spot.x, spot.y);
          k += 1;
        }
        if (k === size && ok(counts)) {
          newSpecies += 1;
          return `${info.id} x${size} [new species]`;
        }
        undo(info, k);
      }
      return null;
    };
    let total = 0;
    while (total < RELAX.openFillMax) {
      const gaps = emptyGaps(placed.map((p) => ({ x: p.xM, y: p.yM, r: p.radiusM })), W, L)
        .sort((a, b) => b.length - a.length)
        .map((cells) => cells.map((c) => ({ ...c, room: roomAt(c.x, c.y) })).sort((a, b) => b.room - a.room));
      let done = false;
      for (const points of gaps) {
        const maxRoom = points[0]?.room ?? 0;
        if (maxRoom <= EPS) continue;
        // Only species that could stand somewhere in this gap: room for
        // their spread at a point within their depth tolerance.
        const depthOfPoint = (g: { x: number; y: number }) => (v2b ? effDepthM(g.x, g.y) : viewer.depthOf(g.x, g.y));
        const fitting = pool.filter((info) => {
          const r = info.diameterM / 2;
          if (r > maxRoom + EPS) return false;
          const t = targetOf(info);
          return points.some((g) => g.room >= r - EPS && (t === null || Math.abs(depthOfPoint(g) - t * viewer.span) <= RULES.stage4.depthTol * viewer.span + EPS));
        });
        const well = fitting
          .filter((info) => info.diameterM / 2 >= RELAX.openFillWellFraction * maxRoom)
          .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
        const rest = fitting
          .filter((info) => info.diameterM / 2 < RELAX.openFillWellFraction * maxRoom)
          .sort((a, b) => b.diameterM - a.diameterM || b.score - a.score || a.id.localeCompare(b.id));
        // v9c: without the fallback, only plants that fill the gap well.
        for (const info of (RELAX.openFillFallback ? [...well, ...rest] : well).slice(0, RELAX.openFillTries)) {
          const before = placed.length;
          const what = tryPlant(info, points);
          if (what) {
            total += placed.length - before;
            diagnostics.push(`v9 open fill: added ${what}.`);
            done = true;
            break;
          }
        }
        if (done) break;
      }
      if (!done) break;
    }
  }

  /** v8 (engineConfig RELAX.lastFill): the last-resort fill. Runs after
   * relaxation and the v7 gap fill, moves nothing, and only adds. Each
   * round finds every empty gap left, then tries its points from the
   * roomiest down against the candidates in Stage 1 score order; the first
   * plant that fits is added and the gaps are found again. It stops when a
   * round adds nothing (or at lastFillMax plants). */
  function lastFill(h5Cap: number, coverCapM2: number): void {
    const counts = new Map(realised);
    for (const [id, n] of added) counts.set(id, (counts.get(id) ?? 0) + n);
    let total = [...counts.values()].reduce((s, n) => s + n, 0);
    let area = placed.reduce((s, p) => s + Math.PI * p.radiusM * p.radiusM, 0);
    const excluded = new Set(site.excluded ?? []);
    const usable = (info: SpeciesInfo) =>
      !info.feature && info.layer !== "L2" && info.id !== windbreakId && !excluded.has(info.id);
    const own = [...realised.keys()]
      .map((id) => infos.get(id) as SpeciesInfo)
      .filter(usable)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    const pool = RELAX.lastFillPool
      ? [...infos.values()]
          .filter((info) => !realised.has(info.id) && usable(info))
          .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
          .slice(0, RELAX.lastFillPoolTop)
      : [];
    const candidates = [...own, ...pool];
    if (!candidates.length) return;
    // Depth target for a species the plan did not select: d* of the
    // selected species nearest in height (v2b), else its layer's target.
    const ranked = [...dStar].map(([id, d]) => ({ h: (infos.get(id) as SpeciesInfo).heightCm, d })).sort((a, b) => a.h - b.h);
    const targetOf = (info: SpeciesInfo): number | null => {
      if (!v2b) return targetDepth(info.layer, profile);
      const known = dStar.get(info.id);
      if (known !== undefined) return known;
      if (!ranked.length) return null;
      return ranked.reduce((best, e) => (Math.abs(e.h - info.heightCm) < Math.abs(best.h - info.heightCm) ? e : best)).d;
    };
    const room = (x: number, y: number) =>
      Math.min(x, W - x, y, L - y, ...placed.map((p) => Math.hypot(p.xM - x, p.yM - y) - p.radiusM));
    const minR = Math.min(...candidates.map((c) => c.diameterM / 2));
    let speciesCount = counts.size;
    let addedHere = 0;
    while (addedHere < RELAX.lastFillMax) {
      const spots = emptyGaps(placed.map((p) => ({ x: p.xM, y: p.yM, r: p.radiusM })), W, L)
        .flat()
        .map((c) => ({ ...c, room: room(c.x, c.y) }))
        .filter((c) => c.room >= minR - EPS)
        .sort((a, b) => b.room - a.room || a.y - b.y || a.x - b.x);
      let done = false;
      for (const spot of spots) {
        for (const info of candidates) {
          const r = info.diameterM / 2;
          if (spot.room < r - EPS) continue; // touches nothing, inside the bed
          const n = counts.get(info.id) ?? 0;
          if (n + 1 > Math.max(...info.allowedN)) continue; // H3 max
          if ((n + 1) / (total + 1) > h5Cap + 1e-9) continue; // H5 cap
          if (n === 0 && site.sMax !== undefined && speciesCount + 1 > site.sMax) continue; // H2 ceiling
          if (area + info.areaM2 > coverCapM2 + 1e-9) continue; // H1
          const { x, y } = spot;
          if (n > 0 && RELAX.cohesionFill) {
            const mateGap = Math.min(...placed.filter((p) => p.plantId === info.id).map((p) => Math.hypot(p.xM - x, p.yM - y) - p.radiusM - r));
            if (!(mateGap <= RELAX.cohesionMaxGapM + EPS)) continue;
          }
          if (!fits(x, y, r, info) || breaksP4(info, x, y) || treeInFront(info, x, y)) continue;
          // Owner 19 Oct: no added plant of h_back_min or taller centred in the front band
          // (straight depth from the viewer). Hard, like the tree rule.
          if (info.heightCm >= hb.hBackMin && viewer.depthOf(x, y) < hb.edgeFrontMid * viewer.span - EPS) continue;
          const target = targetOf(info);
          if (target !== null) {
            const depth = v2b ? effDepthM(x, y) : viewer.depthOf(x, y);
            if (Math.abs(depth - target * viewer.span) > RULES.stage4.depthTol * viewer.span + EPS) continue;
          }
          record(info, x, y, n, { gapFill: true });
          if (n === 0) speciesCount += 1;
          counts.set(info.id, n + 1);
          total += 1;
          area += info.areaM2;
          addedHere += 1;
          added.set(info.id, (added.get(info.id) ?? 0) + 1);
          diagnostics.push(`v8 last fill: added ${info.id} (${n} -> ${n + 1})${realised.has(info.id) ? "" : " [pool species]"}.`);
          done = true;
          break;
        }
        if (done) break;
      }
      if (!done) break;
    }
  }

  /** D33b v4: in each of the gapFillCount largest gaps, one more plant of a
   * species already selected, at the roomiest point of the gap that one
   * fits. n + 1 must stay within the species' H3 maximum and its share
   * within the H5 cap; no new species, no feature plant (H4), no climber,
   * no extra windbreak plant. The plant must not touch any other (gap >= 0,
   * so P2 and P5 hold), must keep every hard rule and must stand within
   * its depth tolerance. */
  function gapFill(h5Cap: number): void {
    const counts = new Map(realised);
    let total = [...counts.values()].reduce((s, n) => s + n, 0);
    const candidates = [...counts.keys()]
      .map((id) => infos.get(id) as SpeciesInfo)
      .filter((info) => !info.feature && info.layer !== "L2" && info.id !== windbreakId)
      .sort((a, b) => b.diameterM - a.diameterM || a.id.localeCompare(b.id));
    const gaps = emptyGaps(placed.map((p) => ({ x: p.xM, y: p.yM, r: p.radiusM })), W, L).slice(0, RELAX.gapFillCount);
    const room = (x: number, y: number) =>
      Math.min(x, W - x, y, L - y, ...placed.map((p) => Math.hypot(p.xM - x, p.yM - y) - p.radiusM));
    gaps.forEach((cells, k) => {
      const spots = cells
        .map((c) => ({ ...c, room: room(c.x, c.y) }))
        .sort((a, b) => b.room - a.room || a.y - b.y || a.x - b.x)
        // v7 tries every point of the gap, so a spot beside a drift can be found.
        .slice(0, RELAX.cohesionFill ? undefined : 12);
      for (const spot of spots) {
        for (const info of candidates) {
          const n = counts.get(info.id) ?? 0;
          if (n + 1 > Math.max(...info.allowedN)) continue; // H3 max
          if ((n + 1) / (total + 1) > h5Cap + 1e-9) continue; // H5 cap
          const r = info.diameterM / 2;
          const x = Math.min(Math.max(spot.x, r), W - r);
          const y = Math.min(Math.max(spot.y, r), L - r);
          if (placed.some((p) => Math.hypot(p.xM - x, p.yM - y) < p.radiusM + r - EPS)) continue; // touches nothing
          if (RELAX.cohesionFill) {
            // v7: beside a plant of its own species.
            const mateGap = Math.min(...placed.filter((p) => p.plantId === info.id).map((p) => Math.hypot(p.xM - x, p.yM - y) - p.radiusM - r));
            if (!(mateGap <= RELAX.cohesionMaxGapM + EPS)) continue;
          }
          if (!fits(x, y, r, info) || breaksP4(info, x, y) || treeInFront(info, x, y)) continue;
          // Owner 19 Oct: no added plant of h_back_min or taller centred in the front band
          // (straight depth from the viewer). Hard, like the tree rule.
          if (info.heightCm >= hb.hBackMin && viewer.depthOf(x, y) < hb.edgeFrontMid * viewer.span - EPS) continue;
          const target = v2b ? (dStar.get(info.id) ?? null) : targetDepth(info.layer, profile);
          if (target !== null) {
            const tol = RELAX.shortClamp && info.heightCm < RELAX.shortHeightCm ? RELAX.shortDepthTol : RULES.stage4.depthTol;
            const depth = v2b ? effDepthM(x, y) : viewer.depthOf(x, y);
            if (Math.abs(depth - target * viewer.span) > tol * viewer.span + EPS) continue;
          }
          record(info, x, y, n, { gapFill: true });
          counts.set(info.id, n + 1);
          total += 1;
          added.set(info.id, (added.get(info.id) ?? 0) + 1);
          diagnostics.push(`D33b gap fill: added ${info.id} (${n} -> ${n + 1}) in gap ${k + 1}.`);
          return;
        }
      }
    });
  }

  /** D33 runs only on a layout that would be output as it stands -
   * complete, with every hard check passing - so it can never rescue a
   * layout the fail rule would reject, and the selection, Z and
   * feasibility are untouched. The checks are then taken again on the
   * final positions. */
  function finish(status: "complete" | "failed", failedSpeciesId: string | null): PlacementResult {
    if (status !== "complete" || !RELAX.on) return finishWith(status, failedSpeciesId);
    const mark = diagnostics.length;
    const asPlaced = finishWith(status, failedSpeciesId);
    if (!asPlaced.checks.every((check) => check.kind !== "hard" || check.pass)) return asPlaced;
    diagnostics.length = mark; // its measures line is taken again below
    const before = placed.length;
    const saved = placed.map((p) => ({ x: p.xM, y: p.yM }));
    relaxPlaced();
    const markAfter = diagnostics.length;
    const relaxed = finishWith(status, failedSpeciesId);
    const counts = `D33 counts: before=${before}; after=${placed.length}; added=${placed.length - before}; removed=${Math.max(0, before - placed.length)}`;
    if (relaxed.checks.every((check) => check.kind !== "hard" || check.pass)) {
      diagnostics.push(counts);
      return relaxed;
    }
    // Never a reason to fail: put the layout back exactly as placed.
    diagnostics.length = markAfter;
    placed.length = before;
    saved.forEach((pos, k) => {
      placed[k].xM = pos.x;
      placed[k].yM = pos.y;
    });
    added.clear();
    diagnostics.push("D33: a hard check failed after relaxation, so the layout as placed is kept.");
    diagnostics.push(`D33 counts: before=${before}; after=${placed.length}; added=0; removed=0`);
    return finishWith(status, failedSpeciesId);
  }

  function finishWith(status: "complete" | "failed", failedSpeciesId: string | null): PlacementResult {
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
    const v2bChecks: PlacementCheck[] = [];
    if (v2b) {
      const edge = hb.edgeFrontMid * viewer.span;
      const treesFront = placed.filter((p) => isTree(p.plantId) && effDepthM(p.xM, p.yM) < edge - EPS).length;
      const tallFront = placed.filter(
        (p) => (infos.get(p.plantId)?.heightCm ?? 0) >= hb.hBackMin && effDepthM(p.xM, p.yM) < edge - EPS,
      ).length;
      if (LAYOUT_V2B.treeHard) {
        v2bChecks.push({
          id: "D29b-tree",
          kind: "hard",
          pass: treesFront === 0,
          detail: `No tree centred in front of ${hb.edgeFrontMid} of the depth from the viewer (${treesFront} do).`,
        });
      }
      diagnostics.push(
        `layout-v2b measures: treesFront=${treesFront}; tallFront=${tallFront}; driftSplits=${driftSplits}; asym=${asym.toFixed(3)}`,
      );
    }
    const allChecks: PlacementCheck[] = [
      { id: "P1", kind: "hard", pass: p1, detail: "Every plant sits fully inside the bed." },
      ...v2bChecks,
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
    ];
    const canopyAreaM2 = placed.reduce((sum, p) => sum + Math.PI * p.radiusM ** 2, 0);
    return {
      status,
      failedSpeciesId,
      realised,
      added: new Map(added),
      skipped: [...skipped],
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
