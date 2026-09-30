import type { ReactElement, ReactNode } from 'react';
import { __ } from '../../i18n';
import { Icon } from '../../icons/Icon';
import { cn } from '../../lib/cn';
import type { NoticeTone } from '../../types';

export type { NoticeTone };

/** Figma `Notice` Tone → status token family, tone icon, and the word a screen reader hears for it (colour alone never carries the meaning). */
const TONES: Record<NoticeTone, { look: string; icon: string; label: () => string }> = {
  gray: { look: 'fy:border-status-neutral-border fy:bg-status-neutral-bg fy:text-status-neutral-text', icon: 'information', label: () => __('Note', 'fyldo') },
  blue: { look: 'fy:border-status-info-border fy:bg-status-info-bg fy:text-status-info-text', icon: 'information', label: () => __('Information', 'fyldo') },
  green: { look: 'fy:border-status-success-border fy:bg-status-success-bg fy:text-status-success-text', icon: 'tick-circle', label: () => __('Success', 'fyldo') },
  amber: { look: 'fy:border-status-warning-border fy:bg-status-warning-bg fy:text-status-warning-text', icon: 'danger', label: () => __('Warning', 'fyldo') },
  red: { look: 'fy:border-status-error-border fy:bg-status-error-bg fy:text-status-error-text', icon: 'info-circle', label: () => __('Error', 'fyldo') },
};

export interface NoticeProps {
  /** Figma `Tone`: gray (default), blue, green, amber, red. */
  tone?: NoticeTone;
  /** Figma `Show title`: short, sentence case. Optional. */
  title?: string;
  /** The message: what happened and what to do next. */
  children: ReactNode;
  /** Figma `Show action`: one Secondary Small Button at the end, centred on the notice's height. */
  action?: ReactNode;
  className?: string;
}

/**
 * Figma "Notice": tone icon · title (optional) · message · action (optional), full width. Dismissing is Milestone 4. A notice that is on the page from the start is a labelled region, not a live region (it must not
 * interrupt a screen reader when the page loads); the label starts with the tone word: "Warning: Renew soon".
 */
export function Notice({ tone = 'gray', title, children, action, className }: NoticeProps): ReactElement {
  const { look, icon, label } = TONES[tone];

  return (
    <div
      role="region"
      aria-label={title ? `${label()}: ${title}` : label()}
      data-slot="fy-notice"
      data-tone={tone}
      className={cn('fy:flex fy:w-full fy:items-start fy:gap-3 fy:rounded-md fy:border fy:px-4 fy:py-3', look, className)}
    >
      {/* the icon sits in a box as tall as the first text line (20px; 24px in Persian), centred on it */}
      <span className="fy:flex fy:h-5 fy:shrink-0 fy:items-center fy:rtl:h-6">
        <Icon name={icon} size={16} />
      </span>
      <div className="fy:flex fy:min-w-0 fy:flex-1 fy:flex-col fy:gap-0.5">
        {title ? <p className="fy:text-label-14-strong">{title}</p> : null}
        <p className="fy:text-copy-14">{children}</p>
      </div>
      {action ? <div className="fy:flex fy:shrink-0 fy:items-center fy:self-stretch">{action}</div> : null}
    </div>
  );
}
