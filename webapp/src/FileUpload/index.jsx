// TODO: make mc-react-library work nicer with non-matsci-parse data types.
// McStructureUpload (examples dropdown, history, share links) only takes
// crystal structures parsed by matsci-parse, so this app rebuilds its examples
// dropdown with the library's classes. A generic upload component (a parse
// callback plus examples and history) would replace this file.

import { useState } from "react";
import { McDropzone, McloudSpinner } from "mc-react-library";

import { examples } from "./examples";
import { readExample, readInput } from "./readInput";

const families = [...new Set(examples.map((e) => e.family))];

// Let the spinner paint before a large file blocks the main thread
const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 30));

/**
 * The drop zone and the examples dropdown. Reads a SeeK-path JSON or a BXSF
 * file and hands it over with `onLoaded({ kind, name, data })`; a new file
 * replaces the current one.
 */
export default function FileUpload({ onLoaded }) {
  const [fileName, setFileName] = useState(null);
  const [busy, setBusy] = useState(null); // what is being read, or null
  const [error, setError] = useState(null);

  const load = async (name, read) => {
    setBusy(name);
    setError(null);
    await nextFrame();
    try {
      const input = await read();
      setFileName(input.name);
      onLoaded(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <McDropzone
        accept=".json,.bxsf"
        disabled={Boolean(busy)}
        onFile={(file) =>
          load(file.name, async () => readInput(file.name, await file.text()))
        }
        fileName={fileName}
        title="Drop a SeeK-path JSON or a BXSF file here"
        hint="SeeK-path JSON (zone and k-path) or BXSF (Fermi surfaces)"
      />

      {busy && (
        <div className="flex items-center justify-center gap-2 pt-3 text-sm text-slate-500">
          <McloudSpinner className="w-8 shrink-0" />
          Reading {busy}…
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-3 py-4 text-center text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mc-structure-upload__examples">
        <p className="mc-structure-upload__examples-title">
          Otherwise, pick an example
        </p>
        <select
          value=""
          onChange={(e) => {
            // Read now: the controlled select resets to "" on re-render
            const name = e.target.value;
            if (name) load(name, () => readExample(name));
          }}
          disabled={Boolean(busy)}
          className="mc-structure-upload__select"
          aria-label="Examples"
        >
          <option value="">{busy ? "Loading…" : "Select an example…"}</option>
          {families.map((family) => (
            <optgroup key={family} label={family}>
              {examples
                .filter((e) => e.family === family)
                .map(({ label, fileName }) => (
                  <option key={fileName} value={fileName}>
                    {label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}
