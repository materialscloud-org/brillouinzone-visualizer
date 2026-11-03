import { describe, expect, it } from "vitest";
import { Vector3 } from "three";

import { getBrillouinZone } from "../src/brillouinZone";
import { foldIntoBZ, kgridPoints, toCartesian } from "../src/kpoints";
import { fromSeekpathJSON, kgridFromMesh } from "../src/seekpath";
import type { Matrix } from "../src/types";

const fccRows = [
  [-1, 1, 1],
  [1, -1, 1],
  [1, 1, -1],
];
const fcc: Matrix = {
  rows: 3,
  cols: 3,
  data: Float64Array.from(fccRows.flat()),
};
const [b1, b2, b3] = fccRows;
const cart = (f: number[]) => toCartesian([f[0], f[1], f[2]], fcc).toArray();

describe("fromSeekpathJSON", () => {
  it("reads Cartesian labelled and explicit points when no fractional ones are given", () => {
    const L = [0.5, 0.5, 0.5];
    const data = fromSeekpathJSON({
      b1,
      b2,
      b3,
      kpoints: { GAMMA: [0, 0, 0], L: cart(L) },
      path: [["GAMMA", "L"]],
      explicit_kpoints_abs: [cart([0.25, 0, 0.5])],
    });
    data.kpath!.points.L.forEach((x, i) => expect(x).toBeCloseTo(L[i], 12));
    expect(data.kpath!.segments).toEqual([["GAMMA", "L"]]);
    data.points![0].forEach((x, i) =>
      expect(x).toBeCloseTo([0.25, 0, 0.5][i], 12),
    );
  });

  it("keeps labelled points without a path, and generates a mesh", () => {
    const data = fromSeekpathJSON({
      b1,
      b2,
      b3,
      kpoints_rel: { X: [0.5, 0, 0.5] },
      mesh: [4, 4, 2],
      offset: [[0.5, 0.5, 0]],
    });
    expect(data.kpath!.segments).toEqual([]);
    expect(data.points).toHaveLength(32);
    expect(data.grid).toEqual({
      kind: "grid",
      mesh: [4, 4, 2],
      origin: [0.125, 0.125, 0],
      scheme: "monkhorst-pack",
    });
  });
});

describe("kgridPoints", () => {
  it("follows the AiiDA convention (i + offset) / n, first index fastest", () => {
    const points = kgridPoints(kgridFromMesh([2, 3, 1], [0.5, 0, 0]));
    expect(points).toHaveLength(6);
    expect(points[0]).toEqual([0.25, 0, 0]);
    expect(points[1]).toEqual([0.75, 0, 0]);
    expect(points[2]).toEqual([0.25, 1 / 3, 0]);
  });
});

describe("foldIntoBZ", () => {
  const bz = getBrillouinZone(fcc);
  const points = kgridPoints(kgridFromMesh([6, 6, 6], [0.5, 0.5, 0.5]));
  const folded = foldIntoBZ(points, fcc);

  it("puts every point inside the first zone", () => {
    for (const v of folded)
      for (const p of bz.planes)
        expect(new Vector3(...p.normal).dot(v)).toBeLessThanOrEqual(
          p.offset + 1e-9,
        );
  });

  it("only moves points by reciprocal lattice vectors", () => {
    points.forEach((f, i) => {
      const shift = new Vector3(...cart([...f])).sub(folded[i]);
      // shift = n1 b1 + n2 b2 + n3 b3 with integer n
      const n = fromSeekpathJSON({
        b1,
        b2,
        b3,
        explicit_kpoints_abs: [shift.toArray()],
      }).points![0];
      n.forEach((x) => expect(Math.abs(x - Math.round(x))).toBeLessThan(1e-9));
    });
  });
});
