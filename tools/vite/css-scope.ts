/**
 * Post-processes the final CSS so wp-admin (and any other plugin) cannot out-rank Fyldo's styles, and Fyldo's
 * selectors can never match anything outside its root (docs/ARCHITECTURE.md §8.2):
 *
 *   1. `@layer` blocks are FLATTENED in declaration order — wp-admin CSS is unlayered, and unlayered rules beat any
 *      layered rule regardless of specificity, so layered output would always lose.
 *   2. Every top-level style rule is prefixed with the root attribute selector, doubled
 *      (`[data-fyldo-v1][data-fyldo-v1] …`, +0,2,0) so it also beats core selectors such as `input[type=text]:focus`.
 *      Rules that already target the root (`[data-fyldo-v1] …`, `:root`, `:host`, `html`) become compound selectors.
 *   3. `@keyframes` are renamed with a `fyldo-` prefix (global namespace), `body.fyldo-screen …` rules are kept as-is.
 */
import postcss, { type AtRule, type ChildNode, type Root, type Rule } from 'postcss';
import type { Plugin } from 'vite';

export interface ScopeOptions {
  /** Attribute selector of the root element, e.g. `[data-fyldo-v1]`. */
  root: string;
}

const KEEP_AS_IS = [/^body\.fyldo-screen(?![\w-])/, /^html\.fyldo-screen(?![\w-])/];

export function scopeSelector(selector: string, root: string): string {
  const s = selector.trim();
  const bumped = root + root;

  if (KEEP_AS_IS.some((re) => re.test(s))) return s;
  if (s.startsWith(root)) return bumped + s.slice(root.length);
  if (s === ':root' || s === ':host' || s === 'html') return bumped;
  return `${bumped} ${s}`;
}

function isInsideKeyframes(node: ChildNode): boolean {
  for (let p = node.parent; p && p.type !== 'root'; p = p.parent as postcss.Container | undefined) {
    if (p.type === 'atrule' && /keyframes$/i.test((p as AtRule).name)) return true;
  }
  return false;
}

export function flattenLayers(ast: Root): void {
  const order: string[] = [];
  const layers = new Map<string, ChildNode[]>();
  const preamble: ChildNode[] = [];
  const rest: ChildNode[] = [];

  const remember = (name: string) => {
    if (!order.includes(name)) order.push(name);
  };

  ast.each((node) => {
    if (node.type === 'atrule' && node.name === 'layer') {
      if (!node.nodes) {
        node.params.split(',').map((n) => n.trim()).filter(Boolean).forEach(remember);
        return;
      }
      const name = node.params.trim() || '(anonymous)';
      remember(name);
      layers.set(name, [...(layers.get(name) ?? []), ...node.nodes.map((n) => n.clone())]);
      return;
    }
    if (node.type === 'atrule' && (node.name === 'charset' || node.name === 'import')) preamble.push(node.clone());
    else rest.push(node.clone());
  });

  ast.removeAll();
  [...preamble, ...order.flatMap((n) => layers.get(n) ?? []), ...rest].forEach((n) => ast.append(n));

  // Layers may be nested inside @media/@supports in odd inputs: unwrap any that remain.
  ast.walkAtRules('layer', (rule) => {
    if (rule.nodes) rule.replaceWith(rule.nodes);
    else rule.remove();
  });
}

export function scopeCss(css: string, options: ScopeOptions): string {
  const ast = postcss.parse(css);

  flattenLayers(ast);

  ast.walkAtRules(/keyframes$/i, (rule) => {
    if (!rule.params.startsWith('fyldo-')) rule.params = 'fyldo-' + rule.params;
  });
  ast.walkDecls(/^animation(-name)?$/i, (decl) => {
    decl.value = decl.value.replace(/(^|[\s,])(?!fyldo-)(spin|ping|pulse|bounce)(?=[\s,;]|$)/g, '$1fyldo-$2');
  });

  ast.walkRules((rule: Rule) => {
    if (isInsideKeyframes(rule)) return;
    if (rule.parent && rule.parent.type === 'rule') return; // nested (`&:hover`) — inherits its parent's scope
    rule.selectors = rule.selectors.map((s) => scopeSelector(s, options.root));
  });

  return ast.toString();
}

/** Vite plugin: run after minification, on the emitted stylesheet(s). */
export function fyldoCssScope(options: ScopeOptions): Plugin {
  return {
    name: 'fyldo-css-scope',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && file.fileName.endsWith('.css')) {
          file.source = scopeCss(String(file.source), options);
        }
      }
    },
  };
}
