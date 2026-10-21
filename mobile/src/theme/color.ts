/**
 * Color helpers that turn the web's `hsl(var(--token) / alpha)` notation into
 * strings React Native parses everywhere (styles, gradients, box shadows).
 */

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) =>
    light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** `hsl(342, 100, 52, 0.4)` → `rgba(255, 10, 84, 0.4)`; mirrors CSS `hsl(342 100% 52% / 0.4)`. */
export function hsl(h: number, s: number, l: number, a = 1): string {
  const [r, g, b] = hslToRgb(h, s, l);
  return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Applies an alpha to a `#rrggbb` color; mirrors `hsl(var(--token) / a)`. */
export function alpha(hex: string, a: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
