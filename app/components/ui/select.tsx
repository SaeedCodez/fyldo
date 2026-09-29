import { Select as BaseSelect } from '@base-ui/react/select';
import type { ReactElement } from 'react';
import { Icon } from '../../icons/Icon';
import { cn } from '../../lib/cn';
import { usePortalContainer } from '../../lib/portal';
import { CONTROL_BASE, CONTROL_SIZE, type ControlSize } from './control';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: string;
}

export interface SelectProps {
  options: SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  size?: ControlSize;
  /** Iconsax name shown before the value (e.g. `global` for a language select). */
  prefixIcon?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

/** Popup: 8 items × 36 + 7 × 2 gaps + 2 × 4 padding, then it scrolls (design rule: cap at ~8 items). */
export const POPUP_MAX_HEIGHT = 310;

/**
 * One-of-many field (6+ options). Base UI Select in the Figma "Select" / "Select Menu" / "Menu Item" look:
 * the menu is exactly as wide as the field, 4px below it (never overlaying it), with the selected option's check
 * at the END of the row. Use inside a `Field.Root` (FieldShell / SettingRow).
 */
export function Select({ options, value, onValueChange, placeholder, size = 'sm', prefixIcon, disabled, name, id, className, ...aria }: SelectProps): ReactElement {
  const container = usePortalContainer();

  return (
    <BaseSelect.Root
      items={options.map(({ value: v, label }) => ({ value: v, label }))}
      value={value === '' ? null : value}
      onValueChange={(next) => onValueChange(next === null ? '' : String(next))}
      disabled={disabled}
      name={name}
      id={id}
    >
      <BaseSelect.Trigger
        {...aria}
        data-slot="fy-select"
        className={cn(
          'fy:group/select fy:text-start fy:focus-visible:border-focus-border fy:focus-visible:shadow-focus-input fy:focus-none',
          CONTROL_BASE,
          CONTROL_SIZE[size],
          className,
        )}
      >
        {prefixIcon ? <Icon name={prefixIcon} size={16} className="fy:text-icon-tertiary" /> : null}
        <BaseSelect.Value
          placeholder={placeholder}
          className="fy:min-w-0 fy:flex-1 fy:truncate fy:data-[placeholder]:text-text-tertiary fy:group-data-[disabled]/field:data-[placeholder]:text-text-disabled"
        />
        <BaseSelect.Icon className="fy:flex fy:shrink-0 fy:text-icon-tertiary">
          <Icon name="arrow-down-2" size={16} className="fy:group-data-[popup-open]/select:hidden" />
          <Icon name="arrow-up-2" size={16} className="fy:hidden fy:group-data-[popup-open]/select:block" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>

      <BaseSelect.Portal container={container ?? undefined}>
        <BaseSelect.Positioner sideOffset={4} alignItemWithTrigger={false} className="fy:z-50 fy:outline-none">
          <BaseSelect.Popup
            data-slot="fy-select-menu"
            className="fy:min-w-(--anchor-width) fy:rounded-lg fy:border fy:border-border-default fy:bg-background-default fy:p-1 fy:shadow-medium fy:outline-none"
          >
            <BaseSelect.List className="fy:flex fy:flex-col fy:gap-0.5 fy:overflow-y-auto" style={{ maxHeight: `min(${POPUP_MAX_HEIGHT}px, var(--available-height))` }}>
              {options.map((option) => (
                <BaseSelect.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    'fy:flex fy:h-9 fy:cursor-pointer fy:items-center fy:gap-2 fy:rounded-sm fy:p-2 fy:text-label-14 fy:text-text-primary fy:outline-none fy:select-none',
                    'fy:data-highlighted:bg-surface-default fy:data-disabled:cursor-not-allowed fy:data-disabled:text-text-disabled',
                  )}
                >
                  {option.icon ? <Icon name={option.icon} size={16} className="fy:text-icon-tertiary" /> : null}
                  <BaseSelect.ItemText className="fy:min-w-0 fy:flex-1 fy:truncate">{option.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator className="fy:flex fy:shrink-0">
                    <Icon name="tick-circle" size={16} />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
