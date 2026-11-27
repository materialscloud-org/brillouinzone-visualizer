const GREEK = { GAMMA: "Γ", DELTA: "Δ", SIGMA: "Σ", LAMBDA: "Λ" };

/** A seekpath point label: GAMMA → Γ, X_1 → X₁. */
export function KLabel({ name }) {
  const [base, sub] = name
    .replace(/GAMMA|DELTA|SIGMA|LAMBDA/gi, (g) => GREEK[g.toUpperCase()])
    .split("_");
  return (
    <>
      {base}
      {sub && <sub>{sub}</sub>}
    </>
  );
}

/** The path as connected runs of points: Γ–X–M–Γ | R–X. */
export function PathSummary({ path }) {
  const parts = [];
  path.forEach(([a, b], i) => {
    if (i === 0 || path[i - 1][1] !== a) {
      if (i > 0)
        parts.push(
          <span key={`|${i}`} className="px-1.5 text-slate-400">
            |
          </span>,
        );
      parts.push(<KLabel key={`a${i}`} name={a} />);
    }
    parts.push(<span key={`-${i}`}>–</span>, <KLabel key={`b${i}`} name={b} />);
  });
  return <span>{parts}</span>;
}
