import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  Object3D,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";

export interface ViewerOptions {
  /** CSS background of the container; the canvas itself is transparent. */
  background?: string;
  /** Extra room around the fitted content, as a factor of its size. */
  padding?: number;
}

/**
 * A minimal three.js viewer: orthographic camera, orbit controls, lights,
 * CSS2D labels, render-on-demand, and resizing with its container.
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
  readonly controls: OrbitControls;

  private readonly padding: number;
  private readonly resizeObserver: ResizeObserver;
  private frame = 0;

  constructor(
    readonly container: HTMLElement,
    { background, padding = 0.8 }: ViewerOptions = {},
  ) {
    this.padding = padding;
    if (background) container.style.background = background;
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

    this.scene.add(new AmbientLight(0xffffff, 1.2));
    const light = new DirectionalLight(0xffffff, 1.8);
    light.position.set(1, 2, 3);
    // Keep the light fixed relative to the view
    this.camera.add(light);
    this.scene.add(this.camera, this.content);

    this.camera.position.set(1, 1, 1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.addEventListener("change", () => this.render());

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

  /** Point the camera at `object` (default: all content) and zoom to fit. */
  fit(object: Object3D = this.content, direction = new Vector3(1, 0.8, 1.2)) {
    const box = new Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const center = box.getCenter(new Vector3());
    const radius = box.getSize(new Vector3()).length() / 2;

    this.controls.target.copy(center);
    this.camera.position
      .copy(center)
      .addScaledVector(direction.normalize(), radius * 4);
    this.camera.near = -radius * 10;
    this.camera.far = radius * 10;
    this.camera.zoom = 1 / (radius * this.padding);
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.render();
  }

  /** Request a redraw on the next animation frame. */
  render() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer.render(this.scene, this.camera);
    });
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
    this.render();
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }
}
