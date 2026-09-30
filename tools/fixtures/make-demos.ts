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
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'e2e/.generated');
const RUNTIME = ['fyldo.php', 'composer.json', 'LICENSE', 'src', 'assets/dist', 'languages'];
const STRAUSS_VERSION = '0.30.0';

type Kind = 'v1' | 'v2' | 'strauss';
interface Demo {
  slug: string;
  title: string;
  fyldoVersion: string;
  kind: Kind;
  /** Layout of the settings screen (M3): the Sidebar (default) or the Top Navigation. */
  navigation?: 'sidebar' | 'top';
}

export const DEMOS: Demo[] = [
  { slug: 'acme-alpha', title: 'Acme Alpha', fyldoVersion: '1.0.0', kind: 'v1' },
  { slug: 'acme-beta', title: 'Acme Beta', fyldoVersion: '1.1.0', kind: 'v1' },
  { slug: 'acme-gamma', title: 'Acme Gamma', fyldoVersion: '1.1.0', kind: 'v1', navigation: 'top' },
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
				'navigation' => '${demo.navigation ?? 'sidebar'}',
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
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) makeDemos();
