# Fyldo — Component Map (Figma → shadcn / Base UI → props → gaps)

> Companion to [design-spec.md](./design-spec.md). Every Figma component set is listed once.
> **Base** = the Base UI primitive (`@base-ui/react/<part>`, v1.8 at time of writing, React peer `^17 || ^18 || ^19`) and the shadcn *base-nova* registry file we copy and restyle (`registry/base-nova/ui/<name>.tsx`; I verified these exist: `button, input, textarea, switch, checkbox, radio-group, select, combobox, tooltip, toast, empty, field, tabs, badge, alert, alert-dialog, card, separator, spinner`).
> Copy rule: components are copied into `app/components/ui/`, then restyled to the Figma tokens. Each file gets a header comment `// from shadcn base-nova @<date>, restyled for Fyldo` so upstream diffs are traceable.

## 0. Conventions used in every component

- **One implementation per component.** No `locale` prop. Direction is read from `dir` on the Fyldo root (and passed to Base UI's `DirectionProvider`); layout uses logical utilities (`ps-3`, `me-2`, `start-0`, `text-start`).
- **Variant naming.** Figma `Type/Tone/Size/State` → code `variant/tone/size` props; `State` is **never a prop** except where it is data (`loading`, `disabled`, `invalid`, `open`, `checked`, `indeterminate`, `dirty/saving/saved/error` on Save Bar). Hover/Focus/Active are CSS (`:hover`, `:focus-visible`, `data-[highlighted]`, `data-[popup-open]`).
- **Size names.** Figma `Small · Medium · Large` → `"sm" | "md" | "lg"` (heights 32 / 40 / 48).
- **Tokens only.** No hex in components. All colours/spacing/radius via the token utilities (`fy:bg-action-primary`, …); a lint rule bans `#rrggbb` and arbitrary values in `app/components`.
- **Icons.** Only through `<Icon name="…" size={16} />`. Icon-only buttons are `IconButton` (requires `label`, renders Tooltip + `aria-label`).
- **Portals.** Every popup (Select, Combobox, Tooltip, Toast, AlertDialog) renders into `useFyldoPortalContainer()` = the instance root element (never `document.body`). The shadcn sources default to `body`; this is a mandatory edit in every copied overlay component.
- **Field wiring.** All form controls are composed inside a `FieldShell` (Base UI `Field.Root / Label / Control / Description / Error`) which provides ids, `aria-describedby`, `aria-invalid`, the helper→error swap, and the disabled propagation. Nothing sets ids by hand.
- **Text is passed in, already translated.** Components never call `__()` for developer-supplied text. Fyldo's own strings (“Save changes”, “Discard”, “n selected”, “Search…”) use `@wordpress/i18n`.
- **`data-slot`** attributes (shadcn convention) are kept for testing hooks, e.g. `data-slot="fy-button"`. Class names are not a public API.

Legend: ✅ exists in shadcn/Base UI and only needs restyling · 🔧 exists but needs behavioural changes · ➕ must be built (composition of primitives) · ⛔ not from shadcn on purpose.

---

## 1. Primitives (not in Figma, required by the design)

| Name | Purpose | Base / notes |
|---|---|---|
| `Icon` | The **only** way to render Iconsax icons. `name` (kebab), `size` 12/16/20/24, `flip?` | ➕ see ARCHITECTURE §8.4. Always Linear, `currentColor`, `aria-hidden="true"` unless `label` given; unknown name → render `null` + `console.warn` once per name; auto-mirrors names in `RTL_FLIP` list under `[dir=rtl]` |
| `Spinner` | Custom `Icon/spinner` (16×16, 1.5 px stroke, `currentColor`) | ➕ shadcn `spinner` used as structure only; `role="status"`/`aria-label` only when standalone; `prefers-reduced-motion` → slower rotation, not stopped |
| `FieldShell` | Label / control / helper / error stack; 8 px gaps; error replaces helper with `info-circle` | ➕ Base UI `Field` (shadcn `field.tsx` is layout-only and is **not** used for wiring) |
| `FyldoRoot` | Root element: `dir`, `lang`, `data-fyldo-v1`, portal container context, `DirectionProvider`, `Tooltip.Provider delay=300`, `Toast.Provider`, scoped reset | ➕ |
| `VisuallyHidden`, `LtrText` (`dir="ltr"` + `unicode-bidi: isolate`) | a11y / bidi helpers | ➕ |
| `Divider` | 1 px `border/default` | ✅ shadcn `separator` (Base UI `Separator`) |

---

## 2. Form controls

### 2.1 Button — Figma `Button` (8:1984)

Base: **shadcn `button` → Base UI `Button`** (`@base-ui/react/button`).

```ts
type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'error'; // Figma Type; shadcn default|outline|ghost|destructive
  size?: 'sm' | 'md' | 'lg';                                   // 32 | 40 | 48
  loading?: boolean;                                           // Figma State=Loading
  leadingIcon?: IconName;  trailingIcon?: IconName;            // Figma Leading/Trailing icon + swap
  render?: ReactElement;                                       // Base UI `render` (replaces Radix asChild), e.g. <a>
} & ButtonHTMLAttributes;
```

| Figma | Code |
|---|---|
| Type=Primary/Secondary/Tertiary/Error | `variant` (default `primary`) |
| Size | `size` (default `sm` — Figma default, "dense settings forms") |
| State=Disabled | `disabled` (Base UI: `focusableWhenDisabled` **off** for plain disabled) |
| State=Loading | `loading`: sets `aria-busy`, `aria-disabled` (via `focusableWhenDisabled` so focus isn't lost), shows `Spinner` before the label, **label kept, width unchanged**, ignores clicks |
| State=Hover/Focus | CSS |
| Label / icons | `children`, `leadingIcon`, `trailingIcon` (icons `aria-hidden`) |

**Geometry (measured in Figma, enforced by `e2e/harness/figma-parity.spec.ts`):** Figma auto-layout counts the 1 px stroke IN the layout, so padding is always 12/16/20 and the border exists only where Figma has a stroke — Secondary always, every other type only when disabled/loading. Consequently widths differ exactly as in Figma: Primary 68, Secondary 70, Primary Disabled 70, Loading +22 (spinner 16 + gap 6).

**Gaps to fill:** 🔧 shadcn sizes are 36/32/28 — replace with 32/40/48 and radius sm/sm/md; Large uses `Button/16`. 🔧 Variants renamed/remapped; shadcn `link`/`outline` removed. ➕ Loading state (shadcn has none). ➕ Disabled/Loading share colours (`action/disabled`, inside 1 px `border/default` except Tertiary which has no stroke). ➕ Focus indicator (design has none — ARCHITECTURE §11). ➕ Guard: dev-mode warning if two `primary` buttons render in the same Section Card (rule 11).

### 2.2 Icon Button — Figma `Icon Button` (43:5456)

Base: shadcn `button` (`size="icon-*"`) + shadcn `tooltip`.

```ts
type IconButtonProps = Omit<ButtonProps,'leadingIcon'|'trailingIcon'|'children'> & {
  icon: IconName;
  label: string;            // REQUIRED: aria-label AND tooltip text (rule 10)
  tooltipSide?: 'top'|'bottom'|'start'|'end';
};
```
**Gaps:** ➕ Tooltip is built in and cannot be disabled (type-level: `label` required). Icon 16, **20 at `lg`**. Loading replaces the icon with the spinner. Square sizes 32/40/48.

*Implemented in M4:* `IconButton` (`app/components/ui/icon-button.tsx`) — `icon`, `label` (required: the `aria-label` AND the tooltip text, one string), `variant` (default Tertiary), `size`, `loading`, `tooltipSide`; it reuses the Button's variant/disabled classes (`BUTTON_VARIANT`, `BUTTON_DISABLED`, `BUTTON_BASE`) so the two cannot drift. **Lint-enforced:** `fyldo/icon-button-tooltip` (tools/lint/fyldo-plugin.js) fails the build for a `button` / `Button` / `BaseButton` / `*.Close` whose only children are `<Icon>`, `<Spinner>` or `<svg>` unless it sits inside a `<Tooltip>` (which `IconButton` does). Icon-only buttons in the app: the Modal's and the Toast's close (Icon Buttons), the Notice's Dismiss and the password toggle (in a `<Tooltip>`); two carry a documented `eslint-disable`: the Tag's remove and the Multi Select's inline Clear — parts of those components, not Figma Icon Buttons, pointer-only 12/16px targets whose names a tooltip would only repeat next to the tag's own text (the keyboard has Backspace and the popup's Clear all). A test runs the rule over the whole app. Pixel test `Icon Button EN/FA · default` (0 % differ).

### 2.3 Input — Figma `Input` (8:2924)

*Implemented in M1:* `Input` (the bordered control, used inside a Setting Row), `FieldShell` (label/helper/error stack) and the composites `TextField` = the full Figma "Input" and `SelectField` = the full Figma "Select".

Base: shadcn `input` + `input-group` (for prefix/suffix) → Base UI `Input`, wrapped in `FieldShell`.

```ts
type TextFieldProps = {
  label?: string;  hideLabel?: boolean;   // Show label=false → still needs aria-label (enforced)
  description?: string;                   // Figma "Helper text"
  error?: string;                         // Figma "Error message"; sets aria-invalid, swaps helper for error row
  size?: 'sm'|'md'|'lg';
  prefixIcon?: IconName; suffix?: ReactNode;  // suffix icons are actions (e.g. clear IconButton)
  type?: 'text'|'url'|'email'|'password'|'search'|'number'; // gap: Figma only shows text
  dir?: 'ltr'|'rtl'|'auto';               // url/email/code default to 'ltr' even inside RTL
  maxLength?: number; 
} & InputHTMLAttributes;
```
| Figma state | Code |
|---|---|
| Default / Hover / Focus | CSS: border `border/default → border/hover → border/strong + Focus/Input halo` |
| Filled | `value` present (placeholder hidden natively) |
| Error | `error` prop → border `status/error/solid` + `Focus/Input Error` halo (always on) |
| Disabled | `disabled` → `surface/disabled`, `text/disabled` |

*Implemented in M2 part 3:* the `password`, `number`, `url` and `email` field types render `Input` (the pack draws one text Input; nothing else was added). `Input` gained `digits` (Persian/Arabic-Indic digits read as ASCII as they are typed and pasted — since M3 part 1 also the Persian decimal separator `٫` as `.` and the thousands separator `٬` dropped; the caret stays after the text that preceded it) and `NumberInput` (text input with `inputmode="decimal"` and `dir="ltr"`: a real `type="number"` refuses Persian digits; it shows what was typed but reports a number, `''`, or the unreadable text so the `number` rule can name it). `url`, `email` and `number` inputs are `dir="ltr"` — the text only, the label keeps the page direction; the text is left-aligned in LTR and sits at the inline end (right) in RTL, as the Input usage frame's FA sample draws its email (changed in M3 part 1; it was left-aligned in both). `password` keeps the page direction, has `type="password"`, `spellcheck=false`, `autocapitalize=off` and `autocomplete="new-password"` (developer-selectable: `current-password`, `off`); a stored secret is never in the DOM: the field is empty with the "•••• set" placeholder and a screen-reader-only description. *M3 part 2 (code-only design, approved by the owner — design-spec §10):* a show/hide toggle (`PasswordInput`) in the Input's suffix icon slot — `eye` / `eye-slash`, 16px, `icon/secondary` → `icon/primary` on hover, a real button named "Show password" whose `aria-pressed` carries the state; it reveals only what was typed, hides again after a successful save and on a page change, and is disabled with the field.

**Gaps:** 🔧 shadcn Input is 36 px with ring focus — replace with 32/40/48, Copy/14 (Copy/16 at `lg`), halo tokens. ➕ Error row layout (16 px `info-circle` + Copy/13). ➕ Validation timing: show error only after blur or submit (rule 7) — implemented in the form layer (`touched` state), not the component. ➕ LTR-in-RTL rule for `url|email`/`code`. ➕ **Neutralise wp-admin `input:focus` blue ring** (ARCHITECTURE §8.2). Input border contrast was fixed in Figma before M1 (design-spec D4).

### 2.4 Textarea — Figma `Textarea` (8:3307)

Base: shadcn `textarea` inside `FieldShell`.
```ts
type TextareaFieldProps = TextFieldProps & { rows?: number /*default 4 (=104px)*/; showCounter?: boolean; code?: boolean; resize?: 'vertical'|'none' };
```
*Implemented in M2 part 1:* `Textarea` (bordered control), `TextareaFooter` (helper/error + counter, one row), `TextareaField` (the full Figma "Textarea", 360 wide). Height = Figma's 104 px at `rows` 4, +20 px per row; the resize handle is the native resizer repainted as Figma's 6×6 glyph (Chromium/WebKit; other engines keep theirs). `code` is not built (the `code` field type is later). The counter uses the page's numerals (`Intl`), Mono/12 in EN and Label/12 in FA (as Figma), and announces only at 90 % / 100 % / over.

**Gaps:** ➕ Counter (Mono/12, `text/tertiary`; turns `status/error/text` and the field goes Error when `value.length > maxLength` — **never truncates**, so do not pass `maxLength` to the DOM element). ➕ Custom 6×6 resize glyph (native `resize: vertical` + pseudo-element). ➕ `code` → Geist Mono + `dir="ltr"` + `spellcheck=false`. Counter announces via `aria-live="polite"` only at thresholds (90 %, 100 %) to avoid noise.

### 2.5 Toggle — Figma `Toggle` (8:3669)

Base: **shadcn `switch` → Base UI `Switch`** (`Root` + `Thumb`) inside `Field`.
```ts
type ToggleProps = { checked?; defaultChecked?; onCheckedChange?; label?: string; description?: string; size?: 'sm'|'md'; disabled?: boolean; name?: string };
```
| Figma | Code |
|---|---|
| Size Small/Medium | `size` → track 28×16 thumb 12 / 36×20 thumb 16, label Label/13 / Label/14, gap 8/12 |
| Checked True/False | `checked` (`data-checked` / `data-unchecked`) |
| State Disabled | `disabled` — thumb loses `Shadow/Thumb` |
| RTL | thumb travel reversed via `[dir=rtl]` (Base UI exposes `--thumb-…`/`data-checked`; we translate with a logical utility) |

**Gaps:** 🔧 shadcn sizes (18.4×32 / 14×24) replaced. ➕ Label/description block with the switch aligned to the first line; the row is one click target (label `htmlFor`). Off-state track contrast is fixed in Figma before M1 (D6). ➕ `Show label=false` → require `aria-label`.

### 2.6 Checkbox & Checkbox group — Figma `Checkbox` (8:4351)

Base: shadcn `checkbox` → Base UI `Checkbox` + **Base UI `CheckboxGroup`** (for the multi-select list, with the documented *parent checkbox* pattern for Indeterminate).
```ts
type CheckboxProps = { checked?: boolean | 'indeterminate'; onCheckedChange?; label?; description?; disabled?; value?: string };
type CheckboxGroupFieldProps = { legend: string; description?; options: {value,label,description?,disabled?}[]; value; onValueChange; parent?: {label} };
```
*Implemented in M2 part 1:* `Checkbox` (bare box, or with label/description), `CheckboxGroup` (+ optional `parent`; parent state counts the ENABLED options; value reported in option order), `GroupField` (stand-alone legend/description/options/error). Inside a Setting Row (`group` mode) the row title names the group (`aria-labelledby`) and its description describes it; options are `Field.Item`s. The 16 px gap between a group's description and its first option is measured from the *Checkbox & Radio · Usage* frame (it is in no component JSON; 12 px fits clearly worse). Figma has no focus indicator here: the approved neutral ring (O5) is drawn.

**Gaps:** 🔧 shadcn box is 16 px but uses `radius-[4px]`+ ring; use `radius/xs`, `control/*` tokens, 1.75 px check stroke. ➕ Indeterminate glyph (7 px dash). ➕ Group: `<fieldset>` + `<legend>`, children indented 24 px toward reading direction, parent checkbox drives `indeterminate`. ➕ The single-checkbox-as-instant-setting anti-pattern (rule 14): dev-mode warning when a lone `Checkbox` is bound to a field with `save: 'instant'`.

### 2.7 Radio & Radio group — Figma `Radio` (8:4114)

Base: shadcn `radio-group` → Base UI `RadioGroup` + `Radio.Root/Indicator`, in a `Fieldset` (Base UI `Fieldset`).
```ts
type RadioGroupFieldProps = { legend: string; description?; options: {value,label,description?,disabled?}[]; value; onValueChange; orientation?: 'vertical'|'horizontal' };
```
*Implemented in M2 part 1:* `RadioGroup` (vertical only — horizontal is not in Figma), `radio` requires a `default` that is an enabled option, ≥ 2 options, and warns from 6 (`_doing_it_wrong`). PHP exports `required` + `allowed` so the browser mirrors both.

**Gaps:** ➕ Vertical stack with 12 px gaps; the whole row is the target. ➕ "Always give radio groups a default selection" — PHP schema **requires** `default` for `radio` fields (validated at registration). ➕ 2–5 options guard: dev-mode warning suggesting `select` at ≥ 6 (rule 14).

### 2.8 Select — Figma `Select` (8:5055) + `Select Menu` (8:5157, Single) + `Menu Item` (8:4601)

Base: **shadcn `select` → Base UI `Select`** (`Root, Trigger, Value, Icon, Portal, Positioner, Popup, List, Item, ItemText, ItemIndicator`).
```ts
type SelectFieldProps<T> = TextFieldProps-ish & { options: {value:T,label:string,icon?:IconName,disabled?:boolean}[]; value?: T; onValueChange?; placeholder?: string; maxVisibleItems?: number /*8*/; searchable?: boolean };
```
| Figma | Code |
|---|---|
| Size | `size` (trigger 32/40/48) |
| State Open | `data-popup-open` on Trigger: same look as Focus + `arrow-up` icon |
| Prefix icon | `prefixIcon` (`global` for language select) |
| Select Menu | `Select.Popup`: padding 4, gap 2, radius lg, 1 px border, `Shadow/Medium`, **width = `--anchor-width`**, `sideOffset` 4, `max-height = 8 × 36 + padding`, scroll |
| Menu Item Default/Hover/Selected/Disabled | `Select.Item`: hover ≡ `data-highlighted` → fill `surface/default`; selected → `tick-circle` at the end via `ItemIndicator`; `data-disabled` |

**Gaps:** 🔧 Popup rules (width, offset, 8-item cap). 🔧 shadcn puts the check at the *start*; Figma at the **end**. ➕ Disabled options stay visible. ➕ `searchable` → renders the **Combobox** variant (Base UI Select has no filtering; guideline "long lists use a searchable combobox"). ➕ Chevron swap `arrow-down`/`arrow-up`. ➕ Popup portal into root; `alignItemWithTrigger={false}` (Base UI default overlays the trigger like macOS — Figma places the menu below).

### 2.9 Select Menu (Multi) + Multi Select — Figma `Select Menu` Type=Multi, `Multi Select` (9:5140), `Menu Item` Type=Multi, `Tag` (9:4203)

Base: **shadcn `combobox` → Base UI `Combobox`** with `multiple`, `Combobox.Chips / Chip / ChipRemove / Clear / Input / List / Item` (verified in the base-nova source).
```ts
type MultiSelectFieldProps = TextFieldProps-ish & { options; value: string[]; onValueChange; placeholder?; searchable?: boolean /*default true*/; clearable?: boolean; maxVisibleTags?: number; footer?: boolean /*"n selected" + Clear*/ };
type TagProps = { label: string; size?: 'sm'|'md'; onRemove?: () => void /* absent → non-removable overflow "+n" */; disabled?: boolean };
```
| Figma | Code |
|---|---|
| Multi Select control (Values + Icons) | `Combobox.Chips` container (min-height 34/42/50, wraps) |
| Tag (removable) | `Combobox.Chip` + `Combobox.ChipRemove` (12 px `close-circle`, `aria-label` = i18n “Remove {label}”) |
| Overflow tag | `Tag` without `onRemove` showing `+{n}` (`aria-label` “{n} more selected”) — 🔧 not in shadcn; computed with `ResizeObserver` or `maxVisibleTags` |
| Clear button | `Combobox.Clear` (16 px `close-circle`, `aria-label` i18n) |
| Select Menu Multi: Search row | `Combobox.Input` inside the popup or in the trigger (see gap) |
| Select Menu Multi: Options | `Combobox.List` of `Combobox.Item` with leading `Checkbox` (Menu Item Type=Multi) |
| Select Menu Multi: Footer | ➕ custom (“n selected” Label/13 + Secondary sm “Clear” button) |

*Implemented in M2 part 2:* `Tag` (Small 20 / Medium 24; removable, or without `onRemove` the non-removable overflow chip with a screen-reader label), `MultiSelect` (the bordered field = `Combobox.Trigger` rendered as a `div`, popup = Search · options · Footer) and `MultiSelectField` (the full Figma "Multi Select"). Decisions, all from the pack:

- **O14 resolved: the search row is inside the popup** (`Combobox.Input`), the field is the trigger. The Figma footer button is **Tertiary Small "Clear all"** (not Secondary), and the popup is exactly as wide as the field, 4px below it.
- Field: min-height 34 / 42 / 50 (the stroke counts in the layout), padding 6/12 · 8/12 · 12/12; with tags the start padding is 6 · 8 · 12 (read from the pack). Tags are Small in a Small field and Medium in Medium and Large ones; they wrap with 4px gaps; the chevron column stays beside the first line. `maxVisibleTags` (default 3, as drawn) → the rest is the non-removable "+n" chip. Selected values are always reported in option order, the order the server stores.
- Menu Item Multi: the leading checkbox is `CheckboxMark` (the Checkbox box drawn as a picture — the option itself carries `aria-selected`; nested inputs would be invalid), optional `icon` after it, no trailing tick. Hover and keyboard highlight share the Hover look.
- Keyboard: on the field Enter / Space / ↓ open, Backspace (or Delete) removes the last tag; in the popup type to filter, ↑ ↓, Enter toggles, **Space toggles while the search is empty** (otherwise it is a space in the query), Backspace on an empty search removes the last tag, Esc closes and focus returns to the field. The filter is kept after ticking so several results of one query can be picked. Tag remove buttons and the inline Clear are pointer targets (`tabIndex=-1`); the keyboard has Backspace and the footer's Clear all.
- The inline **Clear button** (Figma `Clear button`, off by default → `clearable`): the pack's hidden `Clear` layer (16px close-circle, `icon/tertiary`, 8px before the chevron).
- `searchable: false` hides the search row (Figma `Search` off); the list is then not filterable. The footer is `menuFooter` (Figma `Footer`).
- **Code-only design, approved by the owner (design-spec §10):** the pack draws no *empty result* state. "No results found." reuses the Menu Item geometry (36px row, 8px padding, Copy/14 `text/tertiary`) — nothing new was invented, but it is not Figma.
- Screen readers: the field is a `combobox` named by its label; the tags are text in it; removals and Clear are announced in a polite status region.

### 2.10 Tag — see 2.9. Also usable standalone (filters). Radius `xs`, fill `surface/default`, hover `surface/hover`.

### 2.11 Segmented Control — Figma `Segment` (set, 10 variants) + `Segmented Control` (2)

Base: Base UI `RadioGroup` + `Radio.Root` (a radio group gives `role="radiogroup"`, roving focus and arrow keys, mirrored in RTL, for free; `ToggleGroup` is a set of toggle buttons without a single-choice contract).
```ts
type SegmentedControlProps = { options: { value: string; label: string; disabled?: boolean }[]; value: string; onValueChange(value: string): void; disabled?: boolean; name?: string };
```
| Figma | Code |
|---|---|
| Segment State Default / Hover / Selected / Focus / Disabled | `text/secondary` · `surface/hover` + `text/primary` · `background/default` + Shadow/Small + Label/14 Strong (`data-checked`) · neutral focus ring (O5) · `text/disabled` |
| Segmented Control Locale EN / FA | Track `surface/default`, `radius/lg`, padding 4, gap 2; segments padding 6/16, gap 6, `radius/md`. The DOM order is the option order; RTL mirrors it (first option on the right), the Figma FA frame lists its layers the other way round |

`SegmentedControlField` adds label → control → helper (or error) for stand-alone use; inside a page the Setting Row names the group (`group` mode, as for radio). PHP: `segmented` (src/Fields/SegmentedField.php) like `radio`: 2–5 options (warns from 6), `default` required and an enabled option, exports `required` + `allowed`; layout `stacked`.

### 2.12 Slider — Figma `Slider` (Locale × Size × Position × State)

Base: Base UI `Slider` (single thumb, `thumbAlignment="edge"`). `Position` (25 / 50 / 75) is only Figma's showcase of the thumb: it is not an API, the thumb follows `value`.
```ts
type SliderProps = { value: number; onValueChange(value: number): void; min?; max?; step?; size?: 'sm'|'md'; formatValue?(n: number): string; showValue?: boolean; disabled?: boolean };
```
| Figma | Code |
|---|---|
| Size Small / Medium | `size`: track 20 / 24 high, thumb 24×16 / 28×20 |
| Header (Label, Value) / Control / Helper text; Show label / value / helper | `SliderField` (`hideLabel`, `showValue`, `description`); the Value is always LTR; a bare `Slider` in a Setting Row shows only the value above the control (`showValue`) |
| Track `surface/active` · Range `control/on` · Thumb `control/thumb` + Shadow/Thumb | tokens; hover `control/on-hover`; Disabled: `control/off-disabled` track, `control/on-disabled` range, 1px `control/on-disabled` stroke on the thumb, no shadow |
| RTL | Everything mirrors: the range fills from the right, the thumb moves left as the value grows |

Keyboard (Base UI): arrows ±`step`, Home/End, PageUp/PageDown and Shift+arrows ± a tenth of the range; `aria-valuetext` is the formatted value (Persian digits in FA). **Gap:** Figma draws the range as `Position`% of the track with the thumb at its end, which cannot work at 0 and 100; the thumb here travels inside the track (2px rim kept at both ends), so it sits a few px off the showcase in between (7px at 75%).

PHP: `slider` (src/Fields/SliderField.php): `min` (0), `max` (100), `step` (1) on the field, exported as the `min` / `max` / `step` rules plus `number` and `required`; `default` is `min` unless given and must be inside the range and on the step; an out-of-range or off-step value is an error (no clamping, as for `number`).

---

## 3. Feedback / status

### 3.1 Badge — Figma `Badge` (8:5510)
Base: shadcn `badge` (custom variants; shadcn's are 4 fixed variants).
```ts
type BadgeProps = { tone?: 'gray'|'blue'|'green'|'amber'|'red'; style?: 'subtle'|'solid'; size?: 'sm'|'md'; icon?: IconName; children: ReactNode /*1–2 words*/ };
```
**Gaps:** 🔧 pill radius, sizes 20/24, icon 12. ➕ Tone × style matrix from status tokens (Amber Solid uses dark text). Solid contrast fixed in Figma before M1 (D9). Never interactive, no `role`. Prop named `tone` (Figma) but `style` collides with React's `style` → code prop is **`appearance`** (`'subtle'|'solid'`).

### 3.2 Notice — Figma `Notice` (8:5763)
Base: shadcn `alert` (`Alert, AlertTitle, AlertDescription, AlertAction`).
```ts
type NoticeProps = { tone?: 'gray'|'blue'|'green'|'amber'|'red'; title?: string; children: ReactNode; action?: {label:string; onClick|href}; onDismiss?: () => void; role?: 'status'|'alert' };
```
*M3 part 2:* the pack's `Show action` slot (`action`: one Secondary Small Button after the content, centred on the notice's height) — used by the 409 conflict notice ("Reload latest values").

*Completed in M4:* `onDismiss` draws the pack's `Close` — the 16px `close-circle` in a 16×20 box (24 in Persian) at the very end, its pointer target grown to 24×24, named "Dismiss" with a Tooltip that repeats it (rule 10; the pack draws no tooltip here, the rule asks for one). Errors and warnings stay until resolved, so `admin_notice()` makes only gray/blue/green dismissible by default. `live` (for a notice that appears AFTER the page loaded: the 409 conflict) gives `role="status"` (gray/blue/green) or `role="alert"` (amber/red) and puts the tone word in front of the message as hidden text (a live region has no accessible name); a notice that is on the page from the start stays a labelled `region`. PHP notices (`Instance::admin_notice()`) are drawn in `Notices` (`app/components/fyldo/Notices.tsx`), Fyldo's own slot under the Page Header: 12px apart (measured on the Badge & Notice usage frame), most severe first (PHP sorts), the action a Secondary Small link button (`export-square` and "(opens in a new tab)" when external); dismissal is kept for the visit and focus moves to the page's `h1`. No `notice` class anywhere.

*Implemented in M2 part 3 (the static part only — it did not exist yet, and the `notice` field needs it):* `Notice` = tone icon · optional title · message, five tones (Gray `information` · Blue `information` · Green `tick-circle` · Amber `danger` · Red `info-circle`, tokens `status/neutral|info|success|warning|error`), 16/12 padding, gap 12, radius md, full width. It is a labelled `region` (never a live region: it is on the page from the start) whose name starts with the tone word ("Warning: …", translated) because colour alone must not carry the meaning. Action button and Dismiss (drawn in the pack) stay M4, as do the live-region roles (`status` / `alert`) for notices injected after load.

**Gaps:** 🔧 shadcn Alert has no tones or icon by default. ➕ Tone → icon map; ➕ semantics: `role="status"` for gray/blue/green, `role="alert"` for red/amber (assertive only when injected after load; initial-render notices use `role="region"` + `aria-label`, to avoid screen-reader spam on page load). ➕ Dismiss = `IconButton` with label “Dismiss”. ➕ **No `notice` CSS class on React notices** (design-spec D8). ➕ PHP-rendered admin-notice helper (`$fyldo->admin_notice()`) uses WP classes.

### 3.3 Toast — Figma `Toast` (72:6694)
Base: **shadcn `toast` → Base UI `Toast`** (`Provider, Portal, Viewport, Root, Content, Title, Description, Action, Close, createToastManager, useToastManager` — verified in base-nova source).
```ts
type ToastOptions = { tone?: 'neutral'|'success'|'error'|'loading'; title: string; description?: string; action?: {label:string; onClick}; timeout?: number /* default 5000; error/loading → 0 */ };
fyldo.toast(options) / fyldo.toast.promise(...)
```
| Figma / rule | Code |
|---|---|
| Position | `Toast.Viewport` fixed, `inset-inline-end: 24px; bottom: 24px` (logical → bottom-left in RTL), width 400 |
| max 3 visible, newest at bottom | `Toast.Provider limit={3}` |
| 5 s auto-dismiss, pause on hover **and** focus | `timeout={5000}` (Base UI pauses on hover/focus/window blur) |
| Error / Loading persist | `timeout: 0` |
| ≤ 1 action | typed `action?` single |
| `role="status"` / Error `role="alert"` | Base UI `priority: 'high'` for error → assertive |
| Loading | `type: 'loading'`; promise helper |
| Close | `IconButton` (label i18n “Close”) |

**Gaps:** ➕ Tone icons + icon colours (design-spec §4.13). ➕ Viewport landmark label i18n “Notifications” and F6 hotkey (Base UI provides). ➕ **Rule 3**: the Save Bar never triggers a toast; enforced in the form layer. ➕ Dev-mode warning for a toast with more than one action or a trailing period.

*Implemented in M4:* `createToaster()` (`app/lib/toast.ts`) is the manager — `show`, `neutral` / `success` / `error` / `loading`, `update`, `promise` (Loading → Success/Error in the same toast), `close`; `ToastProvider` (`app/components/ui/toast.tsx`) draws the stack and `useToaster()` / `useOptionalToaster()` reach it (there is no `window.Fyldo`: Fyldo has no globals). Decisions: **Action** is a Tertiary Small Button (as the pack's instance draws it; the spec's "Tertiary/Secondary" was loose), one only by type, and it runs its handler and closes the toast; **Close** is the Tertiary Small Icon Button `close-circle` with its Tooltip. Layout from the pack: 400 wide, padding 8 · 8 · 8 · 16 (logical: `ps-4 pe-2 py-2`), gap 12, the tone icon centred on the row; the stack is fixed at the bottom-end corner (`inset-inline-end: 24px; bottom: 24px`: bottom-left in RTL), always laid out expanded — **12px between toasts, measured on the Toast usage frame** (the component JSON has no stack gap) — the newest (index 0) at the bottom, older ones above; the limit 3 marks the oldest `data-limited` (hidden, inert) and it returns when there is room; Base UI's collapsed "peek" stack is not used (the pack draws none). Timers: Neutral/Success 5 s, Error/Loading 0 (until closed); hovering or focusing anything in the stack pauses every timer (Base UI). Announcements: the viewport is the "Notifications" region with `aria-live="polite"`; Error has `priority: 'high'` — Base UI announces it through a separate `role="alert"` and hides the toast from the accessibility tree until it is focused (F6 jumps into the stack). Slide-in 200 ms + fade (the motion proposal), none under `prefers-reduced-motion`. Swipe to dismiss goes down or toward the corner's edge (right in LTR, left in RTL). The Save Bar's Saved never toasts (rule 3) and validation never does (rule 5): the only toasts the app queues itself are the reset action's. Pixel test `Toast EN/FA · default` (EN 0.5 % differ; FA the icon and the close button).

### 3.4 Tooltip — Figma `Tooltip` (72:6535)
Base: shadcn `tooltip` → Base UI `Tooltip` (`Provider delay={300}`, `Root, Trigger, Portal, Positioner, Popup, Arrow`).
```ts
type TooltipProps = { content: string; side?: 'top'|'bottom'|'start'|'end'; children: ReactElement };
```
**Gaps:** 🔧 open delay 300 ms on hover, 0 on focus (Base UI: `delay`/`closeDelay`; keyboard-focus opens immediately by default). 🔧 `start/end` → Base UI logical sides `inline-start / inline-end` (to be confirmed in M1; fallback: resolve from `dir`). 🔧 Bubble `background/inverse`, Copy/13, padding 10/6, radius sm, max-width 240. ➕ No interactive content allowed (types: `content: string`). Esc closes (default).

*Implemented in M4:* `Tooltip` + `TooltipProvider` (`app/components/ui/tooltip.tsx`): `label` (a plain string), `side` (`top` default, `bottom`, `start`, `end`), one focusable child. Base UI's logical sides do the RTL work (verified in Vitest for all four sides in LTR and RTL: `data-side` is `top` / `bottom` / `inline-start` / `inline-end`, and in RTL Start is on the right); it flips only to avoid clipping (collision padding 8). The 10×5 arrow (5×10 at the sides) is a `clip-path` triangle in `app.css`, drawn outside the bubble; **its tip sits 6px from the trigger, measured on the Tooltip usage frame** (`sideOffset` 11 = 6 + the 5px arrow). Bubble `background/inverse`, `text/inverse` Copy/13, padding 10/6, radius sm, max-width 240; fade 150 ms (none under reduced motion). Pixel test `Tooltip EN/FA · default` (Top: EN 3.9 % differ; FA the arrow), which also asserts Start/End land on the right sides.

### 3.5 Empty State — Figma `Empty State` (73:6879)
Base: **shadcn `empty`** (pure layout: `Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent`).
```ts
type EmptyStateProps = { size?: 'lg'|'sm'; icon: IconName; title: string; description?: string; primaryAction?: ReactElement<ButtonProps>; secondaryAction?: ReactElement<ButtonProps> };
```
**Gaps:** 🔧 icon box (48 r-lg / 40 r-md, 1 px border, `Shadow/Small`), spacings/typography per size. ➕ Actions rendered as `Button size="sm"` primary + secondary. ➕ Used automatically for empty `list`/`repeater` fields later.

*Implemented in M4:* `EmptyState` (`app/components/ui/empty-state.tsx`): `size` (`lg` 480 / `sm` 360), `icon` (an Iconsax name; the config's `icon` strings are preloaded at boot like every other), `title`, `description`, `primaryAction`, `secondaryAction` (elements; `cloneElement` forces Primary Small / Secondary Small so callers cannot break the rule "at most one Primary"), `headingLevel` (default 3: inside a Section Card whose title is an h2). Large: padding 48/32 · gap 20 · box 48 r-lg · icon 24 · text max 416, gap 8, Heading/20 + Copy/14; Small: 32/24 · 16 · 40 r-md · 20 · max 312, gap 4, Heading/16 + Copy/13; actions gap 8 (the row mirrors in RTL). Nothing in the app renders one yet: it is for empty `list`/`repeater` fields (backlog) and developers' own screens. Pixel test `Empty State EN/FA · default` (Large: EN 1.0 % differ; FA the icon box and the mirrored order of the actions).

### 3.6 Modal — Figma `Modal` (50:5622)
Base: **shadcn `alert-dialog` → Base UI `AlertDialog`** for Danger; **`dialog` → Base UI `Dialog`** for Default. One `Modal` API on top:
```ts
type ModalProps = { open; onOpenChange; type?: 'default'|'danger'; title: string; description?: string; confirmLabel: string; cancelLabel?: string; onConfirm: () => void|Promise<void>; confirmKeyword?: string /* typed confirmation */; };
```
| Rule (design-spec §2) | Implementation |
|---|---|
| Cancel start / confirm end | footer `justify-content: flex-end` + DOM order Cancel, Confirm (RTL mirrors automatically) |
| Default closes on Esc / close / backdrop | `Dialog` defaults |
| Danger closes only via Cancel / close button; never while running | `AlertDialog` (no outside-press dismiss); `onOpenChange` ignores `escape-key` while `pending`; close/cancel disabled while `pending` |
| Typed keyword | `FieldShell` + Input; confirm disabled until exact match (case-sensitive, trimmed) |
| Focus trap, return focus | Base UI built-in; `initialFocus` = Cancel for Danger (safe default), first field for typed confirmation |
| Scrim `background/overlay`, page inert | Base UI backdrop + `inert` outside popup |

*Implemented in M3 part 2 (Type=Default; M4 added Danger, below):* `Modal` (`app/components/ui/modal.tsx`) over Base UI `Dialog` — `open/onOpenChange/title/description/cancelLabel/confirmLabel/onConfirm` (+ `focusAfterConfirm`). 480 wide (`w-120`, at most the viewport − 32 px through a 16 px padded `Dialog.Viewport`), radius lg, 1 px `border/default`, `Shadow/Large`, scrim `background/overlay`; header 24 all round, gap 16 (Title Heading/20 + Description Copy/14 `text/secondary`, gap 8) + the close Icon Button (Tertiary Small, `close-circle` — identified in the pack PNG; `aria-label` "Close"; its Tooltip comes with M4's Tooltip); footer `background/subtle`, top border, 16/24, `justify-between`: Cancel (Secondary Small) at the start, Confirm (Primary Small) at the end, DOM order Cancel → Confirm (RTL mirrors). Closes on Esc / close / backdrop; focus starts on Cancel (the safe choice), is trapped, the page behind is inert, focus returns to the trigger — after Confirm it goes where the action leads (`focusAfterConfirm`). Fade + scale 0.98 in 150 ms, none under reduced motion. Portals into the root. Pixel test: `pack-visual-save.spec.ts`.

*Implemented in M4 (Type=Danger):* `type="danger"` (Base UI `AlertDialog`: `role="alertdialog"`), `confirmKeyword` and a running state. Layout from the pack: header padding 24/24/16/24, a Body (padding 0/24/24/24) with the labelled **Medium** Input "Type RESET to confirm" (placeholder = the keyword; the pack's Helper text layer is hidden), footer as Default with the **Error** Small Confirm, which is `action/disabled` until the keyword matches (case-sensitive, surrounding spaces ignored; the server checks it again). `onConfirm` may return a promise: while it runs Confirm is loading and Cancel, the close button and the field are disabled and **nothing closes the modal**. A Danger modal closes on Esc (Esc is Cancel, it never confirms; design-spec §10.1) but ignores a click on the scrim (the Default one closes on both). Initial focus: the keyword field, else Cancel; after Confirm focus goes to `focusAfterConfirm` (the reset button). Enter in the keyword field confirms when it matches (the body is a `<form>`). The close button is now an `IconButton` (Tertiary Small, `close-circle`) — its Tooltip "Close" (rule 10) is on the Default modal too. Pixel test `Modal Danger EN/FA · default` (EN 2.4 % differ; FA the close button).

**Gaps:** ➕ `pending` state with spinner in confirm (M4). ➕ Small-screen behaviour not in Figma (the 16 px inset above).

---

## 4. Layout & navigation

### 4.1 Nav Item + Sidebar — Figma `Nav Item` (18:2155), `Sidebar` (18:2391)
Base: ⛔ **not shadcn `sidebar`** (heavy: provider, cookie persistence, mobile Sheet, rail). Custom `<nav aria-label>` + `<a aria-current="page">` list.
```ts
type NavItemProps = { icon?: IconName; label: string; href: string; active?: boolean; badge?: string|number; disabled?: boolean };
type SidebarProps = { brand: {name; version?; logo?}; groups: {label?: string; items: NavItemProps[]}[]; footer?: NavItemProps[] };
```
| Figma | Code |
|---|---|
| State Default/Hover/Active/Focus/Disabled | CSS + `aria-current="page"` (Active), `aria-disabled` (Disabled; still focusable? no — removed from tab order) |
| Badge | `Badge` neutral sm 20 px pill |
| Group labels | visible label element (`Group label`, 12 px `text/tertiary`); the group `<ul>` uses `aria-labelledby` pointing at it; unlabeled groups get no label |

**Gaps:** ➕ Responsive collapse (design silent): at ≤ 960 px (WP auto-fold) the sidebar becomes a top drawer/“Menu” disclosure — proposal in ARCHITECTURE §8.3. ➕ Sticky positioning inside wp-admin (`top: var(--wp-admin--admin-bar--height, 32px)`). ➕ Client-side routing (hash) with `href` fallbacks so links work without JS interception. ➕ Keyboard: normal tab order (a list of links, not a roving-tabindex widget).

*Implemented in M3 part 1:* `NavItem` (`app/components/fyldo/NavItem.tsx`: an `<a href>` with `aria-current="page"`; padding 6/8, gap 8, radius md; its height follows the line height — 32 in EN, **34 in FA** as the pack draws it; Focus = the pack's `background/default` fill + the neutral ring (O5); Disabled = not a link at all; external links add a screen-reader "(opens in a new tab)"), `Sidebar` (256, `background/subtle`, end border; header 20/20/16/20 with the brand; navigation 8/16/0/16 with groups 20 apart — a visible group label names its `<ul>` through `aria-labelledby`; footer 12/16 with a top border, a second `<nav>` named "Resources"; one `<nav>` named after the instance title) and the `drawer` variant used by the ≤ 782 px **Menu disclosure** (WordPress's own mobile breakpoint, as requested; the brand and a Secondary Small "Menu" button with `aria-expanded` above the content). `Badge` (`app/components/ui/badge.tsx`) was built here because the Nav Item badge, the Tab count and the brand's version are Badges: Gray Subtle Small in all three; counts and the version use the page's numerals (`localizeDigits`: ۳, ۱٫۰), and the version reads "v1.0" in EN and "۱٫۰" in FA (the pack's FA badge has no "v"; it is the translation of `v%s`).
*Brand (M3 part 2, decided by the owner):* `BrandMark` = logo (24) · name (Heading/16) · version Badge, gap 10 (design/figma/brand/README.md). The logo is the instance `logo` — an Iconsax icon through `<Icon size={24}>`, or an image URL as a 24×24 `<img alt="">` — else the Fyldo mark (`FyldoMark`: the exported 24×24 path, `fill="currentColor"` = `text/primary`, `aria-hidden`). The title defaults to "Fyldo" (translated: «فیلدو»). Pixel test "Brand EN/FA · default" against the Sidebar PNG (EN: the whole header, 0.7 % differ; FA: the mark, 0 %).
**Icons in the pack:** nested icon instances carry only a swap id; the names behind the Sidebar/Top Navigation ones were found by geometry matching (every Iconsax Linear icon at 16 px vs the pack PNGs): `setting-2`, `brush-2`, `notification-bing`, `shield-tick`, `flashy`, `element-3`, `data`, `code-1`, `book-1`, `message-question`, and the Page Header's external-link icon `export-square` (`e2e/harness/support/shell.ts`).

### 4.2 Top Navigation — Figma `Top Navigation` (37:4189)
Base: ⛔ custom (`<header>` + `<nav>`); items are the **Tab visual** but **link semantics** (`aria-current`), not `role="tab"`.
```ts
type TopNavigationProps = { brand; utilities?: ButtonProps[]; groups: {items: NavItemProps[]}[] /* group divider between */ };
```
**Gaps:** ➕ Overflow: 8 sections max by rule; beyond that horizontal scroll with fade + “More” menu (design silent). ➕ Utility links: Tertiary sm Buttons with a **leading** icon (as the pack draws them).

*Implemented in M3 part 1:* `TopNavigation` — row 1 (padding 12/24/4/24, gap 16): brand · spacer · utilities; row 2 (padding 0/12, gap 4): the Tab look as links (`aria-current`) with the page icons, one `<ul>` per group named by the group's label, groups split by the 1×16 divider in a 17 px slot; 96 px tall in EN, 98 in FA. Utilities are `ButtonLink`s (a real `<a>` with the Button look — a Base UI Button rendered as an anchor would get `role="button"`). With `navigation: 'top'` the `header` links join the utilities and the Page Header shows no actions (rule 16). ≤ 782 px (design silent): the utilities wrap under the brand and row 2 scrolls sideways; no "More" menu and no edge fade (not designed).

### 4.3 Tab + Tabs — Figma `Tab` (18:2506), `Tabs` (18:2614)
Base: **shadcn `tabs` → Base UI `Tabs`** (`Root, List, Tab, Indicator, Panel`) — used for **sub-pages of a nav item** (real tablist with panels).
```ts
type TabsProps = { value; onValueChange; tabs: {id;label;icon?;count?;disabled?}[]; children: panels };
```
**Gaps:** 🔧 Underline style: 2 px indicator `action/primary`, 1 px divider `border/default`, tab content height 32, hover fill `surface/hover` on the inner rounded box. 🔧 `Tabs.Indicator` is animated by Base UI CSS vars (`--active-tab-*`) → RTL-safe when `DirectionProvider` set; ➕ count Badge; ➕ URL sync (`#/page/tab`); ➕ keyboard per WAI-ARIA (arrows/Home/End, RTL-aware) from Base UI; activation on focus vs Enter: **manual activation** (each tab may load/validate).

*Implemented in M3 part 1:* `Tab.tsx` (`TabLook` + `TAB_OUTER`: 8 px top padding, the Content box 6/12 with gap 6 and radius md, a 6 px gap, the 2 px indicator; 48 px in EN, 50 in FA because the height follows the line height; the neutral focus ring hugs the Content box through the `focus-ring-inner` utility) and `Tabs.tsx` over Base UI Tabs with `activateOnFocus={false}` (arrows move focus, mirrored in RTL; Enter/Space open the tab, which pushes `#/<page>/<tab>`). Each tab draws its own indicator (the pack's per-tab Indicator layer; no sliding animation — none is designed). The tablist is named by the page title; a section without a `tab` shows on every tab.

### 4.4 Setting Row — Figma `Setting Row` (18:2719)
Base: ➕ custom composition over `Field` (`Field.Root/Label/Description`). `ControlSlot` receives the field renderer.
```ts
type SettingRowProps = { title: string; description?: string; badge?: BadgeProps; layout?: 'inline'|'stacked'|'field'; divider?: boolean /*true; false on last row*/; control: ReactNode; error?: string };
```
**Layout rule from the PHP schema:** `toggle`, `checkbox` ⇒ `inline`; `text|textarea|select|multi_select|number` ⇒ `stacked`; `radio`/`checkbox_group` ⇒ `stacked` (with `Fieldset`). Overridable per field (`'layout' => 'inline'`). `field` (Figma `Layout=Field`) puts the control (320 wide, 360 when `wide`) at the end of the row with the error under it; defaults never use it, and at ≤782px it falls back to `stacked`.
*Disabled with a reason (M2 part 3):* `disabled` is `true` or a string. A string is rendered under the description (kept `text/secondary`, not the faded disabled colour: it is the one thing that must stay readable) as a Base UI `Field.Description` — or, for a checkbox/radio group, an id in the group's `aria-describedby` — so it is part of the control's accessible description for every control type (tested for toggle, checkbox, text, textarea, number, password, select, multi select, checkbox group, radio group). A disabled field is never validated, never sent and ignored by the server.

**Gaps:** ➕ Label association (inline Toggle: title is the switch label via `aria-labelledby`; description via `aria-describedby`). ➕ Divider auto-off on last row (CSS `:last-child`, prop override). ➕ Disabled propagation + “why disabled” text (rule 14). ➕ Conditional visibility hook (`show_if`) — later milestone.

### 4.5 Section Card — Figma `Section Card` (18:2913)
Base: shadcn `card` (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter) restyled.
```ts
type SectionCardProps = { title: string; description?: string; tone?: 'default'|'danger'; footer?: ReactNode /* only in save:'section' mode, or danger */; children: SettingRow[] };
```
*M3 part 2:* the footer is drawn on pages that save per section (`save: 'section'`), on every card with value fields (never a Danger card): the pack's Footer text (Copy/13) as a polite live status — "Changes take effect after you save." (the pack's text) when clean, then "You have unsaved changes" / "Saving changes…" / "All changes saved" / the error in `status/error/text` (`footerStatus: 'error'`) — and the pack's Primary Small **Save** (loading while it saves, disabled while the card is clean). The button keeps focus in the field on pointer-down: the field's blur validation could otherwise insert an error row above the footer and move the button away mid-click.

*M3 part 1:* the existing `SectionCard` already matched the pack (pixel test `Section Card EN · default`: 1.2 % of pixels differ, text anti-aliasing); unchanged. *M4:* a Danger section shows its header and the pack's Danger footer — "This action can’t be undone." (Copy/13, `status/error/text`) and an **Error** Small button (the action's label) — no content, no Save. The button opens the Danger Modal (`SettingsPage`); Confirm sends `POST …/pages/{page}/actions/reset` (`Api.runAction`, one request at a time with the page's saves) and replaces the page's form with the returned values and revision (unsaved edits dropped). Defaults for the texts (Fyldo's, translated): "Reset all settings?" / "Every option on this page will return to its default value. This can’t be undone." (the pack's sentence, "this page" because the action is per page) / the action's label as the confirm verb / "Cancel".

**Gaps:** 🔧 Card radius `lg`, header padding 24/24/24/4, content padding 24/24/0/4, footer on `background/subtle` with top border. ➕ Danger tone (no content, footer tinted). ➕ Landmark: `<section aria-labelledby=title-id>`; heading level `h2` (page header is `h1`). ➕ Footer rendered **only** when the page's `save` mode is `section` (rule 1) or the card is Danger — enforced by the layout, not by the caller.

### 4.6 Save Bar — Figma `Save Bar` (18:3079)
Base: ➕ custom (no shadcn equivalent).
```ts
type SaveBarProps = { status: 'dirty'|'saving'|'saved'|'error'; message?: string; onSave: () => void; onDiscard?: () => void; errorMessage?: string };
```
| Figma state | Code |
|---|---|
| Dirty | shown when `dirtyCount > 0`; 8 px dot `status/warning/solid` |
| Saving | spinner; both buttons disabled; `aria-busy` |
| Saved | `tick-circle`; buttons disabled; confirmation is **this bar** (no toast) |
| Error | border + message `status/error/*`; Save enabled to retry |

*Implemented (M1, completed in M3 part 2):* every pack state — Dirty (8 px `status/warning/solid` dot), Saving (spinner; Discard disabled, Save loading), Saved (`tick-circle` `status/success/solid`; both disabled), Error (`info-circle`, `status/error/border` + `status/error/text`; the pack's message "Couldn’t save. Check the highlighted fields." for invalid fields, "Couldn't save. Check your connection and try again." for a failed request, the conflict message on a 409; both buttons enabled) — and Discard (restores the stored values at once; the leave dialog is for navigation). `position: sticky; bottom: 32px` (16 px at ≤ 782 px) in the content column; `role="region"` "Unsaved changes" + `aria-live="polite"` message, focus never stolen; Ctrl/⌘+S saves; slides in and out in 200 ms (`@starting-style`), Saved lingers 4 s or until the next edit (O15); rendered only on `save: 'global'` pages. FA strings follow the pack («لغو تغییرات», «ذخیره‌ی تغییرات»…). Pixel test: `pack-visual-save.spec.ts` (Dirty, EN 1.4 % differ; FA the dot and the mirrored actions).

**Gaps (resolved in M3 part 2):** floating layout, live region, Ctrl/⌘+S, `beforeunload` + the in-app Modal, the Saved lifetime, global-only.

### 4.7 Page Header — Figma `Page Header` (20:3127)
Base: ➕ custom `<header>`: `h1` (Heading/32), description (Copy/16 `text/secondary`), actions slot at the end.
*Implemented in M3 part 1:* actions are the instance's `header` links as Secondary Small `ButtonLink`s; an external one ends with the `export-square` icon (identified in the pack PNG; it does not mirror in RTL, as the pack's FA variant shows) and says "(opens in a new tab)" to screen readers. The `h1` has `tabindex=-1` and receives focus after a page change.

**Gaps:** ➕ Real `<h1>` (Heading/32). WordPress core JS moves any `.notice`/`.updated`/`.error` element to just after the first `h1` inside `.wrap`. Our root is therefore **not** placed inside `.wrap`, and PHP-side admin notices for the screen are rendered by Fyldo into its own notice slot (ARCHITECTURE §8.3), so WP's relocation never touches the React tree. ➕ Actions slot is hidden when the Top Navigation already shows the utility links (rule 16).

---

## 5. Field type ↔ component matrix (what PHP `type` renders)

| PHP `type` | Component | Row layout | Sanitize (server) | Client validation (mirrored) |
|---|---|---|---|---|
| `text` | `TextField` (`type=text`) | stacked | `sanitize_text_field` | required, min/max length, pattern |
| `url` | `Input type=url` (text `dir="ltr"`) | stacked | Persian digits → ASCII, `esc_url_raw` + scheme allowlist | schemes (default http/https), digits |
| `email` | `Input type=email` (text `dir="ltr"`) | stacked | Persian digits → ASCII, `sanitize_email` + `is_email` | email, digits |
| `password` | `Input type=password` | stacked | raw string (no trimming), never echoed back (write-only: `null` keeps, `""` clears) | required, min/max length, pattern |
| `number` | `NumberInput` (`inputmode=decimal`, `dir="ltr"`) | stacked | Persian digits → ASCII, int/float, `''` when empty; unreadable text stays text so `number` fails (no clamping: out of range is an error) | number, min, max, step |
| `textarea` | `TextareaField` | stacked | `sanitize_textarea_field` | required, max length |
| `code` | `TextareaField code` | stacked | raw string capped by length; `kses`-none — dev opts in | max length |
| `toggle` | `Toggle` | inline | `rest_sanitize_boolean` | — |
| `checkbox` | `Checkbox` (single statement) | inline | boolean | required (must agree) |
| `checkbox_group` | `CheckboxGroupField` | stacked | subset of allowed keys | min/max selected |
| `radio` | `RadioGroupField` | stacked | one of allowed keys (else default) | required, allowed |
| `segmented` | `SegmentedControl` | stacked | `sanitize_text_field`; `allowed` rejects anything but an enabled option | required, allowed |
| `slider` | `Slider` (`size=md`, value above the control) | stacked | Persian digits → ASCII, int/float; unreadable text stays text so `number` fails | number, required, min, max, step |
| `select` | `SelectField` | stacked | one of allowed keys (else default) | allowed |
| `multi_select` | `MultiSelectField` | stacked | subset of allowed keys, option order | required, allowed, min/max selected |
| `notice` (static) | `Notice` | full width, own row | — (no value: not stored, not in REST) | — |
| *later* `repeater`, `color`, `media`, `code editor`, `date` | out of scope until designed | | | |

## 6. Shared gaps summary (design silent — proposals in ARCHITECTURE §15)

1. Focus indicator on every non-field control (design has none; blue `Focus/Ring` unused).
2. Contrast failures: placeholder/counter text, field borders, off-switch track, some Solid badges (design-spec §9).
3. Responsive behaviour (sidebar collapse, top nav overflow, modal on small screens, Save Bar on mobile).
4. Motion spec.
5. ~~Password / number / other input types~~ (M2 part 3: they reuse the one Input; the password show/hide toggle is code-only design, design-spec §10); group legends styling.
6. Saved-state lifetime on Save Bar; loading skeleton; global error state.
7. WP integration realities the design ignores: `#wpcontent` padding offsets, admin-bar height, `.notice` relocation, `input:focus` ring, screen-options/help tabs, RTL admin CSS (`rtl.css`) auto-loaded by WP.
