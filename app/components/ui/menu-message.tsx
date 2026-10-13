import type { ReactElement } from 'react';
import { __ } from '../../i18n';
import { Spinner } from '../../icons/Spinner';
import { cn } from '../../lib/cn';
import { Button } from './button';

export type MenuMessageKind = 'loading' | 'empty' | 'error';

export interface MenuMessageProps {
  kind: MenuMessageKind;
  /** Error: sends the failed request again. */
  onRetry?: () => void;
  className?: string;
}

/**
 * Figma "Menu Message": the status row of a Select Menu whose options load from the server. It takes the place of the
 * options (or sits under them while the next page loads). Menu Item geometry: 40 high, padding 8 (`space/8`), radius
 * `radius/sm`, Copy/14 `text/tertiary`. Loading leads with the spinner (`icon/tertiary`); Error is `text/secondary` with a
 * Tertiary Small "Retry" at the end, the row's padding 4 around the button (start 8).
 */
export function MenuMessage({ kind, onRetry, className }: MenuMessageProps): ReactElement {
  if (kind === 'error') {
    return (
      <div data-slot="fy-menu-message" data-kind={kind} role="alert" className={cn('fy:flex fy:h-10 fy:items-center fy:gap-2 fy:rounded-sm fy:py-1 fy:ps-2 fy:pe-1', className)}>
        <span className="fy:min-w-0 fy:flex-1 fy:truncate fy:text-copy-14 fy:text-text-secondary">{__('Couldn’t load results.', 'fyldo')}</span>
        <Button variant="tertiary" size="sm" onClick={onRetry}>
          {__('Retry', 'fyldo')}
        </Button>
      </div>
    );
  }

  return (
    <div data-slot="fy-menu-message" data-kind={kind} role="status" className={cn('fy:flex fy:h-10 fy:items-center fy:gap-2 fy:rounded-sm fy:p-2 fy:text-copy-14 fy:text-text-tertiary', className)}>
      {kind === 'loading' ? <Spinner className="fy:text-icon-tertiary" /> : null}
      <span className="fy:min-w-0 fy:truncate">{kind === 'loading' ? __('Searching…', 'fyldo') : __('No results found.', 'fyldo')}</span>
    </div>
  );
}
