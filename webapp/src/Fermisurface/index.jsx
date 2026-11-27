import { useMemo, useState } from "react";
import { McResults } from "mc-react-library";

import BZView from "./BZView";
import CutBox from "./CutBox";
import { NO_CUT, cutPlanes } from "./cuts";
import { FermiInfo, SeekpathInfo } from "./InfoTables";

/**
 * The results for a loaded file (`{ kind, name, data }` from FileUpload):
 * the viewer and a summary, side by side (stacked on narrow screens). BXSF
 * files also get a box for cutting the surfaces open.
 */
export default function Fermisurface({ input, className = "" }) {
  // The cut belongs to one file: a new file starts uncut
  const [saved, setSaved] = useState({ input, cut: NO_CUT });
  const cut = saved.input === input ? saved.cut : NO_CUT;
  const setCut = (next) => setSaved({ input, cut: next });

  const isFermi = input?.kind === "fermi";
  const planes = useMemo(
    () => (isFermi ? cutPlanes(cut, input.data.reciprocalBasis) : []),
    [cut, input, isFermi],
  );

  if (!input) return null;

  return (
    <div className={`space-y-3 px-2 sm:px-4 ${className}`}>
      <McResults resultKey={input} className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Results</h2>
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <BZView
            seekpath={isFermi ? undefined : input.data}
            fermi={isFermi ? input.data : undefined}
            cutPlanes={planes}
            className="h-[560px]"
          />
          {isFermi ? (
            <div className="space-y-3">
              <FermiInfo {...input} />
              <CutBox
                cut={cut}
                onChange={setCut}
                reciprocalBasis={input.data.reciprocalBasis}
              />
            </div>
          ) : (
            <SeekpathInfo {...input} />
          )}
        </div>
      </McResults>
    </div>
  );
}
