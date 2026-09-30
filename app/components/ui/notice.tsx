import type { ReactElement, ReactNode } from 'react';
import { __ } from '../../i18n';
import { Icon } from '../../icons/Icon';
import { cn } from '../../lib/cn';
import type { NoticeTone } from '../../types';
import { Tooltip } from './tooltip';

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
  /** Figma `Show action`: one Secondary Small Button (or link button) at the end, centred on the notice's height. */
  action?: ReactNode;
  /**
   * Figma `Dismissible`: a close control at the very end. Errors and warnings stay until resolved (design rule 6), so
   * only offer it on gray, blue and green notices. The caller removes the notice — and moves focus somewhere sensible.
   */
  onDismiss?: () => void;
  /**
   * The notice appeared AFTER the page loaded (a failed save, a conflict): announce it. Gray, blue and green use
   * `role="status"` (polite), amber and red `role="alert"` (assertive). Notices that are on the page from the start
   * are not live: a screen reader would otherwise read all of them out at load.
   */
  live?: boolean;
  className?: string;
}

/**
 * Figma "Notice": tone icon · title (optional) · message · action (optional) · dismiss (optional), full width, radius md.
 * The tone word is part of what a screen reader hears ("Warning: Renew soon") because colour alone never carries the
 * meaning — as the region's name, or, for a live notice, as hidden text in front of the message. It never gets the
 * WordPress `notice` class: core JS would move it out of the screen (design-spec D8).
 */
export function Notice({ tone = 'gray', title, children, action, onDismiss, live = false, className }: NoticeProps): ReactElement {
  const { look, icon, label } = TONES[tone];
  const urgent = tone === 'amber' || tone === 'red';

  return (
    <div
      role={live ? (urgent ? 'alert' : 'status') : 'region'}
      aria-label={live ? undefined : title ? `${label()}: ${title}` : label()}
      data-slot="fy-notice"
      data-tone={tone}
      className={cn('fy:flex fy:w-full fy:items-start fy:gap-3 fy:rounded-md fy:border fy:px-4 fy:py-3', look, className)}
    >
      {/* the icon sits in a box as tall as the first text line (20px; 24px in Persian), centred on it */}
      <span className="fy:flex fy:h-5 fy:shrink-0 fy:items-center fy:rtl:h-6">
        <Icon name={icon} size={16} />
      </span>
      <div className="fy:flex fy:min-w-0 fy:flex-1 fy:flex-col fy:gap-0.5">
        {title ? (
          <p className="fy:text-label-14-strong">
            {live ? <span className="fy:sr-only">{label()}: </span> : null}
            {title}
          </p>
        ) : null}
        <p className="fy:text-copy-14">
          {live && !title ? <span className="fy:sr-only">{label()}: </span> : null}
          {children}
        </p>
      </div>
      {action ? <div className="fy:flex fy:shrink-0 fy:items-center fy:self-stretch">{action}</div> : null}
      {onDismiss ? (
        // Figma "Close": the 16px `close-circle` in a 16×20 box like the tone icon; the pointer target grows to 24×24.
        <span className="fy:flex fy:h-5 fy:shrink-0 fy:items-center fy:rtl:h-6">
          <Tooltip label={__('Dismiss', 'fyldo')}>
            <button
              type="button"
              data-slot="fy-notice-dismiss"
              aria-label={__('Dismiss', 'fyldo')}
              onClick={onDismiss}
              className="fy:relative fy:inline-flex fy:size-4 fy:shrink-0 fy:cursor-pointer fy:items-center fy:justify-center fy:rounded-xs fy:transition-opacity fy:duration-100 fy:ease-out fy:hover:opacity-70 fy:focus-ring fy:before:absolute fy:before:-inset-1"
            >
              <Icon name="close-circle" size={16} />
            </button>
          </Tooltip>
        </span>
      ) : null}
    </div>
  );
}
