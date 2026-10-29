import type { ReactElement, ReactNode } from 'react';
import { __, formatNumber, sprintf } from '../../i18n';
import { cn } from '../../lib/cn';
import { usePortalContainer } from '../../lib/portal';
import { IconButton } from './icon-button';

export interface PaginationProps {
  /** The current page, 1-based. */
  page: number;
  /** How many pages there are. With one page (or none) nothing is rendered. */
  pageCount: number;
  /** Called with the page to show (`page − 1` or `page + 1`). */
  onPageChange: (page: number) => void;
  /** At the start: what is shown ("Showing 1–8 of 24 items"), in the page's numerals. */
  summary?: ReactNode;
  /** The `<nav>`'s accessible name. Default "Pagination"; name it when a page has more than one ("Stories pages"). */
  'aria-label'?: string;
  className?: string;
}

/**
 * Figma "Pagination": a row that fills its container, the summary (Label/13 `text/secondary`) at the start and the
 * controls 8 apart at the end — Previous (Secondary Small Icon Button), "Page 1 of 3" (Label/13 `text/secondary`, in
 * the page's numerals), Next. The arrows mirror in RTL (Previous points right). At either end its button is disabled,
 * never hidden, and stays focusable so focus is not lost on the last click; the page text is announced when it changes.
 */
export function Pagination({ page, pageCount, onPageChange, summary, 'aria-label': label, className }: PaginationProps): ReactElement | null {
  const locale = usePortalContainer()?.lang || undefined;
  if (pageCount <= 1) return null;

  const number = (n: number) => (locale ? formatNumber(n, locale) : String(n));
  const first = page <= 1;
  const last = page >= pageCount;

  return (
    <nav aria-label={label ?? __('Pagination', 'fyldo')} data-slot="fy-pagination" className={cn('fy:flex fy:w-full fy:items-center fy:justify-between fy:gap-4', className)}>
      {summary !== undefined && summary !== null ? <p className="fy:min-w-0 fy:text-label-13 fy:text-text-secondary">{summary}</p> : null}
      <div className="fy:ms-auto fy:flex fy:shrink-0 fy:items-center fy:gap-2">
        <IconButton
          icon="arrow-left"
          label={__('Previous page', 'fyldo')}
          variant="secondary"
          size="sm"
          disabled={first}
          focusableWhenDisabled
          onClick={() => onPageChange(page - 1)}
        />
        <span aria-live="polite" aria-atomic="true" data-slot="fy-pagination-page" className="fy:whitespace-nowrap fy:text-label-13 fy:text-text-secondary">
          {/* translators: 1: the current page number, 2: the number of pages. */}
          {sprintf(__('Page %1$s of %2$s', 'fyldo'), number(page), number(pageCount))}
        </span>
        <IconButton
          icon="arrow-right"
          label={__('Next page', 'fyldo')}
          variant="secondary"
          size="sm"
          disabled={last}
          focusableWhenDisabled
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </nav>
  );
}
