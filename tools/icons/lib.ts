/**
 * Iconsax (Linear only) → tiny ES modules, one per icon. The package stays the pinned source of truth: we render each
 * component with `variant="Linear"` and `color="currentColor"` and keep only the resulting shapes.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { IconNode } from '../../app/icons/types.ts';

export type { IconNode };

import { normalizeIconName } from '../../app/icons/normalize.ts';

export { normalizeIconName };

/** Iconsax-style kebab name for a package export: `SearchNormal1` → `search-normal-1`. */
export function toKebab(exportName: string): string {
  return exportName
    .replace(/^I(?=\d)/, '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .toLowerCase();
}

const camel = (attr: string) => attr.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** Parse the inner markup of an Iconsax SVG (only `<path>` and `<g>` occur in the Linear set). */
export function parseMarkup(markup: string): IconNode[] {
  const root: IconNode[] = [];
  const stack: IconNode[][] = [root];
  const tag = /<(\/?)(\w+)([^>]*?)(\/?)>/g;

  for (let m = tag.exec(markup); m; m = tag.exec(markup)) {
    const [, closing, name, rawAttrs, selfClosing] = m as unknown as [string, string, string, string, string];
    if (closing) {
      stack.pop();
      continue;
    }
    if (name !== 'path' && name !== 'g') throw new Error(`Unexpected element <${name}> in icon markup`);

    const attrs: Record<string, string> = {};
    for (const a of rawAttrs.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[camel(a[1] as string)] = decode(a[2] as string);

    const node: IconNode = [name, attrs];
    (stack[stack.length - 1] as IconNode[]).push(node);
    if (!selfClosing) {
      node[2] = [];
      stack.push(node[2]);
    }
  }
  return prune(root);
}

/** React closes `<path></path>`: drop the empty child lists so modules stay small. */
function prune(nodes: IconNode[]): IconNode[] {
  for (const node of nodes) {
    if (node[2] && node[2].length === 0) node.length = 2;
    else if (node[2]) prune(node[2]);
  }
  return nodes;
}

const decode = (v: string) => v.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x27;/g, "'");

export interface RenderedIcon {
  key: string;
  kebab: string;
  exportName: string;
  nodes: IconNode[];
}

/** Render every export of the package as Linear and return its shapes. */
export async function renderAllLinear(): Promise<RenderedIcon[]> {
  const icons = (await import('iconsax-reactjs')) as unknown as Record<string, unknown>;
  const seen = new Map<string, string>();
  const out: RenderedIcon[] = [];

  for (const exportName of Object.keys(icons).sort()) {
    const component = icons[exportName];
    if (typeof component !== 'function' && typeof component !== 'object') continue;
    if (exportName === 'default' || exportName === 'module.exports') continue;

    const html = renderToStaticMarkup(
      createElement(component as never, { variant: 'Linear', size: 24, color: 'currentColor' }),
    );
    const svg = /^<svg[^>]*>(.*)<\/svg>$/s.exec(html);
    if (!svg) throw new Error(`Icon ${exportName} did not render an <svg>`);

    const key = normalizeIconName(exportName);
    const clash = seen.get(key);
    if (clash) throw new Error(`Icon name collision: ${clash} and ${exportName} both normalise to "${key}"`);
    seen.set(key, exportName);

    out.push({ key, kebab: toKebab(exportName), exportName, nodes: parseMarkup(svg[1] as string) });
  }
  return out;
}

export const moduleSource = (nodes: IconNode[]): string => `export default ${JSON.stringify(nodes)};\n`;
