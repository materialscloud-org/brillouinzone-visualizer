import {
  Color,
  type ColorRepresentation,
  type Material,
  type Mesh,
  type Object3D,
} from "three";

import { Viewer, VIEWS, type ViewerOptions } from "./viewer";
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
import {
  button,
  checkbox,
  colorInput,
  el,
  gearIcon,
  rangeInput,
  toggleSwitch,
} from "./ui/elements";
import { FermiSurface, type FermiSurfaceOptions } from "./fermi/fermiSurface";

/** Layer colours; anything left out keeps its default. */
export interface BZColors {
  zone?: ColorRepresentation;
  zoneEdges?: ColorRepresentation;
  kpath?: ColorRepresentation;
  highSymmetryPoints?: ColorRepresentation;
  kpoints?: ColorRepresentation;
}

export interface BZVisualizerOptions extends ViewerOptions {
  /** Show the control bar below the viewer, with its settings panel (default true). */
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
  /** Slider range relative to the Fermi energy (default [-1, 1]). */
  energyRange?: [number, number];
  energyStep?: number;
}

/**
 * One component for both use cases: the Brillouin zone with the seekpath
 * k-path, plus Fermi surfaces when band data is given.
 *
 * Layout follows mc-react-structure-visualizer: the 3D window on top
 * ("Click to interact"), a control box below.
 */
export class BZVisualizer {
  readonly element: HTMLDivElement;
  readonly viewer: Viewer;
  readonly reciprocalBasis: Matrix;
  readonly bz: BrillouinZone;

  private readonly layers: Record<string, Object3D | undefined> = {};
  private readonly cleanups: (() => void)[] = [];
  /** Updates a settings control after a setter call, keyed like `visible:axes`. */
  private readonly syncs = new Map<string, (value: never) => void>();
  // Settings, kept so that replaced layers (`setSeekpath`) look the same
  private readonly visibility: Record<string, boolean> = {};
  private readonly colorChoices = new Map<string, ColorRepresentation>();
  private readonly opacityChoices = new Map<string, number>();
  private folded = false;
  // Fermi surfaces (replaceable with `setFermi`) and their controls
  private surface?: FermiSurface;
  private readonly fermiOptions: FermiSurfaceOptions;
  private clipToZone: boolean;
  private cutPlanes: readonly CutPlane[];
  private readonly energyRange: [number, number];
  private readonly energyStep: number;
  private energySlot?: HTMLElement;
  private bandsSlot?: HTMLElement;
  private labelsShown = true;

  constructor(
    container: HTMLElement,
    seekpath?: SeekpathJSON,
    {
      controls = true,
      fermi,
      fermiOptions,
      energy,
      energyRange = [-1, 1],
      energyStep = 0.01,
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
    this.energyRange = energyRange;
    this.energyStep = energyStep;

    // --- DOM ---------------------------------------------------------------
    const windowEl = el("div", "bzv-window");
    const controlBar = el("div", "bzv-controls");
    this.element = el("div", "bzv", [
      windowEl,
      ...(controls ? [controlBar] : []),
    ]);
    container.appendChild(this.element);
    this.viewer = new Viewer(windowEl, viewerOptions);

    const note = el("div", "bzv-note", ["Click to interact"]);
    note.addEventListener("click", () =>
      this.viewer.setInteractive(!this.viewer.isInteractive),
    );
    const syncNote = () =>
      note.classList.toggle("on", this.viewer.isInteractive);
    windowEl.addEventListener("interactivechange", syncNote);
    syncNote();
    windowEl.appendChild(note);

    // --- scene -------------------------------------------------------------
    Object.assign(this.visibility, {
      vectors: showBVectors,
      axes: showAxes,
      kpath: showKPath,
      kpoints: showKPoints,
    });
    this.folded = foldKPoints;
    this.labelsShown = showLabels;
    for (const [key, color] of [
      ["kpath:path", colors.kpath],
      ["kpath:points", colors.highSymmetryPoints],
      ["kpoints:", colors.kpoints],
    ] as const)
      if (color != null) this.colorChoices.set(key, color);

    const longest = Math.max(...basisVectors(basis).map((b) => b.length()));
    this.layers.bz = brillouinZoneObject(this.bz, {
      opacity: fermi ? 0.08 : 0.18,
      color: colors.zone,
      edgeColor: colors.zoneEdges,
    });
    this.layers.vectors = reciprocalVectorsObject(basis);
    this.layers.axes = axesObject(longest * 1.4);
    for (const layer of Object.values(this.layers))
      if (layer) this.viewer.add(layer);
    this.setPathLayers(path);
    this.setFermiLayer(fermi, energy);

    this.setVisible("vectors", showBVectors);
    this.setVisible("axes", showAxes);
    this.setLabels(showLabels);
    this.viewer.fit();

    if (!controls) return;

    // --- bar: camera (+ energy) on the first row, settings on the second --
    const firstRow = el("div", "bzv-row bzv-row-main", [
      el("div", "bzv-group", [
        "Camera:",
        button("x", () => this.viewer.fit(this.viewer.content, VIEWS.x)),
        button("y", () => this.viewer.fit(this.viewer.content, VIEWS.y)),
        button("z", () => this.viewer.fit(this.viewer.content, VIEWS.z)),
        button("reset", () => this.viewer.fit()),
      ]),
    ]);
    // Filled (and refilled by `setFermi`) by fermiControls
    this.energySlot = el("div", "bzv-group bzv-energy");
    this.bandsSlot = el("div");
    firstRow.append(this.energySlot);
    this.fermiControls();

    const toggle = (
      name: string,
      text: string,
      on: boolean,
      ...tools: HTMLElement[]
    ) => {
      const box = checkbox(text, on, (v) => this.setVisible(name, v));
      this.onSync(`visible:${name}`, (v: boolean) => {
        box.querySelector("input")!.checked = v;
      });
      return el("div", "bzv-panel-row", [box, el("span", "bzv-tools", tools)]);
    };
    const color = (name: string, part = "") => {
      const input = colorInput(this.getColor(name, part), "Colour", (c) =>
        this.setColor(name, c, part),
      );
      this.onSync(`color:${name}:${part}`, (c: string) => (input.value = c));
      return input;
    };
    const zoneOpacity = rangeInput(
      0,
      1,
      0.01,
      this.getOpacity("bz"),
      "Opacity",
      (v) => this.setOpacity("bz", v),
    );
    this.onSync("opacity:bz", (v: number) => (zoneOpacity.value = String(v)));
    const fold = toggleSwitch("Fold into BZ", foldKPoints, (on) =>
      this.setFolded(on),
    );
    this.onSync("folded", (v: boolean) => {
      fold.querySelector("input")!.checked = v;
    });
    const labels = checkbox("Labels", showLabels, (on) => this.setLabels(on));
    this.onSync("labels", (v: boolean) => {
      labels.querySelector("input")!.checked = v;
    });

    // The k-path and k-point rows stay hidden until there is such a layer
    const pathColor = color("kpath", "path");
    const kpathRow = toggle(
      "kpath",
      "k-path",
      showKPath,
      pathColor,
      color("kpath", "points"),
    );
    const kpointsRow = toggle(
      "kpoints",
      "k-points",
      showKPoints,
      color("kpoints"),
    );
    const foldRow = el("div", "bzv-panel-row indent", [fold]);
    this.onSync("present", () => {
      kpathRow.hidden = !this.layers.kpath;
      pathColor.hidden = !this.layers.kpath?.getObjectByName("path");
      kpointsRow.hidden = foldRow.hidden = !this.layers.kpoints;
    });
    this.sync("present", null);

    const panel = el("div", "bzv-panel", [
      el("h4", "", ["Layers"]),
      toggle(
        "bz",
        "Zone",
        true,
        zoneOpacity,
        color("bz", "fill"),
        color("bz", "edges"),
      ),
      toggle("vectors", "b vectors", showBVectors),
      toggle("axes", "Axes", showAxes),
      kpathRow,
      kpointsRow,
      foldRow,
      el("div", "bzv-panel-row", [labels]),
      this.bandsSlot,
    ]);

    // The panel opens over the 3D window, just above the button (bottom right)
    const settingsButton = el("button", "bzv-button bzv-settings-button", [
      "Settings",
      gearIcon(),
    ]);
    settingsButton.type = "button";
    settingsButton.setAttribute("aria-expanded", "false");
    const setOpen = (open: boolean) => {
      panel.classList.toggle("open", open);
      settingsButton.setAttribute("aria-expanded", String(open));
    };
    settingsButton.addEventListener("click", () =>
      setOpen(!panel.classList.contains("open")),
    );
    // Using the panel should not switch on mouse interaction with the scene
    for (const node of [panel, note])
      node.addEventListener("mousedown", (e) => e.stopPropagation());
    const onDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panel.contains(target) && !settingsButton.contains(target))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onKey);
    this.cleanups.push(
      () => document.removeEventListener("click", onDocumentClick),
      () => document.removeEventListener("keydown", onKey),
    );

    windowEl.appendChild(panel);
    controlBar.append(
      firstRow,
      el("div", "bzv-row bzv-row-end", [settingsButton]),
    );
  }

  /** Show or hide a scene layer: "bz", "vectors", "axes", "kpath", "kpoints", "fermi". */
  setVisible(layer: string, visible: boolean): this {
    const object = this.layers[layer];
    if (object) object.visible = visible;
    this.visibility[layer] = visible;
    this.sync(`visible:${layer}`, visible);
    this.viewer.render();
    return this;
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
    this.fermiControls();
    this.viewer.render();
    return this;
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
    this.viewer.render();
    return this;
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
    this.setFolded(this.folded);
    this.setLabels(this.labelsShown);
    this.sync("present", null);
  }

  /** Show the k-points folded into the first zone, or as given. */
  setFolded(folded: boolean): this {
    const kpoints = this.layers.kpoints;
    if (kpoints) {
      kpoints.getObjectByName("cell")!.visible = !folded;
      kpoints.getObjectByName("folded")!.visible = folded;
    }
    this.folded = folded;
    this.sync("folded", folded);
    this.viewer.render();
    return this;
  }

  /** Show or hide all text labels. */
  setLabels(visible: boolean): this {
    this.viewer.content.traverse((o) => {
      if ("isCSS2DObject" in o) o.visible = visible;
    });
    this.labelsShown = visible;
    this.sync("labels", visible);
    this.viewer.render();
    return this;
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
    this.sync(`color:${layer}:${part}`, `#${new Color(color).getHexString()}`);
    this.viewer.render();
    return this;
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
    this.sync(`opacity:${layer}`, opacity);
    this.viewer.render();
    return this;
  }

  getOpacity(layer: string): number {
    return this.materials(layer, layer === "bz" ? "fill" : "")[0]?.opacity ?? 1;
  }

  /** Move the Fermi surfaces to energy `E` (no-op without Fermi data). */
  setEnergy(E: number): this {
    this.fermiSurface?.setEnergy(E);
    this.sync("energy", E);
    this.viewer.render();
    return this;
  }

  /** The current isosurface energy (NaN without Fermi data). */
  get energy(): number {
    return this.fermiSurface?.energy ?? NaN;
  }

  /**
   * Cut the Fermi surfaces with planes, removing the side each normal points
   * to (`[]` removes the cuts; no-op without Fermi data).
   */
  setCutPlanes(planes: readonly CutPlane[]): this {
    this.cutPlanes = planes;
    this.fermiSurface?.setCutPlanes(planes);
    this.viewer.render();
    return this;
  }

  private onSync<T>(key: string, update: (value: T) => void) {
    this.syncs.set(key, update as (value: never) => void);
  }

  private sync(key: string, value: unknown) {
    this.syncs.get(key)?.(value as never);
  }

  /** Tell listeners the energy was changed from the controls. */
  private emitEnergy() {
    this.element.dispatchEvent(
      new CustomEvent("energychange", { detail: { energy: this.energy } }),
    );
  }

  private materials(layer: string, part: string): Material[] {
    const band = /^band:(\d+)$/.exec(layer);
    const root = band
      ? this.fermiSurface?.meshes[Number(band[1])]
      : this.layers[layer];
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

  /** (Re)build the energy slider and the band controls for the current data. */
  private fermiControls() {
    const surface = this.surface;
    if (!this.energySlot || !this.bandsSlot) return;
    this.energySlot.hidden = this.bandsSlot.hidden = !surface;
    this.energySlot.replaceChildren(
      ...(surface ? this.energyControl(surface) : []),
    );
    this.bandsSlot.replaceChildren(
      ...(surface ? this.bandControls(surface) : []),
    );
  }

  private energyControl(surface: FermiSurface): HTMLElement[] {
    const [lo, hi] = this.energyRange;
    const EF = surface.data.fermiEnergy;
    const readout = el("output");
    const show = (dE: number) => {
      readout.textContent = `${dE >= 0 ? "+" : "−"}${Math.abs(dE).toFixed(2)} eV`;
      readout.title = `E = ${(EF + dE).toFixed(3)} eV`;
    };
    // Coalesce slider events to one re-mesh per frame
    let pending = 0;
    const slider = rangeInput(
      lo,
      hi,
      this.energyStep,
      surface.energy - EF,
      "Energy relative to the Fermi energy",
      (dE) => {
        show(dE);
        pending ||= requestAnimationFrame(() => {
          pending = 0;
          this.setEnergy(EF + Number(slider.value));
          this.emitEnergy();
        });
      },
    );
    show(surface.energy - EF);
    this.onSync("energy", (E: number) => {
      slider.value = String(E - EF);
      show(E - EF);
    });
    const resetE = el("button", "bzv-button", ["E", el("sub", "", ["F"])]);
    resetE.type = "button";
    resetE.title = "Back to the Fermi energy";
    resetE.addEventListener("click", () => {
      this.setEnergy(EF);
      this.emitEnergy();
    });
    return [
      el("span", "", ["E−E", el("sub", "", ["F"])]),
      slider,
      readout,
      resetE,
    ];
  }

  private bandControls(surface: FermiSurface): HTMLElement[] {
    const chips = surface.meshes.map((mesh, i) => {
      const name = el("span", "", [mesh.name]);
      name.title = "Show / hide";
      const swatch = colorInput(this.getColor(`band:${i}`), "Colour", (c) =>
        this.setColor(`band:${i}`, c),
      );
      this.onSync(`color:band:${i}:`, (c: string) => (swatch.value = c));
      const chip = el("span", "bzv-band", [swatch, name]);
      name.addEventListener("click", () => {
        mesh.visible = !mesh.visible;
        chip.classList.toggle("off", !mesh.visible);
        this.viewer.render();
      });
      return chip;
    });
    const opacity = rangeInput(
      0.1,
      1,
      0.01,
      this.getOpacity("fermi"),
      "Surface opacity",
      (v) => this.setOpacity("fermi", v),
    );
    this.onSync("opacity:fermi", (v: number) => (opacity.value = String(v)));
    return [
      el("h4", "", ["Bands"]),
      el("div", "bzv-bands", chips),
      el("div", "bzv-panel-row", ["Opacity", opacity]),
      el("div", "bzv-panel-row", [
        checkbox("Clip to zone", this.clipToZone, (on) => {
          this.clipToZone = on;
          surface.setClipping(on);
          this.viewer.render();
        }),
      ]),
    ];
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
