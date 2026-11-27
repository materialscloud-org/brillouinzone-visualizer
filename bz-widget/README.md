# bz-widget

[bz-visualizer](..) in Jupyter (JupyterLab, Notebook, VS Code,
Colab), as an [anywidget](https://anywidget.dev). Brillouin zone, k-path,
k-points and Fermi surfaces.

The layers: the vanilla TS core → its React component
(`bz-visualizer/react`) → this widget, which renders the React component
with `@anywidget/react` and keeps it in sync with a small Python class.

## Usage

```python
import seekpath
from bz_widget import BZVisualizer

# seekpath's output goes straight in (as does seekpath web / matsci-parse JSON)
BZVisualizer(seekpath.get_explicit_k_path(structure))

# Fermi surfaces from a .bxsf file (a path, or its contents as str/bytes)
w = BZVisualizer(bxsf="bands.bxsf", energy_range=[-2, 2], show_axes=False)
w
```

- `w.energy` follows the energy slider (updated when it is released) and
  starts at the file's Fermi energy, `w.fermi_energy`; setting it moves the
  slider.
- `w.view("x")` (or `"y"`, `"z"`, `"reset"`) turns the camera. `w.camera`
  holds the view (`position`, `target`, `up`, `zoom`), updated whenever it is
  moved; assign a saved one, or pass `camera=` when creating, to restore it.
- Options are any bz-visualizer option, in snake_case or camelCase
  (`show_axes`, `axis_length`, `colors`, `widths`, `controls`, ...). They are in
  `w.options`; assign a new dict to change them live:
  `w.options = {**w.options, "colors": {"zone": "#9ab8d8"}}`.
- `w.seekpath`, `w.bxsf` and `w.height` can be replaced too.

See `examples/demo.ipynb`.

## Development

```bash
pnpm install          # links the parent package; build it first (pnpm build in ..)
pnpm build            # -> src/bz_widget/static/widget.{js,css}
pip install -e ".[test]"
pytest
```

`pnpm dev` rebuilds on change; re-run the notebook cell to pick it up.

The .bxsf file is sent to the browser as bytes and parsed there, so large
files cost their full size in transfer (the 224 MB example takes a while).
