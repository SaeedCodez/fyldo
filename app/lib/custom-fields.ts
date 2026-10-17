/**
 * `custom` fields: the developer's own ES module draws the control (docs/custom-fields.md). Every module named in the
 * config is imported before the first render (app/lib/modules.ts); the module gets the SDK (app/lib/sdk.ts).
 */
import type { ComponentType } from 'react';
import { isSettingsPage, type CustomFieldDef, type FieldDef, type FyldoConfig, type JsonValue } from '../types';
import { createModuleRegistry } from './modules';
import type { FyldoSdk } from './sdk';

/** What the control gets, in React (`Component` props) and in plain DOM (`mount` / `update`). */
export interface CustomFieldProps {
  value: JsonValue;
  /** Any JSON value; it is what the Save Bar saves. */
  onChange: (value: JsonValue) => void;
  /** Call when focus leaves the control: the field is validated then, like every other field. */
  onBlur: () => void;
  disabled: boolean;
  /** The field shows an error under the control. */
  invalid: boolean;
  /** Id of the row's title: put it in `aria-labelledby` of the control (or of a `role="group"` around several). */
  labelledBy: string;
  /** Ids of the row's description and disabled reason, for `aria-describedby`; undefined when there is none. */
  describedBy?: string;
  /** The field's `props` from PHP. */
  props: Record<string, JsonValue>;
  field: { id: string; label: string; description: string };
  /** The page's locale (`fa_IR`…). The direction is the one of the page: `element.closest('[dir]')`. */
  locale: string;
  /**
   * The current values of the fields named in PHP's `watch`, keyed by id, with the person's edits as they happen (a live
   * preview). Read-only: `{}` when the field watches nothing. The object is new only when one of them changes.
   */
  values: Readonly<Record<string, JsonValue>>;
}

export interface CustomFieldMountHandle {
  /** New props (value, disabled, invalid…) after a change. */
  update?: (props: CustomFieldProps) => void;
  /** The field leaves the screen (another page or tab). */
  destroy?: () => void;
}

export interface CustomFieldDefinition {
  /** A React component, rendered with Fyldo's own React (hooks work; never bundle a second React). */
  Component?: ComponentType<CustomFieldProps>;
  /** Plain DOM, or any framework: draw into `element`. Used when there is no `Component`. */
  mount?: (element: HTMLElement, props: CustomFieldProps) => CustomFieldMountHandle | void;
  /** Instant feedback on blur and save; the server (`validate_cb`) still decides. A message, or null when valid. */
  validate?: (value: JsonValue, props: Record<string, JsonValue>) => string | null | undefined;
}

/** What a module's default export receives when it is a function: the SDK (fields and pages share it). */
export { sdk as customFieldApi } from './sdk';

export type CustomFieldApi = FyldoSdk;

/** A module's default export: the definition, or a function of the API that returns it. */
export type CustomFieldExport = CustomFieldDefinition | ((api: CustomFieldApi) => CustomFieldDefinition);

const registry = createModuleRegistry<CustomFieldDefinition>('custom field');

/** Use `exported` for the fields whose `module` is `url` (the loader does this; tests too). */
export const defineCustomField = (url: string, exported: unknown): void => registry.define(url, exported);

/** The definition for a module URL; null when it could not be loaded or used (the field says so). */
export const customDefinition = (url: string): CustomFieldDefinition | null => registry.get(url);

/** Every `module` named in the config: fields of settings pages and of forms, and the sub-fields of groups. */
export function collectCustomModules(config: Pick<FyldoConfig, 'pages' | 'forms'>): string[] {
  const urls = new Set<string>();
  const visit = (field: FieldDef): void => {
    if (field.type === 'custom' && field.module !== '') urls.add(field.module);
    if (field.type === 'group') field.fields.forEach(visit);
  };
  const forms = [...config.pages.filter(isSettingsPage), ...(config.forms ?? [])];
  forms.forEach((form) => form.sections.forEach((section) => section.fields.forEach(visit)));
  return [...urls];
}

/** Import every module in parallel. Never rejects: a module that fails is reported and its fields say so. */
export const loadCustomFields = (urls: string[]): Promise<void> => registry.load(urls);

/** The module's own check of a value (after the declarative rules); null when it has none or the value passes. */
export function customError(field: CustomFieldDef, value: unknown): string | null {
  const validate = customDefinition(field.module)?.validate;
  if (!validate) return null;
  try {
    const message = validate(value as JsonValue, field.props);
    return typeof message === 'string' && message !== '' ? message : null;
  } catch (e) {
    console.error(`Fyldo: the validate() of custom field "${field.id}" threw.`, e);
    return null;
  }
}
