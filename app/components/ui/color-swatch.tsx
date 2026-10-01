import { forwardRef, type ButtonHTMLAttributes, type ReactElement } from 'react';
import { cn } from '../../lib/cn';

/** Figma "Color" frames: 16 (Small field, preset), 20 (Medium field), 24 (Large field). */
export type ColorDotSize = 16 | 20 | 24;

const DOT_SIZE: Record<ColorDotSize, string> = { 16: 'fy:size-4', 20: 'fy:size-5', 24: 'fy:size-6' };

/**
 * The colour chip: `radius/xs`, a 1px `border/default` stroke, filled with the value. The fill is a literal colour on
 * purpose (the colour IS the data); everything else is token-bound. With no colour it is Figma's dashed outline
 * (`border/strong`, dashes 3/3) and no fill.
 */
export function ColorDot({ color, size = 16, className }: { color: string; size?: ColorDotSize; className?: string }): ReactElement {
  if (color === '') {
    return (
      <svg
        aria-hidden="true"
        data-slot="fy-color-dot"
        data-empty=""
        viewBox={`0 0 ${size} ${size}`}
        className={cn('fy:block fy:shrink-0 fy:fill-none fy:stroke-border-strong', DOT_SIZE[size], className)}
      >
        <rect x="0.5" y="0.5" width={size - 1} height={size - 1} rx="3.5" strokeDasharray="3 3" />
      </svg>
    );
  }
  return (
    <span
      aria-hidden="true"
      data-slot="fy-color-dot"
      className={cn('fy:box-border fy:block fy:shrink-0 fy:rounded-xs fy:border fy:border-border-default', DOT_SIZE[size], className)}
      style={{ backgroundColor: color }}
    />
  );
}

export interface ColorSwatchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color' | 'children'> {
  /** `#rrggbb`. Also the accessible name unless `aria-label` says otherwise. */
  color: string;
  selected?: boolean;
}

/*
 * Figma "Color Swatch" (24×24, `radius/sm`, a 16px chip centred in it). Default: nothing around the chip. Hover:
 * `surface/hover`. Selected: a 2px `focus/border` stroke. Focus: `background/default`, a 2px `focus/ring-neutral` stroke and
 * the soft 3px halo of the inputs. Disabled: 40% opacity.
 */
export const ColorSwatch = forwardRef<HTMLButtonElement, ColorSwatchProps>(function ColorSwatch({ color, selected = false, className, ...props }, ref) {
  return (
    <button
      type="button"
      ref={ref}
      aria-label={color}
      data-slot="fy-color-swatch"
      data-selected={selected ? '' : undefined}
      className={cn(
        'fy:box-border fy:inline-flex fy:size-6 fy:shrink-0 fy:items-center fy:justify-center fy:rounded-sm fy:border-2 fy:p-0 fy:outline-none',
        'fy:cursor-pointer fy:transition-colors fy:duration-100 fy:ease-out',
        selected ? 'fy:border-focus-border' : 'fy:border-transparent fy:hover:bg-surface-hover',
        'fy:focus-visible:border-focus-ring-neutral fy:focus-visible:bg-background-default fy:focus-visible:shadow-focus-input',
        'fy:disabled:cursor-not-allowed fy:disabled:opacity-40 fy:disabled:hover:bg-transparent',
        className,
      )}
      {...props}
    >
      <ColorDot color={color} size={16} />
    </button>
  );
});
