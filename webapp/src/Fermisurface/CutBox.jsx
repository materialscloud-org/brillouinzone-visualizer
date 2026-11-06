import { useMemo } from "react";

import { AXES, B_VECTORS, zoneRadius } from "./cuts";

function Segmented({ options, value, onChange, disabled }) {
  return (
    <div className="inline-flex overflow-hidden rounded border border-slate-300">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option)}
          className={`px-2 py-0.5 text-xs ${
            option === value
              ? "bg-slate-700 text-white"
              : "bg-white text-slate-700 hover:bg-slate-100"
          } disabled:opacity-50`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/**
 * A small demonstration of cut planes: pick a direction and slide the plane
 * through the zone, removing one side or keeping a thin slab.
 */
export default function CutBox({ cut, onChange, reciprocalBasis }) {
  const radius = useMemo(() => zoneRadius(reciprocalBasis), [reciprocalBasis]);
  const set = (change) => onChange({ ...cut, ...change });
  const off = !cut.on;

  return (
    <section className="rounded border border-slate-200 p-3 text-sm">
      <label className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
        <input
          type="checkbox"
          checked={cut.on}
          onChange={(e) => set({ on: e.target.checked })}
        />
        Cut the Fermi surfaces
      </label>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-slate-400">Normal</span>
          <Segmented
            options={AXES}
            value={cut.direction}
            onChange={(direction) => set({ direction })}
            disabled={off}
          />
          <Segmented
            options={B_VECTORS}
            value={cut.direction}
            onChange={(direction) => set({ direction })}
            disabled={off}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="w-16 text-slate-400">Offset</span>
          <input
            type="range"
            min={-radius}
            max={radius}
            step={radius / 200}
            value={cut.offset}
            onChange={(e) => set({ offset: Number(e.target.value) })}
            onDoubleClick={() => set({ offset: 0 })}
            disabled={off}
            className="min-w-0 flex-1"
            aria-label="Plane offset from Γ"
            title="Distance from Γ along the normal (double-click: through Γ)"
          />
          <span className="w-14 text-right font-mono text-xs text-slate-600">
            {cut.offset.toFixed(3)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-slate-400">Keep</span>
          <Segmented
            options={["half", "slab"]}
            value={cut.slab ? "slab" : "half"}
            onChange={(keep) => set({ slab: keep === "slab" })}
            disabled={off}
          />
          {!cut.slab && (
            <button
              type="button"
              disabled={off}
              onClick={() => set({ flip: !cut.flip })}
              className="rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Other side
            </button>
          )}
        </div>

        {cut.slab && (
          <div className="flex items-center gap-2">
            <span className="w-16 text-slate-400">Thickness</span>
            <input
              type="range"
              min={0.01}
              max={1}
              step={0.01}
              value={cut.thickness}
              onChange={(e) => set({ thickness: Number(e.target.value) })}
              disabled={off}
              className="min-w-0 flex-1"
              aria-label="Slab thickness"
              title="As a fraction of the zone radius"
            />
            <span className="w-14 text-right font-mono text-xs text-slate-600">
              {(cut.thickness * radius).toFixed(3)}
            </span>
          </div>
        )}

        <p className="text-xs text-slate-400">
          Planes go through Γ + offset · n̂ (in the file's k units). The view
          updates without recomputing the surfaces.
        </p>
      </div>
    </section>
  );
}
