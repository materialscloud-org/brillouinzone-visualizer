import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Matrix3, Matrix4, Vector3 } from "three";

import { getBrillouinZone, basisVectors } from "../src/brillouinZone";
import { FermiSurface, parseBXSF } from "../src";
import type { FermiSurfaceData, Matrix } from "../src/types";

const BXSF_DIR = "demo/data";

describe("parseBXSF", () => {
  const text = readFileSync(`${BXSF_DIR}/example.bxsf`, "utf8");
  const data = parseBXSF(text);

  it("reads the header", () => {
    expect(data.fermiEnergy).toBe(7.2709);
    expect(data.bands).toHaveLength(5);
    expect(data.bands[0].field).toBe("Band 27");
    // 61 x 61 x 41 general grid -> 60 x 60 x 40 periodic, stored [D, H, W]
    expect(data.bands[0].shape).toEqual([40, 60, 60]);
    expect([...data.reciprocalBasis.data.slice(0, 3)]).toEqual([1, 0.57735, -0]);
  });

  it("reorders to first-axis-fastest", () => {
    // File order: third axis fastest. The first 41 values are i = j = 0, k = 0..40.
    const firstBand = text.slice(text.indexOf("BAND:")).split(/\s+/).slice(2, 2 + 41).map(Number);
    const [, H, W] = data.bands[0].shape;
    for (let k = 0; k < 40; k++) expect(data.bands[0].data[k * H * W]).toBe(firstBand[k]);
    // The dropped endpoint repeats the first point
    expect(firstBand[40]).toBe(firstBand[0]);
  });
});

describe("FermiSurface", () => {
  // Tight-binding band E(f) = -Σ cos(2π f_a) on a sheared (fcc) cell
  const rows = [[-1, 1, 1], [1, -1, 1], [1, 1, -1]];
  const basis: Matrix = { rows: 3, cols: 3, data: Float64Array.from(rows.flat()) };
  const n = 32;
  const band = (f: number[]) => -f.reduce((s, x) => s + Math.cos(2 * Math.PI * x), 0);
  const values = new Float64Array(n * n * n);
  for (let k = 0; k < n; k++)
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) values[(k * n + j) * n + i] = band([i / n, j / n, k / n]);

  const data: FermiSurfaceData = {
    reciprocalBasis: basis,
    fermiEnergy: 0,
    bands: [{ data: values, shape: [n, n, n], channels: 1, basis, origin: [0, 0, 0] }],
  };
  const bz = getBrillouinZone(basis);
  const toFractional = new Matrix3()
    .setFromMatrix4(new Matrix4().makeBasis(...basisVectors(basis)))
    .invert();

  for (const E of [-2, 0, 1.5]) {
    it(`vertices lie on E(k) = ${E} and the zone is covered`, () => {
      const surface = new FermiSurface(data, bz).setEnergy(E);
      const mesh = surface.meshes[0];
      const pos = mesh.geometry.getAttribute("position");
      expect(pos.count).toBeGreaterThan(100);

      const v = new Vector3();
      let maxError = 0;
      let insideZone = 0;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrix);
        if (bz.planes.every((p) => new Vector3(...p.normal).dot(v) <= p.offset + 1e-9)) insideZone++;
        const f = v.clone().applyMatrix3(toFractional).toArray();
        maxError = Math.max(maxError, Math.abs(band(f) - E));
      }
      // Linear interpolation on a 32-point grid: error well below the band width (6)
      expect(maxError).toBeLessThan(0.05);
      // The marched region surrounds the zone, so part of the mesh is clipped away
      expect(insideZone).toBeGreaterThan(0);
      expect(insideZone).toBeLessThan(pos.count);
    });
  }
});
