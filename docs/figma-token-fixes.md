# Figma token changes needed before Milestone 1 can be closed

Decision O4 (changed): the failing tokens are fixed **in Figma**, the code is built against the re-read values, and the
contrast test (`tests/js/contrast.test.ts`) has **no `expectedFail` entries**. Decision O5 adds two focus tokens.

Status on 2026-09-29 (re-read at the start of M1 and again at the end): **the Figma file still has the original values.**
The code is finished against everything else; these 10 contrast tests are red until the file is updated:

```
npm run test -- tests/js/contrast.test.ts
```

All numbers below are WCAG 2.x contrast ratios computed from the Figma values (`tools/tokens/color.ts`).
"Suggested" only uses primitives that **already exist** in the file unless stated.

## 1. Tokens that fail today

| # | Token (Color collection) | Now → primitive | Fails on | Ratio now | Needs | Suggested change | Ratio after |
|---|---|---|---|---|---|---|---|
| 1 | `text/tertiary` (placeholder, counter, sidebar group labels) | `gray/700` #8f8f8f | `background/default`, `background/subtle` | **3.23**, **3.10** | ≥ 4.5 | Point to a colour ≥ 4.5 on **#fafafa**: no existing step qualifies except `gray/900` (5.50, but that is identical to `text/secondary`, so no hierarchy). **Recommended: add a primitive `gray/850` = #737373** (4.74 on white, 4.54 on #fafafa) and alias `text/tertiary` to it | 4.74 / 4.54 |
| 2 | `text/disabled` | `gray/700` (same alias as tertiary) | — (disabled text is exempt) | 3.23 | — | Keep `gray/700`, but alias it **separately** so #1 doesn't change disabled text | — |
| 3 | Field boundary: `border/default` (Input, Textarea, Select, Multi Select stroke) | `gray/400` #ebebeb | `background/default` | **1.19** | ≥ 3 (1.4.11) | **Add `border/input` → `gray/700` (#8f8f8f, 3.23)**. Keep `border/default` for card borders and dividers (decorative, exempt) | 3.23 |
| 4 | Field hover boundary: `border/hover` | `gray/500` #c9c9c9 | `background/default` | **1.66** | ≥ 3 | **Add `border/input-hover` → `gray/900` (#666666)** | 5.74 |
| 5 | Focused field boundary | *token missing* (`border/strong` `gray/600` = 2.38) | — | — | ≥ 3 | **Add `focus/border` → `gray/1000` (#171717)** (approved O5) | 17.93 |
| 6 | Keyboard focus ring | *token missing* (`focus/ring` is blue and unused) | — | — | ≥ 3 | **Add `focus/ring-neutral` → `gray/1000`** (approved O5). Optionally delete the blue `focus/ring` and the `Focus/Ring` effect | 17.93 |
| 7 | Switch track off: `control/off` | `gray/500` #c9c9c9 | `background/default` | **1.66** | ≥ 3 | `control/off` → `gray/700` (3.23); `control/off-hover` → `gray/900` (5.74) | 3.23 |
| 8 | Solid badge, info: `status/info/solid` | `blue/700` #0072f5 | white text | **4.44** | ≥ 4.5 | `blue/800` #0062d1 (5.73) — or `blue/900` (5.31) | 5.73 |
| 9 | Solid badge, success: `status/success/solid` (also the Toast/Save Bar success icon, which only needs 3:1) | `green/700` #45a557 | white text | **3.10** | ≥ 4.5 | `green/900` #297a3a (5.33). (`green/800` gives 4.08 — not enough) | 5.33 |
| 10 | Subtle badge, error: `status/error/subtle` | `red/300` #ffe5e5 | `status/error/text` (`red/900`) | **4.497** (misses by 0.003) | ≥ 4.5 | `status/error/subtle` → `red/200` #ffebeb | 4.69 |

`status/warning/solid` (amber) is fine because its text is `text/primary` (9.94), not white.

## 2. How the code picks the new tokens up

| Figma change | Code that follows (no other change needed) |
|---|---|
| `focus/ring-neutral`, `focus/border` added | Generated as `--fyldo-focus-ring-color` / `--fyldo-focus-border-color`; `--ring` (shadcn) maps to the ring token. The generator is **strict**: without them `npm run build` fails and names the missing tokens |
| `border/input`, `border/input-hover` added | Switch the shared control classes in `app/components/ui/control.ts` from `border-border-default/hover` to the new names (2 lines); the contrast test already prefers `border/input` when it exists |
| Any value change | Re-measure with the figma-console MCP (see below) → `npm run tokens:snapshot` → `npm run tokens` → all utilities follow |

## 3. Refreshing the snapshot after the Figma edit (needs a session with the figma-console MCP)

1. `figma_export_tokens` with `format: dtcg`, `colorFormat: hex8`, `outputPath: <repo>/tokens/.raw/all.tokens.json`.
2. `figma_execute` with `tools/figma/extract-styles.js`; save its result as `tokens/.raw/styles.json`.
3. `npm run tokens:snapshot && npm run tokens && npm test` (unit, contrast, generator) and `npm run test:e2e`.
