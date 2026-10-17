import type { ReactElement, ReactNode } from 'react';
import { Icon } from '../../icons/Icon';
import { __ } from '../../i18n';
import { cn } from '../../lib/cn';
import { Badge, type BadgeTone } from './badge';

export type StatTrend = 'up' | 'down' | 'neutral';
export type StatTone = 'positive' | 'negative' | 'neutral';

export interface StatDelta {
  /** The change, already formatted in the page's numerals ("12%", "۱۲٪"). */
  value: ReactNode;
  /** The direction: an arrow up or down; none for neutral. */
  trend: StatTrend;
  /**
   * Whether the change is good news. Default: up → positive (green), down → negative (red), neutral → gray. Set it when
   * up is bad (a bounce rate that went up is `{ trend: 'up', tone: 'negative' }`).
   */
  tone?: StatTone;
}

export interface StatCardProps {
  /** What is counted ("Views"), one or two words. */
  label: string;
  /** The number, already formatted in the page's numerals ("4,820", "۴٬۸۲۰"). */
  value: ReactNode;
  /** Iconsax name, drawn 16px in the 28px box at the end of the header. */
  icon?: string;
  /** The change against the previous period, as a Small subtle Badge. */
  delta?: StatDelta;
  /** What the change is measured against ("vs previous 30 days"). */
  comparison?: ReactNode;
  className?: string;
}

const TONE: Record<StatTone, BadgeTone> = { positive: 'green', negative: 'red', neutral: 'gray' };
const DEFAULT_TONE: Record<StatTrend, StatTone> = { up: 'positive', down: 'negative', neutral: 'neutral' };
/** The pack's `arrow-up` / `arrow-down` swaps are chevrons: `arrow-up-2` / `arrow-down-2` in the code's icon set (geometry-matched). */
const ARROW: Record<StatTrend, string | undefined> = { up: 'arrow-up-2', down: 'arrow-down-2', neutral: undefined };

/**
 * Figma "Stat Card", 222 wide in Figma; in code it fills its grid cell. Radius lg, 1px `border/default`,
 * `background/default`, padding 16, gap 8: the header (label Label/13 `text/secondary` · a 28px icon box, radius md,
 * `border/default`, icon `icon/secondary`), the value (Heading/24), and the footer 6 apart — the delta Badge (Green, Red or
 * Gray, Subtle Small, with an up or down chevron) and the comparison (Label/12 `text/tertiary`). The arrow is only a
 * picture: screen readers hear "Up" or "Down" before the change.
 */
export function StatCard({ label, value, icon, delta, comparison, className }: StatCardProps): ReactElement {
  const trendText = delta ? { up: __('Up', 'fyldo'), down: __('Down', 'fyldo'), neutral: '' }[delta.trend] : '';

  return (
    <div data-slot="fy-stat-card" className={cn('fy:flex fy:w-full fy:flex-col fy:gap-2 fy:rounded-lg fy:border fy:border-border-default fy:bg-background-default fy:p-4', className)}>
      <div className="fy:flex fy:items-center fy:justify-between fy:gap-2">
        <p className="fy:min-w-0 fy:text-label-13 fy:text-text-secondary">{label}</p>
        {icon ? (
          <span aria-hidden="true" className="fy:flex fy:size-7 fy:shrink-0 fy:items-center fy:justify-center fy:rounded-md fy:border fy:border-border-default fy:bg-background-default fy:text-icon-secondary">
            <Icon name={icon} size={16} />
          </span>
        ) : null}
      </div>
      <p data-slot="fy-stat-card-value" className="fy:text-heading-24 fy:text-text-primary">
        {value}
      </p>
      {delta || (comparison !== undefined && comparison !== null) ? (
        <div className="fy:flex fy:items-center fy:gap-1.5">
          {delta ? (
            <Badge tone={TONE[delta.tone ?? DEFAULT_TONE[delta.trend]]} size="sm" icon={ARROW[delta.trend]}>
              {trendText ? <span className="fy:sr-only">{trendText} </span> : null}
              {delta.value}
            </Badge>
          ) : null}
          {comparison !== undefined && comparison !== null ? <p className="fy:min-w-0 fy:flex-1 fy:text-label-12 fy:text-text-tertiary">{comparison}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
