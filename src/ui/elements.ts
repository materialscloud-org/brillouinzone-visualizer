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

export function checkbox(text: string, checked: boolean, onChange: (checked: boolean) => void) {
  const input = el("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  return el("label", "bzv-check", [input, text]);
}
