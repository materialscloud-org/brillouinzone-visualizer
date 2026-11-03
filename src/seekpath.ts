import { kgridPoints, toFractional } from "./kpoints";
import type { KGrid, KPath, Matrix, Vec3 } from "./types";

/**
 * The legacy brillouinzone-visualizer input, as produced by seekpath /
 * matsci-parse `getBrillouinZoneData`, or assembled from an AiiDA
 * KpointsData. Only `b1..b3` is required. For labelled points and explicit
 * points, fractional (`_rel`) coordinates are used when present, Cartesian
 * (`kpoints`, `explicit_kpoints_abs`) otherwise.
 */
export interface SeekpathJSON {
  b1: number[];
  b2: number[];
  b3: number[];
  /** Labelled points, Cartesian. */
  kpoints?: Record<string, number[]>;
  /** Labelled points, fractional. */
  kpoints_rel?: Record<string, number[]>;
  /** Segments between labelled points. */
  path?: string[][];
  explicit_kpoints_abs?: number[][];
  explicit_kpoints_rel?: number[][];
  /** A regular mesh (AiiDA style), used when no explicit points are given. */
  mesh?: number[];
  /** Mesh offset in units of the grid spacing (AiiDA style), e.g. [0.5, 0.5, 0.5]. */
  offset?: number[] | number[][];
}

export interface KPathData {
  reciprocalBasis: Matrix;
  /** Labelled points, plus the path segments when there are any. */
  kpath?: KPath;
  /** Explicit k-points (path sampling, mesh, ...), fractional coordinates. */
  points?: Vec3[];
  /** The mesh the points were generated from, if any. */
  grid?: KGrid;
}

const vec3 = (p: ArrayLike<number>): Vec3 => [p[0], p[1], p[2]];

/** AiiDA mesh + offset (in grid-spacing units) as a matsci-parse KGrid. */
export function kgridFromMesh(
  mesh: number[],
  offset: number[] = [0, 0, 0],
): KGrid {
  const [n1, n2, n3] = mesh;
  const [o1, o2, o3] = offset;
  return {
    kind: "grid",
    mesh: [n1, n2, n3],
    origin: [o1 / n1, o2 / n2, o3 / n3],
    scheme:
      o1 === 0 && o2 === 0 && o3 === 0 ? "gamma-centered" : "monkhorst-pack",
  };
}

/**
 * Read the legacy JSON. The zone geometry is recomputed from `b1..b3`;
 * everything else is converted to fractional coordinates.
 */
export function fromSeekpathJSON(json: SeekpathJSON): KPathData {
  const reciprocalBasis: Matrix = {
    rows: 3,
    cols: 3,
    data: Float64Array.from([...json.b1, ...json.b2, ...json.b3]),
  };
  const fractional = (p: number[]) => toFractional(p, reciprocalBasis);

  const labelled = json.kpoints_rel
    ? Object.entries(json.kpoints_rel).map(([k, p]) => [k, vec3(p)] as const)
    : json.kpoints
      ? Object.entries(json.kpoints).map(
          ([k, p]) => [k, fractional(p)] as const,
        )
      : undefined;
  const kpath: KPath | undefined = labelled?.length
    ? {
        kind: "path",
        points: Object.fromEntries(labelled),
        segments: (json.path ?? []).map(([a, b]) => [a, b] as const),
      }
    : undefined;

  const offset = Array.isArray(json.offset?.[0])
    ? (json.offset[0] as number[])
    : (json.offset as number[] | undefined);
  const grid = json.mesh ? kgridFromMesh(json.mesh, offset) : undefined;
  const points =
    json.explicit_kpoints_rel?.map(vec3) ??
    json.explicit_kpoints_abs?.map(fractional) ??
    (grid ? kgridPoints(grid) : undefined);

  return { reciprocalBasis, kpath, points, grid };
}
