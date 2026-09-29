/**
 * Runs INSIDE Figma (figma-console MCP → figma_execute). Returns text + effect styles as compact JSON.
 * The result is saved (by the developer / the assistant) as tokens/.raw/styles.json; `npm run tokens:snapshot` turns it into tokens/figma.styles.json.
 *
 *   docs/figma-token-fixes.md §3 documents the full procedure (variables via figma_export_tokens or extract-variables.js, styles via this file).
 */
const hex8 = (c) =>
  '#' +
  [c.r, c.g, c.b, c.a === undefined ? 1 : c.a]
    .map((x) => Math.round(x * 255).toString(16).padStart(2, '0'))
    .join('');

const textStyles = (await figma.getLocalTextStylesAsync()).map((s) => ({
  name: s.name,
  family: s.fontName.family,
  style: s.fontName.style,
  size: s.fontSize,
  lineHeight: s.lineHeight.unit === 'AUTO' ? { unit: 'AUTO' } : { unit: s.lineHeight.unit, value: s.lineHeight.value },
  letterSpacing: { unit: s.letterSpacing.unit, value: s.letterSpacing.value },
}));

const effectStyles = (await figma.getLocalEffectStylesAsync()).map((s) => ({
  name: s.name,
  effects: s.effects.map((e) => ({
    type: e.type,
    x: e.offset ? e.offset.x : 0,
    y: e.offset ? e.offset.y : 0,
    blur: e.radius,
    spread: e.spread || 0,
    color: e.color ? hex8(e.color) : null,
  })),
}));

return { textStyles, effectStyles };
