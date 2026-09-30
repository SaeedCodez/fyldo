/**
 * npm run release — builds the two release artifacts from the working tree (docs/ARCHITECTURE.md §5.1).
 *
 *   build/fyldo/       the drop-in folder: exactly the runtime tree, prebuilt assets included, no dev files
 *   build/fyldo.zip    the standalone plugin (Plugins → Add New → Upload); it unzips to fyldo/, the same folder
 *
 * Flags: --tag vX.Y.Z   fail unless the tag matches the version in fyldo.php (the release workflow passes it).
 * Needs node, php, wp-cli and gettext (`msgfmt`), like CI. Consumers never run this.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'build');
const folder = resolve(out, 'fyldo');
const zip = resolve(out, 'fyldo.zip');

/** The runtime tree. Everything else in the repository is development-only. Keep in sync with .gitattributes. */
export const RUNTIME = ['fyldo.php', 'composer.json', 'LICENSE', 'README.md', 'CHANGELOG.md', 'src', 'demo', 'assets/dist', 'languages'];

const run = (cmd: string, args: string[], cwd = root): void => {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
};

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

const fail = (message: string): never => {
  console.error(`\nrelease: ${message}`);
  process.exit(1);
};

/** The one version: the `Version:` header of fyldo.php (the file parses its own header for the Loader). */
export function readVersion(): string {
  const header = readFileSync(resolve(root, 'fyldo.php'), 'utf8').match(/^ \* Version:\s+(\S+)\s*$/m);
  return header?.[1] ?? fail('fyldo.php has no "Version:" header.');
}

function checkVersions(version: string): void {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version: string };
  if (pkg.version !== version) fail(`package.json is ${pkg.version} but fyldo.php is ${version}.`);
  // Composer takes the version from the git tag: a "version" key in composer.json would fight Packagist.
  const composer = JSON.parse(readFileSync(resolve(root, 'composer.json'), 'utf8')) as { version?: string };
  if (composer.version !== undefined) fail('composer.json must not declare "version" (Composer reads the git tag).');
  const tagIndex = process.argv.indexOf('--tag');
  const tag = tagIndex > -1 ? process.argv[tagIndex + 1] : undefined;
  if (tagIndex > -1 && tag !== `v${version}`) fail(`tag ${tag ?? '(missing)'} does not match fyldo.php ${version} (expected v${version}).`);
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) fail(`"${version}" is not a semantic version.`);
  if (!new RegExp(`^## \\[?${version.replaceAll('.', '\\.')}\\]?`, 'm').test(readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8'))) {
    fail(`CHANGELOG.md has no entry for ${version}.`);
  }
}

/** The assembled folder must be the runtime tree and nothing else. */
function verifyFolder(): void {
  const top = readdirSync(folder).sort();
  const expected = [...new Set(RUNTIME.map((entry) => entry.split('/')[0]))].sort();
  if (JSON.stringify(top) !== JSON.stringify(expected)) fail(`unexpected top-level entries: ${top.join(', ')} (expected ${expected.join(', ')}).`);

  const dev = /(\.(tsx?|map|log)$|^\.|node_modules|\.generated\.)/;
  const files = [...walk(folder)].map((f) => relative(folder, f));
  const stray = files.filter((f) => f.split('/').some((part) => dev.test(part)));
  if (stray.length > 0) fail(`dev files in the release tree:\n  ${stray.join('\n  ')}`);

  for (const required of ['assets/dist/boot.js', 'assets/dist/app.js', 'assets/dist/app.css', 'languages/fyldo-fa_IR.mo', 'languages/fyldo-fa_IR.json']) {
    if (!existsSync(resolve(folder, required))) fail(`the release tree lacks ${required}.`);
  }
  const php = files.filter((f) => f.endsWith('.php'));
  for (const file of php) execFileSync('php', ['-l', join(folder, file)], { stdio: 'pipe' });
  console.log(`\nrelease: php -l ok on ${php.length} files`);
  console.log(`\nrelease: ${files.length} files, all runtime.`);
}

function main(): void {
  const version = readVersion();
  checkVersions(version);
  console.log(`Fyldo ${version}`);

  run('npm', ['run', 'tokens:check']);
  run('npm', ['run', 'build']);
  run('npm', ['run', 'i18n']);
  run('npm', ['run', 'size']);

  rmSync(out, { recursive: true, force: true });
  mkdirSync(folder, { recursive: true });
  for (const entry of RUNTIME) {
    const from = resolve(root, entry);
    if (!existsSync(from)) fail(`missing ${entry}.`);
    cpSync(from, resolve(folder, entry), { recursive: true });
  }
  verifyFolder();

  // -X: no extra file attributes, so the ZIP does not depend on who built it.
  run('zip', ['-X', '-q', '-r', zip, 'fyldo'], out);
  console.log(`\nrelease: ${relative(root, folder)}/ (drop-in) and ${relative(root, zip)} (plugin) for ${version}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
