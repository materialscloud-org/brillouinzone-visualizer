import pathlib

import numpy as np
import traitlets
import pytest
import seekpath

from bz_widget import BZVisualizer, seekpath_json

BXSF = pathlib.Path(__file__).parents[2] / "demo/data/simple_example.bxsf"

NACL = (
    [[5.64, 0, 0], [0, 5.64, 0], [0, 0, 5.64]],
    [[0, 0, 0], [0, .5, .5], [.5, 0, .5], [.5, .5, 0], [.5, .5, .5], [.5, 0, 0], [0, .5, 0], [0, 0, .5]],
    [11] * 4 + [17] * 4,
)


def test_seekpath_result_is_converted_to_plain_json():
    result = seekpath.get_explicit_k_path(NACL)
    w = BZVisualizer(result)
    assert set(w.seekpath) == {"b1", "b2", "b3", "kpoints_rel", "path", "explicit_kpoints_rel"}
    assert w.seekpath["b1"] == np.asarray(result["reciprocal_primitive_lattice"][0]).tolist()
    assert w.seekpath["kpoints_rel"]["GAMMA"] == [0, 0, 0]
    assert isinstance(w.seekpath["explicit_kpoints_rel"][0], list)


def test_seekpath_web_json_passes_through():
    data = {"b1": [1, 0, 0], "b2": [0, 1, 0], "b3": [0, 0, 1], "faces_data": {}}
    assert seekpath_json(data) == data


def test_bxsf_from_path_str_or_bytes():
    raw = BXSF.read_bytes()
    assert BZVisualizer(bxsf=BXSF).bxsf == raw
    assert BZVisualizer(bxsf=str(BXSF)).bxsf == raw
    assert BZVisualizer(bxsf=raw.decode()).bxsf == raw
    assert BZVisualizer(bxsf=raw).bxsf == raw
    with pytest.raises(Exception):
        BZVisualizer(bxsf=123)


def test_options_take_snake_case_and_numpy():
    w = BZVisualizer(show_axes=False, energy_range=np.array([-2.0, 2.0]), colors={"zone": "#fff"})
    assert w.options == {"showAxes": False, "energyRange": [-2.0, 2.0], "colors": {"zone": "#fff"}}
    w.options = {"axis_length": 0.8}
    assert w.options == {"axisLength": 0.8}


def test_fermi_energy_is_read_only_but_set_by_the_browser():
    w = BZVisualizer(bxsf=BXSF)
    with pytest.raises(traitlets.TraitError):
        w.fermi_energy = 1.0
    w.set_state({"fermi_energy": 7.2709, "energy": 7.2709})  # as the frontend does
    assert (w.fermi_energy, w.energy) == (7.2709, 7.2709)


def test_camera_is_checked_and_view_takes_a_direction():
    state = {"position": np.array([1.0, 2, 3]), "target": [0, 0, 0], "up": [0, 1, 0], "zoom": 1.5}
    w = BZVisualizer(camera=state)
    assert w.camera["position"] == [1.0, 2.0, 3.0] and "camera" not in w.options
    with pytest.raises(traitlets.TraitError):
        w.camera = {"position": [1, 2, 3]}
    with pytest.raises(ValueError):
        w.view("w")
    w.view("x")  # not displayed: nothing to receive it, but no error
