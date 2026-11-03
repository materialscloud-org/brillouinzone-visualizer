import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  Object3D,
  OrthographicCamera,
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
}

/** View direction and up vector for the standard camera buttons. */
export const VIEWS = {
  x: { direction: new Vector3(1, 0, 0), up: new Vector3(0, 0, 1) },
  y: { direction: new Vector3(0, 1, 0), up: new Vector3(0, 0, 1) },
  z: { direction: new Vector3(0, 0, 1), up: new Vector3(0, 1, 0) },
  default: { direction: new Vector3(1, 0.8, 1.2), up: new Vector3(0, 1, 0) },
} as const;

/**
 * A minimal three.js viewer: orthographic camera, free (trackball)
 * rotation, lights, CSS2D labels, render-on-demand, and resizing with its
 * container.
 */
export class Viewer {
  readonly scene = new Scene();
  /** Everything added with `add`; lights and camera live outside it. */
  readonly content = new Group();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, -100, 100);
  readonly renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true, // allows screenshots
  });
  readonly labelRenderer = new CSS2DRenderer();
  readonly controls: TrackballControls;

  private readonly padding: number;
  private readonly resizeObserver: ResizeObserver;
  private readonly cleanups: (() => void)[] = [];
  private frame = 0;
  private interacting = false;
  private interactive = true;

  constructor(
    readonly container: HTMLElement,
    { padding = 0.8, clickToInteract = true }: ViewerOptions = {},
  ) {
    this.padding = padding;
    container.style.position ||= "relative";

    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.localClippingEnabled = true;
    container.appendChild(this.renderer.domElement);

    Object.assign(this.labelRenderer.domElement.style, {
      position: "absolute",
      top: "0",
      left: "0",
      pointerEvents: "none",
    });
    container.appendChild(this.labelRenderer.domElement);

    this.scene.add(new AmbientLight(0xffffff, 0.6));
    this.scene.add(new HemisphereLight(0xffffff, 0x8899aa, 1.2));
    const light = new DirectionalLight(0xffffff, 1.6);
    light.position.set(1, 2, 3);
    // Keep the light fixed relative to the view
    this.camera.add(light);
    this.scene.add(this.camera, this.content);

    this.camera.position.set(1, 1, 1);
    this.controls = new TrackballControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { staticMoving: true, rotateSpeed: 3, zoomSpeed: 1.5 });
    // Trackball needs update() every frame, so animate only while dragging
    this.controls.addEventListener("start", () => {
      this.interacting = true;
      this.animate();
    });
    this.controls.addEventListener("end", () => (this.interacting = false));

    if (clickToInteract) this.setupClickToInteract();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  add(...objects: Object3D[]): this {
    this.content.add(...objects);
    this.render();
    return this;
  }

  /** Remove everything added with `add`. */
  clear(): this {
    this.content.clear();
    this.render();
    return this;
  }

  /** Look at `object` (default: all content) along `direction` and zoom to fit. */
  fit(
    object: Object3D = this.content,
    { direction, up }: { direction: Vector3; up: Vector3 } = VIEWS.default,
  ) {
    const box = new Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const center = box.getCenter(new Vector3());
    const radius = box.getSize(new Vector3()).length() / 2;

    this.controls.target.copy(center);
    this.camera.up.copy(up);
    this.camera.position
      .copy(center)
      .addScaledVector(direction.clone().normalize(), radius * 4);
    this.camera.lookAt(center);
    this.camera.near = -radius * 10;
    this.camera.far = radius * 10;
    this.camera.zoom = 1 / (radius * this.padding);
    this.camera.updateProjectionMatrix();
    this.render();
  }

  /** Enable or disable mouse interaction (see `clickToInteract`). */
  setInteractive(on: boolean) {
    this.interactive = on;
    this.controls.enabled = on;
    this.renderer.domElement.style.pointerEvents = on ? "" : "none";
    this.container.dispatchEvent(new CustomEvent("interactivechange", { detail: on }));
  }

  get isInteractive() {
    return this.interactive;
  }

  /** Request a redraw on the next animation frame. */
  render() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  private draw() {
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  private animate = () => {
    this.controls.update();
    this.draw();
    if (this.interacting) requestAnimationFrame(this.animate);
  };

  private setupClickToInteract() {
    this.setInteractive(false);
    // The canvas ignores the mouse while inactive, so clicks land here
    const onContainerDown = () => {
      if (!this.interactive) this.setInteractive(true);
    };
    const onDocumentDown = (e: MouseEvent) => {
      if (this.interactive && !this.container.contains(e.target as Node)) this.setInteractive(false);
    };
    this.container.addEventListener("mousedown", onContainerDown);
    document.addEventListener("mousedown", onDocumentDown);
    this.cleanups.push(
      () => this.container.removeEventListener("mousedown", onContainerDown),
      () => document.removeEventListener("mousedown", onDocumentDown),
    );
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    const aspect = w / h;
    this.camera.left = -aspect;
    this.camera.right = aspect;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.controls.handleResize();
    this.render();
  }

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
