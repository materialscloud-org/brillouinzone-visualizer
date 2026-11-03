import { formatSpaceGroupSymbol } from "mc-react-library";

import { PathSummary } from "./formatting";

function Info({ title, rows }) {
  return (
    <section className="rounded border border-slate-200 p-3 text-sm">
      <h3 className="mb-2 font-semibold text-slate-900">{title}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
        {rows
          .filter(([, value]) => value != null && value !== "")
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-slate-400">{label}</dt>
              <dd className="text-slate-800">{value}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

/** Summary of a SeeK-path JSON file. */
export function SeekpathInfo({ name, data }) {
  const points = data.kpoints_rel ?? data.kpoints;
  return (
    <Info
      title="k-path (SeeK-path)"
      rows={[
        [
          "File",
          <span key="file" className="font-mono">
            {name}
          </span>,
        ],
        [
          "Bravais lattice",
          data.bravais_lattice_extended ?? data.bravais_lattice,
        ],
        [
          "Space group",
          data.spacegroup_international && (
            <>
              {formatSpaceGroupSymbol(data.spacegroup_international)}{" "}
              <span className="text-slate-500">
                (number {data.spacegroup_number})
              </span>
            </>
          ),
        ],
        [
          "Path",
          data.path?.length ? (
            <PathSummary key="path" path={data.path} />
          ) : null,
        ],
        ["High-symmetry points", points ? Object.keys(points).length : null],
        [
          "Explicit k-points",
          (data.explicit_kpoints_rel ?? data.explicit_kpoints_abs)?.length,
        ],
      ]}
    />
  );
}

/** Summary of a BXSF file. */
export function FermiInfo({ name, data }) {
  const [D, H, W] = data.bands[0].shape;
  const crossing = data.bands.filter((band) => {
    let min = Infinity;
    let max = -Infinity;
    for (const e of band.data) {
      if (e < min) min = e;
      if (e > max) max = e;
    }
    return min <= data.fermiEnergy && data.fermiEnergy <= max;
  });
  return (
    <Info
      title="Fermi surfaces (BXSF)"
      rows={[
        [
          "File",
          <span key="file" className="font-mono">
            {name}
          </span>,
        ],
        ["Fermi energy", `${data.fermiEnergy} eV`],
        [
          "Bands",
          data.bands.map((b) => b.field?.replace("Band ", "")).join(", "),
        ],
        ["Grid", `${W} × ${H} × ${D} (periodic)`],
        [
          "Bands at E_F",
          crossing.length
            ? crossing.map((b) => b.field).join(", ")
            : "none: no band crosses the Fermi energy; use the energy slider",
        ],
      ]}
    />
  );
}
