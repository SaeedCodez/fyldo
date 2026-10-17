/**
 * npm run types → writes assets/dist/fyldo-sdk.d.ts, the SDK's types for modules written in TypeScript
 * (docs/custom-fields.md#typescript), then type-checks the sample modules in tests/types against it.
 *
 * One file bundled from app/sdk-types.ts. The components' props extend Base UI's, so Base UI's types (and clsx's) are
 * inlined; React's stay an import of 'react', which the consumer's `@types/react` resolves. Any other import would
 * not resolve in a plugin or theme, so it fails the build. Runs after `vite build`, which empties assets/dist.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDtsBundle } from 'dts-bundle-generator';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const target = resolve(root, 'assets/dist/fyldo-sdk.d.ts');
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  version: string;
};

const [bundle] = generateDtsBundle(
  [
    {
      filePath: resolve(root, 'app/sdk-types.ts'),
      libraries: {
        inlinedLibraries: ['@base-ui/react', '@base-ui/utils', 'clsx'],
        importedLibraries: ['react'],
      },
      output: { noBanner: true, exportReferencedTypes: false },
    },
  ],
  { preferredConfigPath: resolve(root, 'tsconfig.json') },
);
if (bundle === undefined) throw new Error('types: dts-bundle-generator returned nothing.');

const imports = [
  ...bundle.matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]|<reference types="([^"]+)"/g),
].map((m) => m[1] ?? m[2]);
const foreign = [...new Set(imports.filter((specifier) => specifier !== 'react'))];
if (foreign.length > 0) {
  console.error(
    `types: fyldo-sdk.d.ts imports ${foreign.join(', ')}: a plugin cannot resolve it. Inline it in tools/types/build.ts.`,
  );
  process.exit(1);
}

const banner = `/**
 * Fyldo ${version}: types of the module SDK, for custom fields and custom pages written in TypeScript.
 * Generated from app/sdk-types.ts by \`npm run build\`; do not edit. Needs @types/react 19.
 * docs/custom-fields.md#typescript
 */
`;
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, banner + bundle);
console.log(`types: wrote assets/dist/fyldo-sdk.d.ts (${bundle.split('\n').length} lines).`);

// The sample modules see only the bundle and @types/react, like a plugin does.
execFileSync(
  resolve(root, 'node_modules/.bin/tsc'),
  ['-p', resolve(root, 'tests/types/tsconfig.json')],
  { stdio: 'inherit' },
);
console.log('types: tests/types type-check against it.');
