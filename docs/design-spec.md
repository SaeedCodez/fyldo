# Fyldo — Design Spec (extracted from Figma)

> Source: Figma file `Pg3Ni7eqTLQYIG6hfNVPt6` ("Fyldo"), read through the **figma-console MCP** on 2026-09-29.
> The "Fyldo – HeroUI" file was ignored, as instructed.
> Pages: `Foundations`, `Icons`, `Components` (13 sections, 27 component sets, 2 page templates × 2 locales).
> Everything below was read from the file, not inferred from screenshots. Section 9 lists every place where the design is silent, contradictory or fails WCAG.

**Reading guide**

- `{token}` = a Figma variable. The token → CSS mapping is in [ARCHITECTURE.md §9](./ARCHITECTURE.md#9-build-pipeline).
- `EN | FA` in Figma = `Locale` variant. **In code this does not exist**: direction comes from `dir`, text from i18n (see §7).
- All dimensions are px. All colours are light-mode only (the `Color` collection has one mode, `Light`).

---

## 1. Tokens

Four variable collections. Aliases: `Color/*` → `Primitives/*`. `Spacing`, `Typography` hold raw values.

### 1.1 Primitives (55) — never used directly by components

| Scale | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 1000 |
|---|---|---|---|---|---|---|---|---|---|---|
| `color/gray` | #f2f2f2 | #ebebeb | #e5e5e5 | #ebebeb ⚠ | #c9c9c9 | #a8a8a8 | #8f8f8f | #7d7d7d | #666666 | #171717 |
| `color/blue` | #f0f7ff | #ebf5ff | #e0f0ff | #cce6ff | #99ceff | #52aeff | #0072f5 | #0062d1 | #0068d6 | #00254d |
| `color/red` | #fff0f0 | #ffebeb | #ffe5e5 | #fdd8d8 | #f8b9b9 | #f87275 | #e5484d | #da2f35 | #cb2a2f | #391417 |
| `color/amber` | #fff6e5 | #fff4d6 | #fef0cd | #ffdd8f | #ffc96b | #f5b047 | #ffb224 | #ff990a | #a35200 | #4e2009 |
| `color/green` | #effbef | #ebfaeb | #daf6da | #c6f1c7 | #99e59e | #6cda75 | #45a557 | #398e4a | #297a3a | #1b311e |

Plus: `color/white #fff`, `color/black #000`, `color/background/100 #fff`, `color/background/200 #fafafa`, `color/gray/1000-hover #383838` (off-scale; primary hover).
⚠ `gray/200` and `gray/400` are the same value (#ebebeb). Kept as-is; the generator preserves both names.

### 1.2 Color (63 semantic tokens, mode `Light`)

| Group | Token → primitive | Figma description |
|---|---|---|
| **Background / surface** | `background/default` → bg/100 | Page & card background |
| | `background/subtle` → bg/200 | Settings canvas, sidebar, card footer, modal footer |
| | `background/inverse` → gray/1000 | Tooltips |
| | `background/overlay` = #000 @ 40 % | Modal scrim (only literal, non-alias colour) |
| | `surface/default` → gray/100 | Component background, menu-item hover, tag |
| | `surface/hover` → gray/200 | Nav-item hover, tag hover |
| | `surface/active` → gray/300 | Nav-item active / selected |
| | `surface/disabled` → gray/100 | Disabled field background |
| **Border** | `border/default` → gray/400 | Default border & divider |
| | `border/hover` → gray/500 | Field / secondary-button hover |
| | `border/strong` → gray/600 | Field focus / open |
| **Text** | `text/primary` → gray/1000 | Headings, values |
| | `text/secondary` → gray/900 | Descriptions, helper |
| | `text/tertiary` → gray/700 | Placeholder, counter |
| | `text/disabled` → gray/700 | Disabled text (same value as tertiary) |
| | `text/inverse` → bg/100 | Text on dark |
| **Icon** | `icon/primary` → gray/1000 · `icon/secondary` → gray/900 · `icon/tertiary` → gray/700 (input prefix/suffix) | |
| **Action** | `action/primary` gray/1000 · `-hover` gray/1000-hover | Primary button |
| | `action/secondary` bg/100 · `-hover` gray/100 | Secondary button |
| | `action/tertiary-hover` gray/100 | Ghost hover |
| | `action/danger` red/800 · `-hover` red/900 | Destructive |
| | `action/disabled` gray/100 | Disabled **and** loading button |
| **Control** | `control/off` gray/500 · `-hover` gray/600 · `-disabled` gray/200 | Switch track off |
| | `control/on` gray/1000 · `-hover` gray/1000-hover · `-disabled` gray/500 | Switch track / checked box / radio |
| | `control/thumb` white | Switch thumb, check, radio dot |
| | `control/border` gray/700 · `-hover` gray/900 | Unchecked checkbox / radio border |
| **Link / focus** | `link/default` blue/900 | Inline links |
| | `focus/ring` blue/700 | **Unused by any component variant** — see §9 |
| **Status** (×5 tones: `info`, `success`, `warning`, `error`, `neutral`) | `status/<tone>/bg`, `/border`, `/solid`, `/text`, `/subtle` | `neutral` = gray, `info` = blue, `success` = green, `warning` = amber, `error` = red. `warning/solid` = amber/700, `error/solid` = red/800, others = 700 |

Full alias table (tone → primitive step):

| Tone | bg | border | solid | text | subtle |
|---|---|---|---|---|---|
| neutral | gray/100 | gray/400 | gray/1000 | gray/1000 | gray/200 |
| info | blue/100 | blue/400 | blue/700 | blue/900 | blue/300 |
| success | green/100 | green/400 | green/700 | green/900 | green/300 |
| warning | amber/100 | amber/400 | amber/700 | amber/900 | amber/300 |
| error | red/100 | red/400 | red/800 | red/900 | red/300 |

### 1.3 Spacing / radius / border (21)

`space/`: 0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80.
`radius/`: none 0 · xs 4 · sm 6 · md 8 · lg 12 · full 9999.
`border-width/default`: 1.
Rule from Foundations: buttons/inputs `sm` (6), cards `md`/`lg`, pills `full`. Actual usage: Large button/input `md`; Section Card, Modal, Toast, Select Menu, Save Bar `lg`; Notice `md`; Tag `xs`; Badge, switch track, radio `full`.

### 1.4 Typography

| Token | EN | FA |
|---|---|---|
| `*/font-family/sans` | Geist | IRANYekanX (**code replaces it with Vazirmatn**) |
| `*/font-family/mono` | Geist Mono | Geist Mono (code stays LTR) |
| `*/font-style/semibold` | SemiBold | DemiBold (IRANYekanX names 600 "DemiBold"; Vazirmatn uses numeric weight 600, so the mapping is moot in code) |

Weights used: 400, 500, 600.

**Text styles (42).** Format `size/line-height`. EN letter-spacing is **negative on headings only**; FA letter-spacing is **always 0** ("tracking breaks Persian letter joins").

| Style | EN weight · size/lh · tracking | FA weight · size/lh |
|---|---|---|
| Heading/32 | 600 · 32/40 · −1.28 px (−4 %) | 600 · 32/48 |
| Heading/24 | 600 · 24/32 · −0.96 px | 600 · 24/36 |
| Heading/20 | 600 · 20/26 · −0.40 px | 600 · 20/32 |
| Heading/16 | 600 · 16/24 · −0.32 px | 600 · 16/26 |
| Heading/14 | 600 · 14/20 · −0.28 px | 600 · 14/22 |
| Label/16 | 400 · 16/20 | 400 · 16/26 |
| Label/14 | 400 · 14/20 | 400 · 14/22 |
| Label/14 Strong | 500 · 14/20 | 500 · 14/22 |
| Label/13 | 400 · 13/16 | 400 · 13/20 |
| Label/13 Strong | 500 · 13/16 | 500 · 13/20 |
| Label/12 | 400 · 12/16 | 400 · 12/18 |
| Label/12 Strong | 500 · 12/16 | 500 · 12/18 |
| Copy/16 | 400 · 16/24 | 400 · 16/28 |
| Copy/14 | 400 · 14/20 | 400 · 14/24 |
| Copy/13 | 400 · 13/18 | 400 · 13/22 |
| Button/16 | 500 · 16/20 | 500 · 16/24 |
| Button/14 | 500 · 14/20 | 500 · 14/22 |
| Button/12 | 500 · 12/16 | 500 · 12/18 |
| Mono/14, /13, /12 | Geist Mono 400 · 14/20, 13/20, 12/16 | same |

Implementation note: the Figma tracking is a fixed px value; in CSS use `em` (−0.04 em on 32, −0.04 em on 24, −0.02 em on 20/16/14) so it scales. FA line-heights are larger — resolve with `[dir=rtl]`/`:lang(fa)` overrides on the same utility (`--fy-leading-*`), not a second set of classes.

### 1.5 Effects (7)

| Style | Definition | Use |
|---|---|---|
| `Shadow/Small` | 0 2 2 0 rgba(0,0,0,.04) | Empty State icon box |
| `Shadow/Medium` | 0 4 8 −4 rgba(0,0,0,.04), 0 16 24 −8 rgba(0,0,0,.06) | Select Menu, Toast, Save Bar |
| `Shadow/Large` | 0 1 1 0 .02, 0 8 16 −4 .04, 0 24 32 −8 .06 (black) | Modal |
| `Shadow/Thumb` | 0 1 2 0 rgba(0,0,0,.16), 0 0 0 0.5 rgba(0,0,0,.08) | Switch thumb (enabled only) |
| `Focus/Input` | 0 0 0 3 rgba(0,0,0,.10) | Text field / select focus & open halo |
| `Focus/Input Error` | 0 0 0 3 rgba(218,47,53,.16) | Field error halo (always on in Error state) |
| `Focus/Ring` | 0 0 0 2 #fff, 0 0 0 4 **#006bf5** | Keyboard focus — defined in Foundations ("2 px white gap + 2 px blue-700"), **not applied anywhere** |

### 1.6 Icons

- Page `Icons` = the full **Iconsax** set (≈1 000 component sets, variant `Property 1 = linear|bold|outline|…`), grouped by category, plus `Fyldo · Custom icons` (16×16 `Icon/spinner`, single `Vector` layer, 1.5 px stroke bound to `icon/primary`; rule: "Icons Iconsax doesn't provide").
- Only **Linear** is used. Stroke 1.5 px, colour = surrounding text/icon token (`currentColor` in code).
- Sizes used: **16** default (Button, Input, Select, Nav Item, Tab, Notice, Toast, Menu Item), **12** (Badge, Tag remove), **20** (Large Icon Button), **24** (Empty State Large; 20 in Small).
- Icons referenced by the components (Iconsax names): `setting-2` (nav default), `arrow-down-2` / `arrow-up-2` (select chevron closed/open — the Figma kit calls these components `arrow-down` / `arrow-up`, but their geometry is the npm package's `ArrowDown2` / `ArrowUp2`, verified by matching the paths), `tick-circle` (menu-item selected, success notice/toast, badge, "Saved"), `close-circle` (tag remove, notice/toast close, multi-select clear), `info-circle` (error notice / toast / field error / "Save failed"), `information` (neutral+info notice/toast), `danger` (warning notice), `search-normal` (select-menu search), `global` (menu-item leading, language select), `element-plus` (empty state), plus 16×16 `Icon/spinner` (loading Button, Icon Button, Toast, Save Bar "Saving").

---

## 2. Global behaviour rules (from every "· Usage" frame)

These cut across components; the implementation must enforce them where possible (types, lint, defaults), not merely document them.

**Saving (Settings page · Usage)**
1. **One save pattern per page — never both.**
   - *Global* (default): a floating Save Bar appears as soon as any value changes: `Dirty → Saving → Saved`, or `Error`. Section-card footers are hidden.
   - *Per section*: each Section Card saves independently via its footer button; there is no Save Bar.
2. Destructive actions live in a **Danger Section Card** at the bottom of the page and always ask for confirmation (Modal, Type=Danger).
3. With the global Save Bar, its Saved state is the confirmation — **no toast in addition**.
4. If a change needs "Save changes" to apply, keep the footer button visible — otherwise save instantly (Toggle usage).

**Feedback**
5. Toast: bottom-end, 24 px from the edges, stacks upward, **max 3 visible**, newest at the bottom. Success/Neutral auto-dismiss after **5 s** (timer pauses on hover **and** focus). Error and Loading persist until resolved/closed. At most **one action**, single verb (Undo, Retry). A toast must never be the only way to finish a task. One short sentence, no final period. Never for validation (inline field errors / Notice). `role="status"`; Error uses `role="alert"`.
6. Notice: page-level at the top of the settings content, section-level at the top of its card. One notice per message, stack max 2–3, most severe first. Errors and warnings stay until resolved; success may auto-dismiss/be dismissible. Meaning must not rely on colour alone (icon + label).
7. Validation errors: shown **after blur or submit**, describe how to fix, inline under the field (Input Error). Textarea over its limit → Error state, counter turns red, never truncate silently.

**Modal**
8. Title is a question naming the action ("Reset all settings?"); the confirm button repeats the verb (never OK/Yes). **Cancel at the start, confirm at the end** of the footer (mirrored in RTL). Width 480.
9. Default modal closes on Esc / close button / backdrop. **Danger modal closes only via Cancel or the close button**, and never while the action is running; the confirm button is disabled until the user types the keyword (only for high-impact actions). Focus moves in on open, is trapped, returns to the trigger on close. Page behind is dimmed (`background/overlay`) and inert.

**Icon-only controls / tooltips**
10. **Every Icon Button has a Tooltip whose text equals its `aria-label`.** Tooltip opens on hover after **300 ms**, immediately on keyboard focus; closes on leave, blur, Esc. No links/buttons inside; sentence case, no final period; default placement Top, flip only to avoid clipping; Start/End follow reading direction. Never hide essential info in a tooltip (touch).

**Buttons**
11. One Primary per card/view. Sentence case with a verb ("Save changes", not "OK"). Loading keeps label **and width**; the button is disabled while the request runs. Error buttons open a confirmation for irreversible actions. Icons are 16 px (20 in Large Icon Button); leading icons describe the action, trailing icons show direction / external link. In a card footer the actions sit at the end; RTL mirrors the row.

**Forms**
12. Always a visible label except search fields with a clear prefix icon. Labels are short nouns. Placeholders show an example, never the label. Fields stack with **20 px** gaps inside a card. LTR values (URLs, emails, keys, code) stay LTR inside FA fields (`dir="ltr"`, left-aligned). Input/Select/Multi Select heights match the Button size used in the same row (32/40/48).
13. Textarea: default ~4 rows (104 px); counter only when there is a real limit; code fields use Geist Mono and force LTR.
14. Control choice: Toggle = one independent on/off; Checkbox = any number of options or agreeing to one statement (**not** a single-checkbox instant setting); Radio = exactly one of 2–5 visible options (always with a default selection); Select = exactly one of 6+; searchable combobox for very long lists (countries, time zones). The whole row (control + label) is the click target. Label on/off with the feature ("Enable caching"), not the state. Explain why a toggle is disabled in its description.
15. Select: menu same width as the field, **4 px** below it, height capped at ~8 items then scroll; disabled options stay visible; selected option shows a check at the end.

**Layout**
16. Content column **800 px**, centred in the main area; cards separated by 24 px. Navigation is **sidebar (default; 6+ sections or grouped menus) or top navigation (≤ ~8 sections)** — one per plugin, same items/icons/order. Tabs are for sub-pages of one nav item, **never nested**. Utility links (Documentation, Help) go bottom of the sidebar, or top-right of the top nav (then hide the Page Header action). Sidebar group labels 1–2 words; Nav Item badge only for items needing attention. Turn `Divider` off on the last Setting Row of a card. Setting Row layouts: **Inline** (Toggle, Checkbox at the end, vertically centred) / **Stacked** (Input, Select, Multi Select, Textarea under the description).
17. Empty State: title names what's missing; one-sentence description; at most one Primary (creates the first item); Secondary is usually a docs link; Large for a whole card/tab/page, Small in tables/lists/narrow panels; for filtered lists say the filter found nothing and offer "Clear search". Loading is not empty (spinner/skeleton).
18. Badge: 1–2 words, never contains actions, Solid reserved for one high-emphasis label ("Pro").
19. RTL mirrors the whole layout: sidebar on the right, controls on the left, tab order reversed, brand on the right in top nav, arrows point left, switch "on" = thumb on the left.
20. The dark wp-admin bar/menu in the templates is **context only**, not part of Fyldo.

---

## 3. Component inventory

27 component sets. `n` = variants in Figma (all Locale-doubled except Icon Button). Properties are the Figma component properties (`Label (FA)` etc. duplicates omitted — see §7). `▢` = boolean, `T` = text, `⇄` = instance swap.

| # | Component | Figma id | n | Variant axes (excl. Locale) | Properties |
|---|---|---|---|---|---|
| 1 | Button | 8:1984 | 120 | Type: Primary·Secondary·Tertiary·Error — Size: Small·Medium·Large — State: Default·Hover·Focus·Disabled·Loading | Label T · Leading icon ▢ · Trailing icon ▢ · Leading/Trailing icon swap ⇄ |
| 2 | Icon Button | 43:5456 | 60 | Type (4) — Size (3) — State (5) | Icon ⇄ |
| 3 | Input | 8:2924 | 36 | Size (3) — State: Default·Hover·Focus·Filled·Error·Disabled | Label T · Placeholder T · Value T · Helper T · Error T · Show label ▢ · Show helper ▢ · Prefix icon ▢ · Suffix icon ▢ · icon swaps ⇄ |
| 4 | Textarea | 8:3307 | 12 | State (6) | Label · Placeholder · Value · Helper · Error T · Show label/helper/counter ▢ · Resize handle ▢ |
| 5 | Toggle | 8:3669 | 32 | Size: Small·Medium — Checked: False·True — State: Default·Hover·Focus·Disabled | Label T · Description T · Show label ▢ · Show description ▢ |
| 6 | Checkbox | 8:4351 | 24 | Checked: False·True·Indeterminate — State (4) | Label · Description T · Show label/description ▢ |
| 7 | Radio | 8:4114 | 16 | Checked: False·True — State (4) | same as Checkbox |
| 8 | Select | 8:5055 | 42 | Size (3) — State: Default·Hover·Focus·**Open**·Filled·Error·Disabled | Label · Placeholder · Value · Helper · Error T · Show label/helper ▢ · Prefix icon ▢ + swap ⇄ |
| 9 | Select Menu | 8:5157 | 4 | Type: Single·Multi | Search ▢ · Footer ▢ |
| 10 | Menu Item | 8:4601 | 16 | Type: Single·Multi — State: Default·Hover·Selected·Disabled | Label T · Leading icon ▢ + swap ⇄ |
| 11 | Multi Select | 9:5140 | 42 | Size (3) — State (7 as Select) | Label · Placeholder · Helper · Error T · Show label/helper ▢ · Clear button ▢ |
| 12 | Tag | 9:4203 | 12 | Size: Small·Medium — State: Default·Hover·Disabled | Label T · Removable ▢ |
| 13 | Badge | 8:5510 | 40 | Tone: Gray·Blue·Green·Amber·Red — Style: Subtle·Solid — Size: Small·Medium | Label T · Icon ▢ + swap ⇄ |
| 14 | Notice | 8:5763 | 10 | Tone: Gray·Blue·Green·Amber·Red | Title T · Message T · Show title ▢ · Show action ▢ · Dismissible ▢ |
| 15 | Nav Item | 18:2155 | 10 | State: Default·Hover·Active·Focus·Disabled | Label T · Icon ▢ + swap ⇄ · Badge ▢ |
| 16 | Sidebar | 18:2391 | 2 | — | (composition: header, groups, footer) |
| 17 | Tab | 18:2506 | 10 | State (5) | Label T · Icon ▢ + swap ⇄ · Count ▢ |
| 18 | Tabs | 18:2614 | 2 | — | (composition: divider + Tab instances) |
| 19 | Setting Row | 18:2719 | 4 | Layout: Inline·Stacked | Title · Description T · Show description ▢ · Badge ▢ · Divider ▢ · exposed Control instance |
| 20 | Section Card | 18:2913 | 4 | Tone: Default·Danger | Title · Description T · Show description ▢ · Footer ▢ · Footer text ▢ |
| 21 | Save Bar | 18:3079 | 8 | State: Dirty·Saving·Saved·Error | Discard button ▢ |
| 22 | Page Header | 20:3127 | 2 | — | Title · Description T · Show description ▢ · Actions ▢ |
| 23 | Top Navigation | 37:4189 | 2 | — | (composition: brand, utilities, Tab row, group dividers) |
| 24 | Modal | 50:5622 | 4 | Type: Default·Danger | Close button ▢ (+ exposed slots) |
| 25 | Tooltip | 72:6535 | 8 | Placement: Top·Bottom·Start·End | Label T · Arrow ▢ |
| 26 | Toast | 72:6694 | 8 | Tone: Neutral·Success·Error·Loading | Message · Description T · Show description ▢ · Action ▢ · Close button ▢ |
| 27 | Empty State | 73:6879 | 4 | Size: Large·Small | Title · Description T · Show description ▢ · Icon ⇄ · Primary action ▢ · Secondary action ▢ |

Templates (frames, not components): `Settings page · EN / FA` and `Settings page · Top nav · EN / FA`, 1 440 wide inside a dark "wp-admin bar (context)" (32 px) and folded admin menu.

---

## 4. Component specs

Notation: `H 12/0` = horizontal auto-layout, padding-x 12, padding-y 0; `gap 8`. Colours are tokens. "→" = differs from Default.

### 4.1 Button (8:1984) and Icon Button (43:5456)

| Size | Height | Padding-x | Gap | Radius | Text | Icon |
|---|---|---|---|---|---|---|
| Small | 32 | 12 | 6 | sm (6) | Button/14 | 16 |
| Medium | 40 | 16 | 6 | sm (6) | Button/14 | 16 |
| Large | 48 | 20 | 8 | **md (8)** | **Button/16** | 16 |

Icon Button: square 32/40/48 (no padding), radius sm/sm/md, icon 16/16/**20**.

| Type | Default | Hover | Focus | Disabled / Loading |
|---|---|---|---|---|
| Primary | fill `action/primary`, text+icon `text/inverse` | `action/primary-hover` | **= Default** | fill `action/disabled`, 1 px inside stroke `border/default`, text+icon `text/disabled` |
| Secondary | fill `action/secondary`, 1 px inside stroke `border/default`, `text/primary` | fill `action/secondary-hover`, stroke `border/hover` | = Default | as above |
| Tertiary | transparent, `text/primary` | fill `action/tertiary-hover` | fill `background/default` (invisible on white) | **no fill, no stroke**, `text/disabled` |
| Error | fill `action/danger`, `text/inverse` | `action/danger-hover` | = Default | as Primary disabled |

Loading = Disabled colours **plus** a 16 px `Icon/spinner` before the label (before the icon in Icon Button, replacing it); label and width unchanged. Persian: spinner sits at the trailing side (order mirrored by `dir`). Clip content true. No focus ring in any variant (§9).

Props → code: `variant`, `size`, `loading`, `leadingIcon`, `trailingIcon`, children = label. Icon Button: `label` (required — aria-label + tooltip), `icon`.

### 4.2 Input (8:2924) — also the pattern for Select, Multi Select, Textarea

Vertical stack, gap 8, width fills (Figma 320): `Label` → `Control` → `Helper` (or `Error`).

- **Label**: Label/14 Strong, `text/primary`. **Helper**: Copy/13, `text/secondary`, row gap 6.
- **Control**: horizontal, padding-x 12, gap 8, fill `background/default`, 1 px stroke `border/default`, radius sm (Large: md). Height 32 / 40 / 48. Text **Copy/14** (Large **Copy/16**). Prefix / suffix icon 16 px `icon/tertiary`; placeholder `text/tertiary`; value `text/primary`.
- **States** (control only unless noted):
  - Hover: stroke `border/hover`.
  - Focus: stroke `border/strong` + effect `Focus/Input` (3 px rgba(0,0,0,.10)); a 1×16 `text/primary` caret is drawn (design-only).
  - Filled: placeholder replaced by value.
  - Error: stroke `status/error/solid` + effect `Focus/Input Error` (halo always on); Helper is **replaced** by an Error row: 16 px `info-circle` + message Copy/13 `status/error/text`.
  - Disabled: label, placeholder, helper → `text/disabled`; fill `surface/disabled`.
- Label is hideable (`Show label`) only for search fields.

### 4.3 Textarea (8:3307)

As Input but control padding `12/8`, inner gap 2, default height 104 (≈4 rows), stretches when resized; 6×6 resize glyph at the bottom-end corner (`border/strong`, `border/default` disabled); helper row = helper text + **counter** (Mono/12, `text/tertiary`, e.g. `104/160`) at the end. Error: counter and message use `status/error/text` ("172/160"). One size only.

### 4.4 Toggle (8:3669)

| Size | Track | Thumb | Gap to text | Label style |
|---|---|---|---|---|
| Small | 28×16, padding 2, radius full | 12 | 8 | Label/13 |
| Medium | 36×20, padding 2 | 16 | 12 | Label/14 |

Track `control/off` → hover `control/off-hover` → disabled `control/off-disabled`; on: `control/on` → `control/on-hover` → `control/on-disabled`. Thumb `control/thumb` with `Shadow/Thumb` (none when disabled). Focus = Default. Optional text block (label + description Copy/13 `text/secondary`, gap 2); disabled → both `text/disabled`. The switch aligns with the first line of the label. **RTL: whole control mirrors; "on" thumb sits on the left.**

### 4.5 Checkbox (8:4351) / Radio (8:4114)

Control 16×16 (in a 16×20 slot so it centres on the first text line); gap 8; label Label/14; description Copy/13.

- Checkbox box radius `xs` (4); Radio circle `full`. Unchecked: fill `background/default`, 1 px `control/border`; hover `control/border-hover`; disabled fill `surface/disabled`, stroke `border/default`.
- Checked: fill `control/on`; check mark 8×5 stroke `control/thumb` 1.75 px. Indeterminate: 7 px dash, same stroke. Radio dot 6 px `control/thumb`.
- Groups: radios stack with **12 px** gaps; checkbox children indent **24 px** toward reading direction; parent shows Indeterminate. Whole row is the click target.

### 4.6 Select (8:5055), Select Menu (8:5157), Menu Item (8:4601)

Select = Input anatomy with a 16 px chevron (`arrow-down`, `arrow-up` when Open) at the end and optional 16 px prefix icon. Open = Focus styling (border/strong + Focus/Input) **and** the value shown. Error/Disabled as Input.

**Select Menu** (Single): vertical, padding 4, gap 2, fill `background/default`, 1 px `border/default`, radius **lg**, `Shadow/Medium`, width = field width, 4 px below it. Contains Menu Items; highlighted item has fill `surface/default`. **Multi**: padding 0 with three regions — `Search` row (padding 12/8, `search-normal` icon + "Search…" Copy/14 `text/tertiary`, bottom border), `Options` (padding 4, gap 2), `Footer` (fill `background/subtle`, top border, padding 12/4/4/4: "n selected" Label/13 `text/secondary` + a Small Secondary "Clear" Button). Search and Footer toggle independently.

**Menu Item**: 36 high, padding 8, gap 8, radius sm. Label Label/14. Default transparent → Hover fill `surface/default` → Selected shows 16 px `tick-circle` at the end → Disabled label `text/disabled`. Optional leading 16 px icon. Multi type replaces the check with a leading Checkbox.

### 4.7 Multi Select (9:5140) and Tag (9:4203)

Multi Select control: **min height 34 / 42 / 50** (Small / Medium / Large; padding-y 6 / 8 / 12 — it is the Input height + 2 px so a 20 px Tag fits with breathing room, and it grows as chips wrap), padding-x 12, gap 8. Left side = wrapping value area (gap 4) that shows a placeholder **or** Tag instances (+ an "Overflow" Tag `+n`); right side = optional `close-circle` Clear (16) and chevron. When values exist the leading padding becomes 6 so chips align optically. States as Select.

**Tag**: Small 20 high, padding-x 6 / 4 on the remove side, gap 4, radius **xs**, fill `surface/default`, 1 px `border/default`, Label/12; Medium 24 high, padding 8/6, Label/13. Remove = 12 px `close-circle`. Hover fill `surface/hover`; Disabled fill `surface/disabled` + `text/disabled`. `Removable=false` → the overflow counter.

### 4.8 Badge (8:5510) and Notice (8:5763)

**Badge**: pill (radius full). Small 20 high, padding-x 6, Label/12 Strong; Medium 24 high, padding-x 8, Label/13 Strong; gap 4; optional 12 px icon. Subtle: fill `status/<tone>/subtle`, text `status/<tone>/text`. Solid: fill `status/<tone>/solid`, text `text/inverse` — **except Amber, whose Solid text is `text/primary`** (dark on amber). Gray = neutral.

**Notice**: horizontal, padding 16/12, gap 12, radius md, fill `status/<tone>/bg`, 1 px `status/<tone>/border`; all text `status/<tone>/text`. Left: 16 px tone icon (neutral/blue `information`, green `tick-circle`, amber `danger`, red `info-circle`). Middle: optional Title (Label/14 Strong) + Message (Copy/14), gap 2. Right: optional Small Secondary action button, optional 16 px `close-circle` (dismissible). Tone mapping to WordPress: Gray/Blue = info, Green = success, Amber = warning, Red = error.

### 4.9 Nav Item (18:2155), Sidebar (18:2391)

Nav Item: 32 high, padding 8/6, gap 8, radius md, 16 px icon + Label/14 (`text/secondary`), optional badge. Hover fill `surface/hover` + label `text/primary`; **Active** fill `surface/active` + label **Label/14 Strong** `text/primary`; Focus = fill `background/default` (invisible on the subtle sidebar → practically no indicator); Disabled label `text/disabled`. Badge = Badge (neutral subtle, 20 px pill).

Sidebar: 256 wide, fill `background/subtle`, 1 px end border. Header 60 (padding 20/20/16, gap 10): 24 px logo + "Fyldo" Heading/16 + version Badge. Navigation (padding 16/16/8/0, group gap 20): groups of `Group label` (22 high, padding 8, text 12 `text/tertiary`) + Nav Items (gap 2). Footer (padding 16/12, gap 2, top border): utility Nav Items (Documentation, Help & support).

### 4.10 Tab (18:2506), Tabs (18:2614), Top Navigation (37:4189)

Tab: vertical, 48 high; inner content 32 high, padding 12/6, gap 6, radius md; label Label/14 `text/secondary`; optional 16 icon, optional count Badge; 2 px **Indicator** under the tab. Hover fill `surface/hover`; Active label `text/primary` + Indicator fill `action/primary`; Focus fill `background/default`; Disabled `text/disabled`. Tabs: 800 wide row, gap 4, 1 px bottom divider `border/default`.

Top Navigation: full width, 2 rows on `background/default`, 1 px bottom divider. Row 1 (48, padding 24/12, gap 16): brand (logo + "Fyldo" + version badge) · spacer · utility Buttons (Tertiary Small with trailing icon). Row 2 (48, padding 12): Tab instances with icons; **groups separated by a 1×16 vertical divider** instead of labels.

### 4.11 Setting Row (18:2719), Section Card (18:2913)

Setting Row: padding-y 20, bottom 1 px divider (`border/default`, hideable). **Inline** (horizontal, gap 32): text block (Title Label/14 Strong + optional Badge, gap 8; Description Copy/13 `text/secondary`; gap 4) and the control (Toggle/Checkbox) vertically centred at the end. **Stacked** (vertical, gap 12): text block then a control (Input/Select/Multi Select/Textarea, Figma shows 320 wide × 40).

Section Card: 800 wide, vertical, fill `background/default`, 1 px `border/default`, radius **lg**. Header padding 24/24/24/4, gap 6: Title Heading/20 + Description Copy/14 `text/secondary`. Content padding 24 (bottom 4) holds Setting Rows. Footer (optional): padding 24/12, gap 16, fill `background/subtle`, top border; footer text Copy/13 `text/secondary` + Primary Button.
**Danger**: card border `status/error/border`; header padding 24 all round; no content; footer fill `status/error/bg`, border `status/error/border`, text `status/error/text`, Error-type button.

### 4.12 Save Bar (18:3079), Page Header (20:3127)

Save Bar: floating, 800 wide (same as content column), 32 px from the bottom, height 54, padding 20/12/10/10, gap 16, radius lg, fill `background/default`, 1 px `border/default`, `Shadow/Medium`. Left: status (gap 10): 16 px indicator + Label/14 message. Right: Secondary Small "Discard" + Primary Small "Save changes".

| State | Indicator | Message | Buttons |
|---|---|---|---|
| Dirty | 8 px dot `status/warning/solid` | "You have unsaved changes" | Discard secondary · Save primary |
| Saving | `Icon/spinner` | "Saving changes…" | both disabled (Discard, Save with spinner) |
| Saved | `tick-circle` | "All changes saved" | both disabled |
| Error | `info-circle`, border `status/error/border`, message `status/error/text` | "Couldn't save. Check your connection and try again." | Discard · Save enabled |

Page Header: horizontal, gap 24, no padding. Text block (gap 6): Heading/32 + Copy/16 `text/secondary`. Actions slot at the end (e.g. Secondary "Documentation" with trailing external icon).

### 4.13 Modal (50:5622), Tooltip (72:6535), Toast (72:6694), Empty State (73:6879)

**Modal**: 480 wide, fill `background/default`, 1 px `border/default`, radius lg, `Shadow/Large`, scrim `background/overlay`. Header padding 24, gap 16: text (Title Heading/20 + Description Copy/14 `text/secondary`, gap 8) + Icon Button close (32). Danger adds a **Body** (padding 24/24/0/24) holding a labelled Input (typed confirmation). Footer: `background/subtle`, top border, padding 24/16, **actions aligned at the end** (Cancel Secondary Small, confirm Primary or Error). Danger: confirm is `action/disabled` until the keyword matches.

**Tooltip**: Bubble fill `background/inverse`, text `text/inverse` Copy/13, padding 10/6, radius sm, max width 240, 10×5 arrow (rotated 5×10 for Start/End). Top = bubble above arrow; Bottom = same bubble, arrow **above** it (vertical order swapped, nothing else changes). Opens 300 ms hover / instant focus.

**Toast**: 400 wide, fill `background/default`, 1 px border, radius lg, `Shadow/Medium`, padding 16/8/8/8 (asymmetric: more space at the icon side, less at the close), gap 12. Icon 16 (`information`, `tick-circle`, `info-circle`, `Icon/spinner` per tone) · Content (Message Label/14 Strong, optional Description Copy/13 `text/secondary`, gap 2) · optional Action (Small Tertiary/Secondary button) · Close Icon Button (32). The container is identical for every tone; tone is carried by the **icon glyph and its colour**: Neutral `information` + `icon/primary`, Success `tick-circle` + `status/success/solid`, Error `info-circle` + `status/error/solid`, Loading spinner + `icon/primary`.

**Empty State**: vertical, centred. Large: 480×, padding 32/48, gap 20; icon box 48×48 radius lg, fill `background/default`, 1 px border, `Shadow/Small`, 24 px icon; text (gap 8) Title Heading/20 + Description Copy/14; actions row gap 8 (Primary + Secondary, Small). Small: 360×, padding 24/32, gap 16; icon box 40 radius md, 20 icon; Title Heading/16 (gap 4), Description Copy/13.

---

## 5. Templates (Settings page)

`Settings page · EN` 1 440 × 1 437: `wp-admin bar (context)` 32 px + Body 1 405. Body = folded dark WP menu (context) + Sidebar (256, `background/subtle`, full height) + main area (`background/default`) containing a centred **800 px** column: Page Header → Tabs (sub-pages "Site identity · Reading · Permalinks · Privacy") → Section Cards ("Site identity", "Language & region") → Danger Section Card ("Reset settings") → floating Save Bar. `Top nav` variant: Top Navigation across the full width, content column still 800 px. FA templates are the mirrored layouts.

Vertical rhythm seen in the template: Page Header → 24 → Tabs → 24 → cards, 24 between cards, Save Bar 32 from the bottom edge.

## 6. Interaction / motion

Figma has **no motion spec** (no durations, no easing, no prototype reactions read). Only behavioural timings: tooltip 300 ms, toast 5 s. Proposal in ARCHITECTURE §11: 100–150 ms `ease-out` colour transitions, 150 ms popup fade+scale-in from 0.98, all disabled under `prefers-reduced-motion`.

## 7. Localisation model (how the Figma duplication collapses)

| Figma | Code |
|---|---|
| `Locale=EN\|FA` variant | one component; direction from `dir` (root attribute + Base UI `DirectionProvider`), logical CSS (`ps-*`, `me-*`, `start/end`) |
| `en/…`, `fa/…` typography tokens | one token set; `--fyldo-font-sans` switches by `:lang`/`[dir=rtl]` (Geist ↔ Vazirmatn) |
| `Label (FA)`, `Placeholder (FA)`… text props | i18n keys; PHP `__()` in config + `@wordpress/i18n` in the UI |
| Mirrored icon order (Button, Input) | flex row + `dir` (no manual reordering) |
| Arrows point left in FA | `Icon` flips a named list of directional icons under `[dir=rtl]` |
| `Toggle` "on = thumb left in RTL" | Base UI `Switch` + `[dir=rtl]` translate direction |
| Mono stays LTR | `.fy:font-mono` + `dir="ltr"` `unicode-bidi: isolate` on code/URL/key values |

## 8. Coverage of "Figma is silent" — things the code needs that Figma does not define

Responsive/mobile layout (WP breakpoints 782 / 960) · page loading skeleton · fatal-error state · unsaved-changes navigation prompt · Saved-state dismissal timing · keyboard shortcut for save · number/password/URL/color input types (Input is text only) · Fieldset/legend styling for radio/checkbox groups (usage shows a bold group label) · disabled Nav/Tab states inside a group · hover state for Setting Row/Section Card (none) · scroll behaviour of the 8-item-capped Select Menu.
These are collected as designer questions in [ARCHITECTURE.md §15](./ARCHITECTURE.md#15-open-decisions-and-recommendations).

---

## 9. Design issues found (original findings, 2026-09-29)

> **Status update:** the token failures below (D3–D6, D9) and the missing focus tokens (`focus/ring-neutral`, `focus/border`) are being **fixed in Figma by the owner before M1** (decision O4/O5). The code is built against the **re-read, fixed** values; the numbers in this section describe the file as it was on 2026-09-29 and are kept as the record of *why* the changes were made. Sections 1–4 are re-verified against the file at the start of M1 (see `tokens/figma.tokens.json`).

Contrast is computed from the Figma token values (WCAG 2.x formula, against `background/default` #fff unless noted).

| # | Finding | Evidence | Impact |
|---|---|---|---|
| D1 | **No component has a focus indicator.** Button, Icon Button, Toggle, Checkbox, Radio Focus variants are pixel-identical to Default; Tertiary / Nav Item / Tab Focus only set a white fill. Only text fields have a focus treatment (`border/strong` + 3 px 10 % halo). | Node diffs of every `State=Focus` variant vs Default | Fails WCAG 2.4.7 (Focus Visible) unless we add one. Requirement: "provide a subtle, non-blue `:focus-visible`" — proposal in ARCHITECTURE §11. |
| D2 | The blue `Focus/Ring` effect and `focus/ring` token (blue/700, 4.44:1) are defined in Foundations but never applied. | Effect styles / variable usage | Dead tokens. We will **not** ship blue; `--ring` maps to a neutral. |
| D3 | Field focus halo is too weak on its own: `border/strong` #a8a8a8 = **2.38:1**, halo `rgba(0,0,0,.10)` ≈ 1.2:1 | computed | WCAG 1.4.11 (non-text contrast 3:1) for the focus state. |
| D4 | **Field boundary contrast**: `border/default` #ebebeb = **1.19:1**, `border/hover` 1.66:1. Inputs are identified only by this border. | computed | WCAG 1.4.11 needs ≥ 3:1 for the visual boundary of a text field (a defensible exception exists only if the field is identifiable otherwise). The app-wide Vercel look depends on this border. |
| D5 | `text/tertiary` #8f8f8f = **3.23:1** on white, 2.89:1 on the disabled fill. Used for **placeholders and the Textarea counter** (12 px). | computed | Fails WCAG 1.4.3 (4.5:1) for placeholder and counter text. (Disabled text is exempt.) Minimum passing neutral ≈ #767676 (4.54:1). |
| D6 | Switch **off** track `control/off` #c9c9c9 = **1.66:1** against the page; checkbox/radio `control/border` #8f8f8f = 3.23:1 (passes). | computed | Off-state switch fails 1.4.11 if the track is the only cue; thumb position + `aria-checked` + label carry the state, but the boundary still fails. |
| D7 | Badge Subtle error text: `red/900` on `red/300` = **4.50:1** (borderline pass); info 4.58, success 4.61 — all barely above 4.5. Any deviation in the primitives breaks them. | computed | Add contrast unit tests on token pairs (planned). |
| D8 | Usage says Notice should "use the matching admin-notice class (`notice-success`…) when rendering in wp-admin". Adding class `notice` to a React-rendered element makes WordPress core (`common.js`) **move it** to below the first `h1.wp-header-end` and applies core margins/borders. | WP core behaviour | Interpreted as: apply to PHP-rendered admin notices only; React Notices never get the `notice` class. Please confirm. |
| D9 | **Solid Badge contrast**: white on `status/success/solid` (green/700) = **3.10:1**, white on `status/info/solid` (blue/700) = **4.44:1** — both below 4.5:1 for 12–13 px text. Toast success icon (`green/700` on white) is also 3.10:1 (passes as a non-text icon at 3:1, barely). Red 4.73 and amber (dark text, 9.94) pass. | computed | Fix in tokens (darker `solid` step, e.g. green/900, blue/900) or restrict Solid to neutral/red/amber. |
| D10 | `Textarea` has one Size only, but Input/Select/Multi Select have three; usage doc says Input/Select sizes "match the Button size in the same row". | Variant axes | Confirm Textarea stays single-size. |
| D11 | FA typography uses **IRANYekanX** (Medium/DemiBold) while code uses Vazirmatn (per brief). Metrics differ slightly (line-height 22/24 was tuned for IRANYekanX). | Text styles | Line-heights must be re-verified in FA screenshots at Milestone 1; keep them as tokens. |
| D12 | Primitives `gray/200` = `gray/400`; `text/tertiary` = `text/disabled`; `control/on` = `action/primary`. Harmless duplicates, but disabled vs placeholder text are indistinguishable. | Variables | Kept 1-to-1; noted for the designer. |
