import type { ReactElement, ReactNode } from 'react';
import { Icon } from '../../icons/Icon';
import { cn } from '../../lib/cn';

export type BadgeTone = 'gray' | 'blue' | 'green' | 'amber' | 'red';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  /** Figma `Tone` (Gray = neutral). */
  tone?: BadgeTone;
  /** Figma `Style`. Named `appearance` because `style` is React's. Solid is for one high-emphasis label ("Pro"). */
  appearance?: 'subtle' | 'solid';
  /** Figma `Size`: Small 20px / Medium 24px. */
  size?: BadgeSize;
  /** Optional 12px leading icon. */
  icon?: string;
  /** 1–2 words, or a count. Never interactive. */
  children: ReactNode;
  className?: string;
}

/*
 * Figma Badge: a pill (radius full), padding-x 6 (Small) / 8 (Medium), gap 4, Label/12 Strong or Label/13 Strong.
 * Subtle: `status/<tone>/subtle` fill + `status/<tone>/text`. Solid: `status/<tone>/solid` + `text/inverse`, except
 * Amber, whose Solid text is `text/primary` (dark on amber).
 */
const SIZE: Record<BadgeSize, string> = {
  sm: 'fy:h-5 fy:px-1.5 fy:text-label-12-strong',
  md: 'fy:h-6 fy:px-2 fy:text-label-13-strong',
};

const SUBTLE: Record<BadgeTone, string> = {
  gray: 'fy:bg-status-neutral-subtle fy:text-status-neutral-text',
  blue: 'fy:bg-status-info-subtle fy:text-status-info-text',
  green: 'fy:bg-status-success-subtle fy:text-status-success-text',
  amber: 'fy:bg-status-warning-subtle fy:text-status-warning-text',
  red: 'fy:bg-status-error-subtle fy:text-status-error-text',
};

const SOLID: Record<BadgeTone, string> = {
  gray: 'fy:bg-status-neutral-solid fy:text-text-inverse',
  blue: 'fy:bg-status-info-solid fy:text-text-inverse',
  green: 'fy:bg-status-success-solid fy:text-text-inverse',
  amber: 'fy:bg-status-warning-solid fy:text-text-primary',
  red: 'fy:bg-status-error-solid fy:text-text-inverse',
};

/** Short status label or count (Nav Item badge, Tab count, the brand's version). No role: it is text. */
export function Badge({
  tone = 'gray',
  appearance = 'subtle',
  size = 'sm',
  icon,
  children,
  className,
}: BadgeProps): ReactElement {
  return (
    <span
      data-slot="fy-badge"
      data-tone={tone}
      className={cn(
        'fy:inline-flex fy:shrink-0 fy:items-center fy:justify-center fy:gap-1 fy:rounded-full fy:whitespace-nowrap',
        SIZE[size],
        (appearance === 'solid' ? SOLID : SUBTLE)[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}
