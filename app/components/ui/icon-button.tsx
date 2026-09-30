import { Button as BaseButton } from '@base-ui/react/button';
import type { ComponentPropsWithoutRef, ReactElement } from 'react';
import { Icon } from '../../icons/Icon';
import { Spinner } from '../../icons/Spinner';
import { cn } from '../../lib/cn';
import { BUTTON_BASE, BUTTON_DISABLED, BUTTON_VARIANT, type ButtonSize, type ButtonVariant } from './button';
import { Tooltip, type TooltipSide } from './tooltip';

export interface IconButtonProps extends Omit<ComponentPropsWithoutRef<typeof BaseButton>, 'children' | 'aria-label'> {
  /** Iconsax name. */
  icon: string;
  /**
   * REQUIRED (design rule 10): the accessible name AND the Tooltip text — the same string, so they can never differ.
   * A few words, sentence case, no final period ("Edit", "Remove domain").
   */
  label: string;
  /** Figma `Type`. Default Tertiary: the quiet button for toolbars, rows and close controls. */
  variant?: ButtonVariant;
  /** Figma `Size`: a 32 / 40 / 48 square; the icon is 16 (20 at Large). */
  size?: ButtonSize;
  /** Figma `State=Loading`: the spinner replaces the icon; clicks are ignored. */
  loading?: boolean;
  /** Default Top; flips only to avoid clipping. Start and End follow the reading direction. */
  tooltipSide?: TooltipSide;
}

/** Square sizes 32 / 40 / 48, radius sm / sm / md (Figma Icon Button). No padding: the icon is centred. */
const SIZE: Record<ButtonSize, string> = {
  sm: 'fy:size-8 fy:rounded-sm',
  md: 'fy:size-10 fy:rounded-sm',
  lg: 'fy:size-12 fy:rounded-md',
};

/**
 * Figma "Icon Button". The Tooltip is part of the component and cannot be turned off: an icon alone names nothing, so
 * every Icon Button says what it does — on hover after 300 ms, at once on keyboard focus (design rule 10). The lint
 * rule `fyldo/icon-button-tooltip` keeps every other icon-only button in the app to the same rule.
 */
export function IconButton({
  icon,
  label,
  variant = 'tertiary',
  size = 'sm',
  loading = false,
  tooltipSide = 'top',
  disabled,
  className,
  ...props
}: IconButtonProps): ReactElement {
  return (
    <Tooltip label={label} side={tooltipSide}>
      <BaseButton
        {...props}
        aria-label={label}
        disabled={Boolean(disabled) || loading}
        // keep focus on the button while it loads, as Button does
        focusableWhenDisabled={loading || props.focusableWhenDisabled}
        aria-busy={loading || undefined}
        data-slot="fy-icon-button"
        data-variant={variant}
        data-size={size}
        data-loading={loading ? '' : undefined}
        className={cn(BUTTON_BASE, SIZE[size], BUTTON_VARIANT[variant], BUTTON_DISABLED[variant], className as string | undefined)}
      >
        {loading ? <Spinner /> : <Icon name={icon} size={size === 'lg' ? 20 : 16} />}
      </BaseButton>
    </Tooltip>
  );
}
