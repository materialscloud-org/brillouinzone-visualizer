import { createBZVisualizer, parseBXSF } from "../src";

import mc3d10 from "../legacy/brillouinzone-visualizer/src/example_data/mc3d-10.json";
import mc3d10016 from "../legacy/brillouinzone-visualizer/src/example_data/mc3d-10016.json";

const $ = (id: string) => document.getElementById(id)!;

createBZVisualizer($("bz-1"), mc3d10);
createBZVisualizer($("bz-2"), mc3d10016, { showPathpoints: true });

const text = await fetch("/legacy/fermisurface-visualiser/convert-bxsf/BXSFfiles/file2.bxsf").then((r) => r.text());
const fermi = parseBXSF(text);

// No seekpath output exists for this BXSF file. It uses the same fcc cell
// setting as mc3d-10016, whose fractional k-path is the standard fcc path,
// so that path is borrowed here on the BXSF lattice.
const [b1, b2, b3] = [0, 3, 6].map((i) => [...fermi.reciprocalBasis.data.slice(i, i + 3)]);
createBZVisualizer($("fs"), { ...mc3d10016, b1, b2, b3 }, { fermi });
