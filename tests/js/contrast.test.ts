/**
 * WCAG 2.2 AA on the design tokens. A failing pair fails the build; the only exceptions are the owner-approved
 * entries in UI_EXCEPTIONS below (decision O16), each with a reason and a floor so it cannot get worse silently.
 * (Decision O4: failing tokens are fixed in Figma, not worked around in code.)
 *
 * Text pairs need 4.5:1 (1.4.3); UI components, their boundaries and focus indicators need 3:1 (1.4.11).
 * Disabled text is exempt (1.4.3), decorative dividers/card borders are exempt.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrast, parseHex } from '../../tools/tokens/color';
import { resolveColor } from '../../tools/tokens/generate';
import type { TokenSnapshot } from '../../tools/tokens/snapshot';

const snapshot = JSON.parse(readFileSync(resolve(__dirname, '../../tokens/figma.tokens.json'), 'utf8')) as TokenSnapshot;
const color = (name: string) => parseHex(resolveColor(snapshot, `color.${name.replace(/\//g, '.')}`));
const ratio = (fg: string, bg: string) => contrast(color(fg), color(bg));

const TONES = ['info', 'success', 'warning', 'error', 'neutral'] as const;

const TEXT: Array<[fg: string, bg: string, why: string]> = [
  ['text/primary', 'background/default', 'body text'],
  ['text/primary', 'background/subtle', 'text on the settings canvas / sidebar'],
  ['text/primary', 'surface/default', 'menu-item hover, tag'],
  ['text/primary', 'surface/hover', 'nav-item hover'],
  ['text/primary', 'surface/active', 'nav-item active'],
  ['text/secondary', 'background/default', 'descriptions'],
  ['text/secondary', 'background/subtle', 'descriptions on the canvas, card footer'],
  ['text/secondary', 'surface/default', 'secondary text on component background'],
  ['text/secondary', 'surface/hover', 'nav-item default label on hover'],
  ['text/tertiary', 'background/default', 'placeholder and counter'],
  ['text/tertiary', 'background/subtle', 'group labels in the sidebar'],
  ['text/inverse', 'action/primary', 'primary button'],
  ['text/inverse', 'action/primary-hover', 'primary button hover'],
  ['text/inverse', 'action/danger', 'error button'],
  ['text/inverse', 'action/danger-hover', 'error button hover'],
  ['text/inverse', 'background/inverse', 'tooltip'],
  ['link/default', 'background/default', 'links'],
  ...TONES.flatMap((tone): Array<[string, string, string]> => [
    [`status/${tone}/text`, `status/${tone}/bg`, `${tone} notice`],
    [`status/${tone}/text`, `status/${tone}/subtle`, `${tone} subtle badge`],
  ]),
  ['status/error/text', 'background/default', 'field error message'],
  ['status/error/text', 'status/error/bg', 'danger card footer'],
  ['text/inverse', 'status/info/solid', 'solid badge (info)'],
  ['text/inverse', 'status/success/solid', 'solid badge (success)'],
  ['text/inverse', 'status/error/solid', 'solid badge (error)'],
  ['text/inverse', 'status/neutral/solid', 'solid badge (neutral)'],
  ['text/primary', 'status/warning/solid', 'solid badge (warning) — dark text on amber'],
];

const UI: Array<[fg: string, bg: string, why: string]> = [
  ['border/input-hover', 'background/default', 'text field hover boundary'],
  ['focus/border', 'background/default', 'focused field boundary'],
  ['focus/ring-neutral', 'background/default', 'keyboard focus ring (against the white gap)'],
  ['control/border', 'background/default', 'checkbox / radio boundary'],
  ['control/off', 'background/default', 'switch track, off'],
  ['control/on', 'background/default', 'switch track, on'],
  ['icon/tertiary', 'background/default', 'prefix / suffix icons'],
  ['status/success/solid', 'background/default', 'success icon (toast, save bar)'],
  ['status/error/solid', 'background/default', 'error icon / field border'],
];

describe('WCAG 2.2 AA — text (≥ 4.5:1)', () => {
  it.each(TEXT)('%s on %s (%s)', (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

/**
 * Owner-approved exceptions to the 3:1 rule (decision O16, 2026-10-01). Keep this list short and every entry justified.
 * `floor` is the lowest ratio accepted, so the exception cannot quietly get worse; if the pair ever reaches 3:1 the
 * guard below fails and the entry must be deleted.
 */
const UI_EXCEPTIONS: Array<{ fg: string; bg: string; why: string; floor: number }> = [
  {
    fg: 'border/input',
    bg: 'background/default',
    why: 'resting text-field boundary: the owner chose a soft gray/500 (#c9c9c9) over WCAG 1.4.11; hover (≥ 3:1), focus and error borders still pass',
    floor: 1.6,
  },
];

describe('WCAG 2.2 AA — UI components and focus (≥ 3:1)', () => {
  it.each(UI)('%s on %s (%s)', (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3);
  });
});

describe('WCAG 2.2 AA — approved exceptions (O16)', () => {
  it.each(UI_EXCEPTIONS)('$fg on $bg stays at or above its floor ($why)', ({ fg, bg, floor }) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(floor);
  });

  it.each(UI_EXCEPTIONS)('$fg on $bg is still an exception (delete the entry once it reaches 3:1)', ({ fg, bg }) => {
    expect(ratio(fg, bg)).toBeLessThan(3);
  });
});
