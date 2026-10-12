import type { ReactElement } from 'react';
import { cn } from '../lib/cn';

const DOTS = [
  [9, 6],
  [15, 6],
  [9, 12],
  [15, 12],
  [9, 18],
  [15, 18],
] as const;

/** Fyldo's own `Icon/drag` (Figma: the 24 grid, six 0.75 radius dots with a 1.5px round stroke): Iconsax has no grip. */
export function DragHandle({
  size = 20,
  className,
}: {
  size?: 16 | 18 | 20 | 24;
  className?: string;
}): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      data-fyldo-icon="drag"
      className={cn('fy:shrink-0', className)}
    >
      {DOTS.map(([cx, cy]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="0.75"
          stroke="currentColor"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
