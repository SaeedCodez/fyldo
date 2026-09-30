import { Field } from '@base-ui/react/field';
import { useLayoutEffect, useRef, type ComponentPropsWithoutRef, type ReactElement, type ReactNode } from 'react';
import { Icon } from '../../icons/Icon';
import { cn } from '../../lib/cn';
import { toAsciiDigits } from '../../lib/digits';
import { CONTROL_BASE, CONTROL_SIZE, type ControlSize } from './control';

export interface InputProps extends Omit<ComponentPropsWithoutRef<typeof Field.Control>, 'size' | 'prefix' | 'children'> {
  size?: ControlSize;
  /** Iconsax name shown before the value (hints the content: search, URL). */
  prefixIcon?: string;
  /** Trailing content, usually an icon-only action (clear). */
  suffix?: ReactNode;
  /**
   * URLs, emails, keys and code: the text stays LTR even inside an RTL layout, and sits at the inline end of the
   * field there (right-aligned, as the pack's Input usage frame draws its FA email) — left-aligned in an LTR layout.
   */
  ltr?: boolean;
  /** Read Persian and Arabic-Indic digits (and the Persian separators ٫ ٬) as ASCII while typing or pasting (URL, email, number). The caret stays where it was. */
  digits?: boolean;
}

/**
 * The bordered text control. Must be rendered inside a Base UI `Field.Root` (see FieldShell / SettingRow), which
 * supplies the id, label association, description and error wiring.
 */
export function Input({ size = 'sm', prefixIcon, suffix, ltr = false, digits = false, className, onValueChange, ...props }: InputProps): ReactElement {
  const control = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  // Replacing the text moves the caret to the end; put it back after what was before it (a dropped ٬ shortens that).
  const restoreCaret = (): void => {
    if (caret.current !== null && control.current && document.activeElement === control.current) control.current.setSelectionRange(caret.current, caret.current);
  };
  useLayoutEffect(() => {
    restoreCaret();
    caret.current = null;
  });

  return (
    <div data-slot="fy-input" className={cn(CONTROL_BASE, CONTROL_SIZE[size], className as string | undefined)}>
      {prefixIcon ? <Icon name={prefixIcon} size={16} className="fy:text-icon-tertiary" /> : null}
      <Field.Control
        {...props}
        ref={control}
        onValueChange={(next, details) => {
          const fixed = digits ? toAsciiDigits(next) : next;
          if (fixed !== next) {
            const at = (details.event.target as HTMLInputElement).selectionStart;
            caret.current = at === null ? null : toAsciiDigits(next.slice(0, at)).length;
            // When the corrected text equals what the field already held (a dropped ٬), nothing re-renders and React
            // just restores the old value, caret at the end: put the caret back once that has happened.
            const pending = caret.current;
            queueMicrotask(() => {
              if (pending === null || !control.current || document.activeElement !== control.current) return;
              control.current.setSelectionRange(pending, pending);
            });
          }
          onValueChange?.(fixed, details);
        }}
        dir={ltr ? 'ltr' : props.dir}
        className={cn(
          'fy:focus-none fy:min-w-0 fy:flex-1 fy:appearance-none fy:border-0 fy:bg-transparent fy:p-0 fy:text-inherit fy:outline-none',
          'fy:placeholder:text-text-tertiary fy:disabled:cursor-not-allowed fy:disabled:placeholder:text-text-disabled',
          ltr && 'fy:text-left fy:rtl:text-right',
        )}
      />
      {suffix}
    </div>
  );
}
