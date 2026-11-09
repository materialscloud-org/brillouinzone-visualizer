import {
  BufferAttribute,
  BufferGeometry,
  type ColorRepresentation,
  DoubleSide,
  Group,
  Matrix3,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Plane,
  Vector3,
} from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";

import { basisVectors } from "../brillouinZone";
import type {
  BrillouinZone,
  CutPlane,
  FermiSurfaceData,
  Matrix,
  VolumetricData,
} from "../types";

// plotly default palette
const PALETTE = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
];

export interface FermiSurfaceOptions {
  colors?: ColorRepresentation[];
  opacity?: number;
  /** Clip the surfaces to the zone (GPU clipping planes). */
  clip?: boolean;
  /** Extra planes to cut the surfaces with (see `CutPlane`). */
  cutPlanes?: readonly CutPlane[];
  /** Energies are cached after rounding to this many decimals. */
  cachePrecision?: number;
  /** Energies kept in the cache; the least recently shown are dropped (default 16). */
  maxCacheSize?: number;
}

/**
 * The cubic marching-cubes field covering the zone, sampled straight from
 * the periodic band grid (no resampling), and the matrix that maps the
 * field's local [-1, 1]³ space to Cartesian k. The grid is laid out along
 * its own basis, which may differ from the one the zone was built from.
 */
function zoneSampling(bz: BrillouinZone, grid: VolumetricData, basis: Matrix) {
  const [D, H, W] = grid.shape;
  const n = [W, H, D];
  const [b1, b2, b3] = basisVectors(basis);
  const origin = new Vector3(...grid.origin);
  const toFractional = new Matrix3()
    .setFromMatrix4(new Matrix4().makeBasis(b1, b2, b3))
    .invert();

  // Lattice index range (per axis) covering every zone corner, plus a margin
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  const v = new Vector3();
  for (let i = 0; i < bz.vertices.length; i += 3) {
    v.fromArray(bz.vertices, i).sub(origin).applyMatrix3(toFractional);
    v.toArray().forEach((f, a) => {
      lo[a] = Math.min(lo[a], Math.floor(f * n[a]) - 1);
      hi[a] = Math.max(hi[a], Math.ceil(f * n[a]) + 1);
    });
  }
  // MarchingCubes marches points 1..size-2 and needs one more layer on
  // each side for its normals; field point p is lattice point lo - 1 + p.
  const size = Math.max(...hi.map((h, a) => h - lo[a] + 1)) + 2;
  const start = lo.map((l) => l - 1);

  // Field point p ↔ local (p - size/2) / (size/2) ↔ k = origin + Σ (start + p) / n · b
  const half = size / 2;
  const [c1, c2, c3] = [b1, b2, b3].map((b, a) =>
    b.clone().multiplyScalar(half / n[a]),
  );
  const offset = origin.clone();
  [b1, b2, b3].forEach((b, a) =>
    offset.addScaledVector(b, (start[a] + half) / n[a]),
  );
  const matrix = new Matrix4().makeBasis(c1, c2, c3).setPosition(offset);

  const fill = (band: VolumetricData): Float32Array => {
    const field = new Float32Array(size * size * size);
    const mod = (i: number, m: number) => ((i % m) + m) % m;
    const xs = Int32Array.from({ length: size }, (_, p) =>
      mod(start[0] + p, W),
    );
    const ys = Int32Array.from(
      { length: size },
      (_, p) => mod(start[1] + p, H) * W,
    );
    const zs = Int32Array.from(
      { length: size },
      (_, p) => mod(start[2] + p, D) * W * H,
    );
    let q = 0;
    for (let z = 0; z < size; z++)
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          field[q++] = band.data[zs[z] + ys[y] + xs[x]];
    return field;
  };

  return { size, matrix, fill };
}

/**
 * Isosurfaces E(k) = E of every band, clipped to the first zone.
 * Meshing is done by three's MarchingCubes; the reciprocal basis (which may
 * be sheared) is applied as the mesh matrix.
 */
export class FermiSurface extends Group {
  readonly meshes: Mesh<BufferGeometry, MeshStandardMaterial>[];
  energy = NaN;

  private readonly sampling: ReturnType<typeof zoneSampling>;
  private readonly fields: (Float32Array | undefined)[];
  private readonly ranges: [number, number][];
  private readonly cache = new Map<string, BufferGeometry[]>();
  private readonly cachePrecision: number;
  private readonly maxCacheSize: number;
  private readonly zonePlanes: Plane[];
  private clipToZone: boolean;
  private cutPlanes: Plane[] = [];
  private mc: MarchingCubes;
  private maxPolyCount: number;

  constructor(
    readonly data: FermiSurfaceData,
    readonly bz: BrillouinZone,
    {
      colors = PALETTE,
      opacity = 1,
      clip = true,
      cutPlanes = [],
      cachePrecision = 3,
      maxCacheSize = 128,
    }: FermiSurfaceOptions = {},
  ) {
    super();
    this.name = "fermiSurface";
    this.cachePrecision = cachePrecision;
    this.maxCacheSize = Math.max(1, maxCacheSize); // never drop the one on screen
    this.sampling = zoneSampling(bz, data.bands[0], data.reciprocalBasis);
    this.fields = data.bands.map(() => undefined);
    this.ranges = data.bands.map((b) => {
      let min = Infinity;
      let max = -Infinity;
      for (const e of b.data) {
        if (e < min) min = e;
        if (e > max) max = e;
      }
      return [min, max];
    });

    const { size, matrix } = this.sampling;
    this.maxPolyCount = 16 * size * size;
    this.mc = new MarchingCubes(
      size,
      new MeshStandardMaterial(),
      false,
      false,
      this.maxPolyCount,
    );

    // three keeps the side a plane's normal points to, so flip ours
    this.zonePlanes = bz.planes.map(
      (p) => new Plane(new Vector3(...p.normal).negate(), p.offset),
    );
    this.clipToZone = clip;

    this.meshes = data.bands.map((band, i) => {
      const mesh = new Mesh(
        new BufferGeometry(),
        new MeshStandardMaterial({
          color: colors[i % colors.length],
          opacity,
          transparent: opacity < 1,
          side: DoubleSide,
          roughness: 0.45,
          metalness: 0.05,
        }),
      );
      mesh.name = band.field ?? `Band ${i + 1}`;
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(matrix);
      return mesh;
    });
    this.add(...this.meshes);
    this.setCutPlanes(cutPlanes);
  }

  /** Clip the surfaces to the zone, or show the whole marched region. */
  setClipping(on: boolean): this {
    this.clipToZone = on;
    return this.updateClipping();
  }

  /** Replace the cut planes (`[]` removes them). */
  setCutPlanes(planes: readonly CutPlane[]): this {
    this.cutPlanes = planes.map(({ point, normal }) => {
      const n = new Vector3(...normal);
      if (n.lengthSq() === 0) throw new Error("Cut plane: zero normal");
      return new Plane().setFromNormalAndCoplanarPoint(
        n.normalize().negate(),
        new Vector3(...point),
      );
    });
    return this.updateClipping();
  }

  private updateClipping(): this {
    const planes = [
      ...(this.clipToZone ? this.zonePlanes : []),
      ...this.cutPlanes,
    ];
    for (const mesh of this.meshes) {
      mesh.material.clippingPlanes = planes;
      mesh.material.needsUpdate = true;
    }
    return this;
  }

  /** Show the isosurfaces at energy `E` (same units as the band data). */
  setEnergy(E: number): this {
    const key = E.toFixed(this.cachePrecision);
    let geometries = this.cache.get(key);
    if (!geometries)
      geometries = this.data.bands.map((_, i) => this.march(i, Number(key)));
    // Re-insert so the Map's order is least recently shown first
    this.cache.delete(key);
    this.cache.set(key, geometries);
    for (const [old, dropped] of this.cache) {
      if (this.cache.size <= this.maxCacheSize) break;
      this.cache.delete(old);
      dropped.forEach((g) => g.dispose());
    }
    this.meshes.forEach((mesh, i) => (mesh.geometry = geometries[i]));
    this.energy = Number(key);
    return this;
  }

  private march(bandIndex: number, E: number): BufferGeometry {
    const geometry = new BufferGeometry();
    const [min, max] = this.ranges[bandIndex];
    if (E < min || E > max) return geometry;

    const field = (this.fields[bandIndex] ??= this.sampling.fill(
      this.data.bands[bandIndex],
    ));
    for (;;) {
      const mc = this.mc;
      mc.field = field;
      mc.normal_cache.fill(0);
      mc.isolation = E;
      mc.update();
      if (mc.count / 3 <= this.maxPolyCount) break;
      // The fixed-size output buffers overflowed: grow and retry
      this.maxPolyCount *= 2;
      this.mc = new MarchingCubes(
        this.sampling.size,
        mc.material as MeshStandardMaterial,
        false,
        false,
        this.maxPolyCount,
      );
    }

    const n = this.mc.count * 3;
    geometry.setAttribute(
      "position",
      new BufferAttribute(this.mc.positionArray.slice(0, n), 3),
    );
    geometry.setAttribute(
      "normal",
      new BufferAttribute(this.mc.normalArray.slice(0, n), 3),
    );
    geometry.computeBoundingSphere();
    return geometry;
  }

  dispose() {
    for (const geometries of this.cache.values())
      geometries.forEach((g) => g.dispose());
    this.cache.clear();
    this.meshes.forEach((m) => m.material.dispose());
    this.mc.geometry.dispose();
  }
}
