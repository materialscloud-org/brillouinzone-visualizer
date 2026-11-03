import { Matrix3, Matrix4, Vector3 } from "three";
import type { BrillouinZone, Matrix, Plane } from "./types";

/** The three rows of a 3x3 matrix as vectors. */
export function basisVectors(m: Matrix): [Vector3, Vector3, Vector3] {
  const d = m.data;
  return [
    new Vector3(d[0], d[1], d[2]),
    new Vector3(d[3], d[4], d[5]),
    new Vector3(d[6], d[7], d[8]),
  ];
}

/**
 * Compute the first Brillouin zone (the Wigner–Seitz cell of the reciprocal
 * lattice) from the reciprocal basis, rows b1, b2, b3.
 *
 * Each face lies on the perpendicular bisector of a short G-vector, so the
 * corners are the triple intersections of those planes that lie inside all
 * of them. Rendering (hull, edges) is left to three's ConvexGeometry.
 */
export function getBrillouinZone(
  reciprocalBasis: Matrix,
  { supercellSize = 3, maxPlanes = 40 } = {},
): BrillouinZone {
  const [b1, b2, b3] = basisVectors(reciprocalBasis);

  // Shortest G-vector per direction, as bisector planes n · k = |G| / 2
  const shortest = new Map<string, Vector3>();
  const n = supercellSize;
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      for (let k = -n; k <= n; k++) {
        if (i === 0 && j === 0 && k === 0) continue;
        const g = b1.clone().multiplyScalar(i)
          .addScaledVector(b2, j)
          .addScaledVector(b3, k);
        const dir = g.clone().normalize();
        const key = dir.toArray().map((x) => Math.round(x * 1e6)).join();
        const best = shortest.get(key);
        if (!best || g.lengthSq() < best.lengthSq()) shortest.set(key, g);
      }
    }
  }
  const candidates = [...shortest.values()]
    .sort((a, b) => a.lengthSq() - b.lengthSq())
    .slice(0, maxPlanes)
    .map((g) => ({ normal: g.clone().normalize(), offset: g.length() / 2 }));

  const tol = 1e-6 * candidates[0].offset;
  const inside = (v: Vector3) =>
    candidates.every((p) => p.normal.dot(v) <= p.offset + tol);

  // Corners: triple intersections inside every half-space
  const corners = new Map<string, Vector3>();
  const m = new Matrix3();
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      for (let k = j + 1; k < candidates.length; k++) {
        const [p, q, r] = [candidates[i], candidates[j], candidates[k]];
        m.set(...p.normal.toArray(), ...q.normal.toArray(), ...r.normal.toArray());
        if (Math.abs(m.determinant()) < 1e-9) continue;
        const v = new Vector3(p.offset, q.offset, r.offset).applyMatrix3(m.invert());
        if (!inside(v)) continue;
        const key = v.toArray().map((x) => Math.round(x / tol)).join();
        if (!corners.has(key)) corners.set(key, v);
      }
    }
  }
  const vertices = [...corners.values()];

  // Face planes: the candidates that actually touch the zone
  const planes: Plane[] = candidates
    .filter(
      (p) =>
        vertices.filter((v) => Math.abs(p.normal.dot(v) - p.offset) < tol)
          .length >= 3,
    )
    .map((p) => ({
      normal: p.normal.toArray() as [number, number, number],
      offset: p.offset,
    }));

  return {
    reciprocalBasis,
    vertices: Float64Array.from(vertices.flatMap((v) => v.toArray())),
    planes,
  };
}

/** True if both bases generate the same lattice (B_a = U B_b, U unimodular). */
export function sameLattice(a: Matrix, b: Matrix, tolerance = 1e-3): boolean {
  const toMatrix3 = (m: Matrix) =>
    new Matrix3().setFromMatrix4(new Matrix4().makeBasis(...basisVectors(m)));
  // Columns are the basis vectors here, so U^T = Mb^-1 Ma
  const u = toMatrix3(b).invert().multiply(toMatrix3(a));
  return (
    u.elements.every((x) => Math.abs(x - Math.round(x)) < tolerance) &&
    Math.abs(Math.abs(u.determinant()) - 1) < tolerance
  );
}
