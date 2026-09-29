/**
 * Reads the shell components (Sidebar, Top Navigation, Tabs, Section Card, Page Header) out of the pack into the specs
 * the gallery renders (tests/harness/gallery/main.tsx), so the pixel tests use exactly the pack's texts.
 */
import { digits, type Node } from './pack';

/**
 * The pack names nested icon instances only by their component-swap id. These are the Iconsax names behind those ids,
 * found by geometry matching (every Iconsax Linear icon rendered at 16px and compared with the pack PNGs; each winner
 * differs from the pack by a small fraction of the runner-up's distance), as was done for the Select chevrons in M1.
 */
export const ICON_BY_SWAP: Record<string, string> = {
  '8:36649': 'setting-2',
  '8:18622': 'brush-2',
  '8:38716': 'notification-bing',
  '8:42054': 'shield-tick',
  '8:15129': 'flashy',
  '8:43437': 'element-3',
  '8:38208': 'data',
  '8:37753': 'code-1',
  '8:45089': 'book-1',
  '8:30359': 'message-question',
  '8:12239': 'export-square',
};

export type Locale = 'EN' | 'FA';

const prop = (n: Node, name: string): unknown => {
  const props = n.instance?.componentProperties ?? {};
  const key = Object.keys(props).find((k) => k === name || k.startsWith(`${name}#`));
  return key ? props[key]?.value : undefined;
};

const icon = (n: Node, swap: string): string => ICON_BY_SWAP[String(prop(n, swap))] ?? '';

/** The label a nested instance shows in a locale (FA components carry their text in the `Label (FA)` property). */
export const label = (n: Node, locale: Locale, base = 'Label'): string =>
  String(prop(n, locale === 'FA' ? `${base} (FA)` : base) ?? n.instance?.texts?.Label ?? '');

/** "v1.0" / "۱٫۰" → "1.0" (the code prints the "v" and the numerals itself). */
export const version = (text: string): string => digits(text.replace('٫', '.')).join('.');

function* walk(n: Node): Generator<Node> {
  yield n;
  for (const c of n.children ?? []) yield* walk(c);
}

export const instances = (root: Node, component: string): Node[] =>
  [...walk(root)].filter((n) => n.instance?.component === component);

/** Sidebar / Top Navigation → the gallery's nav spec. `badge` is the ASCII count; the code localises it. */
export function navSpec(root: Node, locale: Locale, item: 'Nav Item' | 'Tab') {
  const nodes = [...walk(root)];
  const brand =
    nodes.find(
      (n) => n.type === 'TEXT' && (n.name === 'Name' || n.name === 'Fyldo' || n.name === 'فیلدو'),
    )?.text?.characters ?? '';
  const versionNode = nodes.find((n) => n.name === 'Version');
  const groups: Array<{
    label?: string;
    items: Array<{ label: string; icon: string; badge?: string; active: boolean }>;
  }> = [];
  const links: Array<{ label: string; icon: string }> = [];

  const swap = 'Icon swap';
  // FA rows are laid out right-to-left, so the pack lists a row's children from the LAST in reading order.
  const inReadingOrder = (list: Node[] = [], row = true): Node[] =>
    locale === 'FA' && row ? [...list].reverse() : list;
  const badgeProp = item === 'Nav Item' ? 'Badge' : 'Count';
  const toItem = (n: Node) => ({
    label: label(n, locale),
    icon: icon(n, swap),
    badge: prop(n, badgeProp) === true ? '3' : undefined,
    active: String(prop(n, 'State')) === 'Active',
  });

  for (const n of root.children ?? []) {
    if (n.name === 'Navigation') {
      // Sidebar: frames "Group · …" holding a Group label + Nav Items. Top Navigation: Tabs split by "Group divider".
      if (item === 'Nav Item') {
        for (const g of n.children ?? []) {
          const text = [...walk(g)].find((c) => c.type === 'TEXT' && c.name === 'Group label')?.text
            ?.characters;
          groups.push({ label: text, items: instances(g, 'Nav Item').map(toItem) });
        }
      } else {
        let current: (typeof groups)[number] = { items: [] };
        for (const c of inReadingOrder(n.children)) {
          if (c.name === 'Group divider') {
            groups.push(current);
            current = { items: [] };
          } else if (c.instance?.component === 'Tab') current.items.push(toItem(c));
        }
        groups.push(current);
      }
    }
    if (n.name === 'Footer')
      for (const c of instances(n, 'Nav Item'))
        links.push({ label: label(c, locale), icon: icon(c, swap) });
    if (n.name === 'Header') {
      for (const c of inReadingOrder(instances(n, 'Button'))) {
        const leading = prop(c, 'Leading icon') === true;
        links.push({
          label: label(c, locale),
          icon: leading ? (ICON_BY_SWAP[String(prop(c, 'Leading icon swap'))] ?? '') : '',
        });
      }
    }
  }
  return {
    brand,
    version: versionNode ? version(versionNode.instance?.texts?.Label ?? '') : undefined,
    groups,
    links,
  };
}
