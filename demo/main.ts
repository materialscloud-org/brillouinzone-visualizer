import {
  Viewer,
  brillouinZoneObject,
  createBZVisualizer,
  getBrillouinZone,
  reciprocalVectorsObject,
  type SeekpathJSON,
} from "../src";
import { FermiSurface, parseBXSF } from "../src/fermi";

import mc3d10 from "../legacy/brillouinzone-visualizer/src/example_data/mc3d-10.json";
import mc3d10016 from "../legacy/brillouinzone-visualizer/src/example_data/mc3d-10016.json";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// --- Brillouin zone panel -------------------------------------------------

const seekpathFiles: Record<string, SeekpathJSON> = {
  "mc3d-10": mc3d10,
  "mc3d-10016": mc3d10016,
};
let bzViewer: Viewer | undefined;

function showBZ() {
  bzViewer?.dispose();
  bzViewer = createBZVisualizer($("bz-plot"), seekpathFiles[$<HTMLSelectElement>("bz-file").value], {
    showPathpoints: $<HTMLInputElement>("bz-pathpoints").checked,
  });
}
$("bz-file").addEventListener("change", showBZ);
$("bz-pathpoints").addEventListener("change", showBZ);
showBZ();

// --- Fermi surface panel --------------------------------------------------

const fsViewer = new Viewer($("fs-plot"));
let surface: FermiSurface | undefined;
const status = (msg: string) => ($("status").textContent = msg);

async function loadFermi() {
  const name = $<HTMLSelectElement>("fs-file").value;
  status(`loading ${name}.bxsf …`);
  const text = await fetch(`/legacy/fermisurface-visualiser/convert-bxsf/BXSFfiles/${name}.bxsf`).then((r) => r.text());

  let t = performance.now();
  const data = parseBXSF(text);
  const parseMs = performance.now() - t;
  const bz = getBrillouinZone(data.reciprocalBasis);

  surface?.dispose();
  fsViewer.clear();
  surface = new FermiSurface(data, bz, { clip: $<HTMLInputElement>("fs-clip").checked });
  fsViewer.add(brillouinZoneObject(bz, { opacity: 0.05 }), reciprocalVectorsObject(data.reciprocalBasis), surface);

  const legend = $("fs-legend");
  legend.replaceChildren(
    ...surface.meshes.map((mesh) => {
      const label = document.createElement("label");
      const box = Object.assign(document.createElement("input"), { type: "checkbox", checked: true });
      box.addEventListener("change", () => {
        mesh.visible = box.checked;
        fsViewer.render();
      });
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = `#${mesh.material.color.getHexString()}`;
      label.append(box, swatch, mesh.name);
      return label;
    }),
  );

  t = performance.now();
  updateEnergy();
  fsViewer.fit();
  status(
    `${data.bands.length} bands, grid ${data.bands[0].shape.join("×")}, ` +
      `parse ${parseMs.toFixed(0)} ms, first mesh ${(performance.now() - t).toFixed(0)} ms`,
  );
}

function updateEnergy() {
  if (!surface) return;
  const dE = Number($<HTMLInputElement>("fs-energy").value);
  $("fs-energy-label").textContent = `${dE.toFixed(2)} eV`;
  const t = performance.now();
  surface.setEnergy(surface.data.fermiEnergy + dE);
  fsViewer.render();
  status(`E = ${surface.energy.toFixed(3)} eV, meshed in ${(performance.now() - t).toFixed(0)} ms`);
}

$("fs-file").addEventListener("change", loadFermi);
$("fs-clip").addEventListener("change", loadFermi);
$("fs-energy").addEventListener("input", updateEnergy);
loadFermi();
