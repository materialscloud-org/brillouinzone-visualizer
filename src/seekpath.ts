import type { KPath, Matrix, Vec3 } from "./types";

/** The JSON produced by seekpath / matsci-parse `getBrillouinZoneData`. */
export interface SeekpathJSON {
  b1: number[];
  b2: number[];
  b3: number[];
  kpoints_rel?: Record<string, number[]>;
  path?: string[][];
  explicit_kpoints_rel?: number[][];
}

export interface KPathData {
  reciprocalBasis: Matrix;
  kpath?: KPath;
  /** Discrete points along the path, fractional coordinates. */
  explicitPoints?: Vec3[];
}

const vec3 = (p: number[]): Vec3 => [p[0], p[1], p[2]];

/**
 * Read the legacy brillouinzone-visualizer input. Only the reciprocal basis
 * and the fractional path are kept; the zone geometry and Cartesian
 * coordinates are recomputed from them.
 */
export function fromSeekpathJSON(json: SeekpathJSON): KPathData {
  const reciprocalBasis: Matrix = {
    rows: 3,
    cols: 3,
    data: Float64Array.from([...json.b1, ...json.b2, ...json.b3]),
  };

  const kpath: KPath | undefined =
    json.kpoints_rel && json.path
      ? {
          kind: "path",
          points: Object.fromEntries(
            Object.entries(json.kpoints_rel).map(([k, p]) => [k, vec3(p)]),
          ),
          segments: json.path.map(([a, b]) => [a, b] as const),
        }
      : undefined;

  return {
    reciprocalBasis,
    kpath,
    explicitPoints: json.explicit_kpoints_rel?.map(vec3),
  };
}
