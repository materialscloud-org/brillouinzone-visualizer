// The public API: the component, its input, and the types to use them.
// For anything else, the three.js scene is open: `vis.viewer.scene` (and
// `content`, `camera`, `renderer`, `controls`); see the README.
export type * from "./types";
export {
  BZVisualizer,
  createBZVisualizer,
  type ViewName,
  type BZColors,
  type BZWidths,
  type BZLiveOptions,
  type BZVisualizerOptions,
} from "./bzVisualizer";
export { parseBXSF } from "./fermi/bxsf";
export { getBrillouinZone } from "./brillouinZone";
export { overlayGuard, type InteractGuard } from "./ui/guards";
export type { SeekpathJSON } from "./seekpath";
export type { ControlsOptions } from "./ui/controls";
export type { FermiSurface, FermiSurfaceOptions } from "./fermi/fermiSurface";
export type { Viewer, CameraState, ViewerOptions } from "./viewer";
