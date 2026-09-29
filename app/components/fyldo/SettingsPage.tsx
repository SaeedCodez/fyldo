import { useEffect, useRef, type ReactElement } from 'react';
import { usePageForm } from '../../lib/page-form';
import type { Api } from '../../lib/api';
import type { PageDef } from '../../types';
import { FieldRenderer } from './FieldRenderer';
import { PageHeader } from './PageHeader';
import { SaveBar, type SaveBarState } from './SaveBar';
import { SectionCard } from './SectionCard';

export interface SettingsPageProps {
  page: PageDef;
  api: Api;
}

/** Content column (800px, centred): header → section cards → floating Save Bar (global save pattern). */
export function SettingsPage({ page, api }: SettingsPageProps): ReactElement {
  const { state, dirty, setValue, discard, save, validateField } = usePageForm(page, api);
  const column = useRef<HTMLDivElement>(null);
  const focusAfterErrors = useRef(false);

  const bar: SaveBarState | null =
    state.status === 'saving' ? 'saving' : state.status === 'error' ? 'error' : dirty.length > 0 ? 'dirty' : state.status === 'saved' ? 'saved' : null;

  // After a failed submit, move focus to the first invalid field.
  const firstInvalid = page.sections.flatMap((s) => s.fields).find((f) => state.errors[f.id]);
  useEffect(() => {
    if (!focusAfterErrors.current || !firstInvalid) return;
    focusAfterErrors.current = false;
    column.current
      ?.querySelector<HTMLElement>(`[data-field-id="${firstInvalid.id}"] :is(input, button, [role="switch"], [role="combobox"])`)
      ?.focus();
  }, [state.errors, firstInvalid]);

  return (
    <div ref={column} className="fy:mx-auto fy:flex fy:w-full fy:max-w-200 fy:flex-1 fy:flex-col fy:px-4 fy:pt-10">
      <PageHeader title={page.title} description={page.description} />

      <div className="fy:mt-6 fy:flex fy:flex-col fy:gap-6">
        {page.sections.map((section) => (
          <SectionCard key={section.id} title={section.title} description={section.description} tone={section.tone}>
            {section.fields.map((field, index) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={state.values[field.id] ?? field.default}
                error={state.errors[field.id]}
                divider={index < section.fields.length - 1}
                onChange={setValue}
                onBlur={validateField}
              />
            ))}
          </SectionCard>
        ))}
      </div>

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
