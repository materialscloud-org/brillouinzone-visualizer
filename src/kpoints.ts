import { Matrix3, Matrix4, Vector3 } from "three";

import { basisVectors } from "./brillouinZone";
import type { KGrid, Matrix, Vec3 } from "./types";

/** Every point of a regular grid, first index fastest (as matsci-parse `sampleGrid`). */
export function kgridPoints({
  mesh: [n1, n2, n3],
  origin: [o1, o2, o3],
}: KGrid): Vec3[] {
  const points: Vec3[] = [];
  for (let k = 0; k < n3; k++)
    for (let j = 0; j < n2; j++)
      for (let i = 0; i < n1; i++)
        points.push([o1 + i / n1, o2 + j / n2, o3 + k / n3]);
  return points;
}

/** Fractional → Cartesian: k = f · B, with the reciprocal basis rows b1, b2, b3. */
export function toCartesian(frac: Vec3, reciprocalBasis: Matrix): Vector3 {
  return new Vector3(...frac).applyMatrix4(
    new Matrix4().makeBasis(...basisVectors(reciprocalBasis)),
  );
}

/** Cartesian → fractional, the inverse of `toCartesian`. */
export function toFractional(
  cart: ArrayLike<number>,
  reciprocalBasis: Matrix,
): Vec3 {
  const inverse = new Matrix3()
    .setFromMatrix4(new Matrix4().makeBasis(...basisVectors(reciprocalBasis)))
    .invert();
  return new Vector3(cart[0], cart[1], cart[2]).applyMatrix3(inverse).toArray();
}

/**
 * Move each point (fractional) by the reciprocal lattice vector that brings
 * it closest to Γ, i.e. into the first Brillouin zone. Returns Cartesian
 * positions. Points on a zone face keep one of their equivalent images.
 */
export function foldIntoBZ(
  points: readonly Vec3[],
  reciprocalBasis: Matrix,
): Vector3[] {
  const basis = new Matrix4().makeBasis(...basisVectors(reciprocalBasis));
  // Candidate shifts around the rounded image; enough for a reduced basis
  const shifts: Vector3[] = [];
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++)
        shifts.push(new Vector3(i, j, k).applyMatrix4(basis));

  return points.map((f) => {
    const centred = new Vector3(
      ...f.map((x) => x - Math.round(x)),
    ).applyMatrix4(basis);
    let best = centred;
    let bestLength = centred.lengthSq();
    for (const g of shifts) {
      const candidate = centred.clone().sub(g);
      const length = candidate.lengthSq();
      if (length < bestLength - 1e-12) {
        best = candidate;
        bestLength = length;
      }
    }
    return best;
  });
}
