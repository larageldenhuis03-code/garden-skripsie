import type { ViewingEdge } from "../lib/planning/brief.ts";

/**
 * How the plan drawing maps the bed onto the page: always north-up, in the
 * same coordinates Stage 4 places plants in (x west -> east, y north ->
 * south), so a point is drawn exactly where the engine put it.
 *
 * Until 13 Oct 2026 a bed longer than it was wide was drawn a quarter-turn
 * round, which put north on the left and made the compass, the viewer
 * figure and the labels easy to read the wrong way. Every bed is now
 * north-up, like the bed-size preview; a tall bed is simply drawn tall.
 */
export type BedDrawing = {
  /** Drawn width and height, in metres: the bed's own width and length. */
  widthM: number;
  lengthM: number;
  /** Width / length, the drawing's aspect ratio. */
  aspect: number;
  /** Which side of the drawing north is on. Always the top. */
  north: "top";
  /** The side of the drawing the viewer figure stands on: the chosen edge,
   * since the drawing is never turned. */
  viewerSide: ViewingEdge | null;
  /** A plant position, as a percentage of the drawing's width and height. */
  toPercent: (xM: number, yM: number) => { left: number; top: number };
};

export function bedDrawing(
  widthM: number,
  lengthM: number,
  viewingEdge?: ViewingEdge,
): BedDrawing {
  return {
    widthM,
    lengthM,
    aspect: widthM / lengthM,
    north: "top",
    viewerSide: viewingEdge ?? null,
    toPercent: (xM, yM) => ({ left: (xM / widthM) * 100, top: (yM / lengthM) * 100 }),
  };
}
