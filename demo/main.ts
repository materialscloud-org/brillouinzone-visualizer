import "../src/style.css";
import {
  BZVisualizer,
  parseBXSF,
  type BZVisualizerOptions,
  type SeekpathJSON,
} from "../src";

import mc3d10 from "./data/mc3d-10.json";
import mc3d10016 from "./data/mc3d-10016.json";
import highResUrl from "./data/highresolution_example.bxsf?url";
import SimpleExampleURl from "./data/simple_example.bxsf?url";
import wjlUrl from "./data/wjl.bxsf?url";

interface Example {
  label: string;
  note?: string;
  load: () => Promise<[SeekpathJSON | undefined, BZVisualizerOptions?]>;
}

const fetchBXSF = async (url: string) =>
  parseBXSF(await fetch(url).then((r) => r.text()));

const EXAMPLES: Example[] = [
  {
    label: "mc3d-10: cubic zone + k-path",
    load: async () => [mc3d10],
  },
  {
    label: "mc3d-10016: fcc zone + k-path, path points",
    load: async () => [mc3d10016, { showKPoints: true }],
  },
  {
    label: "mc3d-10016: 6×6×6 mesh (AiiDA-style mesh + offset)",
    note: "Try “Fold into BZ” in Settings.",
    load: async () => [
      {
        b1: mc3d10016.b1,
        b2: mc3d10016.b2,
        b3: mc3d10016.b3,
        kpoints: mc3d10016.kpoints,
        mesh: [6, 6, 6],
        offset: [0.5, 0.5, 0.5],
      },
      { showKPoints: true },
    ],
  },
  {
    label: "highresolution_example.bxsf: Fermi surface (fcc) + k-path",
    note: "k-path borrowed from mc3d-10016 (same fcc setting).",
    load: async () => {
      const fermi = await fetchBXSF(highResUrl);
      // No seekpath output exists for this file; its fcc cell matches
      // mc3d-10016's setting, so that fractional path is reused on its lattice.
      const [b1, b2, b3] = [0, 3, 6].map((i) => [
        ...fermi.reciprocalBasis.data.slice(i, i + 3),
      ]);
      return [{ ...mc3d10016, b1, b2, b3 }, { fermi }];
    },
  },
  {
    label: "simple_example.bxsf: Fermi surface (hexagonal)",
    note: "Band 31 only just reaches E_F (by 0.3 meV), so this starts at E_F + 0.3 eV.",
    load: async () => {
      const fermi = await fetchBXSF(SimpleExampleURl);
      return [undefined, { fermi, energy: fermi.fermiEnergy + 0.3 }];
    },
  },
  {
    label: "wjl.bxsf: Fermi surface (WannierIO.jl, 35 bands, 224 MB)",
    note: "Large file: reading it takes a few seconds.",
    load: async () => [undefined, { fermi: await fetchBXSF(wjlUrl) }],
  },
];

const select = document.getElementById("example") as HTMLSelectElement;
const note = document.getElementById("note")!;
const container = document.getElementById("viz")!;
select.append(...EXAMPLES.map((e, i) => new Option(e.label, String(i))));

let vis: BZVisualizer | undefined;
let request = 0;

async function show(index: number) {
  const example = EXAMPLES[index];
  const current = ++request;
  note.textContent = "Loading…";
  const [data, options] = await example.load();
  if (current !== request) return; // a newer selection won
  vis?.dispose();
  vis = new BZVisualizer(container, data, {
    energyRange: [-3, 3],
    ...options,
  });
  note.textContent = example.note ?? "";
}

select.addEventListener("change", () => show(Number(select.value)));
show(0);
