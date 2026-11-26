import type { Viewer } from "../../viewer";
import { el } from "../elements";

/**
 * A layer over the whole scene, invisible until hovered; then it dims the
 * scene and says "Click to interact". A click anywhere on it switches
 * interaction on. It covers the controls too (see overlay.css).
 */
export function overlayGuard(viewer: Viewer): HTMLElement {
  const overlay = el("div", "bzv-overlay", [
    el("span", "", ["Click to interact"]),
  ]);
  const sync = () => (overlay.hidden = viewer.isInteractive);
  viewer.container.addEventListener("interactivechange", sync);
  sync();
  return overlay;
}
