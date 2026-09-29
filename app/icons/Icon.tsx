import { createElement, type ReactElement } from 'react';
import { cn } from '../lib/cn';
import { normalizeIconName } from './normalize';
import { useIconNodes } from './registry';
import { RTL_FLIP } from './rtl-flip';
import type { IconNode } from './types';

export type IconSize = 12 | 16 | 20 | 24;

export interface IconProps {
  /** Any Iconsax icon by kebab-case name: `setting-2`, `arrow-down`, `tick-circle`… */
  name: string;
  /** 16 default · 12 Badge/Tag · 20 large Icon Button · 24 Empty State. */
  size?: IconSize;
  /** Meaningful icons only. Decorative icons (the default) are `aria-hidden`. */
  label?: string;
  className?: string;
}

function renderNode([tag, attrs, children]: IconNode, index: number): ReactElement {
  return createElement(
    tag,
    // Figma keeps the 1.5px stroke when it scales the 24px grid down to 16px: keep it in screen pixels.
    { ...attrs, vectorEffect: 'non-scaling-stroke', key: index },
    children?.map(renderNode),
  );
}

/**
 * The ONLY way other components draw an Iconsax icon: always Linear, always `currentColor`.
 * Unknown names render nothing (and warn once); RTL-directional icons mirror under `dir="rtl"`.
 */
export function Icon({ name, size = 16, label, className }: IconProps): ReactElement | null {
  const nodes = useIconNodes(name);
  const flip = RTL_FLIP.has(normalizeIconName(name));

  if (nodes === null) {
    // Unknown (warned) or still loading: keep the box so nothing shifts.
    return <span aria-hidden="true" className={cn('fy:inline-block fy:shrink-0', className)} style={{ width: size, height: size }} />;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      data-fyldo-icon={normalizeIconName(name)}
      className={cn('fy:shrink-0', flip && 'fy:rtl:-scale-x-100', className)}
    >
      {nodes.map(renderNode)}
    </svg>
  );
}
