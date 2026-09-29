import { Button as BaseButton } from '@base-ui/react/button';
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react';
import { Icon } from '../../icons/Icon';
import { Spinner } from '../../icons/Spinner';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'error';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ComponentPropsWithoutRef<typeof BaseButton>, 'children'> {
  /** Figma `Type`. */
  variant?: ButtonVariant;
  /** Figma `Size`: 32 / 40 / 48. */
  size?: ButtonSize;
  /** Figma `State=Loading`: keeps the label and width, shows a spinner, ignores clicks. */
  loading?: boolean;
  leadingIcon?: string;
  trailingIcon?: string;
  children?: ReactNode;
}

/*
 * Figma auto-layout COUNTS the 1px stroke in the layout: a variant with a stroke is 2px wider than one without
 * (Primary 68 · Secondary 70 · Primary Disabled 70 · Loading +22 for the spinner). So padding is always 12/16/20 and the
 * border exists only where Figma has a stroke: Secondary always, every other type only when disabled/loading.
 */
const SIZE: Record<ButtonSize, string> = {
  sm: 'fy:h-8 fy:px-3 fy:gap-1.5 fy:rounded-sm fy:text-button-14',
  md: 'fy:h-10 fy:px-4 fy:gap-1.5 fy:rounded-sm fy:text-button-14',
  lg: 'fy:h-12 fy:px-5 fy:gap-2 fy:rounded-md fy:text-button-16',
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'fy:bg-action-primary fy:text-text-inverse fy:hover:bg-action-primary-hover',
  secondary:
    'fy:border fy:border-border-default fy:bg-action-secondary fy:text-text-primary fy:hover:border-border-hover fy:hover:bg-action-secondary-hover',
  tertiary: 'fy:bg-transparent fy:text-text-primary fy:hover:bg-action-tertiary-hover',
  error: 'fy:bg-action-danger fy:text-text-inverse fy:hover:bg-action-danger-hover',
};

/** Disabled and Loading look identical (Figma): pale fill + inside stroke; Tertiary has neither. */
const DISABLED_BASE = 'fy:data-disabled:cursor-not-allowed fy:data-disabled:text-text-disabled';
const DISABLED_FILLED =
  'fy:data-disabled:border fy:data-disabled:border-border-default fy:data-disabled:bg-action-disabled fy:data-disabled:hover:border-border-default fy:data-disabled:hover:bg-action-disabled';
const DISABLED: Record<ButtonVariant, string> = {
  primary: `${DISABLED_BASE} ${DISABLED_FILLED}`,
  secondary: `${DISABLED_BASE} ${DISABLED_FILLED}`,
  tertiary: `${DISABLED_BASE} fy:data-disabled:bg-transparent fy:data-disabled:hover:bg-transparent`,
  error: `${DISABLED_BASE} ${DISABLED_FILLED}`,
};

/** The classes of an enabled button of a type and size (shared with ButtonLink). */
const look = (variant: ButtonVariant, size: ButtonSize): string =>
  cn(
    'fy:inline-flex fy:shrink-0 fy:items-center fy:justify-center fy:whitespace-nowrap fy:select-none fy:transition-colors fy:duration-100 fy:ease-out',
    'fy:focus-ring',
    SIZE[size],
    VARIANT[variant],
  );

export interface ButtonLinkProps extends Omit<ComponentPropsWithoutRef<'a'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: string;
  trailingIcon?: string;
  children?: ReactNode;
}

/**
 * A link that looks like a Button (Page Header actions, Top Navigation utilities): a real `<a href>`, announced as a
 * link. A Base UI Button rendered as an anchor would be given `role="button"`.
 */
export function ButtonLink({ variant = 'primary', size = 'sm', leadingIcon, trailingIcon, className, children, ...props }: ButtonLinkProps): ReactElement {
  return (
    <a {...props} data-slot="fy-button" data-variant={variant} data-size={size} className={cn(look(variant, size), 'fy:no-underline', className)}>
      {leadingIcon ? <Icon name={leadingIcon} size={16} /> : null}
      {children !== undefined && children !== null ? <span>{children}</span> : null}
      {trailingIcon ? <Icon name={trailingIcon} size={16} /> : null}
    </a>
  );
}

export function Button({
  variant = 'primary',
  size = 'sm',
  loading = false,
  disabled,
  leadingIcon,
  trailingIcon,
  className,
  children,
  ...props
}: ButtonProps): ReactElement {
  const isDisabled = Boolean(disabled) || loading;

  return (
    <BaseButton
      {...props}
      disabled={isDisabled}
      // Keep the button focusable while loading so focus is not lost when a save starts.
      focusableWhenDisabled={loading || props.focusableWhenDisabled}
      aria-busy={loading || undefined}
      data-slot="fy-button"
      data-variant={variant}
      data-size={size}
      data-loading={loading ? '' : undefined}
      className={cn(look(variant, size), DISABLED[variant], className as string | undefined)}
    >
      {loading ? <Spinner /> : leadingIcon ? <Icon name={leadingIcon} size={16} /> : null}
      {children !== undefined && children !== null ? <span>{children}</span> : null}
      {trailingIcon ? <Icon name={trailingIcon} size={16} /> : null}
    </BaseButton>
  );
}
