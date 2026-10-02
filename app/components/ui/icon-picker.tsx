import { Field } from '@base-ui/react/field';
import { lazy, Suspense, useRef, useState, type MouseEvent, type ReactElement } from 'react';
import { Icon, type IconSize } from '../../icons/Icon';
import { __ } from '../../i18n';
import { cn } from '../../lib/cn';
import { CONTROL_BASE, CONTROL_SIZE, type ControlSize } from './control';

/** The modal (its grid, the icon names and Base UI's Dialog) is its own chunk, fetched the first time a picker opens. */
const IconPickerModal = lazy(() => import('./icon-picker-modal'));

/** Figma: the preview tile is 20 / 24 / 28 in the Small / Medium / Large field, its icon 14 / 16 / 20. */
const PREVIEW: Record<ControlSize, { box: string; icon: IconSize; side: number }> = {
  sm: { box: 'fy:size-5', icon: 14, side: 20 },
  md: { box: 'fy:size-6', icon: 16, side: 24 },
  lg: { box: 'fy:size-7', icon: 20, side: 28 },
};

/**
 * The picker's small square: `radius/xs`, a 1px `border/default` stroke and `background/subtle` around the icon; with no icon
 * it is Figma's dashed outline (`border/strong`, dashes 3/3) and nothing inside.
 */
export function IconPreview({ name, size = 'sm', className }: { name: string; size?: ControlSize; className?: string }): ReactElement {
  const { box, icon, side } = PREVIEW[size];
  if (name === '') {
    return (
      <svg
        aria-hidden="true"
        data-slot="fy-icon-preview"
        data-empty=""
        viewBox={`0 0 ${side} ${side}`}
        className={cn('fy:block fy:shrink-0 fy:fill-none fy:stroke-border-strong', box, className)}
      >
        <rect x="0.5" y="0.5" width={side - 1} height={side - 1} rx="3.5" strokeDasharray="3 3" />
      </svg>
    );
  }
  return (
    <span
      aria-hidden="true"
      data-slot="fy-icon-preview"
      className={cn('fy:box-border fy:flex fy:shrink-0 fy:items-center fy:justify-center fy:rounded-xs fy:border fy:border-border-default fy:bg-background-subtle fy:text-text-primary', box, className)}
    >
      <Icon name={name} size={icon} />
    </span>
  );
}

export interface IconPickerProps {
  /** An Iconsax icon name in kebab case (`setting-2`), or '' for none. */
  value: string;
  onValueChange: (value: string) => void;
  /** The names the modal offers; `null` / omitted = every Iconsax icon. */
  icons?: readonly string[] | null;
  size?: ControlSize;
  /** Shown beside the dashed tile while there is no icon. */
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  /** The page's locale: the modal speaks its counts in its numerals. */
  locale?: string;
  /** The modal closed, or focus left the closed field (the caller validates). */
  onBlur?: () => void;
  'aria-label'?: string;
  className?: string;
}

/**
 * Figma "Icon Picker": the Select anatomy (a preview tile, the icon name, a grid icon) that opens the Icon Picker Modal. The
 * name is always left to right, even in Persian. The value only changes when the person confirms with "Select icon". Use
 * inside a `Field.Root` (FieldShell / SettingRow).
 */
export function IconPicker({ value, onValueChange, icons = null, size = 'sm', placeholder, disabled, name, id, locale = 'en', onBlur, className, ...aria }: IconPickerProps): ReactElement {
  const anchor = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  // Mounted on first open and kept: Base UI's Dialog then runs its own enter / exit and returns focus to the field.
  const [loaded, setLoaded] = useState(false);

  const show = (event: MouseEvent<HTMLElement>): void => {
    anchor.current = event.currentTarget;
    setLoaded(true);
    setOpen(true);
  };

  return (
    <>
      <Field.Control
        {...aria}
        id={id}
        name={name}
        disabled={disabled}
        data-slot="fy-icon-picker"
        data-popup-open={open ? '' : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={show}
        onBlur={() => {
          // Focus moving into the open modal is not leaving the field; closing the modal reports it instead.
          if (!open) onBlur?.();
        }}
        render={<button type="button" />}
        className={cn('fy:group/picker fy:cursor-pointer fy:text-start fy:focus-visible:border-focus-border fy:focus-visible:shadow-focus-input fy:focus-none', CONTROL_BASE, CONTROL_SIZE[size], className)}
      >
        <IconPreview name={value} size={size} className="fy:group-data-[disabled]/field:opacity-40" />
        {value === '' ? (
          <span className="fy:min-w-0 fy:flex-1 fy:truncate fy:text-text-tertiary fy:group-data-[disabled]/field:text-text-disabled">{placeholder ?? __('Choose an icon…', 'fyldo')}</span>
        ) : (
          // The name is code: always left to right, at the start of its slot (the slot itself follows the page, so it sits at the end in Persian).
          <span className="fy:min-w-0 fy:flex-1 fy:truncate fy:text-mono-14">
            <bdi dir="ltr">{value}</bdi>
          </span>
        )}
        <span className="fy:flex fy:shrink-0 fy:text-icon-secondary">
          <Icon name="element-3" size={16} />
        </span>
      </Field.Control>

      {loaded ? (
        <Suspense fallback={null}>
          <IconPickerModal
            open={open}
            anchorRef={anchor}
            value={value}
            icons={icons}
            locale={locale}
            onSelect={(next) => {
              onValueChange(next);
              setOpen(false);
              onBlur?.();
            }}
            onClose={() => {
              setOpen(false);
              onBlur?.();
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
}
