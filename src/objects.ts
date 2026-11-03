import {
  ArrowHelper,
  BufferGeometry,
  Color,
  type ColorRepresentation,
  DoubleSide,
  EdgesGeometry,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

import { basisVectors } from "./brillouinZone";
import type { BrillouinZone, KPath, Matrix, Vec3 } from "./types";

/** An HTML label anchored at a 3D position. */
export function label(html: string, position: Vector3, color = "#333"): CSS2DObject {
  const div = document.createElement("div");
  div.innerHTML = html;
  Object.assign(div.style, {
    color,
    font: "13px 'Helvetica Neue', Helvetica, Arial, sans-serif",
    userSelect: "none",
  });
  const obj = new CSS2DObject(div);
  obj.position.copy(position);
  return obj;
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
}

/** Transparent zone hull with its edges drawn on top. */
export function brillouinZoneObject(
  bz: BrillouinZone,
  { color = 0xd53e4f, opacity = 0.12, edgeColor = 0x333333 }: BZObjectOptions = {},
): Group {
  const points: Vector3[] = [];
  for (let i = 0; i < bz.vertices.length; i += 3)
    points.push(new Vector3().fromArray(bz.vertices, i));

  const hull = new ConvexGeometry(points);
  const group = new Group();
  group.name = "brillouinZone";
  group.add(
    new Mesh(
      hull,
      new MeshBasicMaterial({
        color,
        opacity,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    ),
    new LineSegments(
      new EdgesGeometry(hull),
      new LineBasicMaterial({ color: edgeColor }),
    ),
  );
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
    labels = ["<b>b</b><sub>1</sub>", "<b>b</b><sub>2</sub>", "<b>b</b><sub>3</sub>"],
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
        label(labels[i], b.clone().multiplyScalar(1.05), `#${new Color(colors[i % colors.length]).getHexString()}`),
      );
  });
  return group;
}

export interface KPathObjectOptions {
  color?: ColorRepresentation;
  pointColor?: ColorRepresentation;
  /** Sphere radius, relative to the longest reciprocal vector. */
  pointRadius?: number;
  labels?: boolean;
  /** Discrete points along the path (fractional), drawn as small spheres. */
  explicitPoints?: readonly Vec3[];
}

/** The high-symmetry path: segments, labelled points, optional sample points. */
export function kpathObject(
  kpath: KPath,
  reciprocalBasis: Matrix,
  {
    color = 0x045add,
    pointColor = 0x3288bd,
    pointRadius = 0.02,
    labels = true,
    explicitPoints,
  }: KPathObjectOptions = {},
): Group {
  const basis = new Matrix4().makeBasis(...basisVectors(reciprocalBasis));
  const toCartesian = (frac: Vec3) => new Vector3(...frac).applyMatrix4(basis);
  const scale = Math.max(...basisVectors(reciprocalBasis).map((b) => b.length()));

  const group = new Group();
  group.name = "kpath";

  const segmentPoints = kpath.segments.flatMap(([a, b]) => [
    toCartesian(kpath.points[a]),
    toCartesian(kpath.points[b]),
  ]);
  group.add(
    new LineSegments(
      new BufferGeometry().setFromPoints(segmentPoints),
      new LineBasicMaterial({ color }),
    ),
  );

  const spheres = (positions: Vector3[], radius: number, c: ColorRepresentation) => {
    const mesh = new InstancedMesh(
      new SphereGeometry(radius, 16, 12),
      new MeshBasicMaterial({ color: c }),
      positions.length,
    );
    positions.forEach((p, i) =>
      mesh.setMatrixAt(i, new Matrix4().makeTranslation(p)),
    );
    mesh.computeBoundingSphere();
    return mesh;
  };

  const named = Object.entries(kpath.points);
  group.add(spheres(named.map(([, p]) => toCartesian(p)), pointRadius * scale, pointColor));
  if (labels)
    for (const [name, p] of named)
      group.add(label(prettifyLabel(name), toCartesian(p)));

  if (explicitPoints?.length)
    group.add(spheres(explicitPoints.map(toCartesian), 0.5 * pointRadius * scale, 0x883232));

  return group;
}

/** Cartesian x, y, z axes. */
export function axesObject(length: number, color: ColorRepresentation = 0x555555): Group {
  const group = new Group();
  group.name = "axes";
  const dirs: [Vector3, string][] = [
    [new Vector3(1, 0, 0), "x"],
    [new Vector3(0, 1, 0), "y"],
    [new Vector3(0, 0, 1), "z"],
  ];
  for (const [dir, name] of dirs) {
    group.add(new ArrowHelper(dir, new Vector3(), length, color, length / 10, length / 20));
    group.add(label(`<i>${name}</i>`, dir.clone().multiplyScalar(length * 1.05), "#555"));
  }
  return group;
}
