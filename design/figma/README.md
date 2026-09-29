# Figma reference pack

A read-only export of the Fyldo design (Figma file `Pg3Ni7eqTLQYIG6hfNVPt6`, page **Components**), so that code, tests and
cloud sessions never need Figma access. Exported 2026-09-29 through the figma-console MCP (Desktop Bridge); nothing in the
Figma file was modified. The "Fyldo – HeroUI" file, the Foundations page and the Icons page are **not** part of it
(tokens live in `tokens/figma.tokens.json`, styles in `tokens/figma.styles.json`, the spec in `docs/design-spec.md`).

## Contents

| Path | What |
|---|---|
| `index.json` | Every component set (node id, variant count, JSON path, all PNG paths), every usage/template frame, export date, `variableCount` (150 = `tokens/figma.tokens.json`). Start here. |
| `components/<kebab-name>.json` | One file per COMPONENT_SET (27): property definitions and, per variant, the full node tree. |
| `png/<kebab-name>/<variant>.png` | Every variant at **2x** (534 files). File name = `axis-value` pairs joined by `--`, in axis order, e.g. `locale-en--type-primary--size-small--state-default.png`. |
| `png/usage/*.png` | The 12 "· Usage" frames and the 4 full "Settings page" templates (EN/FA, sidebar and top-nav) at **1x**. |

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
- `node tools/figma/spot-check.mjs` re-runs 90 checks of spec numbers (docs/design-spec.md §4) against the JSON.
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
- `code frames` exports the 16 usage/template frames at scale 1 (`--scale` to change).
- The extractor also installs `globalThis.fp([...])` in the plugin sandbox, which runs several small sets in one call
  (`fp([{mode:'json', setId:'…'}, …])`); results are padded so the harness always saves them to a file the decoder can read.
- `verify` fails when a set lacks JSON or PNGs, variant counts differ from Figma, a PNG is empty/invalid, or the variable count
  is not the one in `tokens/figma.tokens.json`.

## Known differences from docs/design-spec.md (recorded, not fixed)

| Where | Spec says | Figma has |
|---|---|---|
| Textarea width (§4.3, "As Input") | Input pattern (320) | 360 wide |
| Top Navigation row 1 padding (§4.10, "padding 24/12") | vertical 12 | top 12, **bottom 4** (height still 48) |

Everything else spot-checked (90 values over all 27 sets, incl. Button S/M/L 32/40/48, Input 320, Toast 400, Modal 480,
Save Bar 800×54, shadows and radii) matches. The Tooltip's `max width 240` is set on the label text, not on the bubble.
