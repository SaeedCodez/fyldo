import { Field } from '@base-ui/react/field';
import { lazy, Suspense, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react';
import { Icon } from '../../icons/Icon';
import { __ } from '../../i18n';
import { cn } from '../../lib/cn';
import { DEFAULT_PRESETS } from '../../lib/color';
import { ColorDot, type ColorDotSize } from './color-swatch';
import { CONTROL_BASE, CONTROL_SIZE, type ControlSize } from './control';

/** The panel (and Base UI's Popover with it) is its own chunk, fetched the first time a picker opens. */
const ColorPickerPopover = lazy(() => import('./color-picker-popover'));

/** Figma: the swatch is 16 / 20 / 24 in the Small / Medium / Large field. */
const DOT: Record<ControlSize, ColorDotSize> = { sm: 16, md: 20, lg: 24 };

export interface ColorPickerProps {
  /** `#rrggbb` (lower case), or '' for no colour. */
  value: string;
  onValueChange: (value: string) => void;
  /** Hex list in the panel; `false` hides the section. */
  presets?: readonly string[] | false;
  size?: ControlSize;
  /** Shown beside the dashed swatch while there is no colour. */
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  /** The page's locale: the panel speaks its values in its numerals. */
  locale?: string;
  /** The picker closed, or focus left the closed field (the caller validates). */
  onBlur?: () => void;
  'aria-label'?: string;
  className?: string;
}

/**
 * Figma "Color Picker": the Select anatomy (swatch, hex value, chevron) that opens the Color Picker Panel under it. The hex is
 * always left to right, even in Persian. Use inside a `Field.Root` (FieldShell / SettingRow).
 */
export function ColorPicker({
  value,
  onValueChange,
  presets = DEFAULT_PRESETS,
  size = 'sm',
  placeholder,
  disabled,
  name,
  id,
  locale = 'en',
  onBlur,
  className,
  ...aria
}: ColorPickerProps): ReactElement {
  const anchor = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  // Mounted on first open and kept: Base UI's Popover then runs its own enter / exit and returns focus to the field.
  const [loaded, setLoaded] = useState(false);

  const toggle = (event: MouseEvent<HTMLElement>): void => {
    anchor.current = event.currentTarget;
    if (open) {
      setOpen(false);
      onBlur?.();
      return;
    }
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
        data-slot="fy-color-picker"
        data-popup-open={open ? '' : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
          if (event.key !== 'ArrowDown' || open) return;
          event.preventDefault();
          anchor.current = event.currentTarget;
          setLoaded(true);
          setOpen(true);
        }}
        onBlur={() => {
          // Focus moving into the open panel is not leaving the field; closing the panel reports it instead.
          if (!open) onBlur?.();
        }}
        render={<button type="button" />}
        className={cn('fy:group/picker fy:cursor-pointer fy:text-start fy:focus-visible:border-focus-border fy:focus-visible:shadow-focus-input fy:focus-none', CONTROL_BASE, CONTROL_SIZE[size], className)}
      >
        <ColorDot color={value} size={DOT[size]} className="fy:group-data-[disabled]/field:opacity-40" />
        {value === '' ? (
          <span className="fy:min-w-0 fy:flex-1 fy:truncate fy:text-text-tertiary fy:group-data-[disabled]/field:text-text-disabled">{placeholder ?? __('Pick a color…', 'fyldo')}</span>
        ) : (
          // The value is code: always left to right, at the start of its slot (the slot itself follows the page, so it sits at the end in Persian).
          <span className="fy:min-w-0 fy:flex-1 fy:truncate fy:text-mono-14">
            <bdi dir="ltr">{value.toUpperCase()}</bdi>
          </span>
        )}
        <span className="fy:flex fy:shrink-0 fy:text-icon-tertiary">
          <Icon name="arrow-down-2" size={16} className="fy:group-data-[popup-open]/picker:hidden" />
          <Icon name="arrow-up-2" size={16} className="fy:hidden fy:group-data-[popup-open]/picker:block" />
        </span>
      </Field.Control>

      {loaded ? (
        <Suspense fallback={null}>
          <ColorPickerPopover
            open={open}
            anchorRef={anchor}
            value={value}
            presets={presets}
            locale={locale}
            onValueChange={onValueChange}
            onOpenChange={(next, details) => {
              // A press on the field itself is the field's own toggle, not "outside".
              if (!next && details.reason === 'outside-press' && anchor.current?.contains(details.event.target as Node)) {
                details.cancel();
                return;
              }
              setOpen(next);
              if (!next) onBlur?.();
            }}
          />
        </Suspense>
      ) : null}
    </>
  );
}
