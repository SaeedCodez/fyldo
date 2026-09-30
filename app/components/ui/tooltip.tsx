// from shadcn base-nova tooltip @2026-09-30, restyled for Fyldo (Base UI Tooltip; Figma "Tooltip")
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';
import { usePortalContainer } from '../../lib/portal';

/** Figma `Placement`. Start and End follow the reading direction: in RTL, Start is on the right. */
export type TooltipSide = 'top' | 'bottom' | 'start' | 'end';

const SIDE = { top: 'top', bottom: 'bottom', start: 'inline-start', end: 'inline-end' } as const;

/**
 * Tooltips open on hover after 300 ms (design rule 10) and at once on keyboard focus (Base UI's default); closing on
 * leave, blur and Esc is built in. One provider per app: a second tooltip opens instantly right after the first closed.
 */
export function TooltipProvider({ children }: { children: ReactNode }): ReactElement {
  return <BaseTooltip.Provider delay={300}>{children}</BaseTooltip.Provider>;
}

export interface TooltipProps {
  /**
   * The text: a few words, sentence case, no final period, no links or buttons (a plain string on purpose). On an Icon
   * Button it is the button's accessible name too (design rule 10) — `IconButton` does that for you.
   */
  label: string;
  /** Default Top; flips only to avoid clipping. */
  side?: TooltipSide;
  /** The element the tooltip names. It receives the hover/focus handlers, so it must be a single focusable element. */
  children: ReactElement<Record<string, unknown>>;
}

/**
 * Figma "Tooltip": bubble `background/inverse`, text `text/inverse` Copy/13 (max 240 wide), padding 10/6, radius sm, and
 * a 10×5 arrow. The arrow's tip sits 6px from the trigger (measured on the Tooltip usage frame). Portals into the
 * Fyldo root.
 */
export function Tooltip({ label, side = 'top', children }: TooltipProps): ReactElement {
  const container = usePortalContainer();

  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal container={container ?? undefined}>
        {/* 6px gap + the 5px arrow, which is drawn outside the bubble */}
        <BaseTooltip.Positioner side={SIDE[side]} sideOffset={11} collisionPadding={8}>
          <BaseTooltip.Popup
            data-slot="fy-tooltip"
            className="fy:relative fy:z-50 fy:max-w-60 fy:rounded-sm fy:bg-background-inverse fy:px-2.5 fy:py-1.5 fy:text-copy-13 fy:text-text-inverse fy:transition-opacity fy:duration-150 fy:ease-out fy:data-starting-style:opacity-0 fy:data-ending-style:opacity-0 fy:data-instant:transition-none fy:motion-reduce:transition-none"
          >
            {label}
            <BaseTooltip.Arrow data-slot="fy-tooltip-arrow" className="fy:absolute fy:bg-background-inverse" />
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
