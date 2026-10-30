/**
 * Builds the coexistence fixtures (docs/ARCHITECTURE.md §12) into e2e/.generated/plugins:
 *
 *   acme-alpha   bundles Fyldo 1.0.0                      (older 1.x)
 *   acme-beta    bundles Fyldo 1.1.0                      (highest 1.x → the winner)
 *   acme-gamma   bundles Fyldo 1.1.0, a second copy       (tie → deterministic winner, no double load)
 *   acme-delta   bundles Fyldo 2.0.0, a SYNTHETIC major   (namespace Fyldo\V2; proves coexistence mechanics)
 *   acme-omega   bundles Fyldo 1.1.0 prefixed by Strauss  (namespace Omega\Vendor\Fyldo\V1; private copy)
 *
 * Every copy is the real release tree (fyldo.php, src/, assets/dist, languages/, composer.json) built by `npm run build`.
 *
 * Plus the upgrade fixture (e2e/wp/upgrade.spec.ts), outside DEMOS: `acme-upgrade` bundles the newest released 1.x tag
 * lower than fyldo.php AND the current tree; see makeUpgradeFixture().
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'e2e/.generated');
const RUNTIME = ['fyldo.php', 'composer.json', 'LICENSE', 'src', 'demo', 'assets/dist', 'languages'];
const STRAUSS_VERSION = '0.30.0';

type Kind = 'v1' | 'v2' | 'strauss';
interface Demo {
  slug: string;
  title: string;
  fyldoVersion: string;
  kind: Kind;
  /** Layout of the settings screen (M3): the Sidebar (default) or the Top Navigation. */
  navigation?: 'sidebar' | 'top';
  /** The plugin's own colours (docs/theming.md): ramp → step → hex. */
  theme?: Record<'brand' | 'neutral', Record<string, string>>;
}

export const DEMOS: Demo[] = [
  { slug: 'acme-alpha', title: 'Acme Alpha', fyldoVersion: '1.0.0', kind: 'v1' },
  { slug: 'acme-beta', title: 'Acme Beta', fyldoVersion: '1.1.0', kind: 'v1' },
  {
    slug: 'acme-gamma',
    title: 'Acme Gamma',
    fyldoVersion: '1.1.0',
    kind: 'v1',
    navigation: 'top',
    theme: { brand: { '600': '#c8401f', '700': '#a33317' }, neutral: { '1000': '#1c1a2b' } },
  },
  { slug: 'acme-delta', title: 'Acme Delta', fyldoVersion: '2.0.0', kind: 'v2' },
  { slug: 'acme-omega', title: 'Acme Omega', fyldoVersion: '1.1.0', kind: 'strauss' },
];

function copyRuntime(to: string): void {
  for (const entry of RUNTIME) {
    const from = resolve(root, entry);
    if (!existsSync(from)) throw new Error(`Missing ${entry} — run \`npm run build\` first.`);
    cpSync(from, resolve(to, entry), { recursive: true });
  }
}

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

function setVersion(dir: string, version: string): void {
  const file = resolve(dir, 'fyldo.php');
  writeFileSync(file, readFileSync(file, 'utf8').replace(/^( \* Version:\s+).+$/m, `$1${version}`));
}

/** A synthetic next major: only the namespace and the root attribute change (see the doc for what this proves). */
function toSyntheticV2(dir: string): void {
  for (const file of walk(dir)) {
    if (file.endsWith('.php')) {
      const src = readFileSync(file, 'utf8');
      writeFileSync(file, src.replace(/Fyldo\\V1/g, 'Fyldo\\V2'));
    } else if (/assets\/dist\/(app\.js|app\.css)$/.test(file)) {
      writeFileSync(file, readFileSync(file, 'utf8').replaceAll('data-fyldo-v1', 'data-fyldo-v2'));
    }
  }
}

function ensureStrauss(): string {
  const phar = resolve(root, '.tools/strauss.phar');
  if (!existsSync(phar)) {
    mkdirSync(dirname(phar), { recursive: true });
    execFileSync('curl', ['-sSL', '-o', phar, `https://github.com/BrianHenryIE/strauss/releases/download/${STRAUSS_VERSION}/strauss.phar`]);
  }
  return phar;
}

function strauss(pluginDir: string, version: string): void {
  const work = resolve(out, 'strauss-work');
  rmSync(work, { recursive: true, force: true });
  const pkg = resolve(work, 'vendor/fyldo/fyldo');
  mkdirSync(pkg, { recursive: true });
  copyRuntime(pkg);
  setVersion(pkg, version);

  writeFileSync(
    resolve(work, 'composer.json'),
    JSON.stringify(
      {
        name: 'omega/plugin',
        require: { 'fyldo/fyldo': version },
        extra: {
          strauss: {
            target_directory: 'vendor-prefixed',
            namespace_prefix: 'Omega\\Vendor\\',
            classmap_prefix: 'Omega_Vendor_',
            constant_prefix: 'OMEGA_VENDOR_',
            packages: ['fyldo/fyldo'],
            update_call_sites: false,
            delete_vendor_packages: true,
          },
        },
      },
      null,
      2,
    ),
  );
  mkdirSync(resolve(work, 'vendor/composer'), { recursive: true });
  writeFileSync(
    resolve(work, 'vendor/composer/installed.json'),
    JSON.stringify({
      packages: [
        {
          name: 'fyldo/fyldo',
          version,
          version_normalized: `${version}.0`,
          type: 'library',
          'install-path': '../fyldo/fyldo',
          autoload: { files: ['fyldo.php'] },
        },
      ],
      dev: false,
    }),
  );

  execFileSync('php', [ensureStrauss()], { cwd: work, stdio: 'pipe' });
  cpSync(resolve(work, 'vendor-prefixed'), resolve(pluginDir, 'vendor-prefixed'), { recursive: true });
  rmSync(work, { recursive: true, force: true });
}

/** The `theme` config line of a demo, or nothing. */
function themeConfig(demo: Demo): string {
  if (!demo.theme) return '';
  const ramps = Object.entries(demo.theme).map(
    ([ramp, steps]) => `'${ramp}' => array( ${Object.entries(steps).map(([step, hex]) => `'${step}' => '${hex}'`).join(', ')} )`,
  );
  return `\n\t\t\t\t'theme'      => array( ${ramps.join(', ')} ),`;
}

function pluginFile(demo: Demo, namespace: string, bootstrap: string): string {
  return `<?php
/**
 * Plugin Name: ${demo.title} (Fyldo e2e fixture)
 * Description: Generated by tools/fixtures/make-demos.ts. Bundles Fyldo ${demo.fyldoVersion} (${demo.kind}).
 * Version: 1.0.0
 */

defined( 'ABSPATH' ) || exit;

${bootstrap}

add_action(
	'init',
	static function () {
		$fyldo = \\${namespace}\\Fyldo::create(
			'${demo.slug}',
			array(
				'title'      => '${demo.title}',
				'version'    => '1.0.0',
				'navigation' => '${demo.navigation ?? 'sidebar'}',${themeConfig(demo)}
				'menu'       => array(
					'type'   => 'submenu',
					'parent' => 'options-general.php',
					'title'  => '${demo.title}',
				),
				'links'      => array(
					array( 'label' => 'Documentation', 'url' => 'https://example.com/docs', 'icon' => 'book-1', 'external' => true ),
					array( 'label' => 'Help & support', 'url' => 'https://example.com/help', 'icon' => 'message-question', 'external' => true ),
				),
			)
		);
		$fyldo->add_group( 'settings', 'Settings' );
		$fyldo->add_group( 'tools', 'Tools' );
		$fyldo->add_page( 'general', array_merge( require __DIR__ . '/page.php', array( 'group' => 'settings' ) ) );
		$fyldo->add_page( 'fields', array_merge( require __DIR__ . '/fields.php', array( 'group' => 'settings', 'badge' => 3 ) ) ); // M2: #/fields
		$fyldo->add_page( 'advanced', require __DIR__ . '/advanced.php' ); // M3: tabs, #/advanced/<tab>
		// Custom pages and forms: #/notes (list) and #/notes/<id> (a form whose records the plugin stores itself).
		( require __DIR__ . '/notes.php' )( $fyldo, '${demo.slug}', plugins_url( '', __FILE__ ) );
		// M4: notices for the Fyldo screen (drawn in Fyldo's own slot on the fields page, never with the core notice class).
		$fyldo->admin_notice(
			'A new version of ${demo.title} is available.',
			array(
				'tone'   => 'blue',
				'title'  => 'Update available',
				'page'   => 'fields',
				'action' => array( 'label' => 'View changelog', 'url' => 'https://example.com/changes', 'external' => true ),
			)
		);
		$fyldo->admin_notice( 'Your license expires in 7 days.', array( 'tone' => 'warning', 'page' => 'fields', 'id' => 'license' ) );
	}
);
`;
}

/** The `Version:` header of a fyldo.php. */
function headerVersion(file: string): string {
  const version = /^ \* Version:\s+(\S+)$/m.exec(readFileSync(file, 'utf8'))?.[1];
  if (!version) throw new Error(`No Version header in ${file}`);
  return version;
}

/** PHP's version_compare() (the Loader's), so N-1 is chosen exactly as the Loader orders copies. */
const PICK_PREVIOUS =
  '$c = $argv[1]; $best = ""; foreach (array_slice($argv, 2) as $t) { $v = substr($t, 1); ' +
  'if (version_compare($v, $c, "<") && ("" === $best || version_compare($v, substr($best, 1), ">"))) { $best = $t; } } echo $best;';

function upgradePluginFile(tag: string, from: string): string {
  return `<?php
/**
 * Plugin Name: Acme Upgrade (Fyldo e2e fixture)
 * Description: Generated by tools/fixtures/make-demos.ts for e2e/wp/upgrade.spec.ts. Bundles Fyldo ${from} (fyldo-old/, tag ${tag}) and the current tree (fyldo/); the option acme_upgrade_copy picks one.
 * Version: 1.0.0
 */

defined( 'ABSPATH' ) || exit;

/** 'old' (default): this plugin's release 1.0.0 on Fyldo ${from}. 'new': its release 1.1.0 on the current Fyldo. */
function acme_upgrade_is_new() {
	return 'new' === get_option( 'acme_upgrade_copy', 'old' );
}

require_once __DIR__ . ( acme_upgrade_is_new() ? '/fyldo/fyldo.php' : '/fyldo-old/fyldo.php' );

add_action(
	'init',
	static function () {
		$new   = acme_upgrade_is_new();
		$fyldo = \\Fyldo\\V1\\Fyldo::create(
			'acme-upgrade',
			array(
				'title'   => 'Acme Upgrade',
				'version' => $new ? '1.1.0' : '1.0.0',
				'menu'    => array(
					'type'   => 'submenu',
					'parent' => 'options-general.php',
					'title'  => 'Acme Upgrade',
				),
			)
		);

		// Before add_page(): \`upgraded\` fires inside it. Every call is recorded for the spec.
		add_action(
			'fyldo/acme-upgrade/upgraded',
			static function ( $page_id, $from, $to ) {
				$log   = (array) get_option( 'acme_upgrade_log', array() );
				$log[] = array( $page_id, $from, $to );
				update_option( 'acme_upgrade_log', $log, false );
			},
			10,
			3
		);

		// The one default release 1.1.0 changed (grid → list). A site that never saved it keeps grid.
		$layout = array(
			'id'      => 'layout',
			'type'    => 'select',
			'label'   => 'Layout',
			'default' => 'grid',
			'options' => array(
				'grid' => 'Grid',
				'list' => 'List',
			),
		);
		if ( $new ) {
			$layout['default']        = 'list';
			$layout['default_before'] = array( '1.1.0' => 'grid' );
		}

		// Only API that both copies accept.
		$fyldo->add_page(
			'settings',
			array(
				'title'    => 'Settings',
				'sections' => array(
					array(
						'id'     => 'main',
						'title'  => 'Main',
						'fields' => array(
							array( 'id' => 'headline', 'type' => 'text', 'label' => 'Headline', 'default' => 'Hello' ),
							array( 'id' => 'count', 'type' => 'number', 'label' => 'Count', 'default' => 5 ),
							array( 'id' => 'enabled', 'type' => 'toggle', 'label' => 'Enabled', 'default' => false ),
							$layout,
							array( 'id' => 'launch', 'type' => 'date', 'label' => 'Launch date', 'calendar' => 'gregorian' ),
							array(
								'id'         => 'buttons',
								'type'       => 'group',
								'label'      => 'Buttons',
								'item_title' => 'label',
								'addable'    => true,
								'fields'     => array(
									array( 'id' => 'label', 'type' => 'text', 'label' => 'Label' ),
								),
							),
						),
					),
				),
			)
		);
	}
);
`;
}

/**
 * The upgrade fixture (e2e/wp/upgrade.spec.ts), N-1 → N. `acme-upgrade` bundles the newest released 1.x tag lower
 * than fyldo.php in `fyldo-old/` (its `git archive`: a release tag points at the release commit, with assets/dist and
 * languages) and the current tree in `fyldo/`; the option `acme_upgrade_copy` ('old' | 'new') picks the one it loads.
 * The highest copy wins site-wide, so the old tree sits in this plugin only: .wp-env.json maps it without activating
 * it, and the spec runs it with the shared demos deactivated.
 */
function makeUpgradeFixture(plugins: string): void {
  const current = headerVersion(resolve(root, 'fyldo.php'));
  const tags = execFileSync('git', ['tag', '-l', 'v1.*'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((tag) => /^v1\.[0-9A-Za-z.+-]+$/.test(tag));
  const tag = execFileSync('php', ['-r', PICK_PREVIOUS, '--', current, ...tags], { encoding: 'utf8' }).trim();
  if (!tag) throw new Error(`No v1.* tag lower than ${current}. Fetch the tags (git fetch --tags; in CI actions/checkout with fetch-depth: 0).`);

  const dir = resolve(plugins, 'acme-upgrade');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  copyRuntime(resolve(dir, 'fyldo'));

  const old = resolve(dir, 'fyldo-old');
  const archive = resolve(out, 'acme-upgrade-old.tar');
  mkdirSync(old, { recursive: true });
  execFileSync('git', ['archive', '--format=tar', '-o', archive, tag], { cwd: root });
  execFileSync('tar', ['-x', '-f', archive, '-C', old]);
  rmSync(archive);
  if (!existsSync(resolve(old, 'assets/dist/app.js'))) throw new Error(`${tag} is not a release commit (no assets/dist).`);

  const from = headerVersion(resolve(old, 'fyldo.php'));
  writeFileSync(resolve(dir, 'acme-upgrade.php'), upgradePluginFile(tag, from));
  writeFileSync(resolve(out, 'upgrade.json'), JSON.stringify({ tag, from, to: current }, null, 2) + '\n');
  console.log(`fixtures: acme-upgrade bundles Fyldo ${from} (${tag}) and ${current}`);
}

export function makeDemos(): void {
  const plugins = resolve(out, 'plugins');
  mkdirSync(plugins, { recursive: true });

  for (const demo of DEMOS) {
    const dir = resolve(plugins, demo.slug);
    // Empty the plugin directory but keep the directory itself: wp-env mounts it by path.
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    cpSync(resolve(root, 'tests/fixtures/slice-page.php'), resolve(dir, 'page.php'));
    cpSync(resolve(root, 'tests/fixtures/form-fields-page.php'), resolve(dir, 'fields.php'));
    cpSync(resolve(root, 'tests/fixtures/tabs-page.php'), resolve(dir, 'advanced.php'));
    // The custom field of the fields page loads the demo's module and stylesheet from the plugin's own folder.
    for (const file of ['working-hours.js', 'working-hours.css']) cpSync(resolve(root, 'demo/custom', file), resolve(dir, file));
    // The custom page's PHP (page, form, list route) and its module.
    cpSync(resolve(root, 'tests/fixtures/notes-page.php'), resolve(dir, 'notes.php'));
    cpSync(resolve(root, 'tests/fixtures/notes-page.js'), resolve(dir, 'notes.js'));

    if (demo.kind === 'strauss') {
      strauss(dir, demo.fyldoVersion);
      writeFileSync(resolve(dir, `${demo.slug}.php`), pluginFile(demo, 'Omega\\Vendor\\Fyldo\\V1', "require_once __DIR__ . '/vendor-prefixed/autoload.php';"));
      continue;
    }

    const copy = resolve(dir, 'fyldo');
    copyRuntime(copy);
    setVersion(copy, demo.fyldoVersion);
    if (demo.kind === 'v2') toSyntheticV2(copy);

    writeFileSync(
      resolve(dir, `${demo.slug}.php`),
      pluginFile(demo, demo.kind === 'v2' ? 'Fyldo\\V2' : 'Fyldo\\V1', "require_once __DIR__ . '/fyldo/fyldo.php';"),
    );
  }

  writeFileSync(resolve(out, 'manifest.json'), JSON.stringify(DEMOS, null, 2) + '\n');
  console.log(`fixtures: ${DEMOS.length} demo plugins in e2e/.generated/plugins`);

  makeUpgradeFixture(plugins);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) makeDemos();
