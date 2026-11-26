# bz-visualizer

Brillouin zone, k-point and Fermi surface viewer built on three.js. It
replaces two earlier projects, whose code and history are kept in
`legacy/`: brillouinzone-visualizer and fermisurface-visualiser.

## Install

```bash
pnpm add bz-visualizer three
```

three is a peer dependency, so your app supplies one copy of it (and its
addons).

## Usage (TypeScript)

```ts
import { BZVisualizer, parseBXSF } from "bz-visualizer";
import "bz-visualizer/style.css";

const el = document.getElementById("viz")!; // needs a height

// Zone + k-path from seekpath JSON
const vis = new BZVisualizer(el, seekpathJson);

// k-points: explicit (fractional or Cartesian) or an AiiDA-style mesh
new BZVisualizer(el, {
  b1,
  b2,
  b3,
  kpoints,
  mesh: [6, 6, 6],
  offset: [0.5, 0.5, 0.5],
});

// Fermi surfaces from a .bxsf file, with or without a k-path
new BZVisualizer(el, seekpathJson, { fermi: parseBXSF(bxsfText) });

vis.dispose(); // when done
```

## Usage (TypeScript + React)

A ready-made component is in `bz-visualizer/react` (React 18 or later):

```tsx
import { useState } from "react";
import { BZVisualizer } from "bz-visualizer/react";
import "bz-visualizer/style.css";

export function FermiView({ seekpath, fermi }) {
  const [energy, setEnergy] = useState(fermi.fermiEnergy);
  return (
    <BZVisualizer
      seekpath={seekpath}
      fermi={fermi}
      energy={energy}
      onEnergyChange={setEnergy}
      colors={bzTheme}
      style={{ height: 500 }}
    />
  );
}
```

- The wrapper keeps no state: the widget is the one source of truth, and
  props are pushed into it.
- The live options (`LIVE_OPTIONS`: `energy`, `cutPlanes`, `colors`,
  `widths`, `perspective`, `axisLength`, the `show*` flags, `foldKPoints`)
  update the widget in place, each only when its own value changes. A
  choice made in the Settings panel therefore stays until you change that
  prop. Any other option (`controls`, `energyRange`, `fermiOptions`, …)
  rebuilds the widget from the props; the camera stays if the lattice does.
- New `seekpath` or `fermi` data on the same lattice (e.g. from a "k-points
  per line" slider) is swapped in; a new lattice rebuilds.
- `onEnergyChange` reports the slider; `onStateChange(vis)` reports every
  change, panel ones included, to mirror it in your own state.
- Data is compared by identity, so keep it in state or `useMemo`; options
  are compared by value.
- A `ref` gives the underlying `BZVisualizer`, for everything else.

New live options need no wrapper changes: they are added to `BZLiveOptions`
and `LIVE_OPTIONS` in the core (the compiler checks the two match).

## Input

- **`seekpathJson`**: `b1`, `b2`, `b3` (required), plus optional labelled
  points (`kpoints_rel` or Cartesian `kpoints`), `path`, explicit points
  (`explicit_kpoints_rel` or `explicit_kpoints_abs`), or a `mesh` with an
  `offset` in grid-spacing units. This is the output of seekpath and of
  matsci-parse `getBrillouinZoneData`.
- **`fermi`**: band grids, e.g. from `parseBXSF`. Use them as they are; no
  resampling is needed. If a k-path is also given, it must be on the same
  lattice, otherwise you get a warning.

## Options

`showAxes`, `axisLength` (relative to the longest reciprocal vector,
default 1.15), `showBVectors`, `showKPath`, `showKPoints`, `foldKPoints`,
`showLabels`, `colors`, `widths` (`{ kpath, zoneEdges }` in pixels),
`controls` (`false` hides them all, `{ settings: false }` only the
Settings panel), and for Fermi data `energy`, `energyRange` and
`fermiOptions`.

`fermiOptions` sets how the Fermi surfaces are built:

```ts
fermiOptions: {
  gridStep: 1,          // march every Nth grid point (2: 8× fewer cells, less detail)
  dragGridStep: 2,      // the same while the slider is dragged; 1 = never coarser
  cachePrecision: 3,    // energies are cached to this many decimals
  maxCacheSize: 128,    // surfaces kept in the cache
  colors, opacity, clip, cutPlanes,
}
```

While the slider is dragged the surfaces are drawn from every
`dragGridStep`th point, and the full surface follows on release. For a big
file (say over 100 ms per full surface), try `dragGridStep: 4`.

At runtime: `setOptions` (the `show*` flags, `axisLength`,
`foldKPoints`, `colors`, `widths`, `energy`, `cutPlanes`, `perspective`;
choices are kept when the data is swapped), `setVisible`, `setFolded`,
`setLabels`, `setColor`, `setOpacity`, `setEnergy` (`setEnergy(E, true)`
previews at `dragGridStep`, for a slider being dragged), `setCutPlanes`,
`setPerspective`, `setView`, and `setSeekpath` / `setFermi` to replace the
k-points or band data in place (same lattice; settings and camera stay, the
energy keeps its offset from E_F).

The camera is orthographic; `perspective: true` (or the Settings toggle, or
`setPerspective`) switches to perspective, keeping the view. `setView(name)`
looks along `"x"`, `"y"`, `"z"`, a reciprocal vector `"b1"`–`"b3"`, or
`"b1*"`–`"b3*"`, the real-space axes a1–a3 (each perpendicular to the other
two b's); `"default"` is the starting view.

To cut the Fermi surfaces open, pass planes as a point and a normal in
Cartesian k; the side the normal points to is removed:

```ts
new BZVisualizer(el, seekpathJson, {
  fermi,
  fermiOptions: { cutPlanes: [{ point: [0, 0, 0], normal: [0, 0, 1] }] },
});
vis.setCutPlanes([]); // remove the cuts
```

The viewer ignores the mouse until clicked (`clickToInteract: false` turns
this off), so the page scrolls normally over it. Left-drag rotates,
right-drag pans, the wheel zooms. The hint is the `interactGuard` option:
`overlayGuard` (default: on hover, dims the scene and says "Click to
interact"; themed with `--bzv-overlay-background` and
`--bzv-overlay-color`), `false` for none, or your own:

```ts
import type { InteractGuard } from "bz-visualizer";

// Any element; show it while `viewer.isInteractive` is false
const myGuard: InteractGuard = (viewer) => {
  const hint = document.createElement("div");
  hint.className = "my-hint";
  hint.textContent = "Click to explore";
  const sync = () => (hint.hidden = viewer.isInteractive);
  viewer.container.addEventListener("interactivechange", sync);
  sync();
  return hint;
};
```

The guards are in `src/ui/guards/`.

Over the top of the viewer float camera buttons, the
energy slider, and a Settings panel with the layer toggles and colours.

### Your own controls

Pass `controls: false` and build them from the public API. Read the state
with `isVisible`, `getColor`, `getOpacity`, `energy`, `folded`,
`labelsShown`, `clipping` and `fermiSurface` (its `energyRanges` give each
band's [min, max], so a band has a surface at E when min ≤ E ≤ max); change it
with the setters;
redraw when `vis.element` fires `"statechange"` (after every change,
including ones from code). The built-in panel, `src/ui/controls.ts`, is
written this way and makes a working example.

```ts
const vis = new BZVisualizer(el, data, { controls: false });
const axes = document.querySelector<HTMLInputElement>("#axes")!;
axes.onchange = () => vis.setVisible("axes", axes.checked);
vis.element.addEventListener("statechange", () => {
  axes.checked = vis.isVisible("axes");
});
```

### Drawing your own things

The package exports the component, `parseBXSF`, `getBrillouinZone` and the
types, not its scene pieces. If you know three.js, the scene is yours:

```ts
import { Mesh, MeshBasicMaterial, SphereGeometry } from "three";

const marker = new Mesh(
  new SphereGeometry(0.05),
  new MeshBasicMaterial({ color: "red" }),
);
marker.position.set(0.5, 0, 0); // Cartesian k
vis.viewer.content.add(marker); // counted when framing the view; or vis.viewer.scene
vis.viewer.render(); // draws on demand
```

`vis.viewer` also has `camera`, `renderer`, `controls` and `labelRenderer`,
and `vis.bz` / `vis.reciprocalBasis` give the zone and the lattice.

## Styling

`style.css` is a plain stylesheet. Theme it by overriding variables on
`.bzv`, e.g. `--bzv-accent`, `--bzv-border`, `--bzv-radius`,
`--bzv-control-background` and `--bzv-font` (all are listed at the top of
`src/style.css`). Labels use `--bzv-label-color` and `--bzv-label-glow`
(a `text-shadow`); the b1–b3 labels keep their arrow colours.

The 3D colours are an option, so one theme object can be shared across
apps (any CSS colour string or hex number; anything left out keeps its
default):

```ts
import type { BZColors } from "bz-visualizer";

export const bzTheme: BZColors = {
  zone: "#9ab8d8",
  zoneEdges: "#2b3a4a",
  kpath: "#e8590c",
  highSymmetryPoints: "#e8590c",
  kpoints: "#8a4b2a",
  labels: "#000", // sets --bzv-label-color
};

new BZVisualizer(el, seekpathJson, { colors: bzTheme });
```

## Development

```bash
pnpm install
pnpm dev        # demo with an example picker, http://localhost:5173
pnpm test
pnpm build
```

The demo data is in `demo/data/`.
