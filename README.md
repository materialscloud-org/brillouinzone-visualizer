# Brillouin zone visualizer

[![NPM Version](https://img.shields.io/npm/v/brillouinzone-visualizer)](https://www.npmjs.com/package/brillouinzone-visualizer)

A JavaScript library, built on three.js, to visualize the 1st Brillouin
zone (BZ) of crystal structures: the high-symmetry k-path, explicit
k-points or meshes, and Fermi surfaces from band grids (`.bxsf` files).

The main input is the `json` generated from a crystal structure by
[seekpath](https://github.com/giovannipizzi/seekpath); see `demo/data/` for
examples.

Version 1 is a rewrite that also replaces
[fermisurface-visualiser](https://github.com/materialscloud-org/fermisurface-visualiser);
the code of both earlier projects is in this repository's git history
(before `17b359a`). A Jupyter widget is in
`bz-widget/` (the earlier one: [widget-bzvisualizer](https://github.com/osscar-org/widget-bzvisualizer)).

## Usage

```bash
npm install brillouinzone-visualizer three
```

```ts
import { BZVisualizer, parseBXSF } from "brillouinzone-visualizer";
import "brillouinzone-visualizer/style.css";

const el = document.getElementById("viz")!; // needs a height

const vis = new BZVisualizer(el, seekpathJson); // zone + k-path
new BZVisualizer(el, seekpathJson, { fermi: parseBXSF(bxsfText) }); // + Fermi surfaces
new BZVisualizer(el, { b1, b2, b3, mesh: [6, 6, 6] }); // a k-point mesh

vis.dispose(); // when done
```

React (18 or later):

```tsx
import { BZVisualizer } from "brillouinzone-visualizer/react";

<BZVisualizer
  seekpath={seekpath}
  fermi={fermi}
  energy={energy}
  onEnergyChange={setEnergy}
  style={{ height: 500 }}
/>;
```

Options such as `energy`, `colors` and the `show*` flags update the widget
in place; others rebuild it. Data is compared by identity, so keep it in
state or `useMemo`. A `ref` gives the underlying `BZVisualizer`.

## Options

- Layers: `showAxes`, `showBVectors`, `showKPath`, `showKPoints`,
  `foldKPoints`, `showLabels`, `axisLength`.
- Look: `colors`, `widths`, `perspective`.
- Fermi surfaces: `energy`, `energyRange`, and `fermiOptions` (`gridStep`,
  `dragGridStep` for the coarser preview while the slider is dragged,
  `cutPlanes`, `clip`, `opacity`, `colors`).
- Controls: `controls` (`false` hides them, `{ settings: false }` only the
  Settings panel), `clickToInteract`, `interactGuard`.

At runtime, `setOptions` changes any of the live ones, and there are
setters (`setVisible`, `setColor`, `setEnergy`, `setView`, `setPerspective`,
`setCutPlanes`, …); `setSeekpath` / `setFermi` swap the data in place. Every
change fires `"statechange"` on `vis.element`. The three.js scene is
`vis.viewer.scene`.

Theme the controls with the CSS variables at the top of `src/style.css`
(`--bzv-accent`, `--bzv-label-color`, …).

## Development

A demo page is included for development and to demonstrate the usage of
the library. Start it by

```bash
pnpm install
pnpm dev
pnpm test
```

### Publishing a new version

To make a new version and publish to npm via GitHub Actions:

```bash
pnpm version major/minor/patch
git push --follow-tags
```
