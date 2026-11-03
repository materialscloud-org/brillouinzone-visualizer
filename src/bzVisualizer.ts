import { Viewer, type ViewerOptions } from "./viewer";
import { basisVectors, getBrillouinZone, sameLattice } from "./brillouinZone";
import {
  axesObject,
  brillouinZoneObject,
  kpathObject,
  reciprocalVectorsObject,
} from "./objects";
import { fromSeekpathJSON, type SeekpathJSON } from "./seekpath";
import type { BrillouinZone, FermiSurfaceData, Matrix } from "./types";
// Type-only: the Fermi code is loaded on demand, see `loadFermi`
import type { FermiSurface, FermiSurfaceOptions } from "./fermi/fermiSurface";

export interface BZVisualizerOptions extends ViewerOptions {
  showAxes?: boolean;
  showBVectors?: boolean;
  showPathpoints?: boolean;
  /** Band grids (e.g. from `parseBXSF`); adds Fermi surfaces to the zone. */
  fermi?: FermiSurfaceData;
  fermiOptions?: FermiSurfaceOptions;
  /** Initial isosurface energy; defaults to the Fermi energy. */
  energy?: number;
}

/**
 * One component for both use cases: the Brillouin zone with the seekpath
 * k-path, plus Fermi surfaces when band data is given. The Fermi-surface
 * code is a separate chunk that is only fetched in that case.
 */
export class BZVisualizer {
  readonly viewer: Viewer;
  readonly reciprocalBasis: Matrix;
  readonly bz: BrillouinZone;
  fermiSurface?: FermiSurface;
  /** Resolves once everything (including Fermi surfaces) is drawn. */
  readonly ready: Promise<this>;

  constructor(
    container: HTMLElement,
    seekpath?: SeekpathJSON,
    {
      fermi,
      showAxes = !fermi,
      showBVectors = true,
      showPathpoints = false,
      fermiOptions,
      energy,
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
    this.viewer = new Viewer(container, viewerOptions);

    this.viewer.add(brillouinZoneObject(this.bz, { opacity: fermi ? 0.05 : 0.12 }));
    if (showBVectors) this.viewer.add(reciprocalVectorsObject(basis));
    if (path?.kpath)
      this.viewer.add(
        kpathObject(path.kpath, path.reciprocalBasis, {
          explicitPoints: showPathpoints ? path.explicitPoints : undefined,
        }),
      );
    if (showAxes) {
      const longest = Math.max(...basisVectors(basis).map((b) => b.length()));
      this.viewer.add(axesObject(longest * 1.5));
    }
    this.viewer.fit();

    this.ready = fermi
      ? this.loadFermi(fermi, fermiOptions, energy ?? fermi.fermiEnergy)
      : Promise.resolve(this);
  }

  private async loadFermi(data: FermiSurfaceData, options: FermiSurfaceOptions | undefined, energy: number) {
    const { FermiSurface } = await import("./fermi/fermiSurface");
    this.fermiSurface = new FermiSurface(data, this.bz, options).setEnergy(energy);
    this.viewer.add(this.fermiSurface);
    return this;
  }

  /** Move the Fermi surfaces to energy `E` (no-op without Fermi data). */
  setEnergy(E: number): this {
    this.fermiSurface?.setEnergy(E);
    this.viewer.render();
    return this;
  }

  dispose() {
    this.fermiSurface?.dispose();
    this.viewer.dispose();
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
