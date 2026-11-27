// Reading the two accepted inputs: SeeK-path JSON (the zone and k-path) and
// BXSF band grids (the Fermi surfaces).

import { parseBXSF } from "bz-visualizer";

const isVector = (v) =>
  Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

/**
 * Read a file's text as one of the accepted inputs.
 * Returns `{ kind: "seekpath" | "fermi", name, data }`; throws with a message
 * for the user if the file is neither.
 */
export function readInput(name, text) {
  if (/\.bxsf$/i.test(name) || /BANDGRID_3D/.test(text.slice(0, 4096))) {
    return { kind: "fermi", name, data: parseBXSF(text) };
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `${name} is neither a SeeK-path JSON file nor a BXSF file.`,
    );
  }
  if (![json.b1, json.b2, json.b3].every(isVector))
    throw new Error(
      `${name} has no reciprocal vectors (b1, b2, b3): it does not look like a SeeK-path output.`,
    );
  return { kind: "seekpath", name, data: json };
}

/** Fetch an example file from /public/examples and read it. */
export async function readExample(fileName) {
  const response = await fetch(
    `${import.meta.env.BASE_URL}examples/${fileName}`,
  );
  if (!response.ok) throw new Error(`Could not load the example ${fileName}.`);
  return readInput(fileName, await response.text());
}
