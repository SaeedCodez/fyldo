import { useEffect, useRef, type ReactElement, type Ref } from 'react';
import { __ } from '../../i18n';
import { PAGE_SCOPE, scopeState, usePageForm, type FormStore } from '../../lib/page-form';
import type { Api } from '../../lib/api';
import { isValueField, type FieldValue, type PageDef, type SectionDef } from '../../types';
import { Button } from '../ui/button';
import { Notice } from '../ui/notice';
import { FieldRenderer } from './FieldRenderer';
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
export function SettingsPage({ page, api, store, tab = '', onTabChange, headerLinks, headingRef, locale = 'en' }: SettingsPageProps): ReactElement {
  const { state, dirty, scopes, setValue, discard, save, validateField, reload } = usePageForm(page, api, store);
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
            {...(savesHere(page, section) ? footer(section) : {})}
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

      {state.conflict ? (
        // 409: the stored values changed after this page read them. The edits stay until the user reloads.
        <Notice
          className="fy:mt-6"
          tone="amber"
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
    </div>
  );
}
