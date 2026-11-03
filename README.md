# bz-visualizer

Brillouin zone and Fermi surface visualisation on three.js. This repository
combines the two earlier projects and keeps their history:

- `legacy/brillouinzone-visualizer`: materialscloud-org/brillouinzone-visualizer
- `legacy/fermisurface-visualiser`: materialscloud-org/fermisurface-visualiser

## Usage

```ts
import { createBZVisualizer, parseBXSF } from "bz-visualizer";

// Brillouin zone + k-path
createBZVisualizer(el, seekpathJson);

// ... plus Fermi surfaces
createBZVisualizer(el, seekpathJson, { fermi: parseBXSF(bxsfText) });
```

The widget is laid out like mc-react-structure-visualizer: the 3D window
ignores the mouse until clicked ("Click to interact"), so the page scrolls
normally over it, and a control box below holds:

- camera buttons (x, y, z, reset);
- toggles for the zone, b vectors, axes, k-path, path points and labels;
- with Fermi data: an E − E_F slider, clipping to the zone, and band chips.

Rotation is free (three's TrackballControls), as in 3Dmol.

## Bundle

One entry, `bz-visualizer`, with the component (`createBZVisualizer` /
`BZVisualizer`), `parseBXSF`, `FermiSurface`, and the building blocks
(`Viewer`, `getBrillouinZone`, BZ / vector / k-path objects). three is a
peer dependency; the addons used are TrackballControls, ConvexGeometry,
Line2, CSS2DRenderer and MarchingCubes.

The Fermi-surface code is bundled in rather than split off: it adds about
6 kB gzipped to an app (most of it three's MarchingCubes), against roughly
152 kB gzipped for three itself.

## Data model

Everything is derived from the reciprocal basis (`types.ts`):

- `getBrillouinZone(reciprocalBasis)` returns the zone corners and face planes.
  three's `ConvexGeometry` and `EdgesGeometry` draw the hull and its edges.
- Band energies are `VolumetricData` grids on the reciprocal cell, read
  straight from BXSF without resampling. `FermiSurface` fills a
  `MarchingCubes` field from the periodic grid over the region around the
  zone, applies the (possibly sheared) basis as the mesh matrix, and clips
  to the zone with GPU clipping planes.

`Matrix`, `KPath` and `VolumetricData` are structural copies of the
matsci-parse types, so matsci-parse objects can be passed in directly.

## Development

```bash
pnpm install
pnpm dev        # demo at http://localhost:5173 (loads BXSF files from legacy/)
pnpm test
pnpm typecheck
pnpm build
```

```ts
import { Viewer, getBrillouinZone, brillouinZoneObject } from "bz-visualizer";
import { FermiSurface, parseBXSF } from "bz-visualizer/fermi";

const data = parseBXSF(await fetch("file.bxsf").then((r) => r.text()));
const bz = getBrillouinZone(data.reciprocalBasis);
const viewer = new Viewer(container);
const surface = new FermiSurface(data, bz).setEnergy(data.fermiEnergy);
viewer.add(brillouinZoneObject(bz), surface);
viewer.fit();

slider.oninput = () => {
  surface.setEnergy(+slider.value);
  viewer.render();
};
```
