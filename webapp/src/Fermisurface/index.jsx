import { McResults } from "mc-react-library";

import BZView from "./BZView";
import { FermiInfo, SeekpathInfo } from "./InfoTables";

/**
 * The results for a loaded file (`{ kind, name, data }` from FileUpload):
 * the viewer and a summary, side by side (stacked on narrow screens).
 */
export default function Fermisurface({ input, className = "" }) {
  if (!input) return null;
  const isFermi = input.kind === "fermi";

  return (
    <div className={`space-y-3 px-2 sm:px-4 ${className}`}>
      <McResults resultKey={input} className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Results</h2>
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <BZView
            seekpath={isFermi ? undefined : input.data}
            fermi={isFermi ? input.data : undefined}
            className="h-[560px]"
          />
          {isFermi ? <FermiInfo {...input} /> : <SeekpathInfo {...input} />}
        </div>
      </McResults>
    </div>
  );
}
