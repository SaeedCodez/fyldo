/** Shapes of the config PHP inlines (src/Assets/ClientConfig.php) — keep in sync. */

export interface RuleSet {
  required?: boolean;
  min_length?: number;
  max_length?: number;
  pattern?: string;
  schemes?: string[];
  email?: boolean;
  allowed?: string[];
  min?: number;
  max?: number;
}

export type FieldValue = string | boolean | string[] | number | null;

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

export type FieldDef = TextFieldDef | TextareaFieldDef | ToggleFieldDef | CheckboxFieldDef | CheckboxGroupFieldDef | RadioFieldDef | SelectFieldDef;

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
