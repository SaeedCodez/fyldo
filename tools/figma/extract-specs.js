/**
 * Runs INSIDE Figma (figma-console MCP → figma_execute). Measures selected variants of a component set and returns
 * compact, resolved numbers the browser tests compare against (tests/visual/figma/*.json).
 *
 * Edit SET_ID and PICK for the component, run it, save the returned JSON. Colours are the RESOLVED values of the bound
 * variables (what Figma actually renders), so token changes in Figma flow into the tests when the file is re-measured.
 *
 *   SET_ID  component set node id
 *   PICK    variant property filters to include, e.g. [{Locale:'EN', State:'Default'}, …]; a variant is measured when it
 *           matches ANY filter
 */
const SET_ID = '8:1984';
const PICK = [{ Locale: 'EN', Size: 'Small' }];
const MAX_DEPTH = 4;

const hex = (c, opacity = 1) => {
  const to = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  const a = (c.a === undefined ? 1 : c.a) * opacity;
  return '#' + to(c.r) + to(c.g) + to(c.b) + (a < 0.999 ? to(a) : '');
};
const round = (n) => Math.round(n * 100) / 100;
const solid = (paints) => {
  const p = (paints || []).find((x) => x.visible !== false && x.type === 'SOLID');
  return p ? hex(p.color, p.opacity === undefined ? 1 : p.opacity) : null;
};

function measure(node) {
  const out = { w: round(node.width), h: round(node.height) };
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    out.dir = node.layoutMode === 'HORIZONTAL' ? 'row' : 'column';
    out.pad = [node.paddingLeft, node.paddingRight, node.paddingTop, node.paddingBottom];
    out.gap = node.itemSpacing;
  }
  if (typeof node.cornerRadius === 'number' && node.cornerRadius) out.radius = node.cornerRadius;
  const fill = solid(node.fills);
  if (fill) out.fill = fill;
  const stroke = solid(node.strokes);
  if (stroke) {
    out.stroke = stroke;
    out.strokeWidth = node.strokeWeight;
    out.strokeInLayout = node.strokesIncludedInLayout === true;
  }
  if (node.effects && node.effects.length) {
    out.shadows = node.effects
      .filter((e) => e.visible !== false && e.type === 'DROP_SHADOW')
      .map((e) => [e.offset.x, e.offset.y, e.radius, e.spread || 0, hex(e.color)]);
  }
  if (node.opacity !== undefined && node.opacity < 1) out.opacity = node.opacity;
  if (node.type === 'TEXT') {
    out.text = node.characters;
    out.font = { size: node.fontSize, weight: node.fontName.style, family: node.fontName.family, lh: node.lineHeight.unit === 'PIXELS' ? node.lineHeight.value : null, ls: round(node.letterSpacing.value) };
    out.color = solid(node.fills);
  }
  return out;
}

function walk(node, path, out, depth) {
  if (node.visible === false) return;
  out[path] = measure(node);
  if (node.children && depth < MAX_DEPTH && node.type !== 'INSTANCE') {
    const seen = {};
    for (const child of node.children) {
      seen[child.name] = (seen[child.name] || 0) + 1;
      walk(child, path + '/' + child.name + (seen[child.name] > 1 ? '#' + seen[child.name] : ''), out, depth + 1);
    }
  }
}

const set = await figma.getNodeByIdAsync(SET_ID);
const variants = {};
for (const variant of set.children) {
  const props = variant.variantProperties;
  if (!PICK.some((f) => Object.entries(f).every(([k, v]) => props[k] === v))) continue;
  const parts = {};
  walk(variant, 'root', parts, 0);
  variants[Object.entries(props).map(([k, v]) => `${k}=${v}`).join(',')] = parts;
}
return { set: set.name, id: SET_ID, count: Object.keys(variants).length, variants };
