/**
 * One icon as `<svg>` markup, for a module that draws outside React (an iframe, a shadow root, a site preview): the browser
 * twin of PHP's `Fyldo::icon()` (src/Support/Icons.php), with the same output. It loads only that icon's module, once.
 */
import { loadIcon, peekIcon } from './registry';
import type { IconNode } from './types';

export interface IconSvgOptions {
  /** Width and height in px; none by default, so CSS sizes it. */
  size?: number;
  /** A `class` attribute. */
  className?: string;
  /** An accessible name: `role="img"` and `aria-label` instead of `aria-hidden`. */
  label?: string;
}

/** An Iconsax name in kebab case: `setting-2`. */
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ELEMENTS = new Set(['path', 'g', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'rect']);
const ATTRIBUTES = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'opacity', 'fill-rule', 'clip-rule', 'transform']);

// eslint-disable-next-line fyldo/no-hex-colors -- `&#039;` is an HTML entity (what PHP's esc_attr() writes), not a colour.
const attr = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c}`).toLowerCase();

function markup(nodes: IconNode[]): string {
  return nodes
    .map(([tag, attrs, children]) => {
      if (!ELEMENTS.has(tag)) return '';
      const attributes = Object.entries(attrs)
        .map(([key, value]) => [kebab(key), value] as const)
        .filter(([key, value]) => ATTRIBUTES.has(key) && typeof value === 'string')
        .map(([key, value]) => ` ${key}="${attr(value)}"`)
        .join('');
      const inner = children ? markup(children) : '';
      return inner === '' ? `<${tag}${attributes}/>` : `<${tag}${attributes}>${inner}</${tag}>`;
    })
    .join('');
}

/**
 * `<svg>` markup of one Iconsax icon (24×24 viewBox, `fill="none"`, drawn in `currentColor`, decorative unless it has a
 * label), or '' for a name that is not an icon. Resolves once the icon's module has loaded; later calls are instant.
 */
export async function iconSvg(name: string, options: IconSvgOptions = {}): Promise<string> {
  if (!NAME.test(name)) return '';
  await loadIcon(name);
  const nodes = peekIcon(name);
  const body = nodes ? markup(nodes) : '';
  if (body === '') return '';

  const size = Number.isFinite(options.size) && (options.size ?? 0) > 0 ? Math.trunc(options.size as number) : 0;
  const className = options.className?.trim() ?? '';
  const label = options.label?.trim() ?? '';
  return (
    '<svg' +
    (size > 0 ? ` width="${size}" height="${size}"` : '') +
    ' viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"' +
    (className !== '' ? ` class="${attr(className)}"` : '') +
    (label !== '' ? ` role="img" aria-label="${attr(label)}"` : ' aria-hidden="true"') +
    ' focusable="false">' +
    body +
    '</svg>'
  );
}
