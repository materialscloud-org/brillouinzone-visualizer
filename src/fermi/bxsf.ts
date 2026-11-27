import type { FermiSurfaceData, Matrix, VolumetricData } from "../types";

// TODO2: move this upstream to matsci-parse

const POW10 = Array.from({ length: 23 }, (_, e) => 10 ** e); // all exact doubles

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
  const fermiEnergy = parseFloat(fermiMatch?.[1] ?? "");
  if (!Number.isFinite(fermiEnergy))
    throw new Error("BXSF: no Fermi energy found");

  // The grid title line: "BANDGRID_3D_BANDS" or "BEGIN_BANDGRID_3D_<name>",
  // then the band count, grid size, origin and three spanning vectors
  const title = /^\s*(BEGIN_)?BANDGRID_3D_\S*\s*$/m.exec(text);
  if (!title) throw new Error("BXSF: no BANDGRID_3D block found");
  const afterTitle = title.index + title[0].length;
  let pos = text.indexOf("BAND:", afterTitle);
  if (pos < 0) throw new Error("BXSF: no BAND: block found");
  const header = text.slice(afterTitle, pos).trim().split(/\s+/).map(Number);
  const [numBands, n1, n2, n3] = header;
  if (
    header.length !== 16 ||
    !header.every(Number.isFinite) ||
    ![numBands, n1, n2, n3].every(Number.isInteger) ||
    numBands < 1 ||
    Math.min(n1, n2, n3) < 2
  )
    throw new Error(
      "BXSF: expected the band count, grid size, origin and three vectors before BAND:",
    );
  const origin = header.slice(4, 7) as [number, number, number];
  const reciprocalBasis: Matrix = {
    rows: 3,
    cols: 3,
    data: Float64Array.from(header.slice(7, 16)),
  };

  // Engines keep the last regex input (RegExp.input), here the whole file
  // text; point it at an empty string so the text can be freed
  /$/.test("");

  /**
   * The number at `pos`, which then moves past it; NaN if there is none.
   * Plain decimals with up to 15 digits (what BXSF writers produce) are
   * built exactly: an integer below 2^53 times or divided by an exact power
   * of ten is rounded once, as `Number()` does. Anything else goes to
   * `Number()`. About 1.5× faster than `Number()` on every token.
   */
  const readNumber = (): number => {
    let c = text.charCodeAt(pos);
    while (c <= 32) c = text.charCodeAt(++pos);
    const start = pos;
    const negative = c === 45; // "-"
    if (negative || c === 43) c = text.charCodeAt(++pos); // "+" or "-"
    let mantissa = 0;
    let digits = 0;
    let exponent = 0;
    while (c >= 48 && c <= 57) {
      mantissa = mantissa * 10 + (c - 48);
      digits++;
      c = text.charCodeAt(++pos);
    }
    if (c === 46) {
      // "."
      c = text.charCodeAt(++pos);
      while (c >= 48 && c <= 57) {
        mantissa = mantissa * 10 + (c - 48);
        digits++;
        exponent--;
        c = text.charCodeAt(++pos);
      }
    }
    let plain = digits > 0 && digits <= 15;
    if (plain && (c === 101 || c === 69)) {
      // "e" or "E"
      c = text.charCodeAt(++pos);
      const negativeExponent = c === 45;
      if (negativeExponent || c === 43) c = text.charCodeAt(++pos);
      let e = 0;
      let eDigits = 0;
      while (c >= 48 && c <= 57) {
        e = e * 10 + (c - 48);
        eDigits++;
        c = text.charCodeAt(++pos);
      }
      exponent += negativeExponent ? -e : e;
      plain = eDigits > 0;
    }
    // The number must end at whitespace or at the end of the text (c is NaN)
    if (plain && (c <= 32 || Number.isNaN(c)) && Math.abs(exponent) <= 22) {
      const value =
        exponent < 0 ? mantissa / POW10[-exponent] : mantissa * POW10[exponent];
      return negative ? -value : value;
    }
    // Anything else (long mantissa, Fortran "D" exponent, a word): the whole token
    while (pos < text.length && text.charCodeAt(pos) > 32) pos++;
    return pos > start ? Number(text.slice(start, pos)) : NaN;
  };

  const [W, H, D] = [n1 - 1, n2 - 1, n3 - 1];
  const bands: VolumetricData[] = [];
  for (let b = 0; b < numBands; b++) {
    if (pos < 0)
      throw new Error(`BXSF: expected ${numBands} bands, found ${b}`);
    pos += 5; // "BAND:"
    while (text.charCodeAt(pos) <= 32) pos++;
    const labelStart = pos;
    while (pos < text.length && text.charCodeAt(pos) > 32) pos++;
    const label = `Band ${text.slice(labelStart, pos)}`;

    const data = new Float64Array(W * H * D);
    for (let i = 0; i < n1; i++)
      for (let j = 0; j < n2; j++)
        for (let k = 0; k < n3; k++) {
          const v = readNumber();
          if (Number.isNaN(v))
            throw new Error(
              `BXSF: ${label} is truncated or has a value that is not a number`,
            );
          if (i < W && j < H && k < D) data[(k * H + j) * W + i] = v;
        }

    bands.push({
      data,
      shape: [D, H, W],
      channels: 1,
      basis: reciprocalBasis,
      origin,
      field: label,
    });
    pos = text.indexOf("BAND:", pos);
  }
  if (pos >= 0) throw new Error(`BXSF: expected ${numBands} bands, found more`);

  return { reciprocalBasis, fermiEnergy, bands };
}
