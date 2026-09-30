# Fyldo

A settings-page framework for WordPress plugin developers. Declare **pages → sections → fields** in PHP; Fyldo renders a modern React admin UI (Vercel/Geist look, English + Persian/RTL) and validates and saves the values through the REST API.

> **Status:** Milestones 1 (vertical slice), 2 (field library) and 3 (the shell: Sidebar or Top Navigation, Tabs, client-side routing with real links; a Save Bar or per-card saves, the unsaved-changes guard, conflict handling) are implemented — see [docs/ARCHITECTURE.md §13](docs/ARCHITECTURE.md#13-milestones-ordered-each-ends-with-green-ci-and-a-demo). Not released; do not bundle it in a plugin before `1.0.0` (see decision O8).

```php
use Fyldo\V1\Fyldo;

add_action( 'init', static function () {
	$fyldo = Fyldo::create( 'acme-seo', [ 'title' => __( 'Acme SEO', 'acme-seo' ) ] );
	$fyldo->add_page( 'general', [
		'title'    => __( 'General', 'acme-seo' ),
		'icon'     => 'setting-2',                     // any Iconsax name
		'sections' => [ [
			'id' => 'identity', 'title' => __( 'Site identity', 'acme-seo' ),
			'fields' => [
				[ 'id' => 'site_title', 'type' => 'text', 'label' => __( 'Site title', 'acme-seo' ), 'validate' => [ 'required' => true, 'max_length' => 60 ] ],
				[ 'id' => 'maintenance', 'type' => 'toggle', 'label' => __( 'Maintenance mode', 'acme-seo' ) ],
			],
		] ],
	] );
} );

$title = Fyldo::instance( 'acme-seo' )->get( 'general', 'site_title' );   // stored as the option `acme-seo_general`
```

## Documents

| Doc | What |
|---|---|
| [docs/design-spec.md](docs/design-spec.md) | Everything read from the Figma file: tokens, components, variants, usage rules, design issues |
| [docs/component-map.md](docs/component-map.md) | Every Figma component → shadcn / Base UI, props, gaps |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | API, data flow, three distribution modes, coexistence, Strauss, build, tests, milestones, decisions |
| [docs/figma-token-fixes.md](docs/figma-token-fixes.md) | The Figma token changes made for accessibility (applied) and how to refresh the token snapshot |

## Working on Fyldo (contributors only — end users and plugin developers never need Node)

```bash
npm ci && composer install

composer test                      # PHPUnit (no WordPress needed)
composer lint                      # PHP 7.4 syntax ceiling + WordPress Coding Standards
npm run typecheck && npm run lint  # TypeScript + project ESLint rules (no hex colours, no arbitrary values, portals in root)
npm test                           # Vitest: units, components, the save flow, WCAG contrast

npm run build                      # tokens → icons → Vite → assets/dist
npm run build:gallery              # single-variant pages for the Figma parity tests
npx tsx tools/fixtures/make-demos.ts   # five demo plugins bundling different Fyldo copies
npx wp-env start                   # Docker; or: npx wp-env start --runtime=playground
npx playwright test                # harness (Figma parity) + wp (coexistence, isolation, RTL, REST)
```

Tokens come from Figma (`tokens/figma.*.json`, refreshed through the figma-console MCP — see [docs/figma-token-fixes.md](docs/figma-token-fixes.md) §3). Translations: `npm run i18n` (`languages/fyldo.pot`, `fyldo-fa_IR.po` → `.mo` + `.json`).

## Distribution modes (one tree, three ways to load it)

1. **Standalone plugin** — the release ZIP. Install the ZIP from the GitHub Releases page. *(`Requires Plugins: fyldo` only works as a dependency check for a plugin installed this way; Fyldo is not on wordpress.org for now.)*
2. **Drop-in folder** — `require_once __DIR__ . '/fyldo/fyldo.php';`
3. **Composer** — `composer require fyldo/fyldo` (prebuilt assets are in the release tags), optionally re-prefixed with [Strauss](docs/ARCHITECTURE.md#7-strauss-optional-full-isolation--exact-configuration).

Any number of plugins may bundle different copies: the highest eligible 1.x wins, different majors and Strauss-prefixed copies live side by side ([§6](docs/ARCHITECTURE.md#6-coexistence-design)).

Licence: GPL-2.0-or-later.
