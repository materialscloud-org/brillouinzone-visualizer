import "./index.css";
import MaterialsCloudHeader from "mc-react-header";
import { McAppHeader } from "mc-react-library";
import { useState } from "react";

import InfoAccordions from "./AccordionContent";
import FileUpload from "./FileUpload";
import Fermisurface from "./Fermisurface";

const TITLE = "Brillouin zone and Fermi surface visualizer";

function App() {
  // { kind: "seekpath" | "fermi", name, data }
  const [loaded, setLoaded] = useState(null);

  return (
    <>
      <MaterialsCloudHeader
        activeSection="work"
        breadcrumbsPath={[
          { name: "Work", link: "https://www.materialscloud.org/work" },
          { name: "Tools", link: "https://www.materialscloud.org/work/tools" },
          { name: TITLE, link: null },
        ]}
      />

      <main className="min-h-screen bg-[aliceblue] pb-10">
        <div className="mx-auto max-w-7xl px-4">
          <div className="overflow-hidden bg-white p-4 shadow-sm">
            <McAppHeader title={TITLE} />
            <div className="mx-auto max-w-5xl px-6 py-8 sm:px-10">
              <div className="space-y-3">
                <InfoAccordions />
                <FileUpload onLoaded={setLoaded} />
              </div>
            </div>

            <Fermisurface input={loaded} className="mx-auto max-w-6xl py-4" />
          </div>
        </div>
      </main>
    </>
  );
}

export default App;
