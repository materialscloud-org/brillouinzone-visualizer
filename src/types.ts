/**
 * Shared data types.
 *
 * `Matrix`, `KPath` and `VolumetricData` are structural copies of the
 * matsci-parse types of the same name, so objects produced by matsci-parse
 * can be passed straight in without this package depending on it.
 */

export type Vec3 = readonly [number, number, number];

/** A matrix backed by a row-major Float64Array (matsci-parse `Matrix`). */
export interface Matrix {
  readonly rows: number;
  readonly cols: number;
  readonly data: Float64Array;
}

/**
 * A path through reciprocal space (matsci-parse `KPath`).
 * `points` are in fractional reciprocal coordinates.
 */
export interface KPath {
  readonly kind: "path";
  readonly points: Readonly<Record<string, Vec3>>;
  readonly segments: readonly (readonly [string, string])[];
  readonly density?: number;
}

/**
 * A regular k-point grid (matsci-parse `KGrid`). Grid index [i, j, k] sits
 * at `origin + [i / n1, j / n2, k / n3]`, fractional reciprocal coordinates.
 */
export interface KGrid {
  readonly kind: "grid";
  readonly mesh: readonly [number, number, number];
  readonly origin: Vec3;
  readonly scheme: "monkhorst-pack" | "gamma-centered";
}

/**
 * Scalar volumetric grid (matsci-parse `VolumetricData`).
 *
 * `shape` is [D, H, W], slowest axis first: voxel (x, y, z) has x ∈ [0, W)
 * fastest. x runs along the first basis row, z along the third. Voxel
 * (x, y, z) sits at `origin + (x / W) a1 + (y / H) a2 + (z / D) a3`, so the
 * basis rows span W × H × D voxel steps.
 */
export interface VolumetricData {
  readonly data: Float64Array;
  readonly shape: [number, number, number];
  readonly channels: number;
  readonly basis?: Matrix;
  readonly origin: [number, number, number];
  readonly field?: string;
  readonly metadata?: Record<string, unknown>;
}

/** A plane `normal · k = offset`; the inside half-space is `normal · k <= offset`. */
export interface Plane {
  readonly normal: Vec3;
  readonly offset: number;
}

/**
 * The first Brillouin zone in Cartesian reciprocal coordinates.
 * Fully determined by `reciprocalBasis`; build it with `getBrillouinZone`.
 */
export interface BrillouinZone {
  /** Rows are b1, b2, b3, in the units of the source (seekpath: Å⁻¹, 2π included). */
  readonly reciprocalBasis: Matrix;
  /** Corner positions, flat xyz. */
  readonly vertices: Float64Array;
  /** One plane per face, unit outward normal. */
  readonly planes: readonly Plane[];
}

/** Band energies on a k-grid, the input for Fermi surfaces. */
export interface FermiSurfaceData {
  /** Rows are b1, b2, b3; everything BZ-related is derived from this. */
  readonly reciprocalBasis: Matrix;
  readonly fermiEnergy: number;
  /**
   * One grid per band; `field` holds the label. Each grid spans one
   * reciprocal cell (`basis` = the reciprocal basis) and repeats periodically.
   */
  readonly bands: readonly VolumetricData[];
  readonly kpath?: KPath;
}
