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

### 2.3 Input — Figma `Input` (8:2924)

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

**Gaps:** 🔧 shadcn Input is 36 px with ring focus — replace with 32/40/48, Copy/14 (Copy/16 at `lg`), halo tokens. ➕ Error row layout (16 px `info-circle` + Copy/13). ➕ Validation timing: show error only after blur or submit (rule 7) — implemented in the form layer (`touched` state), not the component. ➕ LTR-in-RTL rule for `url|email`/`code`. ➕ **Neutralise wp-admin `input:focus` blue ring** (ARCHITECTURE §8.2). ⚠ Input border contrast (design-spec D4).

### 2.4 Textarea — Figma `Textarea` (8:3307)

Base: shadcn `textarea` inside `FieldShell`.
```ts
type TextareaFieldProps = TextFieldProps & { rows?: number /*default 4 (=104px)*/; showCounter?: boolean; code?: boolean; resize?: 'vertical'|'none' };
```
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

**Gaps:** 🔧 shadcn sizes (18.4×32 / 14×24) replaced. ➕ Label/description block with the switch aligned to the first line; the row is one click target (label `htmlFor`). ➕ Off-state contrast note (D6). ➕ `Show label=false` → require `aria-label`.

### 2.6 Checkbox & Checkbox group — Figma `Checkbox` (8:4351)

Base: shadcn `checkbox` → Base UI `Checkbox` + **Base UI `CheckboxGroup`** (for the multi-select list, with the documented *parent checkbox* pattern for Indeterminate).
```ts
type CheckboxProps = { checked?: boolean | 'indeterminate'; onCheckedChange?; label?; description?; disabled?; value?: string };
type CheckboxGroupFieldProps = { legend: string; description?; options: {value,label,description?,disabled?}[]; value; onValueChange; parent?: {label} };
```
**Gaps:** 🔧 shadcn box is 16 px but uses `radius-[4px]`+ ring; use `radius/xs`, `control/*` tokens, 1.75 px check stroke. ➕ Indeterminate glyph (7 px dash). ➕ Group: `<fieldset>` + `<legend>`, children indented 24 px toward reading direction, parent checkbox drives `indeterminate`. ➕ The single-checkbox-as-instant-setting anti-pattern (rule 14): dev-mode warning when a lone `Checkbox` is bound to a field with `save: 'instant'`.

### 2.7 Radio & Radio group — Figma `Radio` (8:4114)

Base: shadcn `radio-group` → Base UI `RadioGroup` + `Radio.Root/Indicator`, in a `Fieldset` (Base UI `Fieldset`).
```ts
type RadioGroupFieldProps = { legend: string; description?; options: {value,label,description?,disabled?}[]; value; onValueChange; orientation?: 'vertical'|'horizontal' };
```
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

**Gaps:** ⚠ Figma shows a search row **inside the popup**; Base UI Combobox's canonical multiple pattern types in the chips input. Decision needed at Milestone 2: keep Figma (input inside popup — needs `Combobox.Input` in `Popup` with the "input inside popup" recipe) vs canonical. Recommendation: **follow Figma** (matches the design and works better on mobile). ➕ Overflow computation. ➕ Backspace removes the last chip (Base UI default) — keep. ➕ Live region announcing “{label} selected/removed”.

### 2.10 Tag — see 2.9. Also usable standalone (filters). Radius `xs`, fill `surface/default`, hover `surface/hover`.

---

## 3. Feedback / status

### 3.1 Badge — Figma `Badge` (8:5510)
Base: shadcn `badge` (custom variants; shadcn's are 4 fixed variants).
```ts
type BadgeProps = { tone?: 'gray'|'blue'|'green'|'amber'|'red'; style?: 'subtle'|'solid'; size?: 'sm'|'md'; icon?: IconName; children: ReactNode /*1–2 words*/ };
```
**Gaps:** 🔧 pill radius, sizes 20/24, icon 12. ➕ Tone × style matrix from status tokens (Amber Solid uses dark text). ⚠ Solid contrast (D9). Never interactive, no `role`. Prop named `tone` (Figma) but `style` collides with React's `style` → code prop is **`appearance`** (`'subtle'|'solid'`).

### 3.2 Notice — Figma `Notice` (8:5763)
Base: shadcn `alert` (`Alert, AlertTitle, AlertDescription, AlertAction`).
```ts
type NoticeProps = { tone?: 'gray'|'blue'|'green'|'amber'|'red'; title?: string; children: ReactNode; action?: {label:string; onClick|href}; onDismiss?: () => void; role?: 'status'|'alert' };
```
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

### 3.4 Tooltip — Figma `Tooltip` (72:6535)
Base: shadcn `tooltip` → Base UI `Tooltip` (`Provider delay={300}`, `Root, Trigger, Portal, Positioner, Popup, Arrow`).
```ts
type TooltipProps = { content: string; side?: 'top'|'bottom'|'start'|'end'; children: ReactElement };
```
**Gaps:** 🔧 open delay 300 ms on hover, 0 on focus (Base UI: `delay`/`closeDelay`; keyboard-focus opens immediately by default). 🔧 `start/end` → Base UI logical sides `inline-start / inline-end` (to be confirmed in M1; fallback: resolve from `dir`). 🔧 Bubble `background/inverse`, Copy/13, padding 10/6, radius sm, max-width 240. ➕ No interactive content allowed (types: `content: string`). Esc closes (default).

### 3.5 Empty State — Figma `Empty State` (73:6879)
Base: **shadcn `empty`** (pure layout: `Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent`).
```ts
type EmptyStateProps = { size?: 'lg'|'sm'; icon: IconName; title: string; description?: string; primaryAction?: ReactElement<ButtonProps>; secondaryAction?: ReactElement<ButtonProps> };
```
**Gaps:** 🔧 icon box (48 r-lg / 40 r-md, 1 px border, `Shadow/Small`), spacings/typography per size. ➕ Actions rendered as `Button size="sm"` primary + secondary. ➕ Used automatically for empty `list`/`repeater` fields later.

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

**Gaps:** ➕ `pending` state with spinner in confirm. ➕ Portal into root. ➕ Width 480 with `max-width: calc(100vw − 32px)`; small-screen behaviour not in Figma.

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

### 4.2 Top Navigation — Figma `Top Navigation` (37:4189)
Base: ⛔ custom (`<header>` + `<nav>`); items are the **Tab visual** but **link semantics** (`aria-current`), not `role="tab"`.
```ts
type TopNavigationProps = { brand; utilities?: ButtonProps[]; groups: {items: NavItemProps[]}[] /* group divider between */ };
```
**Gaps:** ➕ Overflow: 8 sections max by rule; beyond that horizontal scroll with fade + “More” menu (design silent). ➕ Utility links: Tertiary sm Buttons with trailing icon.

### 4.3 Tab + Tabs — Figma `Tab` (18:2506), `Tabs` (18:2614)
Base: **shadcn `tabs` → Base UI `Tabs`** (`Root, List, Tab, Indicator, Panel`) — used for **sub-pages of a nav item** (real tablist with panels).
```ts
type TabsProps = { value; onValueChange; tabs: {id;label;icon?;count?;disabled?}[]; children: panels };
```
**Gaps:** 🔧 Underline style: 2 px indicator `action/primary`, 1 px divider `border/default`, tab content height 32, hover fill `surface/hover` on the inner rounded box. 🔧 `Tabs.Indicator` is animated by Base UI CSS vars (`--active-tab-*`) → RTL-safe when `DirectionProvider` set; ➕ count Badge; ➕ URL sync (`#/page/tab`); ➕ keyboard per WAI-ARIA (arrows/Home/End, RTL-aware) from Base UI; activation on focus vs Enter: **manual activation** (each tab may load/validate).

### 4.4 Setting Row — Figma `Setting Row` (18:2719)
Base: ➕ custom composition over `Field` (`Field.Root/Label/Description`). `ControlSlot` receives the field renderer.
```ts
type SettingRowProps = { title: string; description?: string; badge?: BadgeProps; layout?: 'inline'|'stacked'; divider?: boolean /*true; false on last row*/; control: ReactNode; error?: string };
```
**Layout rule from the PHP schema:** `toggle`, `checkbox` ⇒ `inline`; `text|textarea|select|multiselect|number` ⇒ `stacked`; `radio`/`checkbox_group` ⇒ `stacked` (with `Fieldset`). Overridable per field (`'layout' => 'inline'`).
**Gaps:** ➕ Label association (inline Toggle: title is the switch label via `aria-labelledby`; description via `aria-describedby`). ➕ Divider auto-off on last row (CSS `:last-child`, prop override). ➕ Disabled propagation + “why disabled” text (rule 14). ➕ Conditional visibility hook (`show_if`) — later milestone.

### 4.5 Section Card — Figma `Section Card` (18:2913)
Base: shadcn `card` (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter) restyled.
```ts
type SectionCardProps = { title: string; description?: string; tone?: 'default'|'danger'; footer?: ReactNode /* only in save:'section' mode, or danger */; children: SettingRow[] };
```
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

**Gaps:** ➕ Floating layout: `position: sticky; bottom: 32px` inside the content column (width 800, follows the column, not the viewport); safe-area on mobile. ➕ `role="region" aria-label="Unsaved changes"` + `aria-live="polite"` on the message; focus is **not** stolen. ➕ Keyboard: `Ctrl/⌘+S` saves (opt-out), Esc does nothing. ➕ `beforeunload` guard while dirty; in-app navigation prompt (Modal default). ➕ Saved state lifetime — design silent: proposal “visible until next edit or 4 s, then slides out (no motion under reduced-motion)”. ➕ Only rendered when page `save = 'global'`.

### 4.7 Page Header — Figma `Page Header` (20:3127)
Base: ➕ custom `<header>`: `h1` (Heading/32), description (Copy/16 `text/secondary`), actions slot at the end.
**Gaps:** ➕ Real `<h1>` (Heading/32). WordPress core JS moves any `.notice`/`.updated`/`.error` element to just after the first `h1` inside `.wrap`. Our root is therefore **not** placed inside `.wrap`, and PHP-side admin notices for the screen are rendered by Fyldo into its own notice slot (ARCHITECTURE §8.3), so WP's relocation never touches the React tree. ➕ Actions slot is hidden when the Top Navigation already shows the utility links (rule 16).

---

## 5. Field type ↔ component matrix (what PHP `type` renders)

| PHP `type` | Component | Row layout | Sanitize (server) | Client validation (mirrored) |
|---|---|---|---|---|
| `text` | `TextField` (`type=text`) | stacked | `sanitize_text_field` | required, min/max length, pattern |
| `url` | `TextField type=url` (LTR) | stacked | `esc_url_raw` + scheme allowlist | url |
| `email` | `TextField type=email` (LTR) | stacked | `sanitize_email` + `is_email` | email |
| `password` | `TextField type=password` | stacked | raw string (no trimming), never echoed back (write-only) | required |
| `number` | `TextField type=number` (inputmode) | stacked | int/float cast, min/max/step clamp | min, max, step |
| `textarea` | `TextareaField` | stacked | `sanitize_textarea_field` | required, max length |
| `code` | `TextareaField code` | stacked | raw string capped by length; `kses`-none — dev opts in | max length |
| `toggle` | `Toggle` | inline | `rest_sanitize_boolean` | — |
| `checkbox` | `Checkbox` (single statement) | inline | boolean | required (must agree) |
| `checkbox_group` | `CheckboxGroupField` | stacked | subset of allowed keys | min/max selected |
| `radio` | `RadioGroupField` | stacked | one of allowed keys (else default) | required, allowed |
| `select` | `SelectField` | stacked | one of allowed keys (else default) | allowed |
| `multiselect` | `MultiSelectField` | stacked | subset of allowed keys | min/max selected |
| `notice` (static) | `Notice` | full width | — | — |
| *later* `repeater`, `color`, `media`, `code editor`, `date` | out of scope until designed | | | |

## 6. Shared gaps summary (design silent — proposals in ARCHITECTURE §15)

1. Focus indicator on every non-field control (design has none; blue `Focus/Ring` unused).
2. Contrast failures: placeholder/counter text, field borders, off-switch track, some Solid badges (design-spec §9).
3. Responsive behaviour (sidebar collapse, top nav overflow, modal on small screens, Save Bar on mobile).
4. Motion spec.
5. Password / number / other input types; group legends styling.
6. Saved-state lifetime on Save Bar; loading skeleton; global error state.
7. WP integration realities the design ignores: `#wpcontent` padding offsets, admin-bar height, `.notice` relocation, `input:focus` ring, screen-options/help tabs, RTL admin CSS (`rtl.css`) auto-loaded by WP.
