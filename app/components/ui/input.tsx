import { Field } from '@base-ui/react/field';
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react';
import { Icon } from '../../icons/Icon';
import { cn } from '../../lib/cn';
import { CONTROL_BASE, CONTROL_SIZE, type ControlSize } from './control';

export interface InputProps extends Omit<ComponentPropsWithoutRef<typeof Field.Control>, 'size' | 'prefix' | 'children'> {
  size?: ControlSize;
  /** Iconsax name shown before the value (hints the content: search, URL). */
  prefixIcon?: string;
  /** Trailing content, usually an icon-only action (clear). */
  suffix?: ReactNode;
  /** URLs, emails, keys and code stay LTR — left-aligned — even inside an RTL layout. */
  ltr?: boolean;
}

/**
 * The bordered text control. Must be rendered inside a Base UI `Field.Root` (see FieldShell / SettingRow), which
 * supplies the id, label association, description and error wiring.
 */
export function Input({ size = 'sm', prefixIcon, suffix, ltr = false, className, ...props }: InputProps): ReactElement {
  return (
    <div data-slot="fy-input" className={cn(CONTROL_BASE, CONTROL_SIZE[size], className as string | undefined)}>
      {prefixIcon ? <Icon name={prefixIcon} size={16} className="fy:text-icon-tertiary" /> : null}
      <Field.Control
        {...props}
        dir={ltr ? 'ltr' : props.dir}
        className={cn(
          'fy:focus-none fy:min-w-0 fy:flex-1 fy:appearance-none fy:border-0 fy:bg-transparent fy:p-0 fy:text-inherit fy:outline-none',
          'fy:placeholder:text-text-tertiary fy:disabled:cursor-not-allowed fy:disabled:placeholder:text-text-disabled',
          ltr && 'fy:text-left',
        )}
      />
      {suffix}
    </div>
  );
}
