/* eslint-disable fyldo/no-hex-colors -- the preset list is colour data, not styling. */
/**
 * Colour maths for the Color Picker: `#rrggbb` <-> HSV, and the one reader of typed hex text.
 * Client mirror of src/Fields/ColorField.php (`read`); both run the `colors` cases of tests/fixtures/validation-cases.json.
 */

/** Hue 0-360, saturation and brightness (value) 0-100. Kept as floats while dragging, so the thumb never snaps. */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

/** The 16 colours of the Figma "Color Picker Panel" (layer names "Swatch #xxxxxx"), in reading order. Same list as ColorField::DEFAULT_PRESETS. */
export const DEFAULT_PRESETS: readonly string[] = [
  '#1d2327',
  '#50575e',
  '#8c8f94',
  '#c3c4c7',
  '#f0f0f1',
  '#ffffff',
  '#2271b1',
  '#135e96',
  '#00a32a',
  '#007017',
  '#dba617',
  '#996800',
  '#d63638',
  '#8a2424',
  '#8e44ad',
  '#e25c9a',
];

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/** The stored form: exactly `#` and six lower-case hex digits. */
export const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/.test(value);

/**
 * Reads typed text as a colour: `#abc`, `abc`, `#AABBCC` and ` aabbcc ` all become `#aabbcc`. Anything else is `null`.
 */
export function parseHex(text: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim());
  if (match === null) return null;
  let digits = (match[1] as string).toLowerCase();
  if (digits.length === 3) digits = [...digits].map((d) => d + d).join('');
  return `#${digits}`;
}

/** What the server stores: a colour in its stored form, nothing for non-text, and unreadable text kept (trimmed) so the `color` rule can report it. */
export function sanitizeColor(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return parseHex(raw) ?? raw.trim();
}

export function hexToHsv(hex: string): Hsv {
  const value = parseHex(hex);
  if (value === null) return { h: 0, s: 0, v: 0 };
  const r = parseInt(value.slice(1, 3), 16) / 255;
  const g = parseInt(value.slice(3, 5), 16) / 255;
  const b = parseInt(value.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : (delta / max) * 100, v: max * 100 };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 100) / 100;
  const val = clamp(v, 0, 100) / 100;
  const channel = (n: number): number => {
    const k = (n + hue / 60) % 6;
    return val - val * sat * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const hex = (x: number): string => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${hex(channel(5))}${hex(channel(3))}${hex(channel(1))}`;
}

/** The fully saturated colour of a hue: the Area's base fill and the Hue thumb. */
export const hueColor = (h: number): string => hsvToHex({ h, s: 100, v: 100 });
