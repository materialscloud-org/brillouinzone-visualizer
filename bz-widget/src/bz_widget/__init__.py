"""bz-visualizer for Jupyter: Brillouin zone, k-path and Fermi surfaces."""

from __future__ import annotations

import os
import pathlib
import re
from typing import Any

import anywidget
import traitlets

__all__ = ["BZVisualizer"]

_STATIC = pathlib.Path(__file__).parent / "static"


def _camel(key: str) -> str:
    """show_axes -> showAxes; names already in camelCase are kept."""
    return re.sub(r"_([a-z])", lambda m: m.group(1).upper(), key)


def _plain(value: Any) -> Any:
    """numpy arrays (and anything else with .tolist) to plain lists, for JSON."""
    if hasattr(value, "tolist"):
        return value.tolist()
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(v) for v in value]
    return value


def seekpath_json(data: dict | None) -> dict | None:
    """
    The visualizer's input from a seekpath result: `seekpath.get_path` or
    `get_explicit_k_path` output is converted; anything else (seekpath web
    JSON, matsci-parse output) is passed through.
    """
    if data is None:
        return None
    data = _plain(dict(data))
    if "point_coords" in data:  # seekpath's Python output
        b1, b2, b3 = data["reciprocal_primitive_lattice"]
        converted = {
            "b1": b1,
            "b2": b2,
            "b3": b3,
            "kpoints_rel": data["point_coords"],
            "path": data["path"],
        }
        if "explicit_kpoints_rel" in data:
            converted["explicit_kpoints_rel"] = data["explicit_kpoints_rel"]
        return converted
    return data


class BZVisualizer(anywidget.AnyWidget):
    """
    Brillouin zone, k-path, k-points and Fermi surfaces.

    >>> import seekpath
    >>> BZVisualizer(seekpath.get_explicit_k_path(structure))
    >>> BZVisualizer(bxsf="bands.bxsf", show_axes=False)

    Parameters
    ----------
    seekpath : a seekpath result, or the same JSON the JS library takes
        (b1, b2, b3, kpoints_rel, path, explicit_kpoints_rel, ...).
    bxsf : a .bxsf file for Fermi surfaces: a path, or its contents as
        bytes or str. It is parsed in the browser.
    energy : the Fermi-surface energy (eV). Synced both ways: releasing the
        slider updates it, and setting it moves the slider. Unset, it starts
        at the Fermi energy once the file is read (`fermi_energy`).
    camera : a view to start from, as saved from `camera` earlier.
    height : CSS height of the widget.
    **options : any bz-visualizer option, in snake_case or camelCase
        (show_axes, axis_length, colors, energy_range, controls, ...).
        Stored in `options`; assign a new dict there to change them.
    """

    _esm = _STATIC / "widget.js"
    _css = _STATIC / "widget.css"

    seekpath = traitlets.Dict(allow_none=True, default_value=None).tag(sync=True)
    # bytes go to the browser as a binary buffer, not JSON
    bxsf = traitlets.Any(default_value=None).tag(sync=True)
    energy = traitlets.Float(allow_none=True, default_value=None).tag(sync=True)
    #: The file's Fermi energy (eV), set by the browser once it has read the file
    fermi_energy = traitlets.Float(
        allow_none=True, default_value=None, read_only=True
    ).tag(sync=True)
    #: The camera: {position, target, up, zoom}. Updated when the view is moved
    #: (after a drag, a wheel step or a camera button); set it to restore a view.
    camera = traitlets.Dict(allow_none=True, default_value=None).tag(sync=True)
    options = traitlets.Dict().tag(sync=True)
    height = traitlets.Unicode("500px").tag(sync=True)

    def __init__(
        self,
        seekpath: dict | None = None,
        *,
        bxsf: str | os.PathLike | bytes | None = None,
        energy: float | None = None,
        camera: dict | None = None,
        height: str = "500px",
        **options: Any,
    ):
        super().__init__(
            seekpath=seekpath,
            bxsf=bxsf,
            energy=energy,
            camera=camera,
            height=height,
            options=options,
        )

    VIEWS = ("x", "y", "z", "b1", "b2", "b3", "b1*", "b2*", "b3*", "reset")

    def view(self, direction: str = "reset") -> None:
        """Look along x, y or z, a reciprocal vector b1-b3, b1*-b3* (the
        real-space axes a1-a3), or back at the default view ("reset").

        Needs the widget on screen: the message goes to the views showing it.
        """
        if direction not in self.VIEWS:
            raise ValueError(f"direction must be one of {self.VIEWS}")
        self.send({"type": "view", "direction": direction})

    @traitlets.validate("camera")
    def _valid_camera(self, proposal):
        camera = proposal["value"]
        if camera is None:
            return None
        camera = _plain(dict(camera))
        if set(camera) != {"position", "target", "up", "zoom"}:
            raise traitlets.TraitError("camera needs position, target, up and zoom")
        return camera

    @traitlets.validate("seekpath")
    def _valid_seekpath(self, proposal):
        return seekpath_json(proposal["value"])

    @traitlets.validate("bxsf")
    def _valid_bxsf(self, proposal):
        value = proposal["value"]
        if value is None or isinstance(value, bytes):
            return value
        if isinstance(value, str) and "BANDGRID" in value:  # the file's contents
            return value.encode()
        if isinstance(value, (str, os.PathLike)):
            return pathlib.Path(value).read_bytes()
        raise traitlets.TraitError("bxsf must be a path, bytes, str or None")

    @traitlets.validate("options")
    def _valid_options(self, proposal):
        return {_camel(k): _plain(v) for k, v in proposal["value"].items()}
