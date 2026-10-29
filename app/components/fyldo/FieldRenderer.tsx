import type { ReactElement } from 'react';
import type { FocusEvent } from 'react';
import { __, formatNumber, sprintf } from '../../i18n';
import { mediaItem, type FieldDef, type FieldValue, type GroupItemValue, type MediaItem, type MediaMap, type RelationItem } from '../../types';
import { cn } from '../../lib/cn';
import { sanitizeMediaId } from '../../lib/wp-media';
import { useRelationSearch } from '../../lib/relation';
import { check, length } from '../../lib/validation';
import { Checkbox, CheckboxGroup } from '../ui/checkbox';
import { ColorPicker } from '../ui/color-picker';
import { DatePicker, TimePicker } from '../ui/date-picker';
import { DateRangePicker } from '../ui/date-range-field';
import { IconPicker } from '../ui/icon-picker';
import { Input } from '../ui/input';
import { MediaPicker } from '../ui/media-field';
import { MultiSelect } from '../ui/multi-select';
import { Notice } from '../ui/notice';
import { NumberInput } from '../ui/number-input';
import { PasswordInput } from '../ui/password-input';
import { ChoiceCards } from '../ui/choice-card';
import { CodeEditor } from '../ui/code-editor';
import { RadioGroup } from '../ui/radio';
import { RelationSelect } from '../ui/relation-select';
import { SegmentedControl } from '../ui/segmented-control';
import { Select } from '../ui/select';
import { Slider } from '../ui/slider';
import { Textarea, TextareaFooter } from '../ui/textarea';
import { Toggle } from '../ui/toggle';
import { CustomControl } from './CustomControl';
import { FieldGroup } from './FieldGroup';
import { SettingRow } from './SettingRow';

export interface FieldRendererProps {
  field: FieldDef;
  value: FieldValue;
  error?: string;
  divider: boolean;
  /**
   * `media`: the attachment a media field was set to (null when cleared), or the items behind a post, term or user field's
   * new value (their titles); the other fields never pass it.
   */
  onChange: (id: string, value: FieldValue, media?: MediaItem | RelationItem[] | null) => void;
  /** `only`: a group validates one sub-field on its blur (`<group>.<index>.<sub-field>`). */
  onBlur: (id: string, only?: string) => void;
  /** A group's change; `clear`: the error keys it makes stale (omitted = all of the group's). Default: `onChange`. */
  onGroupChange?: (id: string, value: GroupItemValue[], clear?: string[]) => void;
  /** The page's errors: a group shows its sub-fields' (keyed `<group>.<index>.<sub-field>`). */
  errors?: Record<string, string>;
  /** Changes when a save is refused for invalid values: a group then opens its first item with an error. */
  reveal?: number;
  /** `item`: a sub-field inside a Group Item (label → control → helper). */
  variant?: 'row' | 'item';
  /** A sub-field's error key, used as its `data-field-id` and name; default the field id. */
  fieldKey?: string;
  /** A sub-field of a disabled group (or one disabled itself). */
  forceDisabled?: boolean;
  /** What an `image` / `file` field draws for its saved attachment, a post, term or user field for its items (the page's `media[field.id]`). */
  media?: MediaMap[string];
  /** A field shows a message of its own (a chosen file that is the wrong type or too large); its value is left as it was. */
  onError?: (id: string, message: string) => void;
  /** The page's stored revision: a password shown in clear is hidden again when it changes (a successful save). */
  revision?: string;
  /** The page's locale: a Slider's value is written in its numerals (۷۵ in Persian). */
  locale?: string;
  /** A post, term or user field's search route: its id, or `<group>.<sub-field>` inside a group. Default: the field id. */
  searchPath?: string;
}

/** `onBlur` for a group: only when focus leaves the group, not when it moves between its options. */
const leavesGroup = (done: () => void) => (event: FocusEvent<HTMLElement>) => {
  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) done();
};

const list = (value: FieldValue): string[] => (Array.isArray(value) ? (value as unknown[]).filter((v): v is string => typeof v === 'string') : []);

/** Maps a PHP field `type` to its control inside a Setting Row. */
export function FieldRenderer({
  field,
  value,
  error,
  divider,
  onChange,
  onBlur,
  onGroupChange,
  errors,
  reveal = 0,
  variant = 'row',
  fieldKey,
  forceDisabled,
  media = null,
  onError,
  revision,
  locale = 'en',
  searchPath,
}: FieldRendererProps): ReactElement | null {
  const search = useRelationSearch();

  // Display only: no value, no label association, nothing to change, nothing to send.
  if (field.type === 'notice') {
    return (
      <div data-slot="fy-notice-row" data-field-id={field.id} className={cn('fy:py-5', divider && 'fy:border-b fy:border-border-default')}>
        <Notice tone={field.tone} title={field.label || undefined}>
          {field.description}
        </Notice>
      </div>
    );
  }

  const disabled = forceDisabled ?? field.disabled !== false;
  const reason = typeof field.disabled === 'string' ? field.disabled : undefined;
  const common = {
    title: field.label,
    description: field.description,
    disabledReason: reason,
    layout: field.layout,
    divider,
    error,
    disabled,
    name: fieldKey ?? field.id,
    fieldId: fieldKey ?? field.id,
    variant,
  } as const;

  switch (field.type) {
    case 'toggle':
      return (
        <SettingRow {...common}>
          <Toggle size="md" checked={value === true} onCheckedChange={(next) => onChange(field.id, next)} />
        </SettingRow>
      );

    case 'checkbox':
      return (
        <SettingRow {...common}>
          <Checkbox checked={value === true} onCheckedChange={(next) => onChange(field.id, next)} onBlur={() => onBlur(field.id)} />
        </SettingRow>
      );

    case 'checkbox_group':
      return (
        <SettingRow {...common} group>
          <CheckboxGroup
            options={field.options}
            parent={field.parent || undefined}
            value={list(value)}
            disabled={disabled}
            onValueChange={(next) => onChange(field.id, next)}
            onBlur={leavesGroup(() => onBlur(field.id))}
          />
        </SettingRow>
      );

    case 'radio':
      return (
        <SettingRow {...common} group>
          <RadioGroup
            options={field.options}
            value={typeof value === 'string' ? value : ''}
            disabled={disabled}
            onValueChange={(next) => onChange(field.id, next)}
            onBlur={leavesGroup(() => onBlur(field.id))}
          />
        </SettingRow>
      );

    case 'choice':
      return (
        <SettingRow {...common} group width="cards">
          <ChoiceCards
            options={field.options}
            content={field.content}
            columns={field.columns}
            value={typeof value === 'string' ? value : ''}
            disabled={disabled}
            onValueChange={(next) => onChange(field.id, next)}
            onBlur={leavesGroup(() => onBlur(field.id))}
          />
        </SettingRow>
      );

    case 'segmented':
      return (
        <SettingRow {...common} group>
          <SegmentedControl
            options={field.options}
            value={typeof value === 'string' ? value : ''}
            disabled={disabled}
            onValueChange={(next) => onChange(field.id, next)}
            onBlur={leavesGroup(() => onBlur(field.id))}
          />
        </SettingRow>
      );

    case 'slider':
      return (
        <SettingRow {...common}>
          <Slider
            size="md"
            min={field.min}
            max={field.max}
            step={field.step}
            // Not a number (a hand-edited option): park the thumb at the start; the first move writes a real value.
            value={typeof value === 'number' ? value : field.min}
            formatValue={(n) => formatNumber(n, locale)}
            showValue
            onValueChange={(next) => onChange(field.id, next)}
            onBlur={() => onBlur(field.id)}
          />
        </SettingRow>
      );

    case 'color':
      return (
        <SettingRow {...common}>
          <ColorPicker
            size="md"
            value={typeof value === 'string' ? value : ''}
            presets={field.presets}
            disabled={disabled}
            locale={locale}
            onValueChange={(next) => onChange(field.id, next)}
            onBlur={() => onBlur(field.id)}
          />
        </SettingRow>
      );

    case 'date':
    case 'datetime':
    case 'time': {
      // min / max / step live in the field's implied rule (src/Fields/AbstractDateTimeField.php).
      const rule = field.validate[field.type];
      const bounds = rule === true || rule === undefined ? {} : rule;
      const text = typeof value === 'string' ? value : '';
      return (
        <SettingRow {...common}>
          {field.type === 'time' ? (
            <TimePicker
              size="md"
              value={text}
              step={bounds.step}
              placeholder={field.placeholder}
              disabled={disabled}
              locale={locale}
              onValueChange={(next) => onChange(field.id, next)}
              onBlur={() => onBlur(field.id)}
            />
          ) : (
            <DatePicker
              size="md"
              kind={field.type}
              value={text}
              calendar={field.calendar}
              min={bounds.min}
              max={bounds.max}
              step={bounds.step}
              placeholder={field.placeholder}
              disabled={disabled}
              locale={locale}
              onValueChange={(next) => onChange(field.id, next)}
              onBlur={() => onBlur(field.id)}
            />
          )}
        </SettingRow>
      );
    }

    case 'date_range':
    case 'time_range':
    case 'datetime_range': {
      // The single type's rule with `range` on (src/Fields/AbstractDateRangeField.php); min / max / step apply to both ends.
      const kind = field.type === 'date_range' ? 'date' : field.type === 'time_range' ? 'time' : 'datetime';
      const rule = field.validate[kind];
      const bounds = rule === true || rule === undefined ? {} : rule;
      const pair = value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
      const range = { start: typeof pair.start === 'string' ? pair.start : '', end: typeof pair.end === 'string' ? pair.end : '' };
      // The end at fault is drawn in red: the one the failure names (the server's message has the same cause).
      const fault = error && check(field.validate, range)?.params.end === 'start' ? 'start' : 'end';
      return (
        <SettingRow {...common} group ownError width="range">
          <DateRangePicker
            size="md"
            kind={kind}
            value={range}
            calendar={field.calendar}
            min={bounds.min}
            max={bounds.max}
            step={bounds.step}
            placeholder={field.placeholder}
            startPlaceholder={field.start_placeholder}
            endPlaceholder={field.end_placeholder}
            disabled={disabled}
            error={error}
            invalid={fault}
            locale={locale}
            onValueChange={(next) => onChange(field.id, next)}
            onBlur={() => onBlur(field.id)}
          />
        </SettingRow>
      );
    }

    case 'icon':
      return (
        <SettingRow {...common}>
          <IconPicker
            size="md"
            value={typeof value === 'string' ? value : ''}
            icons={field.icons}
            disabled={disabled}
            locale={locale}
            onValueChange={(next) => onChange(field.id, next)}
            onBlur={() => onBlur(field.id)}
          />
        </SettingRow>
      );

    case 'image':
    case 'file':
      // A group: the title names it, the buttons inside name themselves (the field label is part of each name).
      return (
        <SettingRow {...common} group width="wide">
          <MediaPicker
            kind={field.type}
            label={field.label}
            value={sanitizeMediaId(value)}
            media={mediaItem(media)}
            mimes={field.mimes}
            maxSize={field.max_size}
            disabled={disabled}
            locale={locale}
            onValueChange={(id, item) => onChange(field.id, id, item)}
            onError={(message) => onError?.(field.id, message)}
            onBlur={() => onBlur(field.id)}
          />
        </SettingRow>
      );

    case 'code': {
      // A message at a line (`<field>.<line>`, CSS markup or the developer's validate_cb) reads "Line 3: …" and turns
      // the line red; a message about the whole code reads as it is.
      const atLines = Object.entries(errors ?? {})
        .map(([key, message]) => ({ line: key.startsWith(`${field.id}.`) ? Number(key.slice(field.id.length + 1)) : NaN, message }))
        .filter((entry) => Number.isInteger(entry.line) && entry.line > 0)
        .sort((a, b) => a.line - b.line);
      const first = atLines[0];
      const message = error ?? (first ? sprintf(__('Line %1$s: %2$s', 'fyldo'), formatNumber(first.line, locale), first.message) : undefined);
      return (
        <SettingRow {...common} error={message} width="full">
          <CodeEditor
            value={typeof value === 'string' ? value : ''}
            language={field.language}
            rows={field.rows}
            toolbar={field.toolbar}
            lineNumbers={field.line_numbers}
            invalidLines={atLines.map((entry) => entry.line)}
            disabled={disabled}
            onValueChange={(next) => onChange(field.id, next)}
            onBlur={() => onBlur(field.id)}
          />
        </SettingRow>
      );
    }

    case 'textarea': {
      const text = typeof value === 'string' ? value : '';
      return (
        <SettingRow {...common} width="wide" errorInControl>
          <Textarea
            value={text}
            placeholder={field.placeholder}
            rows={field.rows}
            resize={field.resize}
            onValueChange={(next) => onChange(field.id, next)}
            onBlur={() => onBlur(field.id)}
          />
          <TextareaFooter error={error} count={length(text)} limit={field.validate.max_length} />
        </SettingRow>
      );
    }

    case 'select':
      return (
        <SettingRow {...common}>
          <Select
            size="md"
            options={field.options}
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder}
            prefixIcon={field.icon}
            onValueChange={(next) => {
              onChange(field.id, next);
              onBlur(field.id);
            }}
          />
        </SettingRow>
      );

    case 'multi_select':
      return (
        <SettingRow {...common}>
          <MultiSelect
            size="md"
            options={field.options}
            value={list(value)}
            placeholder={field.placeholder}
            searchable={field.searchable}
            clearable={field.clearable}
            disabled={disabled}
            aria-label={field.label}
            onValueChange={(next) => onChange(field.id, next)}
            onBlur={() => onBlur(field.id)}
          />
        </SettingRow>
      );

    case 'post':
    case 'term':
    case 'user':
      return (
        <SettingRow {...common}>
          <RelationSelect
            size="md"
            value={typeof value === 'number' || Array.isArray(value) ? (value as number | number[]) : 0}
            multiple={field.multiple}
            known={Array.isArray(media) ? media : []}
            search={search}
            path={searchPath ?? field.id}
            placeholder={field.placeholder}
            disabled={disabled}
            aria-label={field.label}
            onValueChange={(next, items) => onChange(field.id, next, items)}
            onBlur={() => onBlur(field.id)}
          />
        </SettingRow>
      );

    case 'number':
      return (
        <SettingRow {...common}>
          <NumberInput
            size="md"
            value={typeof value === 'number' || typeof value === 'string' ? value : ''}
            placeholder={field.placeholder}
            prefixIcon={field.icon}
            onValueChange={(next) => onChange(field.id, next)}
            onBlur={() => onBlur(field.id)}
          />
        </SettingRow>
      );

    case 'password': {
      // Write-only: `null` = a value is stored and stays unless the user types (the browser never had it).
      const stored = value === null;
      return (
        <SettingRow {...common} srNote={stored ? __('A value is already saved. Leave this empty to keep it, or type a new one to replace it.', 'fyldo') : undefined}>
          <PasswordInput
            size="md"
            hideOn={revision}
            disabled={disabled}
            value={typeof value === 'string' ? value : ''}
            placeholder={stored ? __('•••• set', 'fyldo') : field.placeholder}
            prefixIcon={field.icon}
            autoComplete={field.autocomplete}
            spellCheck={false}
            autoCapitalize="off"
            onValueChange={(next) => onChange(field.id, next)}
            onBlur={() => onBlur(field.id)}
          />
        </SettingRow>
      );
    }

    case 'group':
      // A list of items: the title names the group, each sub-field is a field of its own (FieldRenderer, `item` variant).
      return (
        <SettingRow {...common} layout="stacked" group width="full">
          <FieldGroup
            field={field}
            value={value}
            errors={errors ?? {}}
            reveal={reveal}
            disabled={disabled}
            locale={locale}
            onChange={(next, clear) => (onGroupChange ? onGroupChange(field.id, next, clear) : onChange(field.id, next))}
            onBlur={(key) => onBlur(field.id, key)}
            renderField={(slot) => (
              <FieldRenderer
                field={slot.field}
                value={slot.value}
                error={slot.error}
                divider={false}
                variant="item"
                fieldKey={slot.fieldKey}
                forceDisabled={slot.disabled}
                onChange={(_, next) => slot.onChange(next)}
                onBlur={() => slot.onBlur()}
                locale={locale}
                searchPath={`${field.id}.${slot.field.id}`}
              />
            )}
          />
        </SettingRow>
      );

    case 'custom':
      // The developer's module draws the control; the row names it as a group, so one control or several work alike.
      // Without a module the page draws it itself (`useForm`): `<Form>` shows nothing for it.
      if (field.module === '') return null;
      return (
        <SettingRow {...common} group>
          <CustomControl
            field={field}
            value={value}
            disabled={disabled}
            invalid={Boolean(error)}
            locale={locale}
            onChange={(next) => onChange(field.id, next)}
            onBlur={() => onBlur(field.id)}
          />
        </SettingRow>
      );

    default: {
      // text | url | email — URLs and emails stay LTR (the text; the label keeps the page direction) and read Persian digits as ASCII.
      const ltr = field.type === 'url' || field.type === 'email';
      return (
        <SettingRow {...common}>
          <Input
            size="md"
            value={typeof value === 'string' ? value : ''}
            placeholder={field.placeholder}
            prefixIcon={field.icon}
            type={field.type === 'text' ? 'text' : field.type}
            inputMode={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : undefined}
            autoComplete="off"
            spellCheck={ltr ? false : undefined}
            autoCapitalize={ltr ? 'off' : undefined}
            ltr={ltr}
            digits={ltr}
            onValueChange={(next) => onChange(field.id, next)}
            onBlur={() => onBlur(field.id)}
          />
        </SettingRow>
      );
    }
  }
}
