/** Tiny DOM helpers for the control box. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

export function button(text: string, onClick: () => void) {
  const b = el("button", "bzv-button", [text]);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

export function checkbox(
  text: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
) {
  const input = el("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  return el("label", "bzv-check", [input, text]);
}

/** A checkbox drawn as a sliding switch. */
export function toggleSwitch(
  text: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
) {
  const input = el("input");
  input.type = "checkbox";
  input.setAttribute("role", "switch");
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  return el("label", "bzv-check bzv-switch", [
    input,
    el("span", "bzv-slider"),
    text,
  ]);
}

/** A colour picker; `onInput` fires while dragging. */
export function colorInput(
  value: string,
  title: string,
  onInput: (color: string) => void,
) {
  const input = el("input", "bzv-color");
  input.type = "color";
  input.value = value;
  input.title = title;
  input.addEventListener("input", () => onInput(input.value));
  return input;
}

/** A small range input. */
export function rangeInput(
  min: number,
  max: number,
  step: number,
  value: number,
  title: string,
  onInput: (value: number) => void,
) {
  const input = el("input");
  Object.assign(input, {
    type: "range",
    min: String(min),
    max: String(max),
    step: String(step),
    title,
  });
  input.value = String(value);
  input.addEventListener("input", () => onInput(Number(input.value)));
  return input;
}

/** Gear icon (inline SVG, inherits the text colour). */
export function gearIcon(): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML =
    '<circle cx="12" cy="12" r="3"/>' +
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 ' +
    "1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 " +
    "1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 " +
    "4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 " +
    "1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06" +
    'A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>';
  return svg;
}
