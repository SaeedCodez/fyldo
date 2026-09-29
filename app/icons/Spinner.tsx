import type { ReactElement } from 'react';
import { cn } from '../lib/cn';

/** Fyldo's own `Icon/spinner` (Figma: 16×16, one 270° arc, 1.5px round stroke). */
export function Spinner({ size = 16, className }: { size?: 12 | 16 | 20 | 24; className?: string }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
      data-fyldo-spinner=""
      className={cn('fy:shrink-0', className)}
      style={{ animation: 'fyldo-spin 0.8s linear infinite' }}
    >
      <path
        d="M14 8C14 9.18669 13.6481 10.3467 12.9888 11.3334C12.3295 12.3201 11.3925 13.0892 10.2961 13.5433C9.19975 13.9974 7.99335 14.1162 6.82946 13.8847C5.66558 13.6532 4.59648 13.0818 3.75736 12.2426C2.91825 11.4035 2.3468 10.3344 2.11529 9.17054C1.88378 8.00666 2.0026 6.80026 2.45673 5.7039C2.91085 4.60754 3.67989 3.67047 4.66658 3.01118C5.65328 2.35189 6.81331 2 8 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
