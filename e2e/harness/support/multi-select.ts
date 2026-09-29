/**
 * Shared by the Multi Select parity and pixel specs: reads a Multi Select / Select Menu frame of the Figma pack and turns it into
 * the gallery parameters that reproduce it.
 */
import type { Page } from '@playwright/test';
import { open } from './figma';
import { digits, layer, shown, type Node } from './pack';

export const LOCALES = [
  { name: 'EN', dir: 'ltr' },
  { name: 'FA', dir: 'rtl' },
] as const;
export type Locale = (typeof LOCALES)[number];

export const SIZES = [
  { name: 'Small', code: 'sm' },
  { name: 'Medium', code: 'md' },
  { name: 'Large', code: 'lg' },
] as const;
export const STATES = ['Default', 'Hover', 'Focus', 'Open', 'Filled', 'Error', 'Disabled'] as const;
export type State = (typeof STATES)[number];

export const figmaStart = (root: Node, n: Node, dir: 'ltr' | 'rtl') => (dir === 'rtl' ? root.width - (n.x + n.width) : n.x);
export const figmaEnd = (root: Node, n: Node, dir: 'ltr' | 'rtl') => (dir === 'rtl' ? n.x : root.width - (n.x + n.width));

/** The pack's tag instances of a Multi Select frame, in reading order (first tag first), then the overflow chip. */
export function tagsOf(values: Node, root: Node, dir: 'ltr' | 'rtl') {
  const tags = (values.children ?? []).filter((c) => c.name.startsWith('Tag ')).sort((a, b) => figmaStart(root, a, dir) - figmaStart(root, b, dir));
  const overflow = (values.children ?? []).find((c) => c.name === 'Overflow');
  return { tags, overflow };
}

export const LABEL_OF = (n: Node) => n.instance?.texts.Label ?? '';
export const tagVariantProps = (n: Node) => Object.fromEntries((n.instance?.variant ?? '').split(', ').map((p) => p.split('='))) as Record<string, string>;

/** Gallery parameters that reproduce a pack frame: its texts, its tags (+ the ones hidden behind "+n"). */
export function paramsFor(loc: Locale, root: Node, code: string, state: State, extra: Record<string, string> = {}) {
  const control = layer(root, 'Control');
  const { tags, overflow } = tagsOf(layer(control, 'Values'), root, loc.dir);
  const labels = tags.map(LABEL_OF);
  const hidden = overflow ? (digits(LABEL_OF(overflow))[0] ?? 0) : 0;
  for (let i = 1; i <= hidden; i++) labels.push(`${loc.name === 'FA' ? 'گزینه' : 'More'} ${i}`);
  const options = labels.map((l, i) => `o${i}:${l}`);
  return {
    c: 'multi-select',
    dir: loc.dir,
    size: code,
    state: state === 'Error' ? 'error' : state === 'Disabled' ? 'disabled' : 'default',
    label: layer(root, 'Label').text?.characters ?? '',
    placeholder: shown(control, 'Placeholder') ? (layer(control, 'Placeholder').text?.characters ?? '') : '',
    helper: shown(root, 'Helper text') ? (layer(root, 'Helper text').text?.characters ?? '') : '',
    error: shown(root, 'Error message') ? (layer(root, 'Error message').text?.characters ?? '') : '',
    options: options.join('|'),
    value: tags.length > 0 ? options.map((_, i) => `o${i}`).join(',') : '',
    ...extra,
  };
}

export async function openMenu(page: Page, loc: Locale, root: Node, options: Record<string, string>) {
  const items = Array.from({ length: 6 }, (_, i) => layer(root, `Item ${i + 1}`));
  const labels = items.map(LABEL_OF);
  const stage = await open(page, {
    c: 'multi-select',
    dir: loc.dir,
    label: 'Show on',
    options: labels.map((l, i) => `o${i}:${l}${i === 5 ? '::disabled' : ''}`).join('|'),
    value: 'o0,o1,o2,o3',
    max: '0',
    ...options,
  });
  await stage.getByRole('combobox').click();
  const popup = page.locator('[data-slot=fy-multi-select-menu]');
  await popup.waitFor();
  return { stage, popup, items, labels };
}

