/**
 * Reads the shell components (Sidebar, Top Navigation, Tabs, Section Card, Page Header) out of the pack into the specs
 * the gallery renders (tests/harness/gallery/main.tsx), so the pixel tests use exactly the pack's texts.
 */
import { digits, type Node } from './pack';

/**
 * Nested icon instances are named by the Iconsax library component behind their swap (`valueName`, e.g.
 * "flash / Property 1=linear"). Node ids are not used: they change whenever Figma re-imports the library. The code's
 * icon set names a few of these differently; the targets were found by geometry matching (every Iconsax Linear icon
 * rendered at 16px and compared with the pack PNGs), as was done for the Select chevrons in M1.
 */
export const ICON_BY_SWAP: Record<string, string> = {
  'setting-2': 'setting-2',
  'brush-2': 'brush-2',
  'notification-bing': 'notification-bing',
  'shield-tick': 'shield-tick',
  flash: 'flashy',
  'element-3': 'element-3',
  data: 'data',
  code: 'code-1',
  book: 'book-1',
  'message-question': 'message-question',
  export: 'export-square',
};

export type Locale = 'EN' | 'FA';

const propEntry = (n: Node, name: string) => {
  const props = n.instance?.componentProperties ?? {};
  const key = Object.keys(props).find((k) => k === name || k.startsWith(`${name}#`));
  return key ? props[key] : undefined;
};

const prop = (n: Node, name: string): unknown => propEntry(n, name)?.value;

/** The code's icon name for an instance-swap property ("flash / Property 1=linear" → "flashy"). */
const icon = (n: Node, swap: string): string => {
  const library = (propEntry(n, swap)?.valueName ?? '').split(' / ')[0] ?? '';
  return ICON_BY_SWAP[library] ?? '';
};

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
  // Top Navigation: a Version badge instance. Sidebar: a "Version 1.0" text row in the Footer.
  const versionNode = nodes.find((n) => n.name === 'Version' && n.instance);
  const versionText = nodes.find((n) => n.type === 'TEXT' && n.name === 'Version label')?.text?.characters;
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
          icon: leading ? icon(c, 'Leading icon swap') : '',
        });
      }
    }
  }
  return {
    brand,
    version: versionNode ? version(versionNode.instance?.texts?.Label ?? '') : versionText ? version(versionText) : undefined,
    groups,
    links,
  };
}
