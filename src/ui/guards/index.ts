import type { Viewer } from "../../viewer";

/**
 * A "click to interact" hint over the viewer: a function that returns the
 * element to show. It is added inside the viewer's container, and should
 * follow `viewer.isInteractive` on the container's "interactivechange"
 * event. The click handling itself is the viewer's (`clickToInteract`):
 * pressing anywhere in the viewer switches interaction on.
 */
export type InteractGuard = (viewer: Viewer) => HTMLElement;

export { overlayGuard } from "./overlay";
