import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Matrix3, Matrix4, Vector3 } from "three";

import { getBrillouinZone, basisVectors } from "../src/brillouinZone";
import { parseBXSF } from "../src";
import { FermiSurface } from "../src/fermi/fermiSurface";
import type { FermiSurfaceData, Matrix } from "../src/types";

const BXSF_DIR = "demo/data";

describe("parseBXSF", () => {
  const text = readFileSync(`${BXSF_DIR}/simple_example.bxsf`, "utf8");
  const data = parseBXSF(text);

  it("reads the header", () => {
    expect(data.fermiEnergy).toBe(7.2709);
    expect(data.bands).toHaveLength(5);
    expect(data.bands[0].field).toBe("Band 27");
    // 61 x 61 x 41 general grid -> 60 x 60 x 40 periodic, stored [D, H, W]
    expect(data.bands[0].shape).toEqual([40, 60, 60]);
    expect([...data.reciprocalBasis.data.slice(0, 3)]).toEqual([
      1, 0.57735, -0,
    ]);
  });

  it("reorders to first-axis-fastest", () => {
    // File order: third axis fastest. The first 41 values are i = j = 0, k = 0..40.
    const firstBand = text
      .slice(text.indexOf("BAND:"))
      .split(/\s+/)
      .slice(2, 2 + 41)
      .map(Number);
    const [, H, W] = data.bands[0].shape;
    for (let k = 0; k < 40; k++)
      expect(data.bands[0].data[k * H * W]).toBe(firstBand[k]);
    // The dropped endpoint repeats the first point
    expect(firstBand[40]).toBe(firstBand[0]);
  });

  it("reads every value exactly as Number() would", () => {
    // Reference: split each band into tokens and convert with Number()
    const [D, H, W] = data.bands[0].shape;
    const [n1, n2, n3] = [W + 1, H + 1, D + 1];
    const blocks = text.split("BAND:").slice(1);
    blocks.forEach((block, b) => {
      const tokens = block.trim().split(/\s+/);
      const band = data.bands[b];
      expect(band.field).toBe(`Band ${tokens[0]}`);
      for (let i = 0; i < W; i++)
        for (let j = 0; j < H; j++)
          for (let k = 0; k < D; k++) {
            const expected = Number(tokens[1 + (i * n2 + j) * n3 + k]);
            const got = band.data[(k * H + j) * W + i];
            if (got !== expected) expect(got).toBe(expected); // fail with values
          }
    });
    expect(n1 * n2 * n3).toBeGreaterThan(0);
  });

  it("rejects a non-number value", () => {
    const at = text.indexOf("BAND:") + 40;
    const broken = text.slice(0, at) + " oops " + text.slice(at);
    expect(() => parseBXSF(broken)).toThrow(/not a number/);
  });

  it("rejects a header without the band count", () => {
    const broken = text.replace(/(BANDGRID_3D_BANDS\s*\n)\s*5\s*\n/, "$1");
    expect(broken).not.toBe(text);
    expect(() => parseBXSF(broken)).toThrow(/band count/);
  });

  it("rejects a truncated file", () => {
    expect(() => parseBXSF(text.slice(0, text.length / 2))).toThrow(
      /truncated|expected/,
    );
  });
});

describe("FermiSurface", () => {
  // Tight-binding band E(f) = -Σ cos(2π f_a) on a sheared (fcc) cell
  const rows = [
    [-1, 1, 1],
    [1, -1, 1],
    [1, 1, -1],
  ];
  const basis: Matrix = {
    rows: 3,
    cols: 3,
    data: Float64Array.from(rows.flat()),
  };
  const n = 32;
  const band = (f: number[]) =>
    -f.reduce((s, x) => s + Math.cos(2 * Math.PI * x), 0);
  const values = new Float64Array(n * n * n);
  for (let k = 0; k < n; k++)
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++)
        values[(k * n + j) * n + i] = band([i / n, j / n, k / n]);

  const data: FermiSurfaceData = {
    reciprocalBasis: basis,
    fermiEnergy: 0,
    bands: [
      { data: values, shape: [n, n, n], channels: 1, basis, origin: [0, 0, 0] },
    ],
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
        if (
          bz.planes.every(
            (p) => new Vector3(...p.normal).dot(v) <= p.offset + 1e-9,
          )
        )
          insideZone++;
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

  it("has a surface exactly when the energy is inside the band's range", () => {
    const surface = new FermiSurface(data, bz);
    const [min, max] = surface.energyRanges[0];
    expect([min, max]).toEqual([Math.min(...values), Math.max(...values)]);
    const triangles = (E: number) =>
      surface.setEnergy(E).meshes[0].geometry.getAttribute("position")?.count ??
      0;
    expect(triangles(min - 0.01)).toBe(0);
    expect(triangles(max + 0.01)).toBe(0);
    expect(triangles(min + 0.05)).toBeGreaterThan(0);
    expect(triangles(max - 0.05)).toBeGreaterThan(0);
  });

  // Vertex count of band 0 and its largest deviation from E(k) = E
  const shown = (surface: FermiSurface, E: number) => {
    const mesh = surface.meshes[0];
    const pos = mesh.geometry.getAttribute("position");
    const v = new Vector3();
    let maxError = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrix);
      const f = v.clone().applyMatrix3(toFractional).toArray();
      maxError = Math.max(maxError, Math.abs(band(f) - E));
    }
    return { count: pos.count, maxError };
  };

  it("previews on every other grid point, on the same surface, uncached", () => {
    const surface = new FermiSurface(data, bz);
    const shownAt = (E: number) => shown(surface, E);

    const full = shownAt(surface.setEnergy(1.2).energy);
    surface.setEnergy(0);
    // A cached energy is shown in full even when a preview is asked for
    expect(shownAt(surface.setEnergy(1.2, true).energy).count).toBe(full.count);

    const preview = surface.setEnergy(0.5, true).meshes[0].geometry;
    let disposed = false;
    preview.addEventListener("dispose", () => (disposed = true));
    const coarse = shownAt(0.5);
    expect(coarse.count).toBeGreaterThan(50);
    // On the same surface, with the error of a grid twice as coarse
    expect(coarse.maxError).toBeLessThan(0.15);

    surface.setEnergy(0.5); // released: the full surface replaces the preview
    expect(disposed).toBe(true);
    expect(shownAt(0.5).count).toBeGreaterThan(coarse.count);
    expect(shownAt(0.5).maxError).toBeLessThan(0.05);
  });

  it("marches other grid steps on the same surface", () => {
    const surface = new FermiSurface(data, bz, {
      gridStep: 2,
      dragGridStep: 4,
    });
    surface.setEnergy(0.5, true);
    const drag = shown(surface, 0.5);
    surface.setEnergy(0.5);
    const settled = shown(surface, 0.5);
    expect(drag.count).toBeGreaterThan(20);
    expect(drag.maxError).toBeLessThan(0.4); // a grid 4× as coarse
    expect(settled.count).toBeGreaterThan(drag.count);
    expect(settled.maxError).toBeLessThan(0.15);
  });

  it("drags at full detail when the steps are equal", () => {
    expect(new FermiSurface(data, bz).dragGridStep).toBe(2); // the default
    // Never finer than the settled surface
    expect(
      new FermiSurface(data, bz, { gridStep: 2, dragGridStep: 1 }).dragGridStep,
    ).toBe(2);

    // A drag marches (and caches) the full surface, so releasing at that
    // energy reuses it
    const surface = new FermiSurface(data, bz, { dragGridStep: 1 });
    const dragged = surface.setEnergy(0.7, true).meshes[0].geometry;
    expect(surface.setEnergy(0.7).meshes[0].geometry).toBe(dragged);
    expect(shown(surface, 0.7).maxError).toBeLessThan(0.05);
  });

  it("is left out of the view framing only while clipped to the zone", () => {
    const surface = new FermiSurface(data, bz);
    expect(surface.userData.excludeFromFit).toBe(true);
    surface.setClipping(false);
    expect(surface.userData.excludeFromFit).toBe(false);
    expect(
      new FermiSurface(data, bz, { clip: false }).userData.excludeFromFit,
    ).toBe(false);
  });

  it("drops the least recently shown energy when the cache is full", () => {
    const surface = new FermiSurface(data, bz, { maxCacheSize: 2 });
    const first = surface.setEnergy(-1).meshes[0].geometry;
    const second = surface.setEnergy(0).meshes[0].geometry;
    let firstDisposed = false;
    let secondDisposed = false;
    first.addEventListener("dispose", () => (firstDisposed = true));
    second.addEventListener("dispose", () => (secondDisposed = true));
    surface.setEnergy(-1); // shown again: now the most recent
    surface.setEnergy(1); // full: drops 0
    expect(firstDisposed).toBe(false);
    expect(secondDisposed).toBe(true);
  });

  it("places band data given in another basis of the same lattice correctly", () => {
    // The same band, written with b1 and b2 swapped
    const swappedRows = [rows[1], rows[0], rows[2]];
    const swapped: Matrix = {
      rows: 3,
      cols: 3,
      data: Float64Array.from(swappedRows.flat()),
    };
    const lopsided = (f: number[]) =>
      -Math.cos(2 * Math.PI * f[0]) - 0.5 * Math.cos(2 * Math.PI * f[1]);
    const values = new Float64Array(n * n * n);
    for (let k = 0; k < n; k++)
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++)
          values[(k * n + j) * n + i] = lopsided([j / n, i / n, k / n]);
    const other: FermiSurfaceData = {
      reciprocalBasis: swapped,
      fermiEnergy: 0,
      bands: [
        {
          data: values,
          shape: [n, n, n],
          channels: 1,
          basis: swapped,
          origin: [0, 0, 0],
        },
      ],
    };
    // The zone comes from the original basis
    const mesh = new FermiSurface(other, bz).setEnergy(0.3).meshes[0];
    const pos = mesh.geometry.getAttribute("position");
    expect(pos.count).toBeGreaterThan(100);
    const v = new Vector3();
    let maxError = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrix);
      const f = v.clone().applyMatrix3(toFractional).toArray();
      maxError = Math.max(maxError, Math.abs(lopsided(f) - 0.3));
    }
    expect(maxError).toBeLessThan(0.05);
  });

  it("cut planes remove the side the normal points to, on top of the zone", () => {
    const surface = new FermiSurface(data, bz, {
      cutPlanes: [{ point: [0, 0, 0.5], normal: [0, 0, 2] }],
    });
    const planes = () => surface.meshes[0].material.clippingPlanes!;
    // three keeps the side where distanceToPoint >= 0
    const cut = planes().at(-1)!;
    expect(cut.distanceToPoint(new Vector3(0, 0, 0))).toBeCloseTo(0.5);
    expect(cut.distanceToPoint(new Vector3(0, 0, 1))).toBeCloseTo(-0.5);
    expect(planes()).toHaveLength(bz.planes.length + 1);

    surface.setClipping(false);
    expect(planes()).toHaveLength(1);
    surface.setCutPlanes([]);
    expect(planes()).toHaveLength(0);
    expect(() =>
      surface.setCutPlanes([{ point: [0, 0, 0], normal: [0, 0, 0] }]),
    ).toThrow();
  });
});
