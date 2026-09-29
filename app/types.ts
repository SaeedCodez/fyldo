/** Shapes of the config PHP inlines (src/Assets/ClientConfig.php) — keep in sync. */

export interface RuleSet {
  required?: boolean;
  min_length?: number;
  max_length?: number;
  pattern?: string;
  schemes?: string[];
  email?: boolean;
  /** Implied by the `number` field: the value must be a number. */
  number?: boolean;
  allowed?: string[];
  min?: number;
  max?: number;
  step?: number;
}

export type FieldValue = string | boolean | string[] | number | null;

/** Fields that own a value. A `notice` does not: it is display only. */
interface FieldBase {
  id: string;
  label: string;
  description: string;
  default: FieldValue;
  /** `true`, or a string explaining why the field is disabled. */
  disabled: boolean | string;
  layout: 'inline' | 'stacked';
  validate: RuleSet;
  icon?: string;
  badge?: string;
}

export interface TextFieldDef extends FieldBase {
  type: 'text' | 'url' | 'email';
  placeholder: string;
}

export interface NumberFieldDef extends FieldBase {
  type: 'number';
  placeholder: string;
}

/** Write-only: the value the browser holds is `null` (one is set, leave it), `''` (none / cleared) or the new text. */
export interface PasswordFieldDef extends FieldBase {
  type: 'password';
  placeholder: string;
  autocomplete: 'new-password' | 'current-password' | 'off';
}

export type NoticeTone = 'gray' | 'blue' | 'green' | 'amber' | 'red';

/** Display only: no value, never in the REST payload, cannot be disabled or validated. `label` is the optional title, `description` the message. */
export interface NoticeFieldDef {
  id: string;
  type: 'notice';
  label: string;
  description: string;
  tone: NoticeTone;
}

export interface ToggleFieldDef extends FieldBase {
  type: 'toggle';
}

export interface SelectOptionDef {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: string;
}

export interface SelectFieldDef extends FieldBase {
  type: 'select';
  placeholder: string;
  searchable: boolean;
  options: SelectOptionDef[];
}

export interface MultiSelectFieldDef extends FieldBase {
  type: 'multi_select';
  placeholder: string;
  /** The search row in the popup. */
  searchable: boolean;
  /** The Clear button in the field. */
  clearable: boolean;
  options: SelectOptionDef[];
}

export interface TextareaFieldDef extends FieldBase {
  type: 'textarea';
  placeholder: string;
  rows: number;
  resize: 'vertical' | 'none';
}

export interface CheckboxFieldDef extends FieldBase {
  type: 'checkbox';
}

export interface ChoiceOptionDef {
  value: string;
  label: string;
  disabled: boolean;
  description?: string;
}

export interface CheckboxGroupFieldDef extends FieldBase {
  type: 'checkbox_group';
  /** Label of the "all" checkbox; empty = none. */
  parent: string;
  options: ChoiceOptionDef[];
}

export interface RadioFieldDef extends FieldBase {
  type: 'radio';
  options: ChoiceOptionDef[];
}

export type ValueFieldDef =
  | TextFieldDef
  | NumberFieldDef
  | PasswordFieldDef
  | TextareaFieldDef
  | ToggleFieldDef
  | CheckboxFieldDef
  | CheckboxGroupFieldDef
  | RadioFieldDef
  | SelectFieldDef
  | MultiSelectFieldDef;

export type FieldDef = ValueFieldDef | NoticeFieldDef;

/** Type guard: fields that hold a value (everything except a `notice`). */
export const isValueField = (field: FieldDef): field is ValueFieldDef => field.type !== 'notice';

export interface SectionDef {
  id: string;
  tab: string;
  title: string;
  description: string;
  tone: 'default' | 'danger';
  fields: FieldDef[];
  action?: Record<string, unknown>;
}

export interface PageDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  group: string;
  save: 'global' | 'section';
  tabs: { id: string; label: string }[];
  sections: SectionDef[];
  values: Record<string, FieldValue>;
  revision: string;
}

export interface LinkDef {
  label: string;
  url: string;
  icon: string;
  external: boolean;
  placement: string;
}

export interface JedLocaleData {
  locale_data: { messages: Record<string, string[] | Record<string, string>> };
}

export interface FyldoConfig {
  slug: string;
  title: string;
  version: string;
  fyldoVersion: string;
  navigation: 'sidebar' | 'top';
  groups: { id: string; label: string }[];
  links: LinkDef[];
  pages: PageDef[];
  dir: 'ltr' | 'rtl';
  locale: string;
  rootId: string;
  rest: { root: string; nonce: string; instanceNonce: string; nonceHeader: string };
  i18n: JedLocaleData | null;
}
