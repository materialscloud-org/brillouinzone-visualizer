import {
  ArrowHelper,
  Color,
  type ColorRepresentation,
  DoubleSide,
  EdgesGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  SphereGeometry,
  Vector3,
} from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

import { basisVectors } from "./brillouinZone";
import { foldIntoBZ, toCartesian } from "./kpoints";
import type { BrillouinZone, KPath, Matrix, Vec3 } from "./types";

/** An HTML label anchored at a 3D position. */
export function label(
  html: string,
  position: Vector3,
  color = "#333",
): CSS2DObject {
  const div = document.createElement("div");
  div.innerHTML = html;
  div.className = "bzv-label";
  div.style.color = color;
  const obj = new CSS2DObject(div);
  obj.position.copy(position);
  // Sit just above-right of the anchor instead of centred on it
  obj.center.set(-0.15, 1.1);
  return obj;
}

/** Thick line segments (pixel width), from a flat xyz pair list. */
export function fatLines(
  positions: ArrayLike<number>,
  color: ColorRepresentation,
  width: number,
) {
  const geometry = new LineSegmentsGeometry().setPositions(
    Array.from(positions),
  );
  return new LineSegments2(
    geometry,
    new LineMaterial({ color, linewidth: width }),
  );
}

const GREEK: Record<string, string> = {
  GAMMA: "Γ",
  DELTA: "Δ",
  SIGMA: "Σ",
  LAMBDA: "Λ",
};

/** Seekpath label to HTML: GAMMA → Γ, X_1 → X<sub>1</sub>. */
export function prettifyLabel(name: string): string {
  return name
    .replace(/GAMMA|DELTA|SIGMA|LAMBDA/gi, (g) => GREEK[g.toUpperCase()])
    .replace(/_(.+)$/, "<sub>$1</sub>");
}

export interface BZObjectOptions {
  color?: ColorRepresentation;
  opacity?: number;
  edgeColor?: ColorRepresentation;
  edgeWidth?: number;
}

/** Transparent zone hull with its edges drawn on top. */
export function brillouinZoneObject(
  bz: BrillouinZone,
  {
    color = 0xd53e4f,
    opacity = 0.15,
    edgeColor = 0x333333,
    edgeWidth = 1.5,
  }: BZObjectOptions = {},
): Group {
  const points: Vector3[] = [];
  for (let i = 0; i < bz.vertices.length; i += 3)
    points.push(new Vector3().fromArray(bz.vertices, i));

  const hull = new ConvexGeometry(points);
  const fill = new Mesh(
    hull,
    new MeshBasicMaterial({
      color,
      opacity,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    }),
  );
  fill.name = "fill";
  const edges = fatLines(
    new EdgesGeometry(hull).getAttribute("position").array,
    edgeColor,
    edgeWidth,
  );
  edges.name = "edges";

  const group = new Group();
  group.name = "brillouinZone";
  group.add(fill, edges);
  return group;
}

export interface VectorsObjectOptions {
  colors?: ColorRepresentation[];
  labels?: string[] | false;
}

/** Arrows for the reciprocal basis vectors b1, b2, b3. */
export function reciprocalVectorsObject(
  reciprocalBasis: Matrix,
  {
    colors = [0x2ca02c, 0x1f77b4, 0xd62728],
    labels = [
      "<b>b</b><sub>1</sub>",
      "<b>b</b><sub>2</sub>",
      "<b>b</b><sub>3</sub>",
    ],
  }: VectorsObjectOptions = {},
): Group {
  const group = new Group();
  group.name = "reciprocalVectors";
  basisVectors(reciprocalBasis).forEach((b, i) => {
    const length = b.length();
    group.add(
      new ArrowHelper(
        b.clone().normalize(),
        new Vector3(),
        length,
        colors[i % colors.length],
        0.1 * length,
        0.05 * length,
      ),
    );
    if (labels)
      group.add(
        label(
          labels[i],
          b.clone().multiplyScalar(1.05),
          `#${new Color(colors[i % colors.length]).getHexString()}`,
        ),
      );
  });
  return group;
}

/** Shaded spheres at `positions`, drawn as one instanced mesh. */
export function sphereInstances(
  positions: Vector3[],
  radius: number,
  color: ColorRepresentation,
) {
  const mesh = new InstancedMesh(
    new SphereGeometry(radius, 16, 12),
    new MeshStandardMaterial({ color, roughness: 0.4 }),
    positions.length,
  );
  const m = new Matrix4();
  positions.forEach((p, i) => mesh.setMatrixAt(i, m.makeTranslation(p)));
  mesh.computeBoundingSphere();
  return mesh;
}

/** Largest reciprocal vector length, the natural scale of a scene. */
const longestVector = (reciprocalBasis: Matrix) =>
  Math.max(...basisVectors(reciprocalBasis).map((b) => b.length()));

export interface KPathObjectOptions {
  color?: ColorRepresentation;
  width?: number;
  pointColor?: ColorRepresentation;
  /** Sphere radius, relative to the longest reciprocal vector. */
  pointRadius?: number;
  labels?: boolean;
}

/** The high-symmetry path: segments and labelled points (segments may be empty). */
export function kpathObject(
  kpath: KPath,
  reciprocalBasis: Matrix,
  {
    color = 0x045add,
    width = 3,
    pointColor = 0x3288bd,
    pointRadius = 0.02,
    labels = true,
  }: KPathObjectOptions = {},
): Group {
  const cartesian = (frac: Vec3) => toCartesian(frac, reciprocalBasis);
  const scale = longestVector(reciprocalBasis);

  const group = new Group();
  group.name = "kpath";

  if (kpath.segments.length) {
    const segmentPoints = kpath.segments.flatMap(([a, b]) => [
      ...cartesian(kpath.points[a]).toArray(),
      ...cartesian(kpath.points[b]).toArray(),
    ]);
    const lines = fatLines(segmentPoints, color, width);
    lines.name = "path";
    group.add(lines);
  }

  const named = Object.entries(kpath.points);
  const points = sphereInstances(
    named.map(([, p]) => cartesian(p)),
    pointRadius * scale,
    pointColor,
  );
  points.name = "points";
  group.add(points);
  if (labels)
    for (const [name, p] of named)
      group.add(label(prettifyLabel(name), cartesian(p), "#555555"));

  return group;
}

export interface KPointsObjectOptions {
  color?: ColorRepresentation;
  /** Sphere radius in reciprocal-space units; defaults to a size suited to the point spacing. */
  radius?: number;
}

/**
 * Explicit k-points (a path sampling, a mesh, an irreducible set), given in
 * fractional coordinates. Holds two copies: "cell", the points as given, and
 * "folded", each moved into the first Brillouin zone; show one or the other.
 */
export function kpointsObject(
  points: readonly Vec3[],
  reciprocalBasis: Matrix,
  { color = 0x883232, radius }: KPointsObjectOptions = {},
): Group {
  const scale = longestVector(reciprocalBasis);
  // Shrink the spheres for dense sets: ~ a quarter of the typical spacing
  const cellVolume = Math.abs(
    basisVectors(reciprocalBasis)[0].dot(
      basisVectors(reciprocalBasis)[1]
        .clone()
        .cross(basisVectors(reciprocalBasis)[2]),
    ),
  );
  const spacing = Math.cbrt(cellVolume / Math.max(points.length, 1));
  const r = radius ?? Math.min(0.009 * scale, 0.22 * spacing);

  const cell = sphereInstances(
    points.map((p) => toCartesian(p, reciprocalBasis)),
    r,
    color,
  );
  cell.name = "cell";
  const folded = sphereInstances(foldIntoBZ(points, reciprocalBasis), r, color);
  folded.name = "folded";
  folded.visible = false;

  const group = new Group();
  group.name = "kpoints";
  group.add(cell, folded);
  return group;
}

/** Cartesian x, y, z axes. */
export function axesObject(
  length: number,
  color: ColorRepresentation = 0x555555,
): Group {
  const group = new Group();
  group.name = "axes";
  const dirs: [Vector3, string][] = [
    [new Vector3(1, 0, 0), "x"],
    [new Vector3(0, 1, 0), "y"],
    [new Vector3(0, 0, 1), "z"],
  ];
  for (const [dir, name] of dirs) {
    group.add(
      new ArrowHelper(
        dir,
        new Vector3(),
        length,
        color,
        length / 10,
        length / 20,
      ),
    );
    group.add(
      label(
        `<i>${name}</i>`,
        dir.clone().multiplyScalar(length * 1.05),
        "#555",
      ),
    );
  }
  return group;
}

/** Free an object's GPU resources and remove its label elements. */
export function disposeObject(object: Object3D) {
  object.traverse((o) => {
    if (o instanceof CSS2DObject) o.element.remove();
    const { geometry, material } = o as Mesh;
    geometry?.dispose();
    for (const m of Array.isArray(material) ? material : [material])
      m?.dispose();
  });
}
