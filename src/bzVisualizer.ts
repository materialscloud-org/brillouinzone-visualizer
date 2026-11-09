import {
  Color,
  type ColorRepresentation,
  type Material,
  type Mesh,
  type Object3D,
} from "three";

import { Viewer, type ViewerOptions } from "./viewer";
import { basisVectors, getBrillouinZone, sameLattice } from "./brillouinZone";
import {
  axesObject,
  brillouinZoneObject,
  disposeObject,
  kpathObject,
  kpointsObject,
  reciprocalVectorsObject,
} from "./objects";
import { fromSeekpathJSON, type SeekpathJSON } from "./seekpath";
import type {
  BrillouinZone,
  CutPlane,
  FermiSurfaceData,
  Matrix,
} from "./types";
import { el } from "./ui/elements";
import { buildControls, type ControlsOptions } from "./ui/controls";
import { FermiSurface, type FermiSurfaceOptions } from "./fermi/fermiSurface";

/** Layer colours; anything left out keeps its default. */
export interface BZColors {
  zone?: ColorRepresentation;
  zoneEdges?: ColorRepresentation;
  kpath?: ColorRepresentation;
  highSymmetryPoints?: ColorRepresentation;
  kpoints?: ColorRepresentation;
}

// Where each colour goes: [layer, part] for `setColor`
const COLOR_TARGETS: Record<keyof BZColors, [string, string]> = {
  zone: ["bz", "fill"],
  zoneEdges: ["bz", "edges"],
  kpath: ["kpath", "path"],
  highSymmetryPoints: ["kpath", "points"],
  kpoints: ["kpoints", ""],
};

/** The options a live widget can change with `setOptions`; anything left out stays. */
export interface BZLiveOptions {
  showAxes?: boolean;
  showBVectors?: boolean;
  showKPath?: boolean;
  showKPoints?: boolean;
  /** Legacy name for `showKPoints`. */
  showPathpoints?: boolean;
  foldKPoints?: boolean;
  showLabels?: boolean;
  colors?: BZColors;
  energy?: number;
  cutPlanes?: readonly CutPlane[];
}

export interface BZVisualizerOptions extends ViewerOptions, ControlsOptions {
  /**
   * Show the built-in control bar and settings panel (default true). Set to
   * false to build your own from the getters, setters and "statechange".
   */
  controls?: boolean;
  showAxes?: boolean;
  showBVectors?: boolean;
  showKPath?: boolean;
  /** Show the explicit k-points (path sampling or mesh). */
  showKPoints?: boolean;
  /** Legacy name for `showKPoints`. */
  showPathpoints?: boolean;
  /** Show the k-points moved into the first zone instead of as given. */
  foldKPoints?: boolean;
  showLabels?: boolean;
  /** Initial colours; change them later with `setColor`. */
  colors?: BZColors;
  /** Band grids (e.g. from `parseBXSF`); adds Fermi surfaces to the zone. */
  fermi?: FermiSurfaceData;
  fermiOptions?: FermiSurfaceOptions;
  /** Initial isosurface energy; defaults to the Fermi energy. */
  energy?: number;
}

/**
 * One component for both use cases: the Brillouin zone with the seekpath
 * k-path, plus Fermi surfaces when band data is given.
 *
 * Layout follows mc-react-structure-visualizer: the 3D window on top
 * ("Click to interact"), a control box below (see `buildControls`).
 *
 * Every change of state fires a "statechange" event on `element`.
 */
export class BZVisualizer {
  readonly element: HTMLDivElement;
  readonly viewer: Viewer;
  readonly reciprocalBasis: Matrix;
  readonly bz: BrillouinZone;

  private readonly layers: Record<string, Object3D | undefined> = {};
  private readonly cleanups: (() => void)[] = [];
  // Settings, kept so that replaced layers (`setSeekpath`, `setFermi`) look the same
  private readonly visibility: Record<string, boolean> = {};
  private readonly colorChoices = new Map<string, ColorRepresentation>();
  private readonly opacityChoices = new Map<string, number>();
  private foldedState = false;
  private labelsState = true;
  private surface?: FermiSurface;
  private readonly fermiOptions: FermiSurfaceOptions;
  private clipToZone: boolean;
  private cutPlanes: readonly CutPlane[];

  constructor(
    container: HTMLElement,
    seekpath?: SeekpathJSON,
    {
      controls = true,
      fermi,
      fermiOptions,
      energy,
      energyRange,
      energyStep,
      showAxes = !fermi,
      showBVectors = !fermi,
      showKPath = true,
      showPathpoints = false,
      showKPoints = showPathpoints,
      foldKPoints = false,
      showLabels = true,
      colors = {},
      ...viewerOptions
    }: BZVisualizerOptions = {},
  ) {
    const path = seekpath ? fromSeekpathJSON(seekpath) : undefined;
    // The surfaces must sit on their own grid, so band data defines the zone
    const basis = fermi?.reciprocalBasis ?? path?.reciprocalBasis;
    if (!basis)
      throw new Error("BZVisualizer needs seekpath data, Fermi data, or both");
    if (
      fermi &&
      path &&
      !sameLattice(fermi.reciprocalBasis, path.reciprocalBasis)
    )
      console.warn(
        "BZVisualizer: the seekpath and Fermi-surface reciprocal lattices differ " +
          "(units, orientation or cell); the k-path will not line up with the surfaces.",
      );
    this.reciprocalBasis = basis;
    this.bz = getBrillouinZone(basis);
    this.fermiOptions = fermiOptions ?? {};
    this.clipToZone = this.fermiOptions.clip ?? true;
    this.cutPlanes = this.fermiOptions.cutPlanes ?? [];

    // --- DOM ---------------------------------------------------------------
    const windowEl = el("div", "bzv-window");
    const controlBar = el("div", "bzv-controls");
    this.element = el("div", "bzv", [windowEl]);
    container.appendChild(this.element);
    this.viewer = new Viewer(windowEl, viewerOptions);

    const note = el("div", "bzv-note", ["Click to interact"]);
    note.addEventListener("click", () =>
      this.viewer.setInteractive(!this.viewer.isInteractive),
    );
    // Clicking the note should not also switch on interaction with the scene
    note.addEventListener("mousedown", (e) => e.stopPropagation());
    const syncNote = () =>
      note.classList.toggle("on", this.viewer.isInteractive);
    windowEl.addEventListener("interactivechange", syncNote);
    syncNote();
    // The controls float over the 3D window
    windowEl.append(note, ...(controls ? [controlBar] : []));

    // --- scene -------------------------------------------------------------
    const longest = Math.max(...basisVectors(basis).map((b) => b.length()));
    this.layers.bz = brillouinZoneObject(this.bz, {
      opacity: fermi ? 0.08 : 0.18,
    });
    this.layers.vectors = reciprocalVectorsObject(basis);
    this.layers.axes = axesObject(longest * 1.4);
    for (const layer of Object.values(this.layers))
      if (layer) this.viewer.add(layer);
    this.setPathLayers(path);
    this.setFermiLayer(fermi, energy);
    this.setOptions({
      showAxes,
      showBVectors,
      showKPath,
      showKPoints,
      foldKPoints,
      showLabels,
      colors,
    });
    this.viewer.fit();

    if (controls)
      this.cleanups.push(
        buildControls(this, controlBar, { energyRange, energyStep }),
      );
  }

  /** Change several live options at once; anything left out stays as it is. */
  setOptions(options: BZLiveOptions): this {
    const {
      showKPoints = options.showPathpoints,
      foldKPoints,
      showLabels,
      colors = {},
      energy,
      cutPlanes,
    } = options;
    const layers = {
      axes: options.showAxes,
      vectors: options.showBVectors,
      kpath: options.showKPath,
      kpoints: showKPoints,
    };
    for (const [layer, on] of Object.entries(layers))
      if (on !== undefined) this.setVisible(layer, on);
    if (foldKPoints !== undefined) this.setFolded(foldKPoints);
    if (showLabels !== undefined) this.setLabels(showLabels);
    for (const [key, color] of Object.entries(colors)) {
      const [layer, part] = COLOR_TARGETS[key as keyof BZColors] ?? [];
      if (layer && color != null) this.setColor(layer, color, part);
    }
    if (energy !== undefined) this.setEnergy(energy);
    if (cutPlanes) this.setCutPlanes(cutPlanes);
    return this;
  }

  /**
   * A scene layer: "bz", "vectors", "axes", "kpath", "kpoints", "fermi", or
   * a band as "band:<index>". Undefined if there is no such layer.
   */
  getLayer(layer: string): Object3D | undefined {
    const band = /^band:(\d+)$/.exec(layer);
    return band ? this.surface?.meshes[Number(band[1])] : this.layers[layer];
  }

  /** Show or hide a layer (see `getLayer`). */
  setVisible(layer: string, visible: boolean): this {
    const object = this.getLayer(layer);
    if (object) object.visible = visible;
    this.visibility[layer] = visible;
    return this.changed();
  }

  isVisible(layer: string): boolean {
    return this.getLayer(layer)?.visible ?? false;
  }

  /** The Fermi surfaces, if there is band data. */
  get fermiSurface(): FermiSurface | undefined {
    return this.surface;
  }

  /**
   * Replace (or add, or remove) the Fermi surfaces in place; the zone,
   * camera and settings stay, and the energy keeps its offset from the
   * Fermi energy. Another basis of the same lattice is fine; for a new
   * lattice the zone stays as it is, so build a new BZVisualizer instead.
   */
  setFermi(fermi?: FermiSurfaceData): this {
    if (fermi && !sameLattice(fermi.reciprocalBasis, this.reciprocalBasis))
      console.warn(
        "BZVisualizer.setFermi: the lattice changed; the surfaces will not match " +
          "the zone. Create a new BZVisualizer for a new lattice.",
      );
    const old = this.surface;
    const offset = old ? old.energy - old.data.fermiEnergy : 0;
    this.setFermiLayer(fermi, fermi && fermi.fermiEnergy + offset);
    return this.changed();
  }

  private setFermiLayer(fermi?: FermiSurfaceData, energy?: number) {
    if (this.surface) {
      this.viewer.content.remove(this.surface);
      this.surface.dispose();
      this.surface = undefined;
      delete this.layers.fermi;
    }
    if (!fermi) return;
    this.surface = new FermiSurface(fermi, this.bz, {
      ...this.fermiOptions,
      clip: this.clipToZone,
      cutPlanes: this.cutPlanes,
    }).setEnergy(energy ?? fermi.fermiEnergy);
    this.layers.fermi = this.surface;
    this.viewer.add(this.surface);
    this.setVisible("fermi", this.visibility.fermi ?? true);
    // Colours and opacity chosen for the previous data carry over
    this.surface.meshes.forEach((_, i) => {
      const color = this.colorChoices.get(`band:${i}:`);
      if (color != null) this.setColor(`band:${i}`, color);
    });
    const opacity = this.opacityChoices.get("fermi");
    if (opacity !== undefined) this.setOpacity("fermi", opacity);
  }

  /**
   * Replace the k-path and k-points in place, e.g. for a new sampling
   * density; the zone, camera and settings stay. Without Fermi data the
   * zone comes from this data, so the lattice must not change (build a new
   * BZVisualizer for that).
   */
  setSeekpath(seekpath?: SeekpathJSON): this {
    const path = seekpath ? fromSeekpathJSON(seekpath) : undefined;
    if (path && !sameLattice(path.reciprocalBasis, this.reciprocalBasis)) {
      if (!this.fermiSurface)
        throw new Error(
          "BZVisualizer.setSeekpath: the lattice changed; create a new BZVisualizer",
        );
      console.warn(
        "BZVisualizer: the seekpath and Fermi-surface reciprocal lattices differ; " +
          "the k-path will not line up with the surfaces.",
      );
    }
    this.setPathLayers(path);
    return this.changed();
  }

  private setPathLayers(path?: ReturnType<typeof fromSeekpathJSON>) {
    for (const name of ["kpath", "kpoints"]) {
      const old = this.layers[name];
      if (!old) continue;
      this.viewer.content.remove(old);
      disposeObject(old);
      delete this.layers[name];
    }
    const color = (key: string) => this.colorChoices.get(key);
    if (path?.kpath)
      this.layers.kpath = kpathObject(path.kpath, path.reciprocalBasis, {
        color: color("kpath:path"),
        pointColor: color("kpath:points"),
      });
    if (path?.points?.length)
      this.layers.kpoints = kpointsObject(path.points, path.reciprocalBasis, {
        color: color("kpoints:"),
      });
    for (const name of ["kpath", "kpoints"]) {
      const layer = this.layers[name];
      if (!layer) continue;
      this.viewer.add(layer);
      this.setVisible(name, this.visibility[name] ?? true);
    }
    this.setFolded(this.foldedState);
    this.setLabels(this.labelsState);
  }

  /** Show the k-points folded into the first zone, or as given. */
  setFolded(folded: boolean): this {
    const kpoints = this.layers.kpoints;
    if (kpoints) {
      kpoints.getObjectByName("cell")!.visible = !folded;
      kpoints.getObjectByName("folded")!.visible = folded;
    }
    this.foldedState = folded;
    return this.changed();
  }

  get folded(): boolean {
    return this.foldedState;
  }

  /** Show or hide all text labels. */
  setLabels(visible: boolean): this {
    this.viewer.content.traverse((o) => {
      if ("isCSS2DObject" in o) o.visible = visible;
    });
    this.labelsState = visible;
    return this.changed();
  }

  get labelsShown(): boolean {
    return this.labelsState;
  }

  /**
   * Recolour a layer ("bz", "kpath", "kpoints", or a band as "band:<index>").
   * `part` narrows it to a named child: "fill" or "edges" of the zone,
   * "path" or "points" of the k-path.
   */
  setColor(layer: string, color: ColorRepresentation, part = ""): this {
    for (const material of this.materials(layer, part))
      (material as Material & { color?: Color }).color?.set(color);
    this.colorChoices.set(`${layer}:${part}`, color);
    return this.changed();
  }

  getColor(layer: string, part = ""): string {
    const material = this.materials(layer, part)[0] as
      (Material & { color?: Color }) | undefined;
    return `#${material?.color?.getHexString() ?? "000000"}`;
  }

  /** Set the opacity of a layer's surfaces ("bz", "fermi", or "band:<index>"). */
  setOpacity(layer: string, opacity: number): this {
    const part = layer === "bz" ? "fill" : "";
    for (const material of this.materials(layer, part)) {
      material.opacity = opacity;
      const transparent = layer === "bz" || opacity < 1;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
    }
    this.opacityChoices.set(layer, opacity);
    return this.changed();
  }

  getOpacity(layer: string): number {
    return this.materials(layer, layer === "bz" ? "fill" : "")[0]?.opacity ?? 1;
  }

  /** Move the Fermi surfaces to energy `E` (no-op without Fermi data). */
  setEnergy(E: number): this {
    this.fermiSurface?.setEnergy(E);
    return this.changed();
  }

  /** The current isosurface energy (NaN without Fermi data). */
  get energy(): number {
    return this.fermiSurface?.energy ?? NaN;
  }

  /** Clip the Fermi surfaces to the zone, or show the whole computed region. */
  setClipping(on: boolean): this {
    this.clipToZone = on;
    this.fermiSurface?.setClipping(on);
    return this.changed();
  }

  get clipping(): boolean {
    return this.clipToZone;
  }

  /**
   * Cut the Fermi surfaces with planes, removing the side each normal points
   * to (`[]` removes the cuts; no-op without Fermi data).
   */
  setCutPlanes(planes: readonly CutPlane[]): this {
    this.cutPlanes = planes;
    this.fermiSurface?.setCutPlanes(planes);
    return this.changed();
  }

  /** Redraw, and tell the controls (and anyone listening) that the state changed. */
  private changed(): this {
    this.viewer.render();
    this.element.dispatchEvent(new Event("statechange"));
    return this;
  }

  private materials(layer: string, part: string): Material[] {
    const root = this.getLayer(layer);
    const target = part ? root?.getObjectByName(part) : root;
    const found = new Set<Material>();
    target?.traverse((o) => {
      const material = (o as Mesh).material;
      if (material)
        (Array.isArray(material) ? material : [material]).forEach((m) =>
          found.add(m),
        );
    });
    return [...found];
  }

  dispose() {
    this.cleanups.forEach((fn) => fn());
    this.fermiSurface?.dispose();
    this.viewer.dispose();
    this.element.remove();
  }
}

/**
 * Drop-in for the legacy `createBZVisualizer(container, seekpathData, params, onReady)`.
 * Pass `params.fermi` to add Fermi surfaces.
 */
export function createBZVisualizer(
  container: HTMLElement,
  seekpathData?: SeekpathJSON,
  params: BZVisualizerOptions = {},
  onReady?: (vis: BZVisualizer) => void,
): BZVisualizer {
  const vis = new BZVisualizer(container, seekpathData, params);
  onReady?.(vis);
  return vis;
}
