import { useEffect, useState, type ReactElement } from 'react';
import { __ } from '../../i18n';
import { Icon } from '../../icons/Icon';
import { Spinner } from '../../icons/Spinner';
import { cn } from '../../lib/cn';
import { useMediaQuery } from '../../lib/media';
import { Button } from '../ui/button';

export type SaveBarState = 'dirty' | 'saving' | 'saved' | 'error';

export interface SaveBarProps {
  /** null: nothing to say (a clean page); the bar is not shown. */
  state: SaveBarState | null;
  onSave: () => void;
  onDiscard: () => void;
  /** The Error message (the pack's "Couldn’t save. Check the highlighted fields." by default). */
  errorMessage?: string;
}

/** How long the Save Bar takes to slide in and out (docs/ARCHITECTURE.md §11, motion proposal). */
export const SAVE_BAR_MOTION_MS = 200;

/** The status texts of a save (also used by the Section Card footers of pages that save per section). */
export const saveMessages = {
  dirty: () => __('You have unsaved changes', 'fyldo'),
  saving: () => __('Saving changes…', 'fyldo'),
  saved: () => __('All changes saved', 'fyldo'),
  error: () => __('Couldn’t save. Check the highlighted fields.', 'fyldo'),
};

/**
 * Figma "Save Bar" (global save pattern): floating, 32px from the bottom of the viewport (16px at ≤782px), as wide as
 * the content column. Dirty → Saving → Saved, or Error. Its Saved state IS the confirmation — never add a toast
 * (design rule 3). "All changes saved" stays until the next edit or 4 s (O15), then the bar slides out; it slides in
 * when it appears. No motion under `prefers-reduced-motion`.
 */
export function SaveBar({ state, onSave, onDiscard, errorMessage }: SaveBarProps): ReactElement | null {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  // The last state shown, kept while the Saved bar slides out.
  const [last, setLast] = useState<SaveBarState | null>(state);
  if (state !== null && state !== last) setLast(state);
  const leaving = state === null && last === 'saved' && !reduced;

  useEffect(() => {
    if (!leaving) return undefined;
    const timer = window.setTimeout(() => setLast(null), SAVE_BAR_MOTION_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  const shown = state ?? (leaving ? last : null);
  if (shown === null) return null;

  const message = shown === 'error' ? (errorMessage ?? saveMessages.error()) : saveMessages[shown]();

  return (
    <div className="fy:sticky fy:bottom-8 fy:z-10 fy:mt-auto fy:pt-6 fy:wp-mobile:bottom-4">
      <div
        role="region"
        aria-label={__('Unsaved changes', 'fyldo')}
        data-slot="fy-save-bar"
        data-state={shown}
        data-leaving={leaving ? '' : undefined}
        aria-hidden={leaving ? true : undefined}
        className={cn(
          'fy:flex fy:items-center fy:gap-4 fy:rounded-lg fy:border fy:bg-background-default fy:ps-5 fy:pe-3 fy:py-2.5 fy:shadow-medium',
          'fy:transition fy:duration-200 fy:ease-out fy:starting:translate-y-2 fy:starting:opacity-0 fy:motion-reduce:transition-none',
          leaving && 'fy:translate-y-2 fy:opacity-0',
          shown === 'error' ? 'fy:border-status-error-border' : 'fy:border-border-default',
        )}
      >
        <div className="fy:flex fy:min-w-0 fy:flex-1 fy:items-center fy:gap-2.5">
          <span className="fy:flex fy:size-4 fy:shrink-0 fy:items-center fy:justify-center">
            {shown === 'dirty' ? <span className="fy:size-2 fy:rounded-full fy:bg-status-warning-solid" /> : null}
            {shown === 'saving' ? <Spinner /> : null}
            {shown === 'saved' ? <Icon name="tick-circle" size={16} className="fy:text-status-success-solid" /> : null}
            {shown === 'error' ? <Icon name="info-circle" size={16} className="fy:text-status-error-solid" /> : null}
          </span>
          <p aria-live="polite" className={cn('fy:text-label-14', shown === 'error' ? 'fy:text-status-error-text' : 'fy:text-text-primary')}>
            {message}
          </p>
        </div>
        <div className="fy:flex fy:shrink-0 fy:items-center fy:gap-2">
          <Button variant="secondary" size="sm" onClick={onDiscard} disabled={shown === 'saving' || shown === 'saved'}>
            {__('Discard', 'fyldo')}
          </Button>
          <Button variant="primary" size="sm" onClick={onSave} loading={shown === 'saving'} disabled={shown === 'saved'}>
            {__('Save changes', 'fyldo')}
          </Button>
        </div>
      </div>
    </div>
  );
}

