# Brillouin zone and Fermi surface visualizer (web app)

Materials Cloud tool, modelled on SeeK-path web, that shows a crystal's
Brillouin zone, its SeeK-path k-path, and Fermi surfaces from BXSF band
grids. Everything runs in the browser.

It accepts:

- **SeeK-path JSON**: the _Raw data (JSON)_ download of SeeK-path, or the
  Python `seekpath` output saved as JSON;
- **BXSF** band grids.

One file is shown at a time; a new file replaces it.

## Development

```sh
pnpm install
pnpm dev     # http://localhost:5173
pnpm build   # static site in dist/
pnpm lint
```

The layout follows SeeK-path web: `src/FileUpload/` reads the files
(drop zone, examples, parsing) and `src/Fermisurface/` shows the results
(viewer and summaries); the rest of `src/` is the app shell.

`bz-visualizer` is used from source (`../src`) through aliases in
`vite.config.js`. Once it is published, add it as a dependency and remove
the aliases. The example files are in `public/examples/`.
