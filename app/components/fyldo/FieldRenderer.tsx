import type { ReactElement } from 'react';
import type { FocusEvent } from 'react';
import { __, formatNumber } from '../../i18n';
import type { FieldDef, FieldValue, GroupItemValue, MediaItem } from '../../types';
import { cn } from '../../lib/cn';
import { sanitizeMediaId } from '../../lib/wp-media';
import { length } from '../../lib/validation';
import { Checkbox, CheckboxGroup } from '../ui/checkbox';
import { ColorPicker } from '../ui/color-picker';
import { IconPicker } from '../ui/icon-picker';
import { Input } from '../ui/input';
import { MediaPicker } from '../ui/media-field';
import { MultiSelect } from '../ui/multi-select';
import { Notice } from '../ui/notice';
import { NumberInput } from '../ui/number-input';
import { PasswordInput } from '../ui/password-input';
import { ChoiceCards } from '../ui/choice-card';
import { RadioGroup } from '../ui/radio';
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
  /** `media`: the attachment a media field was set to (null when cleared); the other fields never pass it. */
  onChange: (id: string, value: FieldValue, media?: MediaItem | null) => void;
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
  /** What an `image` / `file` field draws for its saved attachment (the page's `media[field.id]`). */
  media?: MediaItem | null;
  /** A field shows a message of its own (a chosen file that is the wrong type or too large); its value is left as it was. */
  onError?: (id: string, message: string) => void;
  /** The page's stored revision: a password shown in clear is hidden again when it changes (a successful save). */
  revision?: string;
  /** The page's locale: a Slider's value is written in its numerals (۷۵ in Persian). */
  locale?: string;
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
}: FieldRendererProps): ReactElement {
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
        <SettingRow {...common} group cards>
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
        <SettingRow {...common} group wide>
          <MediaPicker
            kind={field.type}
            label={field.label}
            value={sanitizeMediaId(value)}
            media={media}
            mimes={field.mimes}
            maxSize={field.max_size}
            disabled={disabled}
            locale={locale}
            onSelect={(item) => onChange(field.id, item.id, item)}
            onRemove={() => onChange(field.id, 0, null)}
            onError={(message) => onError?.(field.id, message)}
            onBlur={() => onBlur(field.id)}
          />
        </SettingRow>
      );

    case 'textarea': {
      const text = typeof value === 'string' ? value : '';
      return (
        <SettingRow {...common} wide errorInControl>
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
        <SettingRow {...common} layout="stacked" group full>
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
              />
            )}
          />
        </SettingRow>
      );

    case 'custom':
      // The developer's module draws the control; the row names it as a group, so one control or several work alike.
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
