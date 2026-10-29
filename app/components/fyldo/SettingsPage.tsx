import { useEffect, useMemo, useRef, type ReactElement, type Ref } from 'react';
import type { Api } from '../../lib/api';
import { usePageForm, type FormStore } from '../../lib/page-form';
import type { RelationSearch } from '../../lib/relation';
import type { NoticeDef, PageDef } from '../../types';
import { FormBody } from './FormBody';
import { Notices } from './Notices';
import type { PageLink } from './nav-model';
import { PageHeader } from './PageHeader';
import { toUtilityLinks } from './nav-model';

export interface SettingsPageProps {
  page: PageDef;
  api: Api;
  /** The app's forms (they outlive this component: page switches keep values, revision and status). */
  store?: FormStore;
  /**
   * Re-read the stored values when the page is shown, unless it has unsaved edits: the app's store may hold values read
   * before something else (a record's save, another page's save) changed the page's option. Off for the page the screen
   * opened on, whose values PHP has just rendered.
   */
  refreshOnShow?: boolean;
  /** The active tab ('' when the page has none). */
  tab?: string;
  onTabChange?: (tab: string) => void;
  /** The instance's Page Header actions (links placed in the header; none in the Top Navigation layout). The page's own `links` come first. */
  headerLinks?: PageLink[];
  headingRef?: Ref<HTMLHeadingElement>;
  locale?: string;
  /** PHP notices for this page (`Instance::admin_notice()`), most severe first, dismissed ones already left out. */
  notices?: NoticeDef[];
  onDismissNotice?: (id: string) => void;
}

/** The content column: 960px, centred, 40px from the top. Custom pages use it too, so every page lines up. */
export const CONTENT_COLUMN = 'fy:fade-in fy:mx-auto fy:flex fy:w-full fy:max-w-256 fy:flex-1 fy:flex-col fy:px-8 fy:pt-10 fy:wp-mobile:px-4';

/**
 * A settings page in the content column: Page Header → 24 → [notices] → the form (FormBody: conflict Notice, Tabs,
 * Section Cards, Save Bar or card footers). Values and edits belong to the page, so switching tabs keeps them.
 */
export function SettingsPage({ page, api, store, refreshOnShow = false, tab = '', onTabChange, headerLinks = [], headingRef, locale = 'en', notices = [], onDismissNotice }: SettingsPageProps): ReactElement {
  const controller = usePageForm(page, api, store);
  const { refresh } = controller;
  // Once, when the page is shown (the app remounts it for each page): tab switches keep what was read.
  const shownOnce = useRef(false);
  useEffect(() => {
    if (shownOnce.current || !refreshOnShow) return;
    shownOnce.current = true;
    void refresh();
  }, [refreshOnShow, refresh]);
  // The post, term and user fields search through the page's REST route.
  const relationSearch = useMemo<RelationSearch | null>(() => {
    const searchItems = api.searchItems;
    return searchItems ? (path, query, signal) => searchItems(page.id, path, query, signal) : null;
  }, [api, page.id]);
  const column = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={column}
      data-slot="fy-content"
      data-save={page.save}
      className={CONTENT_COLUMN}
    >
      <PageHeader title={page.title} description={page.description} links={[...toUtilityLinks(page.links), ...headerLinks]} headingRef={headingRef} />

      <Notices notices={notices} onDismiss={(id) => onDismissNotice?.(id)} />

      <FormBody form={page} controller={controller} container={column} search={relationSearch} tab={tab} onTabChange={onTabChange} locale={locale} endSpace />
    </div>
  );
}
