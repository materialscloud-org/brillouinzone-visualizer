// Content of the information accordions of the landing page.

import { useState } from "react";
import { DoiBadge, McInfoAccordion } from "mc-react-library";

function WhatItDoesContent() {
  return (
    <>
      <p>This tool shows, interactively and in the browser:</p>
      <ul className="list-disc pl-10">
        <li>
          the <strong>first Brillouin zone</strong> and the{" "}
          <strong>reciprocal lattice vectors</strong>;
        </li>
        <li>
          the <strong>high-symmetry k-points and path</strong> of a SeeK-path
          calculation;
        </li>
        <li>
          the <strong>Fermi surfaces</strong> of a band-structure calculation,
          at the Fermi energy or at any energy around it.
        </li>
      </ul>
      <p className="pt-2">
        Load a SeeK-path file or a BXSF file. Nothing is uploaded: the files are
        read in your browser.
      </p>
    </>
  );
}

function InputFilesContent() {
  return (
    <ul className="list-disc space-y-2 pl-10">
      <li>
        <strong>SeeK-path JSON</strong> (<code>.json</code>): the{" "}
        <em>Raw data (JSON)</em> download of{" "}
        <a href="https://seekpath.materialscloud.io/">SeeK-path</a>, or the
        output of the Python <code>seekpath</code> package saved as JSON. The
        reciprocal vectors <code>b1</code>, <code>b2</code>, <code>b3</code> are
        required; the high-symmetry points, the path and the explicit k-points
        are drawn when present.
      </li>
      <li>
        <strong>BXSF</strong> (<code>.bxsf</code>): the XCrySDen band-grid
        format, written for example by Quantum ESPRESSO and Wannier90. Its bands
        are used as they are, without resampling.
      </li>
    </ul>
  );
}

function ControlsContent() {
  return (
    <ul className="list-disc space-y-1 pl-10">
      <li>
        Click the viewer to interact with it: drag to rotate, right-drag to pan,
        scroll to zoom. Click outside it to scroll the page again.
      </li>
      <li>
        The camera buttons look along <em>x</em>, <em>y</em> and <em>z</em>;
        with Fermi surfaces, the slider sets the energy relative to the Fermi
        energy.
      </li>
      <li>
        <strong>Settings</strong> shows or hides each part of the scene, changes
        its colours, and folds the k-points into the first zone.
      </li>
    </ul>
  );
}

function HowToCiteContent() {
  return (
    <div>
      If you use the k-paths, please cite the SeeK-path paper: Y. Hinuma, G.
      Pizzi, Y. Kumagai, F. Oba, I. Tanaka, Band structure diagram paths based
      on crystallography{" "}
      <span className="inline-block align-middle">
        <DoiBadge
          doi="10.1016/j.commatsci.2016.10.015"
          label="Comp. Mat. Sci"
          color="#a2e5b7"
        />
      </span>
    </div>
  );
}

const ACCORDIONS = [
  { title: "What this tool does", content: <WhatItDoesContent /> },
  { title: "Input files", content: <InputFilesContent /> },
  { title: "Using the viewer", content: <ControlsContent /> },
  { title: "How to cite", content: <HowToCiteContent /> },
];

/** The information accordions at the top of the page, one open at a time. */
export default function InfoAccordions() {
  const [open, setOpen] = useState(null);
  return ACCORDIONS.map(({ title, content }, i) => (
    <McInfoAccordion
      key={title}
      title={title}
      open={open === i}
      onToggle={() => setOpen(open === i ? null : i)}
    >
      {content}
    </McInfoAccordion>
  ));
}
