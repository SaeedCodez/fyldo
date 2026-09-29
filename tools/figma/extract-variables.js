/**
 * Runs INSIDE Figma (figma-console MCP → figma_execute). Returns every local variable as a nested DTCG tree, the same
 * shape `figma_export_tokens` writes and `tools/tokens/snapshot.ts` reads (tokens/.raw/all.tokens.json).
 *
 * Why it exists: `figma_export_tokens` can serve a cached variable set (observed 2026-09-29: five variables added in
 * Figma were missing from its output while `figma_get_variables` and the Plugin API listed them). This script reads
 * the live document, so it is the source of truth for the snapshot; use it whenever the export looks stale
 * (variable counts differ from `figma_get_variables`).
 *
 * Path rule (identical to the exporter): `<collection name, lower-case>.<variable name split on "/">`.
 * Aliases become `{path}`, colours `#RRGGBB` (`#RRGGBBAA` when translucent), numbers `dimension`, strings `fontFamily`
 * (scope FONT_FAMILY) or `string`.
 */
const hex = (c) => {
  const b = (x) => Math.round(x * 255).toString(16).padStart(2, '0').toUpperCase();
  return '#' + b(c.r) + b(c.g) + b(c.b) + (c.a !== undefined && c.a < 1 ? b(c.a) : '');
};

const collections = await figma.variables.getLocalVariableCollectionsAsync();
const variables = await figma.variables.getLocalVariablesAsync();
const byId = new Map(variables.map((v) => [v.id, v]));
const collectionOf = new Map(collections.map((c) => [c.id, c]));

const pathOf = (v) => [collectionOf.get(v.variableCollectionId).name.toLowerCase(), ...v.name.split('/')];

const tree = {};
for (const v of variables) {
  const collection = collectionOf.get(v.variableCollectionId);
  const raw = v.valuesByMode[collection.defaultModeId];
  const path = pathOf(v);

  let value;
  if (raw && typeof raw === 'object' && raw.type === 'VARIABLE_ALIAS') value = '{' + pathOf(byId.get(raw.id)).join('.') + '}';
  else if (v.resolvedType === 'COLOR') value = hex(raw);
  else value = raw;

  const type =
    v.resolvedType === 'COLOR' ? 'color' : v.resolvedType === 'FLOAT' ? 'dimension' : v.scopes.includes('FONT_FAMILY') ? 'fontFamily' : 'string';

  const token = { $type: type, $value: value };
  if (v.description) token.$description = v.description;
  if (v.codeSyntax && v.codeSyntax.WEB) token.$extensions = { 'figma-console-mcp': { codeSyntax: { WEB: v.codeSyntax.WEB } } };

  let node = tree;
  path.slice(0, -1).forEach((key) => {
    if (node[key] && '$value' in node[key]) throw new Error('Variable path collides with a group: ' + path.join('.'));
    node = node[key] = node[key] || {};
  });
  const leaf = path[path.length - 1];
  if (node[leaf]) throw new Error('Variable path collides: ' + path.join('.'));
  node[leaf] = token;
}

tree.$extensions = { 'figma-console-mcp': { figmaFileKey: figma.fileKey || 'Pg3Ni7eqTLQYIG6hfNVPt6', source: 'plugin-api' } };
return { count: variables.length, tree };
