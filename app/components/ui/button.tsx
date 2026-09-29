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
 * Figma draws the 1px stroke INSIDE the box, so widths are the same for every type. With a real CSS border we take the
 * border from the padding: 12 → 11, 16 → 15, 20 → 19 (`px-2.75` = 11px on the 4px spacing scale).
 */
const SIZE: Record<ButtonSize, string> = {
  sm: 'fy:h-8 fy:px-2.75 fy:gap-1.5 fy:rounded-sm fy:text-button-14',
  md: 'fy:h-10 fy:px-3.75 fy:gap-1.5 fy:rounded-sm fy:text-button-14',
  lg: 'fy:h-12 fy:px-4.75 fy:gap-2 fy:rounded-md fy:text-button-16',
};

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'fy:bg-action-primary fy:text-text-inverse fy:border-transparent fy:hover:bg-action-primary-hover',
  secondary:
    'fy:bg-action-secondary fy:text-text-primary fy:border-border-default fy:hover:bg-action-secondary-hover fy:hover:border-border-hover',
  tertiary: 'fy:bg-transparent fy:text-text-primary fy:border-transparent fy:hover:bg-action-tertiary-hover',
  error: 'fy:bg-action-danger fy:text-text-inverse fy:border-transparent fy:hover:bg-action-danger-hover',
};

/** Disabled and Loading look identical (Figma): pale fill + inside stroke; Tertiary has neither. */
const DISABLED: Record<ButtonVariant, string> = {
  primary: 'fy:data-disabled:bg-action-disabled fy:data-disabled:text-text-disabled fy:data-disabled:border-border-default fy:data-disabled:hover:bg-action-disabled',
  secondary: 'fy:data-disabled:bg-action-disabled fy:data-disabled:text-text-disabled fy:data-disabled:border-border-default fy:data-disabled:hover:bg-action-disabled fy:data-disabled:hover:border-border-default',
  tertiary: 'fy:data-disabled:bg-transparent fy:data-disabled:text-text-disabled fy:data-disabled:border-transparent fy:data-disabled:hover:bg-transparent',
  error: 'fy:data-disabled:bg-action-disabled fy:data-disabled:text-text-disabled fy:data-disabled:border-border-default fy:data-disabled:hover:bg-action-disabled',
};

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
      className={cn(
        'fy:inline-flex fy:shrink-0 fy:items-center fy:justify-center fy:whitespace-nowrap fy:border fy:select-none fy:transition-colors fy:duration-100 fy:ease-out',
        'fy:focus-ring',
        SIZE[size],
        VARIANT[variant],
        DISABLED[variant],
        'fy:data-disabled:cursor-not-allowed',
        className as string | undefined,
      )}
    >
      {loading ? <Spinner /> : leadingIcon ? <Icon name={leadingIcon} size={16} /> : null}
      {children !== undefined && children !== null ? <span>{children}</span> : null}
      {trailingIcon ? <Icon name={trailingIcon} size={16} /> : null}
    </BaseButton>
  );
}
