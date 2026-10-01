# Changelog

All notable changes to Fyldo are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/) (inside a major version the public API only grows; see [docs/ARCHITECTURE.md §6](docs/ARCHITECTURE.md#6-coexistence-design)).

## [Unreleased]

### Changed

- **Fields**: single-line and list fields now default to the `field` layout (control beside the label); set `layout => 'stacked'` for the old look. `choice` stays `stacked`, `toggle` and `checkbox` stay `inline`.

### Added

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

[1.0.0-beta.2]: https://github.com/SaeedCodez/fyldo/releases/tag/v1.0.0-beta.2
[1.0.0-beta.1]: https://github.com/SaeedCodez/fyldo/releases/tag/v1.0.0-beta.1
