# Changelog

All notable changes to Fyldo are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/) (inside a major version the public API only grows; see [docs/ARCHITECTURE.md §6](docs/ARCHITECTURE.md#6-coexistence-design)).

## [Unreleased]

### Added

- **Fields**: `post`, `term` and `user`, a searchable select whose options are the site's posts (any post type), terms (any taxonomy) or users, loaded from the server while the user types (Figma Select Menu `Type=Search` and the new Menu Message row for searching, no results and errors). Name the source with `post_type` / `post_status`, `taxonomy` or `role`; `multiple` turns it into a Multi Select whose tags keep the pick order. The value is the ID (`0` = none) or a list of IDs; only items the current user may read are offered and saved, and deleted ones drop out when the value is read. `query_args` narrows the search; `min` / `max` count the items. A new REST route, `GET …/pages/{page}/fields/{field}/items`, serves the results (20 a page); the saved items' titles travel with the page's `media`. Works inside a `group`, and a group's `item_title` may name such a sub-field: each item is then named after the post, term or user chosen in it. The demo has a "Links" page with every variant.
- **Fields**: `custom`, a field whose control you draw yourself, in React or plain JavaScript. `module` is the URL of an ES module; Fyldo imports it before the first render and calls its default export with Fyldo's own React and a few of its components (`Button`, `Checkbox`, `Icon`, `Input`, `NumberInput`, `Select`, `Textarea`, `Toggle`), so the field matches the others and no second React is loaded. The module returns a `Component` (or a plain-DOM `mount`) and an optional `validate` for instant feedback. `props` reach the module as-is and `style` enqueues a stylesheet. The value is any JSON value, its text cleaned like a textarea's unless you add `sanitize_cb`; `validate_cb` decides on the server. It works inside a `group`, and a module that fails to load or crashes stays inside its own row. Nothing is written to `window`. See [docs/custom-fields.md](docs/custom-fields.md); the demo has an "Opening hours" page with two selects saved as one value.
- **Fields**: `default_before` keeps the defaults a site already had when a release changes them. List the earlier defaults by the version that replaced them (`'default' => 30, 'default_before' => [ '2.0.0' => 10, '3.0.0' => 20 ]`); when the instance `version` moves forward, Fyldo stores, for each field nobody saved, the default it had in the version the site came from. Saved values are never touched and new installs get today's default. Fyldo now records the version each page last ran in one autoloaded option, `{slug}__fyldo` (only when the instance has a `version`), and fires `fyldo/{slug}/upgraded( $page_id, $from, $to )`. See [docs/default-history.md](docs/default-history.md).
- **Uninstall**: `Instance::delete_data()`, documented since the architecture draft but missing until now. Call it from your plugin's `uninstall.php` after registering the instance and its pages: it deletes every registered page's option and `{slug}__fyldo`, and fires no hooks.
- **Fields**: `group`, a list of items that share the same sub-fields (Figma "Group" and "Group Item"), e.g. header buttons with a label, an icon and a link. The value is a list of arrays keyed by sub-field id. A fixed group keeps the items of its `default`; `sortable` adds drag handles (and keyboard moving: Space, the arrow keys, Escape), `addable` adds Add, Duplicate and Remove with Undo, limited by `min` / `max`. Items are collapsible cards named by `item_title`, with an optional `item_icon` preview tile. Sub-fields validate as on their own; their errors are keyed `<group>.<index>.<sub-field>` and a failed save opens the first item with an error. Sub-fields cannot be groups, media or password fields.

### Changed

- **Design (redesign pass)**: a brand colour and softer neutrals. Primary is `#6e62fe` (buttons, the active navigation item, toggles and checked controls, focus, links, info tones); grays, borders, shadows and the page background are tinted toward `#f6f7fc` instead of pure gray/black; dividers between settings are lighter (`border/subtle`).
- **Design**: bigger controls and a wider settings column. Buttons, inputs and selects are 36 / 44 / 52 px (were 32 / 40 / 48), toggles, checkboxes, radios, tags and sliders are larger, navigation items are 44 px with a solid primary active state, the sidebar header is 76 px with the version at the far end, tabs are 56 px, the content column is 960 px (was 800), and the modal, toast and empty state are wider. Corner radii are unchanged.
- **Sidebar**: the version number moved from the header (next to the logo, where long versions were cut off) to a "Version 1.0" line at the bottom of the sidebar.
- **Scrolling**: on desktop the page no longer scrolls with the WordPress window scrollbar; the content area scrolls inside Fyldo's shell with its own slim, rounded scrollbar (the sidebar and top navigation stay in place). At 782px and below the document scrolls as before.
- **Motion**: every hover, focus and selection change uses one quick, soft 150 ms transition, and pages (and the cards of a tab) fade in over 150 ms when you navigate. Both are off under `prefers-reduced-motion`.
- **Design**: a focused field's halo is a 0.5 px ring in the border colour (was a 3 px, 18 % tint), so the border looks thicker while you type. Sidebar items turn white on hover. Setting Row controls are 400 px wide (the Textarea 448).
- **Accessibility checks**: the contrast test is less strict than WCAG AA (text 4:1, UI 2.5:1; decision O17). White text on the primary fill is 4.34:1.
- **Saving**: a failed save says why. Separate Save Bar messages for an expired login, a missing permission (403), a request that is too large (413) and a server error (5xx, a PHP fatal or a proxy's error page); a network failure keeps its message. The edits always stay on the page, and the server's details go to the console.
- **Saving**: an expired nonce no longer breaks a save. When WordPress or Fyldo refuses a request because a nonce has expired (a tab left open overnight, or a new login), the browser fetches fresh nonces from a new admin-ajax action, `fyldo_{slug}_nonces` (logged-in users only, like core's `rest-nonce`; it grants nothing, every REST request still checks the capability), and sends the request once more. If the user is logged out, the message says to log in again. The client config's `rest` gains `refresh` (that URL).

### Fixed

- **Admin screen**: nothing but Fyldo below the admin bar. WordPress admin notices (core's update nag, other plugins' notices) are no longer printed on a Fyldo screen, and what still lands above the app (notices added by JavaScript, settings errors, the Screen Options and Help tabs, another plugin's banner) is hidden. They pushed the full-height shell down and cut off its bottom. Other admin screens are unchanged; your own messages go through `Instance::admin_notice()`.
- **Fields**: `image` and `file` values read on the front end. A stored attachment ID was checked against `current_user_can( 'read_post' )` on every read, and logged-out visitors (no `read` capability) always got the default, `0`, instead of the saved attachment. Reading a stored value now only checks that the attachment still exists and fits the field; the permission check stays where it belongs, on save and in the admin preview.
- **Admin screen**: a crash while rendering no longer leaves an empty screen. A top-level error boundary shows an error notice with a "Reload page" button (saved settings are untouched) and logs the error to the console. A custom field's crash still stays inside its own row.

## [1.0.0-beta.3] - 2026-10-02

### Changed

- **Fields**: single-line and list fields now default to the `field` layout (control beside the label); set `layout => 'stacked'` for the old look. `choice` stays `stacked`, `toggle` and `checkbox` stay `inline`.
- **Design**: text-field borders are softer (`border/input` is `gray/500`, hover `gray/700`), following the refreshed design. The resting border is 1.66:1 on white, below WCAG 1.4.11 (3:1); this is a recorded exception (decision O16), hover, focus and error borders still pass.
- **Setting Row**: a new `field` layout (title and description on the start side, a 320px control on the end, 360px for wide controls) and the matching Section Card.

### Added

- **Fields**: the `types` of `file` and `image` takes extensions or WordPress type groups such as `'image'` and `'document'` (`wp_get_ext_types()`), e.g. `array( 'document', 'archive', 'image' )`. A group expands to its extensions; the browser still receives the plain extension list. A `file` field accepts every type WordPress allows, images included, when `types` is not set; an `image` field takes only the `image` group or image extensions.
- **Fields**: `image` (Upload Image) and `file` (Select File): one attachment from the WordPress media library, chosen in the native `wp.media` modal (single selection, filtered to the allowed types, the current attachment preselected; Fyldo has no uploader). The stored value is the **attachment ID** (`0` = none); read it with `wp_get_attachment_image_url( (int) $value, 'full' )` / `wp_get_attachment_url( (int) $value )`. `types` (extensions, mapped with `wp_get_mime_types()`) and `max_size` (bytes or `'2MB'`) are checked in the browser and again on the server (the attachment must exist, be readable, be an image for `image`, match `types` and fit `max_size`); a wrong choice shows the field's error and does not change the value. The page payload and the save response carry a `media` object (name, size, type, dimensions, thumbnail) beside the values, so the preview is right after load and after saving. `wp_enqueue_media()` runs only on a Fyldo screen that has one of these fields. Empty and filled share one height; removing only clears the value. New implied `media` rule (attachment ID); Persian numerals and unit names.
- **Fields**: `icon` (an Icon Picker: a preview tile and the icon name that open a modal with a search box and a grid of every Iconsax Linear icon). The value is the kebab-case name (`setting-2`); `default`, `icons` (a list of names that limits the picker and the server-side check) and `validate.required` are supported. The modal and the icon names load on first use, so the main script stays small; each tile's icon loads when it scrolls into view. The change applies only on "Select icon".
- **Fields**: `choice` (a Choice Card Group: one of a few selectable cards, each with an optional image and description; `content` `auto` | `image` | `text`, `columns` 2 | 3 | 4, option `image` URLs are sanitized). Single choice, validated like `radio` (required, one of the enabled options), mirrored in RTL, two columns at most up to 782px and one up to 480px.
- **Fields**: `color` (a Color Picker: swatch and hex value that open a panel with a saturation/brightness area, a hue strip, a hex box and presets). The value is lower-case `#rrggbb`; `default`, `presets` (a list of hex colours, or `false`) and `validate.required` are supported, and the new implied `color` rule runs in PHP and in the browser. The panel is loaded on first use, so the main script stays small.
- **Fields**: `segmented` (a Segmented Control: one of 2–5 short options) and `slider` (a number in a range with `min`, `max` and `step`, shown with its value). Both go through the normal sanitize, validate and save pipeline and mirror in RTL.

## [1.0.0-beta.2] - 2026-09-30

### Added

- **Demo dashboard** (standalone plugin only): **Settings → Fyldo demo** shows four sample pages (Overview, General, Content, Security) that use every field type, both save modes, tabs and the danger zone, in English and فارسی. It is added only when Fyldo sits directly in `wp-content/plugins/`, never for a drop-in folder or a Composer package, and can be turned off with the `fyldo/fyldo-demo/enabled` filter. PHP only: no extra assets.

## [1.0.0-beta.1] - 2026-09-30

First public beta. The API is feature-complete for 1.0 but not yet frozen: expect small changes before `1.0.0`.

### Added

- **PHP API** (`Fyldo\V1`, PHP 7.4+): declare pages → sections → fields with `Fyldo::create()`, `add_group()`, `add_page()`; read and write with `get()`, `all()`, `update()`, `reset()`; strict registration-time validation with actionable `_doing_it_wrong` messages.
- **Fields**: `text`, `url`, `email`, `password` (write-only), `number`, `textarea` (with counter), `toggle`, `checkbox`, `checkbox_group`, `radio`, `select`, `multi_select`, and the display-only `notice`. Declarative `validate` rules shared by PHP and the browser (one fixture tests both), plus `sanitize_cb` and `validate_cb`.
- **Admin UI**: React 19 + Base UI + Tailwind v4, built from the Figma design pack. English (LTR) and Persian (RTL). Sidebar or Top Navigation, groups, tabs, badges, header and footer links, client-side routing with real links.
- **Saving**: REST-backed sanitize, validate and save with nonce, capability and optimistic-concurrency (409) checks; `global` (Save Bar) and `section` (card footers) save modes; an unsaved-changes guard; Ctrl/⌘+S.
- **Feedback**: toasts, tooltips, notices (`Instance::admin_notice()`), empty states, confirmation modals and a **danger zone** section with a server-checked typed confirmation for resetting a page.
- **Branding**: per-instance `title` and `logo` (Iconsax name or image URL).
- **Coexistence**: any number of copies at any version share one `Fyldo\V1` loader; the highest eligible version wins. Every runtime identifier derives from the instance slug. Strauss-compatible for full isolation.
- **Accessibility**: WCAG 2.2 AA checks (axe) on every component and both layouts, skip link, keyboard walkthrough, `prefers-reduced-motion`.
- **Distribution**: a standalone plugin ZIP (`fyldo.zip`), a drop-in folder and a Composer package, all with prebuilt assets (no Node needed). `npm run release` and a tag-driven GitHub Actions release workflow.

### Not yet

WordPress version matrix, multisite, forced-colors styling and a manual screen-reader pass are planned after 1.0. Fyldo is not published on wordpress.org.

[1.0.0-beta.3]: https://github.com/SaeedCodez/fyldo/releases/tag/v1.0.0-beta.3
[1.0.0-beta.2]: https://github.com/SaeedCodez/fyldo/releases/tag/v1.0.0-beta.2
[1.0.0-beta.1]: https://github.com/SaeedCodez/fyldo/releases/tag/v1.0.0-beta.1
