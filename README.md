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
new BZVisualizer(el, { b1, b2, b3, kpoints, mesh: [6, 6, 6], offset: [0.5, 0.5, 0.5] });

// Fermi surfaces from a .bxsf file, with or without a k-path
new BZVisualizer(el, seekpathJson, { fermi: parseBXSF(bxsfText) });

vis.dispose(); // when done
```

## Usage (TypeScript + React)

```tsx
import { useEffect, useRef } from "react";
import { BZVisualizer, type BZVisualizerOptions, type SeekpathJSON } from "bz-visualizer";
import "bz-visualizer/style.css";

export function BZVis({ data, options }: { data: SeekpathJSON; options?: BZVisualizerOptions }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vis = new BZVisualizer(ref.current!, data, options);
    return () => vis.dispose();
  }, [data, options]); // memoise these, or every new object rebuilds the view

  return <div ref={ref} style={{ height: 500 }} />;
}
```

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

`showAxes`, `showBVectors`, `showKPath`, `showKPoints`, `foldKPoints`,
`showLabels`, `controls` (set to `false` to hide the bar), and for Fermi
data `energy`, `energyRange` and `fermiOptions`. At runtime: `setVisible`,
`setFolded`, `setLabels`, `setColor`, `setOpacity`, `setEnergy`.

The viewer ignores the mouse until clicked. Left-drag rotates, right-drag
pans, the wheel zooms. Under the viewer there are camera buttons, the
energy slider, and a Settings panel with the layer toggles and colours.

## Styling

`style.css` is a plain stylesheet. Theme it by overriding variables on
`.bzv`, e.g. `--bzv-accent`, `--bzv-border`, `--bzv-radius`,
`--bzv-control-background` and `--bzv-font` (all are listed at the top of
`src/style.css`).

## Development

```bash
pnpm install
pnpm dev        # demo with an example picker, http://localhost:5173
pnpm test
pnpm build
```

The demo data is in `demo/data/`.
