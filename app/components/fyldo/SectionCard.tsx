import type { ReactElement, ReactNode } from 'react';
import { useId } from 'react';
import { cn } from '../../lib/cn';

export interface SectionCardProps {
  title: string;
  description?: string;
  /** `danger`: red border, tinted footer — destructive actions only, always last on the page. */
  tone?: 'default' | 'danger';
  /** Only rendered when the page saves per section (or for a Danger card). */
  footer?: ReactNode;
  footerText?: string;
  /** `error`: the footer text is an error (`status/error/text`), e.g. a failed per-section save. */
  footerStatus?: 'default' | 'error';
  /** The footer text is a live status (a per-section save): announced politely when it changes. */
  footerLive?: boolean;
  children?: ReactNode;
}

/** Figma "Section Card": 800px column, radius lg, 1px border, header / rows / optional footer. */
export function SectionCard({ title, description, tone = 'default', footer, footerText, footerStatus = 'default', footerLive = false, children }: SectionCardProps): ReactElement {
  const titleId = useId();
  const danger = tone === 'danger';

  return (
    <section
      aria-labelledby={titleId}
      data-slot="fy-section-card"
      data-tone={tone}
      className={cn(
        'fy:overflow-hidden fy:rounded-lg fy:border fy:bg-background-default',
        danger ? 'fy:border-status-error-border' : 'fy:border-border-default',
      )}
    >
      <header className={cn('fy:flex fy:flex-col fy:gap-1.5 fy:px-6 fy:pt-6', children ? 'fy:pb-1' : 'fy:pb-6')}>
        <h2 id={titleId} className="fy:text-heading-20 fy:text-text-primary">
          {title}
        </h2>
        {description ? <p className="fy:text-copy-14 fy:text-text-secondary">{description}</p> : null}
      </header>
      {children ? <div className="fy:flex fy:flex-col fy:px-6 fy:pb-1">{children}</div> : null}
      {footer ? (
        <footer
          className={cn(
            'fy:flex fy:items-center fy:gap-4 fy:border-t fy:px-6 fy:py-3',
            danger ? 'fy:border-status-error-border fy:bg-status-error-bg' : 'fy:border-border-default fy:bg-background-subtle',
          )}
        >
          <p
            aria-live={footerLive ? 'polite' : undefined}
            data-slot="fy-section-card-footer-text"
            className={cn('fy:flex-1 fy:text-copy-13', danger || footerStatus === 'error' ? 'fy:text-status-error-text' : 'fy:text-text-secondary')}
          >
            {footerText}
          </p>
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
