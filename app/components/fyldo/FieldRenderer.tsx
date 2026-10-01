import type { ReactElement } from 'react';
import type { FocusEvent } from 'react';
import { __, formatNumber } from '../../i18n';
import type { FieldDef, FieldValue } from '../../types';
import { cn } from '../../lib/cn';
import { length } from '../../lib/validation';
import { Checkbox, CheckboxGroup } from '../ui/checkbox';
import { ColorPicker } from '../ui/color-picker';
import { Input } from '../ui/input';
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
import { SettingRow } from './SettingRow';

export interface FieldRendererProps {
  field: FieldDef;
  value: FieldValue;
  error?: string;
  divider: boolean;
  onChange: (id: string, value: FieldValue) => void;
  onBlur: (id: string) => void;
  /** The page's stored revision: a password shown in clear is hidden again when it changes (a successful save). */
  revision?: string;
  /** The page's locale: a Slider's value is written in its numerals (۷۵ in Persian). */
  locale?: string;
}

/** `onBlur` for a group: only when focus leaves the group, not when it moves between its options. */
const leavesGroup = (done: () => void) => (event: FocusEvent<HTMLElement>) => {
  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) done();
};

const list = (value: FieldValue): string[] => (Array.isArray(value) ? value : []);

/** Maps a PHP field `type` to its control inside a Setting Row. */
export function FieldRenderer({ field, value, error, divider, onChange, onBlur, revision, locale = 'en' }: FieldRendererProps): ReactElement {
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

  const disabled = field.disabled !== false;
  const reason = typeof field.disabled === 'string' ? field.disabled : undefined;
  const common = {
    title: field.label,
    description: field.description,
    disabledReason: reason,
    layout: field.layout,
    divider,
    error,
    disabled,
    name: field.id,
    fieldId: field.id,
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
            value={typeof value === 'string' ? value : ''}
            presets={field.presets}
            disabled={disabled}
            locale={locale}
            onValueChange={(next) => onChange(field.id, next)}
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

    default: {
      // text | url | email — URLs and emails stay LTR (the text; the label keeps the page direction) and read Persian digits as ASCII.
      const ltr = field.type === 'url' || field.type === 'email';
      return (
        <SettingRow {...common}>
          <Input
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
