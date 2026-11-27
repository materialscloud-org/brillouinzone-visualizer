import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";

export interface ViewerOptions {
  /** Extra room around the fitted content, as a factor of its size. */
  padding?: number;
  /**
   * Ignore the mouse until the viewer is clicked, and again after a click
   * elsewhere, so the page scrolls normally over it (default true).
   */
  clickToInteract?: boolean;
  /** Start with a perspective camera instead of an orthographic one. */
  perspective?: boolean;
}

/** Vertical field of view of the perspective camera, in degrees. */
const FOV = 35;
const TAN_HALF_FOV = Math.tan(((FOV / 2) * Math.PI) / 180);

/**
 * Where the camera is and what it looks at, to save and restore a view.
 * `zoom` is the orthographic zoom; with a perspective camera it is the zoom
 * that frames the same, so a state works with either projection.
 */
export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  zoom: number;
}

/** View direction and up vector for the standard camera buttons. */
export const VIEWS = {
  x: { direction: new Vector3(1, 0, 0), up: new Vector3(0, 0, 1) },
  y: { direction: new Vector3(0, 1, 0), up: new Vector3(0, 0, 1) },
  z: { direction: new Vector3(0, 0, 1), up: new Vector3(0, 1, 0) },
  default: { direction: new Vector3(1, 0.8, 1.2), up: new Vector3(0, 1, 0) },
} as const;

/**
 * A minimal three.js viewer: orthographic or perspective camera, free
 * (trackball) rotation, lights, CSS2D labels, render-on-demand, and resizing
 * with its container.
 *
 * How to read it:
 * - `scene` holds everything drawn: the lights, the camera in use, and
 *   `content` (what is shown: zone, k-path, surfaces, ...; add to it with
 *   three's `content.add`, then call `render()`).
 * - Two renderers draw the same scene into the container: `renderer` (a
 *   WebGL canvas, the 3D picture) and `labelRenderer` (an HTML layer on top,
 *   for the text labels).
 * - `controls` (TrackballControls) turns mouse drags into camera moves.
 * - Nothing redraws continuously: `render()` asks for one frame, and frames
 *   run every animation tick only while the mouse is dragging (see `render`).
 */
export class Viewer {
  // --- what is drawn ---------------------------------------------------------
  readonly scene = new Scene();
  /**
   * What is shown (zone, k-path, surfaces, your own objects); lights and
   * camera live outside it. Call `render()` after changing it.
   */
  readonly content = new Group();

  // --- cameras: one of each kind, `camera` is the one in use -----------------
  private readonly orthographic = new OrthographicCamera(
    -1,
    1,
    1,
    -1,
    -100,
    100,
  );
  private readonly perspectiveCamera = new PerspectiveCamera(FOV, 1, 0.01, 100);
  /** The camera in use (see `setPerspective`). */
  camera: OrthographicCamera | PerspectiveCamera = this.orthographic;

  // --- drawing and input -----------------------------------------------------
  readonly renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true, // allows screenshots
  });
  readonly labelRenderer = new CSS2DRenderer();
  readonly controls: TrackballControls;

  // --- internal state --------------------------------------------------------
  private readonly padding: number;
  private readonly resizeObserver: ResizeObserver;
  private readonly cleanups: (() => void)[] = []; // run by dispose()
  private frame = 0; // the pending render() frame, 0 if none
  private interacting = false; // a drag is in progress: animate every tick
  private interactive = true; // the mouse is switched on (see clickToInteract)

  constructor(
    readonly container: HTMLElement,
    {
      padding = 0.8,
      clickToInteract = true,
      perspective = false,
    }: ViewerOptions = {},
  ) {
    this.padding = padding;
    // The label layer and any overlays are positioned against the container
    container.style.position ||= "relative";

    // set up the renderers:
    // the WebGL canvas for the 3D picture +
    // an HTML layer over it for labels (it lets the mouse through)
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.localClippingEnabled = true;
    container.appendChild(this.renderer.domElement);

    Object.assign(this.labelRenderer.domElement.style, {
      position: "absolute",
      top: "0",
      left: "0",
      pointerEvents: "none",
      // CSS2DRenderer z-sorts labels with z-index; keep that inside this layer
      zIndex: "1",
    });
    container.appendChild(this.labelRenderer.domElement);

    // set up lighting:
    // small ambient light +
    // hemisphere light (sky=bright, base=darker) +
    // light attached to each camera so the front stays bright
    this.scene.add(new AmbientLight(0xffffff, 0.6));
    this.scene.add(new HemisphereLight(0xffffff, 0x8899aa, 1.2));
    for (const camera of [this.orthographic, this.perspectiveCamera]) {
      const light = new DirectionalLight(0xffffff, 1.6);
      light.position.set(1, 2, 3);
      camera.add(light);
    }
    this.scene.add(this.camera, this.content);

    // set up the mouse controls:
    // trackball rotation (any direction, no fixed "up") +
    // zoom and pan; while a drag runs, animate every tick (see animate)
    this.camera.position.set(1, 1, 1);
    this.controls = new TrackballControls(
      this.camera,
      this.renderer.domElement,
    );
    Object.assign(this.controls, {
      staticMoving: true,
      rotateSpeed: 3,
      zoomSpeed: 1.5,
    });
    // Trackball needs update() every frame, so animate only while dragging
    this.controls.addEventListener("start", () => {
      // TrackballControls pans by (screen fraction) × (camera distance) ×
      // panSpeed, times the world units per pixel for orthographic cameras.
      // These panSpeeds cancel the extra factors so the scene follows the
      // mouse (for perspective, exactly only vertically: x and y share it).
      this.controls.panSpeed =
        this.camera === this.orthographic
          ? this.renderer.domElement.clientWidth /
            this.camera.position.distanceTo(this.controls.target)
          : 2 * TAN_HALF_FOV;
      this.interacting = true;
      this.animate();
    });
    this.controls.addEventListener("end", () => (this.interacting = false));

    // the options that change the starting state
    if (clickToInteract) this.setupClickToInteract();
    if (perspective) this.setPerspective(true);

    // follow the container's size (also draws the first frame)
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  // --- camera ----------------------------------------------------------------
  // The camera always looks at `controls.target`. Its framing is one number,
  // `zoom` (see the `zoom` getter), so the same view can be shown by either
  // camera; `place` turns that number back into a camera setting.

  /** The current view, to restore later with `setCameraState`. */
  getCameraState(): CameraState {
    return {
      position: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      up: this.camera.up.toArray(),
      zoom: this.zoom,
    };
  }

  setCameraState({ position, target, up, zoom }: CameraState): this {
    this.controls.target.fromArray(target);
    this.camera.position.fromArray(position);
    this.camera.up.fromArray(up);
    this.place(zoom);
    return this;
  }

  get isPerspective() {
    return this.camera === this.perspectiveCamera;
  }

  /** Switch between a perspective and an orthographic camera, keeping the view. */
  setPerspective(on: boolean): this {
    if (on === this.isPerspective) return this;
    const from = this.camera;
    const zoom = this.zoom;
    this.camera = on ? this.perspectiveCamera : this.orthographic;
    this.camera.position.copy(from.position);
    this.camera.up.copy(from.up);
    this.scene.remove(from);
    this.scene.add(this.camera);
    this.controls.object = this.camera;
    this.place(zoom);
    return this;
  }

  /** The orthographic zoom, or for perspective the one that frames the same. */
  private get zoom(): number {
    return this.camera === this.orthographic
      ? this.camera.zoom
      : 1 /
          (this.camera.position.distanceTo(this.controls.target) *
            TAN_HALF_FOV);
  }

  /**
   * Point the camera at the target and frame `zoom` (see `zoom`): the
   * orthographic zoom, or the perspective distance that shows the same height.
   */
  private place(zoom: number) {
    const { camera } = this;
    if (camera === this.perspectiveCamera) {
      const distance = 1 / (zoom * TAN_HALF_FOV);
      const eye = camera.position.clone().sub(this.controls.target);
      if (eye.lengthSq() === 0) eye.set(0, 0, 1);
      camera.position
        .copy(this.controls.target)
        .addScaledVector(eye.normalize(), distance);
      camera.near = distance / 100;
      camera.far = distance * 100;
    } else camera.zoom = zoom;
    camera.lookAt(this.controls.target);
    camera.updateProjectionMatrix();
    this.render();
  }

  /**
   * Look at the origin (Γ) along `direction` and zoom to fit `object`
   * (default: all content). Rotation is about the origin, not the centre of
   * the content, which the axes and b-vectors pull off Γ. Parts of the
   * content with `userData.excludeFromFit` set are left out.
   */
  fit(
    object: Object3D = this.content,
    { direction, up }: { direction: Vector3; up: Vector3 } = VIEWS.default,
  ) {
    const box = new Box3();
    for (const part of object === this.content ? object.children : [object])
      if (!part.userData.excludeFromFit) box.expandByObject(part);
    if (box.isEmpty()) return;
    const center = new Vector3();
    // Farthest corner of the box from the origin
    const radius = new Vector3(
      Math.max(-box.min.x, box.max.x),
      Math.max(-box.min.y, box.max.y),
      Math.max(-box.min.z, box.max.z),
    ).length();

    const view = direction.clone().normalize();
    this.controls.target.copy(center);
    // Same orientation, but with up perpendicular to the view: TrackballControls
    // pans along camera.up, and a tilted up makes vertical panning too slow
    this.camera.up.copy(up).addScaledVector(view, -up.dot(view)).normalize();
    this.camera.position.copy(center).addScaledVector(view, radius * 4);
    this.orthographic.near = -radius * 10;
    this.orthographic.far = radius * 10;
    this.place(1 / (radius * this.padding));
  }

  // --- mouse -----------------------------------------------------------------

  /** Enable or disable mouse interaction (see `clickToInteract`). */
  setInteractive(on: boolean) {
    this.interactive = on;
    this.controls.enabled = on;
    this.renderer.domElement.style.pointerEvents = on ? "" : "none";
    this.container.dispatchEvent(
      new CustomEvent("interactivechange", { detail: on }),
    );
  }

  get isInteractive() {
    return this.interactive;
  }

  // --- drawing ---------------------------------------------------------------
  // Render on demand, to save battery and GPU:
  // - anything that changes the picture calls `render()`, which draws once on
  //   the next animation frame (several calls in one frame draw once);
  // - during a drag, `animate` runs every frame instead, because
  //   TrackballControls only moves the camera when `update()` is called.

  /** Request a redraw on the next animation frame. */
  render() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  /** Draw now: the 3D picture, then the labels over it. */
  private draw() {
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  /** One drag frame: move the camera, draw, and repeat until the drag ends. */
  private animate = () => {
    this.controls.update();
    this.draw();
    if (this.interacting) requestAnimationFrame(this.animate);
  };

  /**
   * Start with the mouse off; a press inside the container switches it on,
   * a press anywhere else on the page switches it off again.
   */
  private setupClickToInteract() {
    this.setInteractive(false);
    // The canvas ignores the mouse while inactive, so clicks land here
    const onContainerDown = () => {
      if (!this.interactive) this.setInteractive(true);
    };
    const onDocumentDown = (e: MouseEvent) => {
      if (this.interactive && !this.container.contains(e.target as Node))
        this.setInteractive(false);
    };
    this.container.addEventListener("mousedown", onContainerDown);
    document.addEventListener("mousedown", onDocumentDown);
    this.cleanups.push(
      () => this.container.removeEventListener("mousedown", onContainerDown),
      () => document.removeEventListener("mousedown", onDocumentDown),
    );
  }

  // --- size and cleanup ------------------------------------------------------

  /**
   * Fit both cameras and both renderers to the container. The orthographic
   * camera shows a fixed height of 2 units (top 1, bottom -1, scaled by
   * `zoom`); the width follows the container's shape.
   */
  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    const aspect = w / h;
    Object.assign(this.orthographic, { left: -aspect, right: aspect });
    this.orthographic.updateProjectionMatrix();
    this.perspectiveCamera.aspect = aspect;
    this.perspectiveCamera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.controls.handleResize();
    this.render();
  }

  /** Stop drawing, remove the listeners and free the GPU and DOM resources. */
  dispose() {
    cancelAnimationFrame(this.frame);
    this.interacting = false;
    this.cleanups.forEach((fn) => fn());
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }
}
