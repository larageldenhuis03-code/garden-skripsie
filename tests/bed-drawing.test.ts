import assert from "node:assert/strict";
import test from "node:test";

import { bedDrawing } from "../app/components/bedDrawing.ts";
import type { ViewingEdge } from "../app/lib/planning/index.ts";

const EDGES: ViewingEdge[] = ["north", "east", "south", "west"];

for (const [widthM, lengthM] of [
  [2, 6],
  [6, 2],
]) {
  test(`a ${widthM} x ${lengthM} m bed is drawn north at the top, with the viewer on the chosen edge`, () => {
    for (const edge of EDGES) {
      const drawing = bedDrawing(widthM, lengthM, edge);
      assert.equal(drawing.north, "top");
      assert.equal(drawing.viewerSide, edge, `viewer on the ${edge} edge`);
      // Never turned: the drawing keeps the bed's own width and length.
      assert.equal(drawing.widthM, widthM);
      assert.equal(drawing.lengthM, lengthM);
      assert.equal(drawing.aspect, widthM / lengthM);
    }
    const drawing = bedDrawing(widthM, lengthM, "south");
    // Stage 4's coordinates: x west -> east, y north -> south. The
    // north-west corner is drawn top-left and the south-east bottom-right.
    assert.deepEqual(drawing.toPercent(0, 0), { left: 0, top: 0 });
    assert.deepEqual(drawing.toPercent(widthM, lengthM), { left: 100, top: 100 });
    // A plant 0.5 m from the north edge and 0.5 m from the west edge sits
    // near the top-left on the drawing whichever way the bed is long.
    const near = drawing.toPercent(0.5, 0.5);
    assert.ok(near.left < 50 && near.top < 50);
  });
}

test("no viewer figure is drawn when no viewing edge is given", () => {
  assert.equal(bedDrawing(2, 6).viewerSide, null);
});
