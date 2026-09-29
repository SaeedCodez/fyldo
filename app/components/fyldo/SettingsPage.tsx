import { useEffect, useRef, type ReactElement, type Ref } from 'react';
import { usePageForm } from '../../lib/page-form';
import type { Api } from '../../lib/api';
import type { FieldValue, PageDef, SectionDef } from '../../types';
import { FieldRenderer } from './FieldRenderer';
import type { UtilityLink } from './nav-model';
import { PageHeader } from './PageHeader';
import { SaveBar, type SaveBarState } from './SaveBar';
import { SectionCard } from './SectionCard';
import { Tabs } from './Tabs';

export interface SettingsPageProps {
  page: PageDef;
  api: Api;
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

/**
 * Content column (800px, centred, 40px from the top): Page Header → 24 → Tabs (sub-pages) → 24 → Section Cards (24
 * apart) → floating Save Bar (global save pattern). Values and edits belong to the page, so switching tabs keeps them.
 */
export function SettingsPage({ page, api, tab = '', onTabChange, headerLinks, headingRef, locale = 'en' }: SettingsPageProps): ReactElement {
  const { state, dirty, setValue, discard, save, validateField } = usePageForm(page, api);
  const column = useRef<HTMLDivElement>(null);
  const focusAfterErrors = useRef(false);

  const bar: SaveBarState | null =
    state.status === 'saving' ? 'saving' : state.status === 'error' ? 'error' : dirty.length > 0 ? 'dirty' : state.status === 'saved' ? 'saved' : null;

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

  const cards = (current: string) => (
    <div className="fy:mt-6 fy:flex fy:flex-col fy:gap-6">
      {page.sections
        .filter((section) => onTab(section, current))
        .map((section) => (
          <SectionCard key={section.id} title={section.title} description={section.description} tone={section.tone}>
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
    <div ref={column} data-slot="fy-content" className="fy:mx-auto fy:flex fy:w-full fy:max-w-208 fy:flex-1 fy:flex-col fy:px-4 fy:pt-10">
      <PageHeader title={page.title} description={page.description} links={headerLinks} headingRef={headingRef} />

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

      {page.save === 'global' && bar ? (
        <SaveBar
          state={bar}
          errorMessage={state.message || undefined}
          onSave={() => {
            focusAfterErrors.current = true;
            void save();
          }}
          onDiscard={discard}
        />
      ) : (
        <div className="fy:pb-10" />
      )}
    </div>
  );
}
