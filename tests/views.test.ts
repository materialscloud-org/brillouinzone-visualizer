import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import { viewAxes } from "../src/bzVisualizer";
import { VIEWS } from "../src/viewer";
import type { Matrix } from "../src/types";

const matrix = (rows: number[][]): Matrix => ({
  rows: 3,
  cols: 3,
  data: Float64Array.from(rows.flat()),
});
// fcc reciprocal basis; its real-space a1 is along (0, 1, 1)
const fcc = matrix([
  [-1, 1, 1],
  [1, -1, 1],
  [1, 1, -1],
]);

describe("viewAxes", () => {
  it("looks along b1–b3, and b1*–b3* along the real-space axes", () => {
    expect(viewAxes("b2", fcc).direction.toArray()).toEqual([1, -1, 1]);
    const a1 = viewAxes("b1*", fcc).direction.normalize();
    expect(a1.angleTo(new Vector3(0, 1, 1))).toBeLessThan(1e-12);
    // bi* is perpendicular to the other two b's
    expect(viewAxes("b3*", fcc).direction.dot(new Vector3(-1, 1, 1))).toBe(0);
    expect(viewAxes("b3*", fcc).direction.dot(new Vector3(1, -1, 1))).toBe(0);
  });

  it("keeps bi* on bi's side for a left-handed basis", () => {
    const left = matrix([
      [-1, 1, 1],
      [1, 1, -1],
      [1, -1, 1],
    ]);
    for (const [i, name] of (["b1*", "b2*", "b3*"] as const).entries()) {
      const b = new Vector3().fromArray(left.data, 3 * i);
      expect(viewAxes(name, left).direction.dot(b)).toBeGreaterThan(0);
    }
  });

  it("passes the fixed views through and rejects unknown names", () => {
    expect(viewAxes("x", fcc)).toBe(VIEWS.x);
    expect(() => viewAxes("b4" as never, fcc)).toThrow(/Unknown view/);
  });
});
