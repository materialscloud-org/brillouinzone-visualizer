import { Viewer, type ViewerOptions } from "./viewer";
import { getBrillouinZone } from "./brillouinZone";
import {
  axesObject,
  brillouinZoneObject,
  kpathObject,
  reciprocalVectorsObject,
} from "./objects";
import { fromSeekpathJSON, type SeekpathJSON } from "./seekpath";
import { basisVectors } from "./brillouinZone";

export type * from "./types";
export { Viewer, type ViewerOptions } from "./viewer";
export { getBrillouinZone, basisVectors } from "./brillouinZone";
export * from "./objects";
export * from "./seekpath";

export interface BZVisualizerOptions extends ViewerOptions {
  showAxes?: boolean;
  showBVectors?: boolean;
  showPathpoints?: boolean;
}

/**
 * Drop-in for the legacy `createBZVisualizer`: draws the zone, reciprocal
 * vectors and the high-symmetry path from seekpath JSON.
 */
export function createBZVisualizer(
  container: HTMLElement,
  seekpathData: SeekpathJSON,
  { showAxes = true, showBVectors = true, showPathpoints = false, ...viewerOptions }: BZVisualizerOptions = {},
): Viewer {
  const { reciprocalBasis, kpath, explicitPoints } = fromSeekpathJSON(seekpathData);
  const viewer = new Viewer(container, viewerOptions);

  viewer.add(brillouinZoneObject(getBrillouinZone(reciprocalBasis)));
  if (showBVectors) viewer.add(reciprocalVectorsObject(reciprocalBasis));
  if (kpath)
    viewer.add(
      kpathObject(kpath, reciprocalBasis, {
        explicitPoints: showPathpoints ? explicitPoints : undefined,
      }),
    );
  if (showAxes) {
    const longest = Math.max(...basisVectors(reciprocalBasis).map((b) => b.length()));
    viewer.add(axesObject(longest * 1.5));
  }
  viewer.fit();
  return viewer;
}
