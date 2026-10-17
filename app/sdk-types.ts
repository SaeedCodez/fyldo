/**
 * The public types of a developer's module (a custom field or a custom page): what its default export receives and
 * returns. `npm run types` bundles this entry into assets/dist/fyldo-sdk.d.ts (tools/types/build.ts), which ships in the
 * release, so a plugin or theme can write its modules in TypeScript (docs/custom-fields.md#typescript). Only React's
 * types stay an import (`@types/react` in the consumer); everything else is inlined. Add a type here only when it is
 * public API: v1 only ever grows.
 */
export type { FyldoSdk } from './lib/sdk';
export type {
  CustomFieldApi,
  CustomFieldDefinition,
  CustomFieldExport,
  CustomFieldMountHandle,
  CustomFieldProps,
} from './lib/custom-fields';
export type {
  CustomPageDefinition,
  CustomPageExport,
  CustomPageMountHandle,
  CustomPageProps,
} from './lib/custom-pages';
export type { JsonValue } from './types';
