import { Color, type ColorRepresentation, type Material, type Mesh, type Object3D } from "three";

import { Viewer, VIEWS, type ViewerOptions } from "./viewer";
import { basisVectors, getBrillouinZone, sameLattice } from "./brillouinZone";
import {
  axesObject,
  brillouinZoneObject,
  kpathObject,
  kpointsObject,
  reciprocalVectorsObject,
} from "./objects";
import { fromSeekpathJSON, type SeekpathJSON } from "./seekpath";
import type { BrillouinZone, FermiSurfaceData, Matrix } from "./types";
import { button, checkbox, colorInput, el, gearIcon, rangeInput, toggleSwitch } from "./ui/elements";
import { FermiSurface, type FermiSurfaceOptions } from "./fermi/fermiSurface";

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
  readonly fermiSurface?: FermiSurface;

  private readonly layers: Record<string, Object3D | undefined> = {};
  private readonly cleanups: (() => void)[] = [];

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
      ...viewerOptions
    }: BZVisualizerOptions = {},
  ) {
    const path = seekpath ? fromSeekpathJSON(seekpath) : undefined;
    // The surfaces must sit on their own grid, so band data defines the zone
    const basis = fermi?.reciprocalBasis ?? path?.reciprocalBasis;
    if (!basis) throw new Error("BZVisualizer needs seekpath data, Fermi data, or both");
    if (fermi && path && !sameLattice(fermi.reciprocalBasis, path.reciprocalBasis))
      console.warn(
        "BZVisualizer: the seekpath and Fermi-surface reciprocal lattices differ " +
          "(units, orientation or cell); the k-path will not line up with the surfaces.",
      );
    this.reciprocalBasis = basis;
    this.bz = getBrillouinZone(basis);

    // --- DOM ---------------------------------------------------------------
    const windowEl = el("div", "bzv-window");
    const controlBar = el("div", "bzv-controls");
    this.element = el("div", "bzv", [windowEl, ...(controls ? [controlBar] : [])]);
    container.appendChild(this.element);
    this.viewer = new Viewer(windowEl, viewerOptions);

    const note = el("div", "bzv-note", ["Click to interact"]);
    note.addEventListener("click", () => this.viewer.setInteractive(!this.viewer.isInteractive));
    const syncNote = () => note.classList.toggle("on", this.viewer.isInteractive);
    windowEl.addEventListener("interactivechange", syncNote);
    syncNote();
    windowEl.appendChild(note);

    // --- scene -------------------------------------------------------------
    const longest = Math.max(...basisVectors(basis).map((b) => b.length()));
    this.layers.bz = brillouinZoneObject(this.bz, { opacity: fermi ? 0.08 : 0.18 });
    this.layers.vectors = reciprocalVectorsObject(basis);
    this.layers.axes = axesObject(longest * 1.4);
    if (path?.kpath) this.layers.kpath = kpathObject(path.kpath, path.reciprocalBasis);
    if (path?.points?.length) this.layers.kpoints = kpointsObject(path.points, path.reciprocalBasis);
    if (fermi) {
      this.fermiSurface = new FermiSurface(fermi, this.bz, fermiOptions).setEnergy(energy ?? fermi.fermiEnergy);
      this.layers.fermi = this.fermiSurface;
    }
    for (const layer of Object.values(this.layers)) if (layer) this.viewer.add(layer);

    this.setVisible("vectors", showBVectors);
    this.setVisible("axes", showAxes);
    this.setVisible("kpath", showKPath);
    this.setVisible("kpoints", showKPoints);
    this.setFolded(foldKPoints);
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
    if (this.fermiSurface) firstRow.append(this.energyControl(this.fermiSurface, energyRange, energyStep));

    const toggle = (name: string, text: string, on: boolean, ...tools: HTMLElement[]) =>
      el("div", "bzv-panel-row", [
        checkbox(text, on, (v) => this.setVisible(name, v)),
        el("span", "bzv-tools", tools),
      ]);
    const color = (name: string, part = "") =>
      colorInput(this.getColor(name, part), "Colour", (c) => this.setColor(name, c, part));

    const panel = el("div", "bzv-panel", [
      el("h4", "", ["Layers"]),
      toggle(
        "bz",
        "Zone",
        true,
        rangeInput(0, 1, 0.01, this.getOpacity("bz"), "Opacity", (v) => this.setOpacity("bz", v)),
        color("bz", "fill"),
        color("bz", "edges"),
      ),
      toggle("vectors", "b vectors", showBVectors),
      toggle("axes", "Axes", showAxes),
      ...(this.layers.kpath ? [toggle("kpath", "k-path", showKPath, color("kpath"))] : []),
      ...(this.layers.kpoints
        ? [
            toggle("kpoints", "k-points", showKPoints, color("kpoints")),
            el("div", "bzv-panel-row indent", [
              toggleSwitch("Fold into BZ", foldKPoints, (on) => this.setFolded(on)),
            ]),
          ]
        : []),
      el("div", "bzv-panel-row", [checkbox("Labels", showLabels, (on) => this.setLabels(on))]),
      ...(this.fermiSurface ? this.bandControls(this.fermiSurface, fermiOptions?.clip ?? true) : []),
    ]);

    // The panel opens over the 3D window, just above the button (bottom right)
    const settingsButton = el("button", "bzv-button bzv-settings-button", ["Settings", gearIcon()]);
    settingsButton.type = "button";
    settingsButton.setAttribute("aria-expanded", "false");
    const setOpen = (open: boolean) => {
      panel.classList.toggle("open", open);
      settingsButton.setAttribute("aria-expanded", String(open));
    };
    settingsButton.addEventListener("click", () => setOpen(!panel.classList.contains("open")));
    // Using the panel should not switch on mouse interaction with the scene
    for (const node of [panel, note]) node.addEventListener("mousedown", (e) => e.stopPropagation());
    const onDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panel.contains(target) && !settingsButton.contains(target)) setOpen(false);
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
    controlBar.append(firstRow, el("div", "bzv-row bzv-row-end", [settingsButton]));
  }

  /** Show or hide a scene layer: "bz", "vectors", "axes", "kpath", "kpoints", "fermi". */
  setVisible(layer: string, visible: boolean): this {
    const object = this.layers[layer];
    if (object) object.visible = visible;
    this.viewer.render();
    return this;
  }

  /** Show the k-points folded into the first zone, or as given. */
  setFolded(folded: boolean): this {
    const kpoints = this.layers.kpoints;
    if (kpoints) {
      kpoints.getObjectByName("cell")!.visible = !folded;
      kpoints.getObjectByName("folded")!.visible = folded;
    }
    this.viewer.render();
    return this;
  }

  /** Show or hide all text labels. */
  setLabels(visible: boolean): this {
    this.viewer.content.traverse((o) => {
      if ("isCSS2DObject" in o) o.visible = visible;
    });
    this.viewer.render();
    return this;
  }

  /**
   * Recolour a layer ("bz", "kpath", "kpoints", or a band as "band:<index>").
   * `part` narrows it to a named child, e.g. "fill" or "edges" of the zone.
   */
  setColor(layer: string, color: ColorRepresentation, part = ""): this {
    for (const material of this.materials(layer, part))
      (material as Material & { color?: Color }).color?.set(color);
    this.viewer.render();
    return this;
  }

  getColor(layer: string, part = ""): string {
    const material = this.materials(layer, part)[0] as (Material & { color?: Color }) | undefined;
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
    this.viewer.render();
    return this;
  }

  getOpacity(layer: string): number {
    return this.materials(layer, layer === "bz" ? "fill" : "")[0]?.opacity ?? 1;
  }

  /** Move the Fermi surfaces to energy `E` (no-op without Fermi data). */
  setEnergy(E: number): this {
    this.fermiSurface?.setEnergy(E);
    this.viewer.render();
    return this;
  }

  private materials(layer: string, part: string): Material[] {
    const band = /^band:(\d+)$/.exec(layer);
    const root = band ? this.fermiSurface?.meshes[Number(band[1])] : this.layers[layer];
    const target = part ? root?.getObjectByName(part) : root;
    const found = new Set<Material>();
    target?.traverse((o) => {
      const material = (o as Mesh).material;
      if (material) (Array.isArray(material) ? material : [material]).forEach((m) => found.add(m));
    });
    return [...found];
  }

  private energyControl(surface: FermiSurface, [lo, hi]: [number, number], step: number): HTMLElement {
    const EF = surface.data.fermiEnergy;
    const readout = el("output");
    const show = (dE: number) => {
      readout.textContent = `${dE >= 0 ? "+" : "−"}${Math.abs(dE).toFixed(2)} eV`;
      readout.title = `E = ${(EF + dE).toFixed(3)} eV`;
    };
    // Coalesce slider events to one re-mesh per frame
    let pending = 0;
    const slider = rangeInput(lo, hi, step, surface.energy - EF, "Energy relative to the Fermi energy", (dE) => {
      show(dE);
      pending ||= requestAnimationFrame(() => {
        pending = 0;
        this.setEnergy(EF + Number(slider.value));
      });
    });
    show(surface.energy - EF);
    const resetE = el("button", "bzv-button", ["E", el("sub", "", ["F"])]);
    resetE.type = "button";
    resetE.title = "Back to the Fermi energy";
    resetE.addEventListener("click", () => {
      slider.value = "0";
      show(0);
      this.setEnergy(EF);
    });
    return el("div", "bzv-group bzv-energy", [el("span", "", ["E−E", el("sub", "", ["F"])]), slider, readout, resetE]);
  }

  private bandControls(surface: FermiSurface, clip: boolean): HTMLElement[] {
    const chips = surface.meshes.map((mesh, i) => {
      const name = el("span", "", [mesh.name]);
      name.title = "Show / hide";
      const chip = el("span", "bzv-band", [colorInput(this.getColor(`band:${i}`), "Colour", (c) => this.setColor(`band:${i}`, c)), name]);
      name.addEventListener("click", () => {
        mesh.visible = !mesh.visible;
        chip.classList.toggle("off", !mesh.visible);
        this.viewer.render();
      });
      return chip;
    });
    return [
      el("h4", "", ["Bands"]),
      el("div", "bzv-bands", chips),
      el("div", "bzv-panel-row", [
        "Opacity",
        rangeInput(0.1, 1, 0.01, this.getOpacity("fermi"), "Surface opacity", (v) => this.setOpacity("fermi", v)),
      ]),
      el("div", "bzv-panel-row", [
        checkbox("Clip to zone", clip, (on) => {
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
