import type { BZVisualizer } from "../bzVisualizer";
import type { FermiSurface } from "../fermi/fermiSurface";
import { VIEWS } from "../viewer";
import {
  button,
  checkbox,
  colorInput,
  el,
  gearIcon,
  rangeInput,
  toggleSwitch,
} from "./elements";

export interface ControlsOptions {
  /** Energy slider range relative to the Fermi energy (default [-1, 1]). */
  energyRange?: [number, number];
  energyStep?: number;
}

/**
 * The built-in controls (camera buttons, energy slider, Settings) and the
 * settings panel, floating over the top of the 3D window.
 *
 * It uses only the public BZVisualizer API, so it is also the example for
 * writing your own controls: read the state with the getters, change it
 * with the setters, and redraw on the "statechange" event of `vis.element`.
 * Returns a function that removes it.
 */
export function buildControls(
  vis: BZVisualizer,
  bar: HTMLElement,
  { energyRange = [-1, 1], energyStep = 0.01 }: ControlsOptions = {},
): () => void {
  // Each control whose value follows the widget's state registers an update
  const updates: (() => void)[] = [];
  const follow = <T>(node: T, update: (node: T) => void): T => {
    updates.push(() => update(node));
    return node;
  };

  const check = (
    text: string,
    isOn: () => boolean,
    set: (on: boolean) => void,
    asSwitch = false,
  ) => {
    const label = (asSwitch ? toggleSwitch : checkbox)(text, isOn(), set);
    const input = label.querySelector("input")!;
    return follow(label, () => (input.checked = isOn()));
  };
  const color = (layer: string, part = "") =>
    follow(
      colorInput(vis.getColor(layer, part), "Colour", (c) =>
        vis.setColor(layer, c, part),
      ),
      (input) => (input.value = vis.getColor(layer, part)),
    );
  const opacity = (layer: string, min: number, title: string) =>
    follow(
      rangeInput(min, 1, 0.01, vis.getOpacity(layer), title, (v) =>
        vis.setOpacity(layer, v),
      ),
      (input) => (input.value = String(vis.getOpacity(layer))),
    );
  const layerRow = (layer: string, text: string, ...tools: HTMLElement[]) =>
    el("div", "bzv-panel-row", [
      check(
        text,
        () => vis.isVisible(layer),
        (on) => vis.setVisible(layer, on),
      ),
      el("span", "bzv-tools", tools),
    ]);

  const energyControls = (surface: FermiSurface): HTMLElement[] => {
    const [lo, hi] = energyRange;
    const EF = surface.data.fermiEnergy;
    // Changes made here are announced; the React wrapper's onEnergyChange uses this
    const setByUser = (E: number) => {
      vis.setEnergy(E);
      vis.element.dispatchEvent(
        new CustomEvent("energychange", { detail: { energy: vis.energy } }),
      );
    };
    const readout = el("output");
    const show = () => {
      const dE = Number(slider.value);
      readout.textContent = `${dE >= 0 ? "+" : "−"}${Math.abs(dE).toFixed(2)} eV`;
      readout.title = `E = ${(EF + dE).toFixed(3)} eV`;
    };
    // Coalesce slider events to one re-mesh per frame
    let pending = 0;
    const slider = follow(
      rangeInput(
        lo,
        hi,
        energyStep,
        vis.energy - EF,
        "Energy relative to the Fermi energy",
        () => {
          show();
          pending ||= requestAnimationFrame(() => {
            pending = 0;
            setByUser(EF + Number(slider.value));
          });
        },
      ),
      (input) => {
        input.value = String(vis.energy - EF);
        show();
      },
    );
    const resetE = button("", () => setByUser(EF));
    resetE.replaceChildren("E", el("sub", "", ["F"]));
    resetE.title = "Back to the Fermi energy";
    return [
      el("span", "", ["E−E", el("sub", "", ["F"])]),
      slider,
      readout,
      resetE,
    ];
  };

  const bandControls = (surface: FermiSurface): HTMLElement[] => {
    const chips = surface.meshes.map((mesh, i) => {
      const band = `band:${i}`;
      const name = el("span", "", [mesh.name]);
      name.title = "Show / hide";
      name.addEventListener("click", () =>
        vis.setVisible(band, !vis.isVisible(band)),
      );
      return follow(el("span", "bzv-band", [color(band), name]), (chip) =>
        chip.classList.toggle("off", !vis.isVisible(band)),
      );
    });
    return [
      el("div", "bzv-bands", chips),
      el("div", "bzv-panel-row", [
        "Opacity",
        opacity("fermi", 0.1, "Surface opacity"),
      ]),
      el("div", "bzv-panel-row", [
        check(
          "Clip to zone",
          () => vis.clipping,
          (on) => vis.setClipping(on),
        ),
      ]),
    ];
  };

  // --- layout ---------------------------------------------------------------
  const energy = el("div", "bzv-group bzv-energy");
  const panel = el("div", "bzv-panel");
  const settingsButton = button("Settings", () =>
    setOpen(!panel.classList.contains("open")),
  );
  settingsButton.classList.add("bzv-settings-button");
  settingsButton.append(gearIcon());
  settingsButton.setAttribute("aria-expanded", "false");
  bar.append(
    el("div", "bzv-row", [
      el("div", "bzv-group", [
        "Camera:",
        button("x", () => vis.viewer.fit(vis.viewer.content, VIEWS.x)),
        button("y", () => vis.viewer.fit(vis.viewer.content, VIEWS.y)),
        button("z", () => vis.viewer.fit(vis.viewer.content, VIEWS.z)),
        button("reset", () => vis.viewer.fit()),
      ]),
      energy,
      settingsButton,
    ]),
    panel, // opens under the bar, on the right
  );

  // Rebuild what depends on the data; afterwards only values are updated
  const rebuild = () => {
    updates.length = 0;
    const surface = vis.fermiSurface;
    const kpath = vis.getLayer("kpath");
    energy.hidden = !surface;
    energy.replaceChildren(...(surface ? energyControls(surface) : []));
    panel.replaceChildren(
      layerRow(
        "bz",
        "Zone",
        opacity("bz", 0, "Opacity"),
        color("bz", "fill"),
        color("bz", "edges"),
      ),
      layerRow("vectors", "b vectors"),
      layerRow("axes", "Axes"),
      ...(kpath
        ? [
            layerRow(
              "kpath",
              "k-path",
              ...(kpath.getObjectByName("path")
                ? [color("kpath", "path")]
                : []),
              color("kpath", "points"),
            ),
          ]
        : []),
      ...(vis.getLayer("kpoints")
        ? [
            layerRow("kpoints", "k-points", color("kpoints")),
            el("div", "bzv-panel-row indent", [
              check(
                "Fold into BZ",
                () => vis.folded,
                (on) => vis.setFolded(on),
                true,
              ),
            ]),
          ]
        : []),
      el("div", "bzv-panel-row", [
        check(
          "Labels",
          () => vis.labelsShown,
          (on) => vis.setLabels(on),
        ),
      ]),
      ...(surface ? bandControls(surface) : []),
    );
  };
  let shown: unknown[] = [];
  const refresh = () => {
    const data = [
      vis.getLayer("kpath"),
      vis.getLayer("kpoints"),
      vis.fermiSurface,
    ];
    if (data.some((layer, i) => layer !== shown[i])) {
      shown = data;
      rebuild();
    }
    updates.forEach((update) => update());
  };
  refresh();
  vis.element.addEventListener("statechange", refresh);

  // --- opening and closing the panel ------------------------------------------
  const setOpen = (open: boolean) => {
    panel.classList.toggle("open", open);
    settingsButton.setAttribute("aria-expanded", String(open));
  };
  // Using the controls should not switch on mouse interaction with the scene
  bar.addEventListener("mousedown", (e) => e.stopPropagation());
  const onDocumentClick = (e: MouseEvent) => {
    const target = e.target as Node;
    if (!panel.contains(target) && !settingsButton.contains(target))
      setOpen(false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  };
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKey);

  return () => {
    vis.element.removeEventListener("statechange", refresh);
    document.removeEventListener("click", onDocumentClick);
    document.removeEventListener("keydown", onKey);
    bar.replaceChildren();
  };
}
