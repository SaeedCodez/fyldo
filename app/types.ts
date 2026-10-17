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
  /** Implied by the `color` field: the value must be `#rrggbb`. */
  color?: boolean;
  /** Implied by the `image` and `file` fields: the value is an attachment ID, a whole number of 0 or more (0 = nothing chosen). */
  media?: boolean;
  /** Implied by the `post`, `term` and `user` fields: the value is an ID (0 = nothing chosen), or with `multiple` a list of IDs. */
  relation?: boolean;
  /** Implied by the `date` field: the value is a real day, `Y-m-d`; `min` / `max` are days or `today`. */
  date?: true | MomentRule;
  /** Implied by the `time` field: the value is `H:i` (00:00–23:59); `step` is minutes. */
  time?: true | MomentRule;
  /** Implied by the `datetime` field: the value is `Y-m-d H:i:s` in UTC; `min` / `max` are datetimes or `now`; `step` counts site-time minutes. */
  datetime?: true | MomentRule;
  allowed?: string[];
  min?: number;
  max?: number;
  step?: number;
}

/** The bounds and minute step of a `date`, `time` or `datetime` field, in the stored format (or `today` / `now`). */
export interface MomentRule {
  min?: string;
  max?: string;
  /** Minutes (time, datetime); 1 when absent. */
  step?: number;
  /** A range field (`date_range`, `time_range`, `datetime_range`): the value is a `DateRangeValue`, each end checked. */
  range?: boolean;
}

/** The value of a range field: both ends in the single type's stored format; nothing = both ''. */
// A type, not an interface: it must fit `JsonValue` (a field value).
export type DateRangeValue = {
  start: string;
  end: string;
};

/** One item of a `group` field: the values of its sub-fields, keyed by sub-field id. */
export interface GroupItemValue {
  [subFieldId: string]: FieldValue;
}

/** What a `custom` field may hold: any JSON value (PHP cleans it, src/Fields/CustomField.php). */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type FieldValue = string | boolean | string[] | number | null | GroupItemValue[] | JsonValue;

/** Fields that own a value. A `notice` does not: it is display only. */
interface FieldBase {
  id: string;
  label: string;
  description: string;
  default: FieldValue;
  /** `true`, or a string explaining why the field is disabled. */
  disabled: boolean | string;
  layout: 'inline' | 'stacked' | 'field';
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

export interface ChoiceCardOptionDef {
  value: string;
  label: string;
  disabled: boolean;
  description?: string;
  /** Already sanitized by PHP (http(s) URL or a `/path`); absent when the cards show text only. */
  image?: string;
}

export interface ChoiceFieldDef extends FieldBase {
  type: 'choice';
  options: ChoiceCardOptionDef[];
  /** Resolved by PHP: `image_text` (image + label + description), `image` (image only) or `text`. */
  content: 'image_text' | 'image' | 'text';
  columns: 2 | 3 | 4;
}

export interface SegmentedFieldDef extends FieldBase {
  type: 'segmented';
  options: SelectOptionDef[];
}

export interface SliderFieldDef extends FieldBase {
  type: 'slider';
  min: number;
  max: number;
  step: number;
}

export interface ColorFieldDef extends FieldBase {
  type: 'color';
  /** Hex list in the panel; `false` hides the section. */
  presets: string[] | false;
}

export interface IconFieldDef extends FieldBase {
  type: 'icon';
  /** The icon names the picker offers and the server accepts; `null` = every Iconsax icon. */
  icons: string[] | null;
}

/**
 * `date` (`Y-m-d`), `time` (`H:i`, 24-hour) or `datetime` (`Y-m-d H:i:s` in UTC); '' = nothing. Always Gregorian: the
 * Jalali calendar is only drawn. `min`, `max` and `step` are in `validate` (the `date` / `time` / `datetime` rule).
 */
export interface DateTimeFieldDef extends FieldBase {
  type: 'date' | 'time' | 'datetime';
  /** `auto`: the site's calendar first, with the switch; a locked calendar has no switch. Time fields have none. */
  calendar: 'auto' | 'jalali' | 'gregorian';
  placeholder: string;
}

/**
 * `date_range`, `time_range` or `datetime_range`: a `DateRangeValue`, each end like the single type's value. `min`, `max`
 * and `step` (both ends) are in `validate` (the `date` / `time` / `datetime` rule, with `range` on).
 */
export interface DateRangeFieldDef extends FieldBase {
  type: 'date_range' | 'time_range' | 'datetime_range';
  calendar: 'auto' | 'jalali' | 'gregorian';
  placeholder: string;
  start_placeholder: string;
  end_placeholder: string;
}

/** What the browser draws for a saved attachment (PHP: AbstractMediaField::media). The name, size and type come from the attachment, never from its URL. */
export interface MediaItem {
  id: number;
  filename: string;
  /** Bytes; 0 = unknown. */
  filesize: number;
  mime: string;
  /** Lower case, without the dot. */
  extension: string;
  width: number | null;
  height: number | null;
  /** An image field's thumbnail; null for a file or an image without one. */
  thumbnail: string | null;
}

/** One post, term or user as a relation field draws it (PHP: src/Support/Relations.php). */
export interface RelationItem {
  value: number;
  label: string;
  /** Tells equal titles apart (the post type or taxonomy, a user's login); '' = none. */
  hint: string;
}

/**
 * What the page draws for the IDs it stores, keyed by field id: a media field's attachment (`null` = nothing chosen), a
 * post, term or user field's items (in value order; empty = nothing chosen).
 */
export type MediaMap = Record<string, MediaItem | RelationItem[] | null>;

/** A media field's entry of the page's `media` (a relation field's list is not one). */
export const mediaItem = (entry: MediaItem | RelationItem[] | null | undefined): MediaItem | null => (entry && !Array.isArray(entry) ? entry : null);

interface MediaFieldBase extends FieldBase {
  /** The extensions the field is narrowed to; `null` = every image (`image`) or every type WordPress allows (`file`). */
  types: string[] | null;
  /** The MIME types of `types`, for the media library's filter and the check on choosing. */
  mimes: string[] | null;
  /** Largest file in bytes; `null` = no limit. */
  max_size: number | null;
}

/** The value is the attachment ID (0 = none). */
export interface ImageFieldDef extends MediaFieldBase {
  type: 'image';
}

export interface FileFieldDef extends MediaFieldBase {
  type: 'file';
}

/**
 * Picks posts (`post`), terms (`term`) or users (`user`) found by searching on the server
 * (`…/pages/{page}/fields/{field}/items`). The value is the item's ID (0 = none), or with `multiple` a list of IDs in pick order.
 */
export interface RelationFieldDef extends FieldBase {
  type: 'post' | 'term' | 'user';
  multiple: boolean;
  placeholder: string;
}

/**
 * Drawn by the developer's own ES module (`module`, loaded before the first render: app/lib/custom-fields.ts). The row's
 * title names the control as a group: the module gets its ids to put on its control(s).
 */
export interface CustomFieldDef extends FieldBase {
  type: 'custom';
  /** '' (`'module' => false` in PHP): a form's field that the page draws itself (`useForm`); Fyldo draws nothing for it. */
  module: string;
  /** Fields of the same page whose current values the module gets as `values` (a live preview); absent = none. */
  watch?: string[];
  /** Passed to the module as they are (translated labels, option lists…). */
  props: Record<string, JsonValue>;
}

/** The fields a group item can hold: every value field except another group, media and password fields. */
export type SubFieldDef = Exclude<ValueFieldDef, GroupFieldDef | ImageFieldDef | FileFieldDef | PasswordFieldDef>;

/**
 * A list of items that share the same sub-fields. The value is `GroupItemValue[]`; the errors of a sub-field are keyed
 * `<group>.<index>.<sub-field>` (index from 0), the group's own (count) error by its id.
 */
export interface GroupFieldDef extends FieldBase {
  type: 'group';
  fields: SubFieldDef[];
  /** Sub-field whose value names an item in its header; '' = "Item 1", "Item 2"… */
  item_title: string;
  /** `icon` sub-field shown as the item's preview tile; '' = none. */
  item_icon: string;
  /** Drag handles (and keyboard reordering). */
  sortable: boolean;
  /** Add, Duplicate and Remove. Off: the items are the ones of `default`. */
  addable: boolean;
  min: number | null;
  max: number | null;
  /** The Add button's label; '' = "Add item" (translated). */
  add_label: string;
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
  | ChoiceFieldDef
  | SegmentedFieldDef
  | SliderFieldDef
  | ColorFieldDef
  | IconFieldDef
  | DateTimeFieldDef
  | DateRangeFieldDef
  | ImageFieldDef
  | FileFieldDef
  | SelectFieldDef
  | MultiSelectFieldDef
  | RelationFieldDef
  | CustomFieldDef
  | GroupFieldDef;

export type FieldDef = ValueFieldDef | NoticeFieldDef;

/** Type guard: fields that hold a value (everything except a `notice`). */
export const isValueField = (field: FieldDef): field is ValueFieldDef => field.type !== 'notice';

/** A Danger Section Card's action: `reset` restores the page's defaults. Empty texts are filled in by the browser (translated). */
export interface DangerActionDef {
  id: 'reset';
  label: string;
  confirm: {
    title: string;
    description: string;
    /** Typed confirmation for high-impact actions; '' = none. Checked again by the server. */
    keyword: string;
    /** The confirm button's label; '' = the action's label. */
    label: string;
  };
}

export interface SectionDef {
  id: string;
  tab: string;
  title: string;
  description: string;
  tone: 'default' | 'danger';
  fields: FieldDef[];
  action?: DangerActionDef;
}

/** A sub-page of a page, reached at `#/<page>/<tab>`. */
export interface TabDef {
  id: string;
  label: string;
  /** Iconsax name, or '' for none. */
  icon: string;
  /** Count badge text, or '' for none. */
  badge: string;
}

/** A settings page: Fyldo draws its sections and saves its values. `type` is absent in configs from before custom pages. */
export interface PageDef {
  type?: 'settings';
  id: string;
  title: string;
  description: string;
  icon: string;
  group: string;
  /** Nav Item badge ("needs attention"), or '' for none. */
  badge: string;
  save: 'global' | 'section';
  tabs: TabDef[];
  sections: SectionDef[];
  values: Record<string, FieldValue>;
  /** The saved attachments of the page's `image` and `file` fields and the saved items of its `post`, `term` and `user` fields; absent when it has none. */
  media?: MediaMap;
  revision: string;
}

/**
 * A page the plugin draws itself (a list of records, a record editor, a dashboard): its own ES module (`module`, loaded
 * before the first render: app/lib/custom-pages.ts), inside Fyldo's content column. It reaches `#/<page>/<path…>`.
 */
export interface CustomPageDef {
  type: 'custom';
  id: string;
  title: string;
  description: string;
  icon: string;
  group: string;
  /** Nav Item badge, or '' for none. */
  badge: string;
  module: string;
  /** Passed to the module as they are (translated labels, URLs…). */
  props: Record<string, JsonValue>;
}

/** What `config.pages` holds, in registration order. */
export type AnyPageDef = PageDef | CustomPageDef;

export const isCustomPage = (page: AnyPageDef): page is CustomPageDef => page.type === 'custom';
export const isSettingsPage = (page: AnyPageDef): page is PageDef => page.type !== 'custom';

/**
 * Fields whose records the plugin stores (REST `…/forms/{form}/records/{key}`), drawn by `<Form>` (the SDK's `Form`) on
 * a custom page. Always saved as a whole, through the Save Bar.
 */
export interface FormDef {
  id: string;
  sections: SectionDef[];
}

export interface LinkDef {
  label: string;
  url: string;
  icon: string;
  external: boolean;
  /** `footer`: sidebar footer / top navigation utilities. `header`: Page Header actions. */
  placement: 'footer' | 'header';
}

/** A notice PHP queued with `Instance::admin_notice()`, drawn under the Page Header in Fyldo's own slot. */
export interface NoticeDef {
  id: string;
  tone: NoticeTone;
  title: string;
  message: string;
  dismissible: boolean;
  /** Page id it belongs to; '' = every page. */
  page: string;
  action: { label: string; url: string; external: boolean } | null;
}

export interface JedLocaleData {
  locale_data: { messages: Record<string, string[] | Record<string, string>> };
}

export interface FyldoConfig {
  slug: string;
  /** The brand name (PHP fills in "Fyldo", translated, when the developer gives none). */
  title: string;
  /** The brand logo: an Iconsax icon or an image URL; null = the Fyldo mark. */
  logo: { icon: string } | { url: string } | null;
  version: string;
  fyldoVersion: string;
  navigation: 'sidebar' | 'top';
  groups: { id: string; label: string }[];
  links: LinkDef[];
  notices: NoticeDef[];
  pages: AnyPageDef[];
  /** Absent in configs from before custom pages: none. */
  forms?: FormDef[];
  dir: 'ltr' | 'rtl';
  locale: string;
  rootId: string;
  rest: {
    /** The site's REST root (`rest_url()`): what a custom page's `request()` paths are relative to. Derived from `root` when absent. */
    base?: string;
    /** This instance's namespace (`…/wp-json/fyldo-<slug>/v1/`). */
    root: string;
    nonce: string;
    instanceNonce: string;
    nonceHeader: string;
    /** admin-ajax URL that hands out fresh nonces once these have expired. */
    refresh: string;
  };
  i18n: JedLocaleData | null;
  /** For the `date`, `time` and `datetime` fields: the site's time zone (wp_timezone_string()), "Week starts on" and calendar. */
  dates?: {
    timezone: string;
    startOfWeek: number;
    calendar: 'jalali' | 'gregorian';
  };
}
