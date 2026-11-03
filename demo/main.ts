import { BZVisualizer, createBZVisualizer, parseBXSF, type SeekpathJSON } from "../src";

import mc3d10 from "../legacy/brillouinzone-visualizer/src/example_data/mc3d-10.json";
import mc3d10016 from "../legacy/brillouinzone-visualizer/src/example_data/mc3d-10016.json";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// --- Brillouin zone only --------------------------------------------------

const seekpathFiles: Record<string, SeekpathJSON> = {
  "mc3d-10": mc3d10,
  "mc3d-10016": mc3d10016,
};
let bzVis: BZVisualizer | undefined;

function showBZ() {
  bzVis?.dispose();
  bzVis = createBZVisualizer($("bz-plot"), seekpathFiles[$<HTMLSelectElement>("bz-file").value], {
    showPathpoints: $<HTMLInputElement>("bz-pathpoints").checked,
  });
}
$("bz-file").addEventListener("change", showBZ);
$("bz-pathpoints").addEventListener("change", showBZ);
showBZ();

// --- Brillouin zone + Fermi surfaces --------------------------------------

let fsVis: BZVisualizer | undefined;
const status = (msg: string) => ($("status").textContent = msg);

async function showFermi() {
  const name = $<HTMLSelectElement>("fs-file").value;
  status(`loading ${name}.bxsf …`);
  const text = await fetch(`/legacy/fermisurface-visualiser/convert-bxsf/BXSFfiles/${name}.bxsf`).then((r) => r.text());
  const fermi = parseBXSF(text);

  // No seekpath output exists for these BXSF files. The fcc files use the same
  // cell setting as mc3d-10016 (also fcc), whose fractional k-path is the
  // standard fcc path, so it is borrowed here on the BXSF lattice.
  const [b1, b2, b3] = [0, 3, 6].map((i) => [...fermi.reciprocalBasis.data.slice(i, i + 3)]);
  const seekpath =
    $<HTMLInputElement>("fs-kpath").checked && name !== "example"
      ? { ...mc3d10016, b1, b2, b3 }
      : undefined;

  fsVis?.dispose();
  const t = performance.now();
  fsVis = createBZVisualizer($("fs-plot"), seekpath, {
    fermi,
    fermiOptions: { clip: $<HTMLInputElement>("fs-clip").checked },
    energy: fermi.fermiEnergy + Number($<HTMLInputElement>("fs-energy").value),
  });
  await fsVis.ready;
  status(`${fermi.bands.length} bands, grid ${fermi.bands[0].shape.join("×")}, ready in ${(performance.now() - t).toFixed(0)} ms`);

  $("fs-legend").replaceChildren(
    ...fsVis.fermiSurface!.meshes.map((mesh) => {
      const label = document.createElement("label");
      const box = Object.assign(document.createElement("input"), { type: "checkbox", checked: true });
      box.addEventListener("change", () => {
        mesh.visible = box.checked;
        fsVis!.viewer.render();
      });
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = `#${mesh.material.color.getHexString()}`;
      label.append(box, swatch, mesh.name);
      return label;
    }),
  );
}

function updateEnergy() {
  const dE = Number($<HTMLInputElement>("fs-energy").value);
  $("fs-energy-label").textContent = `${dE.toFixed(2)} eV`;
  if (!fsVis?.fermiSurface) return;
  const t = performance.now();
  fsVis.setEnergy(fsVis.fermiSurface.data.fermiEnergy + dE);
  status(`E = ${fsVis.fermiSurface.energy.toFixed(3)} eV, meshed in ${(performance.now() - t).toFixed(0)} ms`);
}

for (const id of ["fs-file", "fs-clip", "fs-kpath"]) $(id).addEventListener("change", showFermi);
$("fs-energy").addEventListener("input", updateEnergy);
showFermi();
