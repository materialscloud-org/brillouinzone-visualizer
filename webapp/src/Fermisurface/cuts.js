// The cut box settings and the cut planes they stand for.

import { basisVectors, getBrillouinZone } from "bz-visualizer";

export const AXES = ["kx", "ky", "kz"];
export const B_VECTORS = ["b₁", "b₂", "b₃"];

/** The default cut: off, along kz, through Γ. */
export const NO_CUT = {
  on: false,
  direction: "kz",
  offset: 0,
  flip: false,
  slab: false,
  thickness: 0.1,
};

/**
 * Turn the box's settings into planes for `setCutPlanes`: one plane (cut
 * away the side the normal points to), or two facing planes keeping a slab.
 */
export function cutPlanes(cut, reciprocalBasis) {
  if (!cut.on) return [];
  const b = basisVectors(reciprocalBasis).map((v) => v.toArray());
  const directions = {
    kx: [1, 0, 0],
    ky: [0, 1, 0],
    kz: [0, 0, 1],
    ...Object.fromEntries(B_VECTORS.map((name, i) => [name, b[i]])),
  };
  const d = directions[cut.direction];
  const length = Math.hypot(...d);
  const n = d.map((x) => ((cut.flip ? -1 : 1) * x) / length);
  const at = (s) => n.map((x) => x * s);
  const offset = cut.flip ? -cut.offset : cut.offset;

  if (!cut.slab) return [{ point: at(offset), normal: n }];
  const half = (cut.thickness * zoneRadius(reciprocalBasis)) / 2;
  return [
    { point: at(offset + half), normal: n },
    { point: at(offset - half), normal: n.map((x) => -x) },
  ];
}

/** The distance from Γ to the farthest zone corner. */
export function zoneRadius(reciprocalBasis) {
  const { vertices } = getBrillouinZone(reciprocalBasis);
  let r = 0;
  for (let i = 0; i < vertices.length; i += 3)
    r = Math.max(r, Math.hypot(vertices[i], vertices[i + 1], vertices[i + 2]));
  return r;
}
