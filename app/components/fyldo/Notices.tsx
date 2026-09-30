import type { ReactElement } from 'react';
import { __ } from '../../i18n';
import type { NoticeDef } from '../../types';
import { ButtonLink } from '../ui/button';
import { Notice } from '../ui/notice';

export interface NoticesProps {
  /** Notices PHP queued with `Instance::admin_notice()` (already filtered to this page, most severe first). */
  notices: NoticeDef[];
  /** A dismissible notice was dismissed. */
  onDismiss: (id: string) => void;
}

/**
 * Fyldo's own notice slot, under the Page Header (design rule 6: page-level notices at the top of the settings
 * content). Notices are 12px apart, most severe first, and never carry the WordPress `notice` class — core JS would move
 * them out of the screen. They are on the page from the start, so they are labelled regions, not live regions.
 */
export function Notices({ notices, onDismiss }: NoticesProps): ReactElement | null {
  if (notices.length === 0) return null;

  return (
    <div data-slot="fy-notices" className="fy:mt-6 fy:flex fy:flex-col fy:gap-3">
      {notices.map((notice) => (
        <Notice
          key={notice.id}
          tone={notice.tone}
          title={notice.title || undefined}
          onDismiss={notice.dismissible ? () => onDismiss(notice.id) : undefined}
          action={
            notice.action ? (
              <ButtonLink
                href={notice.action.url}
                target={notice.action.external ? '_blank' : undefined}
                rel={notice.action.external ? 'noopener noreferrer' : undefined}
                variant="secondary"
                size="sm"
                trailingIcon={notice.action.external ? 'export-square' : undefined}
              >
                {notice.action.label}
                {notice.action.external ? (
                  <>
                    {' '}
                    <span className="fy:sr-only">{__('(opens in a new tab)', 'fyldo')}</span>
                  </>
                ) : null}
              </ButtonLink>
            ) : undefined
          }
        >
          {notice.message}
        </Notice>
      ))}
    </div>
  );
}
