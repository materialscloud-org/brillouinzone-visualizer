import type { FermiSurfaceData, Matrix, VolumetricData } from "../types";

// TODO: Bench, test and rewrite this for perf.
// TODO2: move this upstream to matsci-parse

/**
 * Parse an XCrySDen band-grid file (.bxsf).
 *
 * BXSF stores a "general grid": n points per axis including both ends of
 * the cell, so the last point repeats the first. It is dropped here, leaving
 * a periodic grid of n - 1 points. Values are written with the third axis
 * fastest; they are reordered to the VolumetricData layout (first axis
 * fastest).
 */
export function parseBXSF(text: string): FermiSurfaceData {
  const fermiMatch = /Fermi Energy:\s*(\S+)/i.exec(text);
  if (!fermiMatch) throw new Error("BXSF: no Fermi energy found");
  const fermiEnergy = parseFloat(fermiMatch[1]);

  // The grid title line: "BANDGRID_3D_BANDS" or "BEGIN_BANDGRID_3D_<name>"
  const title = /^\s*(BEGIN_)?BANDGRID_3D_\S*\s*$/m.exec(text);
  if (!title) throw new Error("BXSF: no BANDGRID_3D block found");
  const afterTitle = title.index + title[0].length;
  const firstBand = text.indexOf("BAND:", afterTitle);
  const header = text
    .slice(afterTitle, firstBand)
    .trim()
    .split(/\s+/)
    .map(Number);
  const [numBands, n1, n2, n3] = header;
  const origin = header.slice(4, 7) as [number, number, number];
  const reciprocalBasis: Matrix = {
    rows: 3,
    cols: 3,
    data: Float64Array.from(header.slice(7, 16)),
  };

  const [W, H, D] = [n1 - 1, n2 - 1, n3 - 1];
  const bands: VolumetricData[] = [];
  const blocks = text.slice(firstBand).split("BAND:").slice(1);
  if (blocks.length !== numBands)
    throw new Error(`BXSF: expected ${numBands} bands, found ${blocks.length}`);

  for (const block of blocks) {
    const tokens = block.trim().split(/\s+/);
    const label = `Band ${tokens[0]}`;
    if (tokens.length - 1 < n1 * n2 * n3)
      throw new Error(`BXSF: ${label} is truncated`);

    const data = new Float64Array(W * H * D);
    for (let i = 0; i < W; i++)
      for (let j = 0; j < H; j++)
        for (let k = 0; k < D; k++)
          data[(k * H + j) * W + i] = +tokens[1 + (i * n2 + j) * n3 + k];

    bands.push({
      data,
      shape: [D, H, W],
      channels: 1,
      basis: reciprocalBasis,
      origin,
      field: label,
    });
  }

  return { reciprocalBasis, fermiEnergy, bands };
}
