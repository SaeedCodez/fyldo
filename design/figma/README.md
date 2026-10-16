# Figma reference pack

A read-only export of the Fyldo design (Figma file `Pg3Ni7eqTLQYIG6hfNVPt6`, page **Components**), so that code, tests and
cloud sessions never need Figma access. Exported 2026-10-11 (after the redesign: primary colour, tinted neutrals, bigger controls) through the figma-console MCP
(Desktop Bridge); nothing in the Figma file was modified. 47 component sets, 947 variants, 26 usage/template frames. The "Fyldo – HeroUI" file, the Foundations page and the icon sets themselves are **not** part of it (Iconsax is a published team library since 2026-10-16; icon instances are recorded by name, size and colour token)
(tokens live in `tokens/figma.tokens.json`, styles in `tokens/figma.styles.json`, the spec in `docs/design-spec.md`).

## Contents

| Path | What |
|---|---|
| `index.json` | Every component set (node id, variant count, JSON path, all PNG paths), every usage/template frame, export date, `variableCount` (166 = `tokens/figma.tokens.json`), `componentCount` (47), `variantCount` (947). Start here. |
| `components/<kebab-name>.json` | One file per COMPONENT_SET (40): property definitions and, per variant, the full node tree. |
| `png/<kebab-name>/<variant>.png` | Every variant at **2x** (839 files). File name = `axis-value` pairs joined by `--`, in axis order, e.g. `locale-en--type-primary--size-small--state-default.png`. |
| `png/usage/*.png` | The 19 "· Usage" frames and the 4 full "Settings page" templates (EN/FA, sidebar and top-nav) at **1x**; 23 in all. |

The existing `tests/visual/figma/*.png` are untouched and independent of this pack.

### Component JSON

```jsonc
{
  "source": { "fileKey": "…", "page": "Components", "nodeId": "8:1984" },
  "set": { "name": "Button", "variantCount": 120,
           "componentPropertyDefinitions": { "Label#8:0": { "type": "TEXT", "defaultValue": "Button" }, … } },
  "variants": [ { "id": "8:1985", "name": "Locale=EN, Type=Primary, …", "file": "locale-en--type-primary--…",
                  "variantProperties": { "Locale": "EN", … }, "node": { …tree… } } ]
}
```

Each node: `name, type, visible, opacity, x, y, width, height` (x/y relative to the variant root), `layout` (Plugin API names:
`layoutMode`, four paddings, `itemSpacing`, `primaryAxisAlignItems`, `counterAxisAlignItems`, sizing modes,
`layoutSizingHorizontal/Vertical`, `layoutGrow`, `layoutAlign`, min/max sizes, `clipsContent`), `cornerRadius`, `fills`,
`strokes` (`paints`, `weight`, `align`), `effects` (`style` name + raw `values`), `text` (`characters`, `textStyle`, font,
size, `lineHeight`, `letterSpacing`, alignment, `fillToken`), `children`.

- **Tokens by name, never by id.** `fills[].token` / `strokes.paints[].token` is the bound variable name (`border/input`) next
  to the resolved `hex`. `bound` maps other properties (`paddingLeft`, `itemSpacing`, `topLeftRadius`, `fontFamily`…) to their
  variable names (`space/12`, `radius/sm`, `en/font-family/sans`). A fill without `token` is a literal.
- **Icons** (Iconsax instances) are `icon: { name, size, variant, colour }` and are not walked.
- **Nested instances** of other component sets are *not* walked: `instance: { component, variant, componentProperties, texts }`
  says what is placed there; look up that set's own JSON for its internals. `texts` holds the visible text overrides.
- `propertyReferences` shows which component property drives a layer (`visible` → `Leading icon#8:121`, `characters` → `Label#8:0`).
- `Locale=EN|FA` is a Figma-only axis (code uses `dir`); FA variants are in the pack because they show the mirrored layout.
- Hex is `#rrggbb`; translucency is a separate `opacity`.

## How tests should use it

- Treat it as the source of truth for **geometry and token bindings** in unit/e2e assertions: read the JSON, pick the
  variant, assert e.g. control height, padding, radius, gap or the token a fill is bound to. Resolve token names to values
  through `tokens/figma.tokens.json`, not through the `hex` here (the hex is a convenience snapshot).
- Use the PNGs as **visual references** (2x, transparent outside the component bounds). They come straight from Figma and
  are not pixel baselines: fonts are Geist/IRANYekanX in Figma and Geist/Vazirmatn in code, so compare layout, not pixels.
- `node tools/figma/spot-check.mjs` re-runs 90 checks of spec numbers (docs/design-spec.md §4, the original 27 sets) against the JSON.
- Never edit files here by hand; refresh them from Figma (below) so the pack stays a faithful copy.

## Refreshing

The extractor is `tools/figma/export-pack.js`; it runs inside Figma through `figma_execute` and only reads. `tools/figma/pack.mjs`
turns its results into files. Do **not** use `figma_export_tokens` (stale cache) or screenshots.

```bash
node tools/figma/pack.mjs code json --set Toast        # prints a snippet; paste it into figma_execute (timeout 30000)
node tools/figma/pack.mjs decode <result-file>         # path printed by the harness; prints "next start N" if a batch was partial
node tools/figma/pack.mjs code png --set Toast         # same for the 2x PNGs
node tools/figma/pack.mjs decode <result-file>
node tools/figma/pack.mjs code list                    # re-list sets/frames/variable count, decode it first when sets were added or renamed
node tools/figma/pack.mjs index && node tools/figma/pack.mjs verify
```

- `code … --start N` continues a batch that stopped at the 30 s cap (large sets can need several calls; every set so far fit in one).
- `code frames` exports the 26 usage/template frames at scale 1 (`--scale` to change).
- The extractor also installs `globalThis.fp([...])` in the plugin sandbox, which runs several small sets in one call
  (`fp([{mode:'json', setId:'…'}, …])`); results are padded so the harness always saves them to a file the decoder can read.
- `verify` fails when a set lacks JSON or PNGs, variant counts differ from Figma, a PNG is empty/invalid, or the variable count
  is not the one in `tokens/figma.tokens.json`.

## Differences from docs/design-spec.md

None. Two mismatches found by `tools/figma/spot-check.mjs` (Textarea is 360 wide, not "as Input"; Top Navigation row 1 padding is
top 12 / bottom 4; row 1 is 52 high since the redesign) were fixed in the spec, which now follows Figma; the spot-check reports 0 differences.

Everything else spot-checked (90 values over the original 27 sets, incl. Button S/M/L 36/44/52, Input 320, Toast 440, Modal 560,
Save Bar 960×62, shadows and radii) matches. The sets added later (Slider, Upload Image, Select File, Segment, Segmented
Control, Color Swatch, Color Picker, Color Picker Panel, Choice Card, Choice Card Group, Icon Picker, Icon Picker Modal, Icon
Tile, and later Group, Group Item, Menu Message, Date Field, Calendar Cell, Calendar Panel, Time Panel) are not in the spot-check. The Tooltip's `max width 240` is set on the
label text, not on the bubble.
