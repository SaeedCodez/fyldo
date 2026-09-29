import type { ReactElement } from 'react';
import { __ } from '../../i18n';
import { Icon } from '../../icons/Icon';
import { Spinner } from '../../icons/Spinner';
import { cn } from '../../lib/cn';
import { Button } from '../ui/button';

export type SaveBarState = 'dirty' | 'saving' | 'saved' | 'error';

export interface SaveBarProps {
  state: SaveBarState;
  onSave: () => void;
  onDiscard: () => void;
  /** Overrides the default error text (e.g. a conflict message). */
  errorMessage?: string;
}

/**
 * Figma "Save Bar": floating, 32px from the bottom of the viewport, same width as the content column.
 * Dirty → Saving → Saved, or Error. Its Saved state IS the confirmation — never add a toast.
 */
export function SaveBar({ state, onSave, onDiscard, errorMessage }: SaveBarProps): ReactElement {
  const message =
    state === 'dirty'
      ? __('You have unsaved changes', 'fyldo')
      : state === 'saving'
        ? __('Saving changes…', 'fyldo')
        : state === 'saved'
          ? __('All changes saved', 'fyldo')
          : (errorMessage ?? __("Couldn't save. Check your connection and try again.", 'fyldo'));

  return (
    <div className="fy:sticky fy:bottom-8 fy:z-10 fy:mt-auto fy:pt-6">
      <div
        role="region"
        aria-label={__('Unsaved changes', 'fyldo')}
        data-slot="fy-save-bar"
        data-state={state}
        className={cn(
          'fy:flex fy:items-center fy:gap-4 fy:rounded-lg fy:border fy:bg-background-default fy:ps-5 fy:pe-3 fy:py-2.5 fy:shadow-medium',
          state === 'error' ? 'fy:border-status-error-border' : 'fy:border-border-default',
        )}
      >
        <div className="fy:flex fy:min-w-0 fy:flex-1 fy:items-center fy:gap-2.5">
          <span className="fy:flex fy:size-4 fy:shrink-0 fy:items-center fy:justify-center">
            {state === 'dirty' ? <span className="fy:size-2 fy:rounded-full fy:bg-status-warning-solid" /> : null}
            {state === 'saving' ? <Spinner /> : null}
            {state === 'saved' ? <Icon name="tick-circle" size={16} className="fy:text-status-success-solid" /> : null}
            {state === 'error' ? <Icon name="info-circle" size={16} className="fy:text-status-error-solid" /> : null}
          </span>
          <p aria-live="polite" className={cn('fy:text-label-14', state === 'error' ? 'fy:text-status-error-text' : 'fy:text-text-primary')}>
            {message}
          </p>
        </div>
        <div className="fy:flex fy:shrink-0 fy:items-center fy:gap-2">
          <Button variant="secondary" size="sm" onClick={onDiscard} disabled={state === 'saving' || state === 'saved'}>
            {__('Discard', 'fyldo')}
          </Button>
          <Button variant="primary" size="sm" onClick={onSave} loading={state === 'saving'} disabled={state === 'saved'}>
            {__('Save changes', 'fyldo')}
          </Button>
        </div>
      </div>
    </div>
  );
}
