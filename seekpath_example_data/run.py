#!/usr/bin/env python

import seekpath
from seekpath.brillouinzone.brillouinzone import get_BZ
import ase.io
import ase.visualize
import numpy as np
import json
from pathlib import Path

def get_data_for_visualizer(cell, relcoords, atomic_numbers):
    system = (np.array(cell), np.array(relcoords), np.array(atomic_numbers))
    res = seekpath.get_explicit_k_path(system, with_time_reversal=False)
    
    b1, b2, b3 = res['reciprocal_primitive_lattice']
    faces_data = get_BZ(b1=b1, b2=b2, b3=b3)

    kpoints_rel = res["point_coords"]
    kpoints_abs = {
        k: (v[0] * np.array(b1) + v[1] * np.array(b2) + v[2] * np.array(b3)).tolist()
        for k, v in kpoints_rel.items()
    }

    response = {
        "faces_data": faces_data,
        "b1": b1,
        "b2": b2,
        "b3": b3,
        "kpoints": kpoints_abs,
        "kpoints_rel": kpoints_rel,
        "path": res["path"],
        "explicit_kpoints_rel": res["explicit_kpoints_rel"].tolist(),
        "explicit_kpoints_linearcoord": res["explicit_kpoints_linearcoord"].tolist(),
        "explicit_kpoints_labels": res["explicit_kpoints_labels"],
        "explicit_kpoints_abs": res["explicit_kpoints_abs"].tolist(),
        "explicit_segments": res["explicit_segments"],
    }

    return response


for struct_file in Path.cwd().glob("*.cif"):
  print(struct_file.name)
  atoms = ase.io.read(struct_file)
  result = get_data_for_visualizer(atoms.cell, atoms.get_scaled_positions(), atoms.numbers)
  with open(f"./{struct_file.stem}.json", "w") as f:
    json.dump(result, f, indent=2)