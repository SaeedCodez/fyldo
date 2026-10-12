/**
 * `custom` fields: the developer's own ES module draws the control (docs/custom-fields.md). Every module named in the
 * config is imported before the first render (like the icons), so no field pops in and nothing is written to `window`:
 * the module gets React and a few Fyldo components from its default export's argument instead of from globals.
 */
import * as React from 'react';
import type { ComponentType } from 'react';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { NumberInput } from '../components/ui/number-input';
import { Select } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Toggle } from '../components/ui/toggle';
import { Icon } from '../icons/Icon';
import type { CustomFieldDef, FieldDef, FyldoConfig, JsonValue } from '../types';

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

/** What a module's default export receives when it is a function. Version 1 never loses a member. */
export const customFieldApi = {
  version: 1,
  React,
  ui: { Button, Checkbox, Icon, Input, NumberInput, Select, Textarea, Toggle },
} as const;

export type CustomFieldApi = typeof customFieldApi;

/** A module's default export: the definition, or a function of the API that returns it. */
export type CustomFieldExport = CustomFieldDefinition | ((api: CustomFieldApi) => CustomFieldDefinition);

type Entry = { definition: CustomFieldDefinition } | { error: string };

const entries = new Map<string, Entry>();

function resolve(exported: unknown): Entry {
  let definition: unknown;
  try {
    definition = typeof exported === 'function' ? (exported as (api: CustomFieldApi) => unknown)(customFieldApi) : exported;
  } catch (e) {
    return { error: `its default export threw: ${String(e)}` };
  }
  const candidate = definition as CustomFieldDefinition | null;
  if (!candidate || typeof candidate !== 'object' || (typeof candidate.Component !== 'function' && typeof candidate.mount !== 'function')) {
    return { error: 'its default export gives neither a `Component` nor a `mount` function' };
  }
  return { definition: candidate };
}

/** Use `exported` for the fields whose `module` is `url` (the loader does this; tests too). */
export function defineCustomField(url: string, exported: unknown): void {
  const entry = resolve(exported);
  if ('error' in entry) console.error(`Fyldo: custom field module "${url}" is not usable: ${entry.error}.`);
  entries.set(url, entry);
}

/** The definition for a module URL; null when it could not be loaded or used (the field says so). */
export const customDefinition = (url: string): CustomFieldDefinition | null => {
  const entry = entries.get(url);
  return entry && 'definition' in entry ? entry.definition : null;
};

/** Every `module` named in the config: fields, and the sub-fields of groups. */
export function collectCustomModules(config: Pick<FyldoConfig, 'pages'>): string[] {
  const urls = new Set<string>();
  const visit = (field: FieldDef): void => {
    if (field.type === 'custom') urls.add(field.module);
    if (field.type === 'group') field.fields.forEach(visit);
  };
  config.pages.forEach((page) => page.sections.forEach((section) => section.fields.forEach(visit)));
  return [...urls];
}

/** Import every module in parallel. Never rejects: a module that fails is reported and its fields say so. */
export async function loadCustomFields(urls: string[]): Promise<void> {
  await Promise.all(
    urls.map(async (url) => {
      try {
        const module = (await import(/* @vite-ignore */ url)) as { default?: unknown };
        defineCustomField(url, module.default);
      } catch (e) {
        console.error(`Fyldo: custom field module "${url}" could not be loaded.`, e);
        entries.set(url, { error: String(e) });
      }
    }),
  );
}

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
