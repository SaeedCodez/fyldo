import type { ReactElement } from 'react';
import type { FieldDef, FieldValue } from '../../types';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Toggle } from '../ui/toggle';
import { SettingRow } from './SettingRow';

export interface FieldRendererProps {
  field: FieldDef;
  value: FieldValue;
  error?: string;
  divider: boolean;
  onChange: (id: string, value: FieldValue) => void;
  onBlur: (id: string) => void;
}

/** Maps a PHP field `type` to its control inside a Setting Row. */
export function FieldRenderer({ field, value, error, divider, onChange, onBlur }: FieldRendererProps): ReactElement {
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

    default: {
      // text | url | email — URLs and emails stay LTR even inside an RTL layout.
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
            ltr={ltr}
            onValueChange={(next) => onChange(field.id, next)}
            onBlur={() => onBlur(field.id)}
          />
        </SettingRow>
      );
    }
  }
}
