import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";

import { getBrillouinZone, sameLattice } from "../src/brillouinZone";
import type { Matrix } from "../src/types";

const basis = (rows: number[][]): Matrix => ({
  rows: 3,
  cols: 3,
  data: Float64Array.from(rows.flat()),
});

function volume(vertices: Float64Array): number {
  const points: Vector3[] = [];
  for (let i = 0; i < vertices.length; i += 3)
    points.push(new Vector3().fromArray(vertices, i));
  const pos = new ConvexGeometry(points).getAttribute("position");
  let v = 0;
  const [a, b, c] = [new Vector3(), new Vector3(), new Vector3()];
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    v += a.dot(b.cross(c)) / 6;
  }
  return Math.abs(v);
}

const det = (m: Matrix) =>
  new Vector3(...m.data.slice(0, 3)).dot(
    new Vector3(...m.data.slice(3, 6)).cross(
      new Vector3(...m.data.slice(6, 9)),
    ),
  );

describe("getBrillouinZone", () => {
  const cases: [string, number[][], number, number][] = [
    [
      "simple cubic",
      [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      8,
      6,
    ],
    [
      "fcc lattice (bcc-like reciprocal)",
      [
        [-1, 1, 1],
        [1, -1, 1],
        [1, 1, -1],
      ],
      24,
      14,
    ],
    [
      "hexagonal",
      [
        [1, 0.57735, 0],
        [0, 1.154701, 0],
        [0, 0, 0.632187],
      ],
      12,
      8,
    ],
  ];

  for (const [name, rows, nVertices, nPlanes] of cases) {
    it(`${name}: corners, faces and volume`, () => {
      const b = basis(rows);
      const bz = getBrillouinZone(b);
      expect(bz.vertices.length / 3).toBe(nVertices);
      expect(bz.planes.length).toBe(nPlanes);
      // The zone is a primitive cell of the reciprocal lattice
      expect(volume(bz.vertices)).toBeCloseTo(Math.abs(det(b)), 6);
    });
  }

  it("matches the zone shipped in the legacy Fermi JSON", () => {
    const legacy = JSON.parse(
      readFileSync(
        "legacy/fermisurface-visualiser/fermisurface-vis/public/data.json",
        "utf8",
      ),
    ).brillouinZone;
    const bz = getBrillouinZone(basis(legacy.reciprocalVectors));
    const key = (v: number[]) => v.map((x) => x.toFixed(4)).join();
    const ours = new Set<string>();
    for (let i = 0; i < bz.vertices.length; i += 3)
      ours.add(key([...bz.vertices.slice(i, i + 3)]));
    expect(ours).toEqual(new Set(legacy.vertices.map(key)));
  });
});

describe("sameLattice", () => {
  const fcc = basis([
    [-1, 1, 1],
    [1, -1, 1],
    [1, 1, -1],
  ]);
  it("accepts a different basis of the same lattice", () => {
    // b1' = b1 + b2, b2' = b2, b3' = -b3
    expect(
      sameLattice(
        basis([
          [0, 0, 2],
          [1, -1, 1],
          [-1, -1, 1],
        ]),
        fcc,
      ),
    ).toBe(true);
  });
  it("rejects a scaled or rotated lattice", () => {
    expect(
      sameLattice(
        basis([
          [-2, 2, 2],
          [2, -2, 2],
          [2, 2, -2],
        ]),
        fcc,
      ),
    ).toBe(false);
    // 30° about z (90° would be a cubic symmetry, i.e. the same lattice)
    const [c, s] = [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)];
    const rotated = [
      [-1, 1, 1],
      [1, -1, 1],
      [1, 1, -1],
    ].map(([x, y, z]) => [c * x - s * y, s * x + c * y, z]);
    expect(sameLattice(basis(rotated), fcc)).toBe(false);
  });
});
