# bz-visualizer

Brillouin zone and Fermi surface visualisation on three.js. This repository
combines the two earlier projects and keeps their history:

- `legacy/brillouinzone-visualizer`: materialscloud-org/brillouinzone-visualizer
- `legacy/fermisurface-visualiser`: materialscloud-org/fermisurface-visualiser

## Entry points

| import | contents | three addons used |
|---|---|---|
| `bz-visualizer` | `Viewer`, `getBrillouinZone`, BZ / vectors / k-path objects, `createBZVisualizer` | OrbitControls, ConvexGeometry, CSS2DRenderer |
| `bz-visualizer/fermi` | `parseBXSF`, `FermiSurface` | MarchingCubes |

The package is marked `sideEffects: false`, so code that only draws a
Brillouin zone does not bundle the Fermi-surface code.

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
