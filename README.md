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

- New `seekpath` or `fermi` data on the same lattice (e.g. from a "k-points
  per line" slider) is swapped into the live widget; the camera and
  settings stay. A new lattice, or a change to an option that shapes the
  widget (`controls`, `energyRange`, `fermiOptions`, …), rebuilds it.
- `energy`, `cutPlanes`, `colors`, `widths`, `axisLength`, `showAxes`, `showBVectors`, `showKPath`,
  `showKPoints`, `foldKPoints` and `showLabels` update the live widget, and
  the settings panel follows them.
- Data is compared by identity, so keep it in state or `useMemo`; options
  are compared by value.
- A `ref` gives the underlying `BZVisualizer`, for everything else.

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
`fermiOptions`. At runtime: `setOptions` (the `show*` flags, `axisLength`,
`foldKPoints`, `colors`, `widths`, `energy`, `cutPlanes`; choices are kept
when the data is swapped), `setVisible`, `setFolded`, `setLabels`, `setColor`, `setOpacity`, `setEnergy` (`setEnergy(E, true)` gives a coarse preview for a slider being dragged),
`setCutPlanes`, and `setSeekpath` / `setFermi` to replace the k-points or
band data in place (same lattice; settings and camera stay, the energy keeps
its offset from E_F).

To cut the Fermi surfaces open, pass planes as a point and a normal in
Cartesian k; the side the normal points to is removed:

```ts
new BZVisualizer(el, seekpathJson, {
  fermi,
  fermiOptions: { cutPlanes: [{ point: [0, 0, 0], normal: [0, 0, 1] }] },
});
vis.setCutPlanes([]); // remove the cuts
```

The viewer ignores the mouse until clicked. Left-drag rotates, right-drag
pans, the wheel zooms. Over the top of the viewer float camera buttons, the
energy slider, and a Settings panel with the layer toggles and colours.

### Your own controls

Pass `controls: false` and build them from the public API. Read the state
with `isVisible`, `getColor`, `getOpacity`, `energy`, `folded`,
`labelsShown`, `clipping` and `fermiSurface`; change it with the setters;
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
