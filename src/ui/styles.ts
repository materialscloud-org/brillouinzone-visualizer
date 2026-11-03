// Styled after mc-react-structure-visualizer: framed viewer, grey control box
// below, "Click to interact" note. Injected once at runtime (not on import),
// so the package stays free of import side effects.
const CSS = `
.bzv, .bzv *, .bzv *::before, .bzv *::after { box-sizing: border-box; }
.bzv {
  width: 100%; height: 100%; min-width: 250px; min-height: 250px;
  display: flex; flex-direction: column; overflow: hidden;
  border: 1px solid #999; border-radius: 5px; background: #fff;
  font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  color: #222;
}
.bzv-window { position: relative; flex: 1; min-height: 0; border-bottom: 1px solid #999; }
.bzv-window canvas { display: block; }
.bzv-note {
  position: absolute; left: 10px; bottom: 10px; z-index: 3;
  padding: 1px 6px; border: 1px solid #999; border-radius: 5px;
  background: #f8f8f8; color: #353434; cursor: pointer; user-select: none;
}
.bzv-note:hover { filter: brightness(90%); }
.bzv-note.on { display: none; }
.bzv-label {
  font-size: 13px; font-weight: 600; pointer-events: none; user-select: none;
  text-shadow: 0 0 2px #fff, 0 0 2px #fff, 0 0 3px #fff;
}
.bzv-controls {
  display: flex; flex-direction: column; gap: 4px;
  padding: 8px 10px; background: #f8f8f8;
}
.bzv-row {
  display: flex; flex-wrap: wrap; align-items: center;
  justify-content: space-around; gap: 4px 14px;
}
.bzv-group { display: inline-flex; align-items: center; gap: 3px; }
.bzv-button {
  height: 25px; padding: 0 8px; font-size: 14px; cursor: pointer;
  border: 1px solid #000; border-radius: 4px; background: #e0e0e0; color: #000;
}
.bzv-button:hover { background: #b9b9b9; }
.bzv-check { display: inline-flex; align-items: center; gap: 3px; cursor: pointer; user-select: none; }
.bzv-check input { margin: 3px; }
.bzv-energy input[type=range] { width: 160px; }
.bzv-energy output { min-width: 4.5em; font-variant-numeric: tabular-nums; }
.bzv-bands { justify-content: flex-start; }
.bzv-band {
  display: inline-flex; align-items: center; gap: 4px; padding: 1px 6px;
  border: 1px solid #ccc; border-radius: 10px; background: #fff;
  cursor: pointer; user-select: none; font-size: 13px;
}
.bzv-band.off { opacity: 0.4; }
.bzv-swatch { width: 10px; height: 10px; border-radius: 2px; }
`;

export function injectStyles() {
  if (typeof document === "undefined" || document.getElementById("bzv-styles")) return;
  const style = document.createElement("style");
  style.id = "bzv-styles";
  style.textContent = CSS;
  document.head.appendChild(style);
}
