import type { Object3D } from "three";

import { Viewer, VIEWS, type ViewerOptions } from "./viewer";
import { basisVectors, getBrillouinZone, sameLattice } from "./brillouinZone";
import {
  axesObject,
  brillouinZoneObject,
  kpathObject,
  reciprocalVectorsObject,
} from "./objects";
import { fromSeekpathJSON, type SeekpathJSON } from "./seekpath";
import type { BrillouinZone, FermiSurfaceData, Matrix } from "./types";
import { injectStyles } from "./ui/styles";
import { button, checkbox, el } from "./ui/elements";
// Type-only: the Fermi code is loaded on demand, see `loadFermi`
import type { FermiSurface, FermiSurfaceOptions } from "./fermi/fermiSurface";

export interface BZVisualizerOptions extends ViewerOptions {
  /** Show the control box below the viewer (default true). */
  controls?: boolean;
  showAxes?: boolean;
  showBVectors?: boolean;
  showKPath?: boolean;
  showPathpoints?: boolean;
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
 * k-path, plus Fermi surfaces when band data is given. The Fermi-surface
 * code is a separate chunk that is only fetched in that case.
 *
 * Layout follows mc-react-structure-visualizer: the 3D window on top
 * ("Click to interact"), a control box below.
 */
export class BZVisualizer {
  readonly element: HTMLDivElement;
  readonly viewer: Viewer;
  readonly reciprocalBasis: Matrix;
  readonly bz: BrillouinZone;
  fermiSurface?: FermiSurface;
  /** Resolves once everything (including Fermi surfaces) is drawn. */
  readonly ready: Promise<this>;

  private readonly layers: Record<string, Object3D | undefined> = {};
  private readonly controlBox: HTMLDivElement;

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
    injectStyles();
    const windowEl = el("div", "bzv-window");
    const note = el("div", "bzv-note", ["Click to interact"]);
    this.controlBox = el("div", "bzv-controls");
    this.element = el("div", "bzv", [windowEl, ...(controls ? [this.controlBox] : [])]);
    container.appendChild(this.element);

    this.viewer = new Viewer(windowEl, viewerOptions);
    windowEl.appendChild(note);
    note.addEventListener("mousedown", (e) => e.stopPropagation());
    note.addEventListener("click", () => this.viewer.setInteractive(!this.viewer.isInteractive));
    const syncNote = () => note.classList.toggle("on", this.viewer.isInteractive);
    windowEl.addEventListener("interactivechange", syncNote);
    syncNote();

    // --- scene -------------------------------------------------------------
    const longest = Math.max(...basisVectors(basis).map((b) => b.length()));
    this.layers.bz = brillouinZoneObject(this.bz, { opacity: fermi ? 0.08 : 0.18 });
    this.layers.vectors = reciprocalVectorsObject(basis);
    this.layers.axes = axesObject(longest * 1.4);
    if (path?.kpath)
      this.layers.kpath = kpathObject(path.kpath, path.reciprocalBasis, {
        explicitPoints: path.explicitPoints,
      });
    this.layers.pathPoints = this.layers.kpath?.getObjectByName("pathPoints");
    for (const layer of Object.values(this.layers)) if (layer?.parent === null) this.viewer.add(layer);

    this.setVisible("vectors", showBVectors);
    this.setVisible("axes", showAxes);
    this.setVisible("kpath", showKPath);
    this.setVisible("pathPoints", showPathpoints);
    this.setLabels(showLabels);
    this.viewer.fit();

    // --- controls ----------------------------------------------------------
    const toggles = el("div", "bzv-row", [
      checkbox("Zone", true, (on) => this.setVisible("bz", on)),
      checkbox("b vectors", showBVectors, (on) => this.setVisible("vectors", on)),
      checkbox("Axes", showAxes, (on) => this.setVisible("axes", on)),
      ...(this.layers.kpath ? [checkbox("k-path", showKPath, (on) => this.setVisible("kpath", on))] : []),
      ...(this.layers.pathPoints
        ? [checkbox("Path points", showPathpoints, (on) => this.setVisible("pathPoints", on))]
        : []),
      checkbox("Labels", showLabels, (on) => this.setLabels(on)),
    ]);
    const camera = el("div", "bzv-group", [
      "Camera:",
      button("x", () => this.viewer.fit(this.viewer.content, VIEWS.x)),
      button("y", () => this.viewer.fit(this.viewer.content, VIEWS.y)),
      button("z", () => this.viewer.fit(this.viewer.content, VIEWS.z)),
      button("reset", () => this.viewer.fit()),
    ]);
    const firstRow = el("div", "bzv-row", [camera]);
    this.controlBox.append(firstRow, toggles);

    this.ready = fermi
      ? this.loadFermi(fermi, fermiOptions, energy ?? fermi.fermiEnergy).then((surface) => {
          this.addFermiControls(surface, firstRow, toggles, energyRange, energyStep, fermiOptions?.clip ?? true);
          return this;
        })
      : Promise.resolve(this);
  }

  /** Show or hide a scene layer: "bz", "vectors", "axes", "kpath", "pathPoints", "fermi". */
  setVisible(layer: string, visible: boolean): this {
    const object = this.layers[layer];
    if (object) object.visible = visible;
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

  /** Move the Fermi surfaces to energy `E` (no-op without Fermi data). */
  setEnergy(E: number): this {
    this.fermiSurface?.setEnergy(E);
    this.viewer.render();
    return this;
  }

  private async loadFermi(data: FermiSurfaceData, options: FermiSurfaceOptions | undefined, energy: number) {
    const { FermiSurface } = await import("./fermi/fermiSurface");
    const surface = new FermiSurface(data, this.bz, options).setEnergy(energy);
    this.fermiSurface = surface;
    this.layers.fermi = surface;
    this.viewer.add(surface);
    return surface;
  }

  private addFermiControls(
    surface: FermiSurface,
    firstRow: HTMLElement,
    toggles: HTMLElement,
    [lo, hi]: [number, number],
    step: number,
    clip: boolean,
  ) {
    const EF = surface.data.fermiEnergy;
    const slider = el("input");
    Object.assign(slider, { type: "range", min: String(lo), max: String(hi), step: String(step) });
    slider.value = String(surface.energy - EF);
    const readout = el("output");
    const show = () => {
      const dE = Number(slider.value);
      readout.textContent = `${dE >= 0 ? "+" : "−"}${Math.abs(dE).toFixed(2)} eV`;
      readout.title = `E = ${(EF + dE).toFixed(3)} eV`;
    };
    show();
    // Coalesce slider events to one re-mesh per frame
    let pending = 0;
    slider.addEventListener("input", () => {
      show();
      pending ||= requestAnimationFrame(() => {
        pending = 0;
        this.setEnergy(EF + Number(slider.value));
      });
    });
    const resetE = el("button", "bzv-button", ["E", el("sub", "", ["F"])]);
    resetE.type = "button";
    resetE.title = "Back to the Fermi energy";
    resetE.addEventListener("click", () => {
      slider.value = "0";
      show();
      this.setEnergy(EF);
    });
    firstRow.append(
      el("div", "bzv-group bzv-energy", [el("span", "", ["E − E", el("sub", "", ["F"]), ":"]), slider, readout, resetE]),
    );

    toggles.append(
      checkbox("Clip to zone", clip, (on) => {
        surface.setClipping(on);
        this.viewer.render();
      }),
    );

    const bands = el(
      "div",
      "bzv-row bzv-bands",
      surface.meshes.map((mesh) => {
        const swatch = el("span", "bzv-swatch");
        swatch.style.background = `#${mesh.material.color.getHexString()}`;
        const chip = el("span", "bzv-band", [swatch, mesh.name]);
        chip.addEventListener("click", () => {
          mesh.visible = !mesh.visible;
          chip.classList.toggle("off", !mesh.visible);
          this.viewer.render();
        });
        return chip;
      }),
    );
    this.controlBox.append(bands);
  }

  dispose() {
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
  if (onReady) vis.ready.then(onReady);
  return vis;
}
