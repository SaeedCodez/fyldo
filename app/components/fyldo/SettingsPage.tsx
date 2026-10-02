import { useCallback, useEffect, useRef, useState, type ReactElement, type Ref } from 'react';
import { __ } from '../../i18n';
import { PAGE_SCOPE, scopeState, usePageForm, type FormStore } from '../../lib/page-form';
import { ApiError, type Api } from '../../lib/api';
import { isValueField, type FieldValue, type NoticeDef, type PageDef, type SectionDef } from '../../types';
import { Button } from '../ui/button';
import { Modal } from '../ui/modal';
import { Notice } from '../ui/notice';
import { useOptionalToaster } from '../ui/toast';
import { FieldRenderer } from './FieldRenderer';
import { Notices } from './Notices';
import type { UtilityLink } from './nav-model';
import { PageHeader } from './PageHeader';
import { SaveBar, saveMessages, type SaveBarState } from './SaveBar';
import { SectionCard } from './SectionCard';
import { Tabs } from './Tabs';

export interface SettingsPageProps {
  page: PageDef;
  api: Api;
  /** The app's forms (they outlive this component: page switches keep values, revision and status). */
  store?: FormStore;
  /** The active tab ('' when the page has none). */
  tab?: string;
  onTabChange?: (tab: string) => void;
  /** Page Header actions (links placed in the header; none in the Top Navigation layout). */
  headerLinks?: UtilityLink[];
  headingRef?: Ref<HTMLHeadingElement>;
  locale?: string;
  /** PHP notices for this page (`Instance::admin_notice()`), most severe first, dismissed ones already left out. */
  notices?: NoticeDef[];
  onDismissNotice?: (id: string) => void;
}

/** A section without a tab belongs to the whole page: it shows on every tab. */
const onTab = (section: SectionDef, tab: string): boolean => section.tab === '' || tab === '' || section.tab === tab;

/** Per-section saving: every card with fields that hold a value gets a footer with its own Save (never a Danger card). */
const savesHere = (page: PageDef, section: SectionDef): boolean =>
  page.save === 'section' && section.tone !== 'danger' && section.fields.some(isValueField);

/**
 * Content column (800px, centred, 40px from the top): Page Header → 24 → [conflict Notice → 24] → Tabs (sub-pages) → 24
 * → Section Cards (24 apart) → floating Save Bar (global save pattern) — or a Save in each card footer (per-section
 * pattern): one pattern per page, never both. Values and edits belong to the page, so switching tabs keeps them.
 */
export function SettingsPage({ page, api, store, tab = '', onTabChange, headerLinks, headingRef, locale = 'en', notices = [], onDismissNotice }: SettingsPageProps): ReactElement {
  const { state, dirty, scopes, setValue, setError, discard, save, validateField, reload, runAction } = usePageForm(page, api, store);
  const toaster = useOptionalToaster();
  // The Danger card whose confirmation is open; kept after it closes so the dialog can fade out with its text.
  const [danger, setDanger] = useState<SectionDef | null>(null);
  const lastDanger = useRef<SectionDef | null>(null);
  const dangerTrigger = useRef<HTMLElement | null>(null);
  if (danger) lastDanger.current = danger;
  const column = useRef<HTMLDivElement>(null);
  const focusAfterErrors = useRef(false);

  const pageScope = scopeState(state, PAGE_SCOPE);
  const bar: SaveBarState | null =
    pageScope.status === 'saving'
      ? 'saving'
      : pageScope.status === 'error'
        ? 'error'
        : dirty.length > 0
          ? 'dirty'
          : pageScope.status === 'saved'
            ? 'saved'
            : null;

  // After a failed submit, move focus to the first invalid field — switching to its tab first when it is on another one.
  const firstInvalid = page.sections.flatMap((s) => s.fields.map((f) => ({ field: f, section: s }))).find(({ field }) => state.errors[field.id]);
  useEffect(() => {
    if (!focusAfterErrors.current || !firstInvalid) return;
    if (!onTab(firstInvalid.section, tab)) {
      onTabChange?.(firstInvalid.section.tab);
      return; // focus once the tab is shown (this effect runs again when `tab` changes)
    }
    focusAfterErrors.current = false;
    column.current
      ?.querySelector<HTMLElement>(`[data-field-id="${firstInvalid.field.id}"] :is(input, textarea, button, [role="switch"], [role="combobox"], [role="checkbox"], [role="radio"])`)
      ?.focus();
  }, [state.errors, firstInvalid, tab, onTabChange]);

  const submit = (scope: string): void => {
    focusAfterErrors.current = true;
    void save(scope);
  };

  // Ctrl/⌘+S inside the page saves a page with a Save Bar (the browser's "Save page" is never what is meant here).
  const shortcut = useRef<(event: KeyboardEvent) => void>(() => undefined);
  shortcut.current = (event) => {
    if (page.save !== 'global' || !(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 's') return;
    event.preventDefault();
    if (dirty.length > 0 && pageScope.status !== 'saving') submit(PAGE_SCOPE);
  };
  useEffect(() => {
    const element = column.current;
    const listener = (event: KeyboardEvent): void => shortcut.current(event);
    element?.addEventListener('keydown', listener);
    return () => element?.removeEventListener('keydown', listener);
  }, []);

  const footer = (section: SectionDef) => {
    const scope = scopeState(state, section.id);
    const sectionDirty = dirty.some((id) => scopes.get(id) === section.id);
    const text =
      scope.status === 'saving'
        ? saveMessages.saving()
        : scope.status === 'error'
          ? scope.message
          : sectionDirty
            ? saveMessages.dirty()
            : scope.status === 'saved'
              ? saveMessages.saved()
              : __('Changes take effect after you save.', 'fyldo');
    return {
      footerText: text,
      footerStatus: scope.status === 'error' ? ('error' as const) : ('default' as const),
      footerLive: true,
      footer: (
        <Button
          variant="primary"
          size="sm"
          loading={scope.status === 'saving'}
          disabled={!sectionDirty && scope.status !== 'saving'}
          // Pressing the button would blur the field first, and its blur validation can add an error row ABOVE this
          // footer, moving the button away before the click completes. Keep focus in the field: Save validates anyway.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => submit(section.id)}
        >
          {__('Save', 'fyldo')}
        </Button>
      ),
    };
  };

  /**
   * Runs a Danger card's action. Every outcome ends in a toast, never a silent failure; the page's values are replaced
   * on success, which is the real confirmation (the toast only says so). A failed request offers Retry.
   */
  const attempt = useCallback(
    async (section: SectionDef): Promise<void> => {
      const action = section.action;
      if (!action) return;
      try {
        await runAction(action.id, action.confirm.keyword);
        toaster?.success(__('Settings reset to defaults', 'fyldo'));
      } catch (error) {
        const unreachable = error instanceof ApiError && (error.status === 0 || error.status >= 500);
        const message = error instanceof ApiError && !unreachable ? error.message : __("Couldn't reset settings. Check your connection and try again.", 'fyldo');
        toaster?.error(message, unreachable || !(error instanceof ApiError) ? { action: { label: __('Retry', 'fyldo'), onClick: () => void attempt(section) } } : undefined);
      }
    },
    [runAction, toaster],
  );

  const dangerFooter = (section: SectionDef) => ({
    footerText: __('This action can’t be undone.', 'fyldo'),
    footer: (
      <Button
        variant="error"
        size="sm"
        onClick={(event) => {
          dangerTrigger.current = event.currentTarget;
          setDanger(section);
        }}
      >
        {section.action?.label || __('Reset settings', 'fyldo')}
      </Button>
    ),
  });

  const cards = (current: string) => (
    <div className="fy:mt-6 fy:flex fy:flex-col fy:gap-6">
      {page.sections
        .filter((section) => onTab(section, current))
        .map((section) => (
          <SectionCard
            key={section.id}
            title={section.title}
            description={section.description}
            tone={section.tone}
            {...(section.tone === 'danger' && section.action ? dangerFooter(section) : savesHere(page, section) ? footer(section) : {})}
          >
            {section.fields.map((field, index) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={field.type === 'notice' ? null : field.id in state.values ? (state.values[field.id] as FieldValue) : field.default}
                error={state.errors[field.id]}
                divider={index < section.fields.length - 1}
                onChange={setValue}
                onBlur={validateField}
                media={state.media[field.id] ?? null}
                onError={setError}
                revision={state.revision}
                locale={locale}
              />
            ))}
          </SectionCard>
        ))}
    </div>
  );

  return (
    <div
      ref={column}
      data-slot="fy-content"
      data-save={page.save}
      className="fy:mx-auto fy:flex fy:w-full fy:max-w-208 fy:flex-1 fy:flex-col fy:px-4 fy:pt-10"
    >
      <PageHeader title={page.title} description={page.description} links={headerLinks} headingRef={headingRef} />

      <Notices notices={notices} onDismiss={(id) => onDismissNotice?.(id)} />

      {state.conflict ? (
        // 409: the stored values changed after this page read them. The edits stay until the user reloads. It appears
        // after the page loaded, so it is announced (role="alert": amber).
        <Notice
          className="fy:mt-6"
          tone="amber"
          live
          title={__('These settings were changed somewhere else', 'fyldo')}
          action={
            <Button variant="secondary" size="sm" loading={state.reloading} onClick={() => void reload()}>
              {__('Reload latest values', 'fyldo')}
            </Button>
          }
        >
          {__('They were saved in another tab or by another person after this page was opened, so your changes were not saved. Reload the latest values to continue; your unsaved changes on this page will be lost.', 'fyldo')}
        </Notice>
      ) : null}

      {page.tabs.length > 0 ? (
        <Tabs
          className="fy:mt-6"
          label={page.title}
          locale={locale}
          value={tab || (page.tabs[0]?.id ?? '')}
          onValueChange={(next) => onTabChange?.(next)}
          tabs={page.tabs.map((t) => ({ id: t.id, label: t.label, icon: t.icon || undefined, badge: t.badge || undefined }))}
        >
          {cards}
        </Tabs>
      ) : (
        cards('')
      )}

      {page.save === 'global' ? (
        <SaveBar state={bar} errorMessage={pageScope.message || undefined} onSave={() => submit(PAGE_SCOPE)} onDiscard={discard} />
      ) : null}
      {page.save !== 'global' || bar === null ? <div className="fy:pb-10" /> : null}

      <Modal
        open={danger !== null}
        onOpenChange={(open) => {
          if (!open) setDanger(null);
        }}
        type="danger"
        title={lastDanger.current?.action?.confirm.title || __('Reset all settings?', 'fyldo')}
        description={lastDanger.current?.action?.confirm.description || __('Every option on this page will return to its default value. This can’t be undone.', 'fyldo')}
        cancelLabel={__('Cancel', 'fyldo')}
        confirmLabel={lastDanger.current?.action?.confirm.label || lastDanger.current?.action?.label || __('Reset settings', 'fyldo')}
        confirmKeyword={lastDanger.current?.action?.confirm.keyword || undefined}
        onConfirm={async () => {
          if (danger) await attempt(danger);
          setDanger(null);
        }}
        // the button that opened it is still there after a reset: focus goes back to it, like after Cancel
        focusAfterConfirm={() => dangerTrigger.current}
      />
    </div>
  );
}
