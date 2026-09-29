import { Field } from '@base-ui/react/field';
import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type ReactElement } from 'react';
import { _n, formatNumber, sprintf } from '../../i18n';
import { cn } from '../../lib/cn';
import { usePortalContainer } from '../../lib/portal';
import { length } from '../../lib/validation';
import { CONTROL_BASE } from './control';
import { FieldError, FieldShell, type FieldShellProps } from './field-shell';

/** Figma's default Textarea control is 104px tall (≈ 4 rows); each further row adds one 20px line. */
export const TEXTAREA_DEFAULT_ROWS = 4;
const CONTROL_HEIGHT = 104;
const LINE = 20;
const BORDER = 2; // 1px stroke ×2 (Figma counts it inside the 104)
const PADDING = 16; // 8px ×2

export interface TextareaProps extends Omit<ComponentPropsWithoutRef<typeof Field.Control>, 'size' | 'children' | 'render' | 'rows' | 'maxLength'> {
  /** Rows the default height is authored for (Figma: 4 → 104px). The user can still resize. */
  rows?: number;
  /** Figma "Resize handle": vertical only, or none. */
  resize?: 'vertical' | 'none';
}

/**
 * The bordered multi-line control. Must be rendered inside a Base UI `Field.Root` (FieldShell / SettingRow).
 * Deliberately has no `maxLength`: over the limit is an error the user can see and fix, never a silent truncation.
 * The border lives on a wrapper (so hover/focus/error look exactly like Input); the textarea inside carries the
 * padding and reaches the wrapper's corner, which puts the native resizer where Figma draws its 6×6 handle.
 */
export function Textarea({ rows = TEXTAREA_DEFAULT_ROWS, resize = 'vertical', className, style, ...props }: TextareaProps): ReactElement {
  const height = CONTROL_HEIGHT + (rows - TEXTAREA_DEFAULT_ROWS) * LINE - BORDER;
  const minHeight = 2 * LINE + PADDING;

  return (
    <div data-slot="fy-textarea" className={cn(CONTROL_BASE, 'fy:block fy:overflow-hidden fy:rounded-sm', className as string | undefined)}>
      <Field.Control
        {...props}
        render={<textarea />}
        style={{ height, minHeight, ...style }}
        data-slot="fy-textarea-control"
        data-resize={resize}
        className={cn(
          'fy:focus-none fy:block fy:w-full fy:appearance-none fy:border-0 fy:bg-transparent fy:px-3 fy:py-2 fy:text-copy-14 fy:text-inherit fy:outline-none',
          'fy:placeholder:text-text-tertiary fy:disabled:cursor-not-allowed fy:disabled:placeholder:text-text-disabled',
          resize === 'vertical' ? 'fy:resize-y' : 'fy:resize-none',
        )}
      />
    </div>
  );
}

/** How close to the limit the text is. The live region only speaks when this changes. */
export type CounterLevel = 'ok' | 'near' | 'full' | 'over';

export function counterLevel(count: number, max: number): CounterLevel {
  if (count > max) return 'over';
  if (count === max) return 'full';
  return count >= Math.ceil(max * 0.9) ? 'near' : 'ok';
}

/** `104/160` in the page's numeral system (Persian gets ۰–۹). Mono/12 in English, Label/12 in Persian — as Figma. */
export function Counter({ count, max }: { count: number; max: number }): ReactElement {
  const locale = usePortalContainer()?.lang || undefined;
  const format = (n: number) => (locale ? formatNumber(n, locale) : String(n));

  return (
    <span
      data-slot="fy-counter"
      dir="ltr"
      className={cn(
        'fy:shrink-0 fy:text-mono-12 fy:[unicode-bidi:isolate] fy:rtl:text-label-12',
        count > max ? 'fy:text-status-error-text' : 'fy:text-text-tertiary',
      )}
    >
      {format(count)}/{format(max)}
    </span>
  );
}

/** Polite announcement, only when the level changes (90 %, 100 %, over): "12 characters remaining." */
function useCounterAnnouncement(count: number, max: number | undefined): string {
  const level: CounterLevel = max === undefined ? 'ok' : counterLevel(count, max);
  const latest = useRef({ count, max });
  latest.current = { count, max };
  const [message, setMessage] = useState('');

  useEffect(() => {
    const { count: n, max: limit } = latest.current;
    if (limit === undefined || level === 'ok') {
      setMessage('');
      return;
    }
    const left = limit - n;
    setMessage(
      left >= 0
        ? sprintf(_n('%d character remaining.', '%d characters remaining.', left, 'fyldo'), left)
        : sprintf(_n('%d character over the limit.', '%d characters over the limit.', -left, 'fyldo'), -left),
    );
  }, [level]);

  return message;
}

/** Helper row: helper text, or the error row in its place, with the counter always at the end. */
export function TextareaFooter({ description, error, count, limit }: { description?: string; error?: string; count: number; limit?: number }): ReactElement | null {
  const announcement = useCounterAnnouncement(count, limit);

  if (!description && !error && limit === undefined) return null;

  return (
    <div data-slot="fy-textarea-footer" className="fy:flex fy:items-center fy:gap-1.5">
      {error ? (
        <FieldError className="fy:min-w-0 fy:flex-1">{error}</FieldError>
      ) : (
        <div className="fy:min-w-0 fy:flex-1">
          {description ? (
            <Field.Description className="fy:text-copy-13 fy:text-text-secondary fy:group-data-[disabled]/field:text-text-disabled">{description}</Field.Description>
          ) : null}
        </div>
      )}
      {limit !== undefined ? <Counter count={count} max={limit} /> : null}
      <span className="fy:sr-only" aria-live="polite" data-slot="fy-counter-live">
        {announcement}
      </span>
    </div>
  );
}

export interface TextareaFieldProps extends Omit<TextareaProps, 'value' | 'defaultValue'>, Omit<FieldShellProps, 'children' | 'className' | 'footer'> {
  value?: string;
  defaultValue?: string;
  /** The `max_length` rule: shows the live counter (only when there is a real limit). */
  limit?: number;
  className?: string;
}

/** Figma "Textarea": label → control → helper row (helper or error, counter at the end). 360 wide. */
export function TextareaField({ label, hideLabel, description, error, disabled, name, className, limit, value, defaultValue, onValueChange, ...textarea }: TextareaFieldProps): ReactElement {
  const [inner, setInner] = useState(defaultValue ?? '');
  const text = value ?? inner;

  return (
    <FieldShell
      label={label}
      hideLabel={hideLabel}
      error={error}
      disabled={disabled}
      name={name}
      className={cn('fy:w-90', className)}
      footer={<TextareaFooter description={description} error={error} count={length(text)} limit={limit} />}
    >
      <Textarea
        {...textarea}
        value={text}
        disabled={disabled}
        onValueChange={(next, details) => {
          setInner(next);
          onValueChange?.(next, details);
        }}
      />
    </FieldShell>
  );
}
