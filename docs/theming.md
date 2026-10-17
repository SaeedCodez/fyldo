# Theming: a plugin's own colours

A plugin can give its Fyldo screen its own colours: a brand colour for buttons, toggles, focus and links, and its own
neutrals for text, borders and backgrounds. Every field, component and custom page follows them, because they all use
Fyldo's semantic tokens and the theme changes what those tokens point at.

```php
Fyldo::create( 'pelk', array(
	'title' => 'Pelk',
	'theme' => array(
		'brand'   => array( 600 => '#ff6b4a', 700 => '#c8401f' /* … */ ),
		'neutral' => array( 'background-200' => '#faf7f5', 1000 => '#1c1a2b' /* … */ ),
	),
) );
```

Each colour is a hex value (`#rgb`, `#rrggbb` or `#rrggbbaa`). Any step can be left out: it keeps Fyldo's colour. An unknown
ramp or step, or a value that is not a hex colour, is a configuration error (`ConfigException`), like any other mistake
in the config.

The theme is set on the instance's root element as custom properties (`--fyldo-theme-brand-600: #ff6b4a`). Fyldo's
popovers, menus, dialogs and toasts render inside that element, so they follow it too. Nothing outside the screen
changes, and another plugin's Fyldo screen keeps its own colours.

## The steps

These are the variables of the **Theme** collection in Fyldo's Figma file. The design decides which semantic token uses
which step. The most visible ones are listed below; `tokens/figma.tokens.json` has the complete mapping.

| Ramp | Step | Used by (semantic tokens) |
|---|---|---|
| `brand` | `50`, `100`, `200` | `brand/subtle`, `brand/subtle-hover`, `brand/border`: tinted states (calendar days in a range, the Item Card and Group item accents, the nav item) |
| | `500` | (the unused blue focus ring) |
| | `600` | `action/primary` (primary button, active nav item), `control/on` (toggle, checkbox), `focus/border`, `focus/ring-neutral` |
| | `700` | `action/primary-hover`, `control/on-hover`, `link/default`, `brand/text` |
| | `300`, `400`, `800`, `900`, `950` | not used by Fyldo today; set them to keep the ramp whole for later |
| `neutral` | `background-100` | `background/default` (cards, inputs), `text/inverse` (text on a primary button), `action/secondary` |
| | `background-200` | `background/subtle` (the canvas, the sidebar, card footers) |
| | `100`, `200`, `300` | `surface/default`, `surface/hover`, `surface/active` (hover and selected states), disabled backgrounds |
| | `400`, `500`, `600` | `border/default`, `border/input` and `border/hover`, `border/strong` |
| | `700`, `850`, `900`, `1000` | `text/disabled` and `control/off`, `text/tertiary`, `text/secondary`, `text/primary` and `background/inverse` (tooltips) |
| | `800`, `1000-hover` | not used by Fyldo today |
| | `overlay` | `background/overlay`, the scrim behind dialogs (a translucent colour, `#rrggbbaa`) |

The following do not change with the theme:

- The status colours: info, success, warning, error, and the red Danger button.
- The shadows: their tint is fixed.
- wp-admin itself: the admin bar and the admin menu.

## From Figma to PHP

In Fyldo's Figma file, the **Theme** collection sits between **Primitives** and **Color**. Its default mode, **Fyldo**,
is Fyldo's own theme. A project adds a mode with its own colours, then switches its frames to that mode. The Pelk file
does this with the **Pelk** mode: each step points at Pelk's own palette (`color/pelk/*`, `color/pelk-neutral/*`).

The values of that mode are the PHP `theme`, step for step: `brand/600` in Figma is `'brand' => array( 600 => … )` in
PHP. Project palettes stay in Figma. The token export leaves out every variable that only a non-default Theme mode
reaches, so Fyldo's code holds Fyldo's colours only.

## Contrast

Fyldo's contrast test (`tests/js/contrast.test.ts`) checks Fyldo's own colours. It cannot check yours, so check the pairs
that matter with your colours, at least:

| Pair | Where | Fyldo's floor |
|---|---|---|
| `neutral/background-100` on `brand/600` | text of the primary button | 4 : 1 |
| `brand/700` on `neutral/background-100` | links | 4 : 1 |
| `neutral/850` on `neutral/background-200` | sidebar group labels, hints | 4 : 1 |
| `neutral/500` on `neutral/background-100` | the border of an input | 2.5 : 1 |

A light brand colour (coral, yellow, light green) usually fails the first pair. Fix it in the design: either use a
darker step at `600` or give the button dark text.

## Example

The demo carries a complete sample theme, the Pelk mode of the Figma file: `Fyldo\V1\Demo\Demo::SAMPLE_THEME` in
`demo/demo.php`. To see the demo in it, add this to a small mu-plugin or to your theme's `functions.php`:

```php
add_filter( 'fyldo/fyldo-demo/theme', fn() => \Fyldo\V1\Demo\Demo::SAMPLE_THEME );
```

Custom pages ([custom-pages.md](custom-pages.md)) follow the theme when their CSS uses Fyldo's semantic tokens
(`var(--fyldo-action-primary)`, `var(--fyldo-text-secondary)`…). They do not follow it when the CSS uses the primitives
(`--fyldo-primary-600`, `--fyldo-gray-400`), and those are not part of the API.
