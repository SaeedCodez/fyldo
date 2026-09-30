import { Combobox } from '@base-ui/react/combobox';
import { useId, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactElement } from 'react';
import { Icon } from '../../icons/Icon';
import { __, _n, formatNumber, sprintf } from '../../i18n';
import { cn } from '../../lib/cn';
import { usePortalContainer } from '../../lib/portal';
import { Button } from './button';
import { CheckboxMark } from './checkbox';
import { CONTROL_LOOK, type ControlSize } from './control';
import { POPUP_MAX_HEIGHT } from './select';
import { Tag, type TagSize } from './tag';

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Iconsax name shown after the checkbox (Figma Menu Item "Leading icon"). */
  icon?: string;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  /** Selected option values. */
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  size?: ControlSize;
  /** The search row inside the popup (Figma Select Menu `Search`). Off: the list is not filterable. */
  searchable?: boolean;
  /** The 16px Clear button in the field (Figma `Clear button`, default off). */
  clearable?: boolean;
  /** The popup footer with "n selected" and Clear (Figma Select Menu `Footer`). */
  menuFooter?: boolean;
  /** Tags shown before the non-removable "+n" chip. Figma shows three. */
  maxVisibleTags?: number;
  disabled?: boolean;
  name?: string;
  id?: string;
  /** Names the popup ("Show on"). */
  'aria-label'?: string;
  className?: string;
  /** The user is done with the field: the popup closed, or focus left it. */
  onBlur?: () => void;
}

/** Figma: the tags are Small (20) in a Small field and Medium (24) in Medium and Large ones. */
const TAG_SIZE: Record<ControlSize, TagSize> = { sm: 'sm', md: 'md', lg: 'md' };

/** Start padding once there are tags (the tag's own 1px stroke + this = a 6/8/12 inset): Small 6, Medium 8, Large stays 12. */
const START_WITH_TAGS: Record<ControlSize, string> = { sm: 'fy:ps-1.5', md: 'fy:ps-2', lg: 'fy:ps-3' };

/*
 * Multi Select control. Figma counts the stroke in the layout, so a Small field is 34 = 1 + 6 + 20 + 6 + 1 and its
 * padding is 6/12 (Medium 8/12, Large 12/12); once there are tags the start padding drops (Small 6, Medium 8, Large unchanged). Tags wrap (4px gaps).
 * The chevron column is one line tall and stays beside the first line.
 */
const FIELD: Record<ControlSize, string> = {
  sm: 'fy:py-1.5 fy:rounded-sm fy:text-copy-14',
  md: 'fy:py-2 fy:rounded-sm fy:text-copy-14',
  lg: 'fy:py-3 fy:rounded-md fy:text-copy-16',
};
const LINE: Record<ControlSize, string> = { sm: 'fy:min-h-5', md: 'fy:min-h-6', lg: 'fy:min-h-6' };
const ICONS: Record<ControlSize, string> = { sm: 'fy:h-5', md: 'fy:h-6', lg: 'fy:h-6' };

/**
 * Many-of-many field. Base UI Combobox with `multiple`, the search input INSIDE the popup (ARCHITECTURE O14): the field is
 * the trigger, it shows the picked values as wrapping Tags (+ a non-removable "+n" beyond `maxVisibleTags`), and the popup
 * holds Search · options with a leading checkbox (Menu Item Multi) · Footer ("n selected" + Clear all).
 * Use inside a `Field.Root` (FieldShell / SettingRow).
 *
 * Keyboard: on the field Enter / Space / ↓ open it; Backspace removes the last tag. In the popup: type to filter, ↑ ↓ move,
 * Enter toggles the highlighted option (Space too while the search is empty), Backspace on an empty search removes the last
 * tag, Esc closes and returns to the field.
 */
export function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder,
  size = 'sm',
  searchable = true,
  clearable = false,
  menuFooter = true,
  maxVisibleTags = 3,
  disabled,
  name,
  id,
  className,
  onBlur,
  'aria-label': ariaLabel,
}: MultiSelectProps): ReactElement {
  const container = usePortalContainer();
  const locale = container?.lang || undefined;
  const number = (n: number) => (locale ? formatNumber(n, locale) : String(n));

  const items = useMemo(() => Combobox.createItems(options, { getValue: (o) => o.value, getLabel: (o) => o.label }), [options]);
  const selected = options.filter((o) => value.includes(o.value));
  const visible = selected.slice(0, Math.max(0, maxVisibleTags));
  const hidden = selected.length - visible.length;
  const tagSize = TAG_SIZE[size];

  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const highlighted = useRef<string | undefined>(undefined);
  const search = useRef<HTMLInputElement>(null);
  const searchId = useId();

  /** Always report the list in option order: the same order the server stores. */
  const commit = (next: string[]) => onValueChange(options.filter((o) => next.includes(o.value)).map((o) => o.value));
  const remove = (option: MultiSelectOption) => {
    setAnnouncement(sprintf(__('%s removed', 'fyldo'), option.label));
    commit(value.filter((v) => v !== option.value));
  };
  const removeLast = () => {
    const last = selected[selected.length - 1];
    if (last) remove(last);
  };
  const clear = () => {
    setAnnouncement(__('Selection cleared', 'fyldo'));
    commit([]);
    search.current?.focus(); // the Clear button disables itself; keep the keyboard in the popup
  };
  const toggle = (optionValue: string) => {
    const option = options.find((o) => o.value === optionValue);
    if (!option || option.disabled) return;
    commit(value.includes(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue]);
  };

  const onFieldKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.key === 'Backspace' || event.key === 'Delete') && !open && selected.length > 0 && !disabled) {
      event.preventDefault();
      removeLast();
    }
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const empty = event.currentTarget.value === '';
    if (event.key === 'Backspace' && empty && selected.length > 0) {
      event.preventDefault();
      removeLast();
    } else if (event.key === ' ' && empty && highlighted.current !== undefined) {
      // Space types a space in a search box, so it only toggles while nothing has been typed.
      event.preventDefault();
      toggle(highlighted.current);
    }
  };

  const onFieldBlur = (event: FocusEvent<HTMLElement>) => {
    if (!open && !event.currentTarget.contains(event.relatedTarget as Node | null)) onBlur?.();
  };

  return (
    <Combobox.Root
      multiple
      items={items}
      value={value}
      onValueChange={(next) => commit(next)}
      // Keep the typed filter after picking, so several results of one query can be ticked in a row.
      onInputValueChange={(_query, details) => {
        if (details.isItemPress) details.cancel();
      }}
      filter={searchable ? undefined : null}
      onItemHighlighted={(next) => {
        highlighted.current = typeof next === 'string' ? next : undefined;
      }}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onBlur?.();
      }}
      disabled={disabled}
      name={name}
      id={id}
    >
      <Combobox.Trigger
        render={<div />}
        nativeButton={false}
        data-slot="fy-multi-select"
        data-size={size}
        onKeyDown={onFieldKeyDown}
        onBlur={onFieldBlur}
        className={cn(
          'fy:group/select fy:flex fy:w-full fy:cursor-pointer fy:items-start fy:gap-2 fy:pe-3 fy:text-start',
          selected.length > 0 ? START_WITH_TAGS[size] : 'fy:ps-3',
          'fy:focus-visible:border-focus-border fy:focus-visible:shadow-focus-input fy:focus-none',
          CONTROL_LOOK,
          FIELD[size],
          className,
        )}
      >
        <span data-slot="fy-multi-values" className={cn('fy:flex fy:min-w-0 fy:flex-1 fy:flex-wrap fy:items-center fy:gap-1', LINE[size])}>
          {selected.length === 0 ? (
            <span className="fy:truncate fy:text-text-tertiary fy:group-data-[disabled]/field:text-text-disabled">{placeholder}</span>
          ) : (
            <>
              {visible.map((option) => (
                <Tag key={option.value} label={option.label} size={tagSize} disabled={disabled} onRemove={() => remove(option)} />
              ))}
              {hidden > 0 ? (
                <Tag label={`+${number(hidden)}`} size={tagSize} disabled={disabled} srLabel={sprintf(_n('%s more selected', '%s more selected', hidden, 'fyldo'), number(hidden))} />
              ) : null}
            </>
          )}
        </span>
        <span data-slot="fy-multi-icons" className={cn('fy:flex fy:shrink-0 fy:items-center fy:gap-2 fy:self-start fy:text-icon-secondary', ICONS[size])}>
          {clearable && selected.length > 0 && !disabled ? (
            // eslint-disable-next-line fyldo/icon-button-tooltip -- part of the field, not a Figma Icon Button: a pointer-only target (the keyboard has Clear all in the popup footer)
            <button
              type="button"
              tabIndex={-1}
              aria-label={__('Clear all', 'fyldo')}
              data-slot="fy-multi-clear"
              className="fy:flex fy:size-4 fy:cursor-pointer fy:items-center fy:justify-center fy:border-0 fy:bg-transparent fy:p-0 fy:text-icon-tertiary"
              onPointerDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                clear();
              }}
            >
              <Icon name="close-circle" size={16} />
            </button>
          ) : null}
          <span aria-hidden="true" className="fy:flex fy:group-data-[disabled]/field:text-text-disabled">
            <Icon name="arrow-down-2" size={16} className="fy:group-data-[popup-open]/select:hidden" />
            <Icon name="arrow-up-2" size={16} className="fy:hidden fy:group-data-[popup-open]/select:block" />
          </span>
        </span>
      </Combobox.Trigger>
      <span role="status" data-slot="fy-multi-announce" className="fy:sr-only">
        {announcement}
      </span>

      <Combobox.Portal container={container ?? undefined}>
        <Combobox.Positioner sideOffset={4} align="start" className="fy:z-50 fy:outline-none">
          <Combobox.Popup
            data-slot="fy-multi-select-menu"
            aria-label={ariaLabel}
            className="fy:flex fy:min-w-(--anchor-width) fy:max-w-(--available-width) fy:flex-col fy:overflow-hidden fy:rounded-lg fy:border fy:border-border-default fy:bg-background-default fy:shadow-medium fy:outline-none"
          >
            <div
              data-slot="fy-multi-search"
              className={searchable ? 'fy:flex fy:items-center fy:gap-2 fy:border-b fy:border-border-default fy:px-3 fy:py-2' : 'fy:sr-only'}
            >
              <Icon name="search-normal" size={16} className="fy:text-icon-tertiary" />
              <Combobox.Input
                ref={search}
                id={searchId}
                // Base UI points every control in the Field at the Field's label: name the search box by its own aria-label instead.
                aria-labelledby={searchId}
                placeholder={__('Search…', 'fyldo')}
                aria-label={__('Search options', 'fyldo')}
                onKeyDown={onSearchKeyDown}
                className="fy:focus-none fy:min-w-0 fy:flex-1 fy:appearance-none fy:border-0 fy:bg-transparent fy:p-0 fy:text-copy-14 fy:text-text-primary fy:outline-none fy:placeholder:text-text-tertiary"
              />
            </div>
            <Combobox.Empty className="fy:p-1 fy:empty:hidden">
              <div className="fy:flex fy:h-9 fy:items-center fy:p-2 fy:text-copy-14 fy:text-text-tertiary">{__('No results found.', 'fyldo')}</div>
            </Combobox.Empty>
            <Combobox.List
              className="fy:flex fy:flex-col fy:gap-0.5 fy:overflow-y-auto fy:p-1 fy:empty:hidden"
              style={{ maxHeight: `min(${POPUP_MAX_HEIGHT}px, var(--available-height))` }}
            >
              {(option: MultiSelectOption) => (
                <Combobox.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    'fy:group/option fy:flex fy:h-9 fy:shrink-0 fy:cursor-pointer fy:items-center fy:gap-2 fy:rounded-sm fy:p-2 fy:text-label-14 fy:text-text-primary fy:outline-none fy:select-none',
                    'fy:data-highlighted:bg-surface-default fy:data-disabled:cursor-not-allowed fy:data-disabled:text-text-disabled',
                  )}
                >
                  <OptionBox option={option} selected={value.includes(option.value)} />
                  {option.icon ? <Icon name={option.icon} size={16} className="fy:shrink-0 fy:text-icon-secondary fy:group-data-[disabled]/option:text-text-disabled" /> : null}
                  <span className="fy:min-w-0 fy:flex-1 fy:truncate">{option.label}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
            {menuFooter ? (
              <div data-slot="fy-multi-footer" className="fy:flex fy:items-center fy:gap-2 fy:border-t fy:border-border-default fy:bg-background-subtle fy:py-1 fy:ps-3 fy:pe-1">
                <span className="fy:min-w-0 fy:flex-1 fy:text-label-13 fy:text-text-secondary" aria-live="polite">
                  {sprintf(_n('%s selected', '%s selected', selected.length, 'fyldo'), number(selected.length))}
                </span>
                <Button variant="tertiary" size="sm" disabled={selected.length === 0} onClick={clear}>
                  {__('Clear all', 'fyldo')}
                </Button>
              </div>
            ) : null}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

/** Menu Item Multi: the 16px checkbox in a 20px (22 in Persian) slot, centred on the row. */
function OptionBox({ option, selected }: { option: MultiSelectOption; selected: boolean }): ReactElement {
  return (
    <span className="fy:flex fy:h-(--fyldo-leading-label-14) fy:shrink-0 fy:items-center">
      <CheckboxMark checked={selected} disabled={option.disabled} />
    </span>
  );
}
