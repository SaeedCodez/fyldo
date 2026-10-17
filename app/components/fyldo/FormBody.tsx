import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type RefObject } from 'react';
import { __ } from '../../i18n';
import { ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';
import { FormValuesContext } from '../../lib/form-values';
import { firstErrorKey } from '../../lib/group';
import { PAGE_SCOPE, scopeState, type FormController, type FormShape, type FormState } from '../../lib/page-form';
import { RelationSearchContext, type RelationSearch } from '../../lib/relation';
import { isValueField, type FieldValue, type SectionDef, type TabDef } from '../../types';
import { Button } from '../ui/button';
import { Modal } from '../ui/modal';
import { Notice } from '../ui/notice';
import { useOptionalToaster } from '../ui/toast';
import { FieldRenderer } from './FieldRenderer';
import { SaveBar, saveMessages, type SaveBarState } from './SaveBar';
import { SectionCard } from './SectionCard';
import { Tabs } from './Tabs';

export interface FormBodyProps {
  /** A settings page, or a plugin's form (no tabs, saved as a whole). `title` names the tab list. */
  form: FormShape & { title?: string; tabs?: TabDef[] };
  controller: FormController;
  /** Where focus goes after a failed save, and where Ctrl/⌘+S saves: the page's column, or the Form's own element. */
  container: RefObject<HTMLElement | null>;
  /** The search of the post, term and user fields; null when the form has none. */
  search: RelationSearch | null;
  /** The active tab ('' when the form has none). */
  tab?: string;
  onTabChange?: (tab: string) => void;
  locale?: string;
  /** `record`: the conflict Notice speaks of an item, not of settings. */
  kind?: 'settings' | 'record';
  /** The 40px under the last card when no Save Bar shows: a settings page's column ends here. */
  endSpace?: boolean;
  /** The values are loading: the cards show the defaults, faded and inert, so nothing moves when the values arrive. */
  busy?: boolean;
}

/** A section without a tab belongs to the whole page: it shows on every tab. */
const onTab = (section: SectionDef, tab: string): boolean => section.tab === '' || tab === '' || section.tab === tab;

/** Per-section saving: every card with fields that hold a value gets a footer with its own Save (never a Danger card). */
const savesHere = (form: FormShape, section: SectionDef): boolean =>
  form.save === 'section' && section.tone !== 'danger' && section.fields.some(isValueField);

const conflictTexts = {
  settings: () => ({
    title: __('These settings were changed somewhere else', 'fyldo'),
    message: __('They were saved in another tab or by another person after this page was opened, so your changes were not saved. Reload the latest values to continue; your unsaved changes on this page will be lost.', 'fyldo'),
  }),
  record: () => ({
    title: __('This item was changed somewhere else', 'fyldo'),
    message: __('It was saved in another tab or by another person after you opened it, so your changes were not saved. Reload the latest values to continue; your unsaved changes will be lost.', 'fyldo'),
  }),
};

/** What the Save Bar says for a form that saves as a whole: nothing (null), Dirty, Saving, Saved or Error. */
export function saveBarState(state: FormState, dirty: readonly string[]): SaveBarState | null {
  const page = scopeState(state, PAGE_SCOPE);
  if (page.status === 'saving') return 'saving';
  if (page.status === 'error') return 'error';
  if (dirty.length > 0) return 'dirty';
  return page.status === 'saved' ? 'saved' : null;
}

/** Ctrl/⌘+S inside `container` runs `onSave` (the browser's "Save page" is never what is meant there). */
export function useSaveShortcut(container: RefObject<HTMLElement | null>, onSave: (() => void) | null): void {
  const latest = useRef(onSave);
  latest.current = onSave;
  useEffect(() => {
    const element = container.current;
    const listener = (event: KeyboardEvent): void => {
      if (!latest.current || !(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      latest.current();
    };
    element?.addEventListener('keydown', listener);
    return () => element?.removeEventListener('keydown', listener);
  }, [container]);
}

/**
 * 409: the stored values changed after this form read them. The edits stay until the person reloads. It appears after the
 * page loaded, so it is announced (role="alert": amber).
 */
export function ConflictNotice({ kind, reloading, onReload }: { kind: 'settings' | 'record'; reloading: boolean; onReload: () => void }): ReactElement {
  const text = conflictTexts[kind]();
  return (
    <Notice
      className="fy:mt-6"
      tone="amber"
      live
      title={text.title}
      action={
        <Button variant="secondary" size="sm" loading={reloading} onClick={onReload}>
          {__('Reload latest values', 'fyldo')}
        </Button>
      }
    >
      {text.message}
    </Notice>
  );
}

/**
 * What a form draws below its header: [conflict Notice → 24] → Tabs (sub-pages) → 24 → Section Cards (24 apart) →
 * floating Save Bar (global save pattern) — or a Save in each card footer (per-section pattern): one pattern per form,
 * never both. Shared by the settings pages and the plugin's record forms (`<Form>`).
 */
export function FormBody({ form, controller, container, search, tab = '', onTabChange, locale = 'en', kind = 'settings', endSpace = false, busy = false }: FormBodyProps): ReactElement {
  const { state, dirty, scopes, setValue, setError, discard, save, validateField, reload, runAction } = controller;
  const toaster = useOptionalToaster();
  // The Danger card whose confirmation is open; kept after it closes so the dialog can fade out with its text.
  const [danger, setDanger] = useState<SectionDef | null>(null);
  const lastDanger = useRef<SectionDef | null>(null);
  const dangerTrigger = useRef<HTMLElement | null>(null);
  if (danger) lastDanger.current = danger;
  const focusAfterErrors = useRef(false);
  const tabs = useMemo(() => form.tabs ?? [], [form.tabs]);
  // Every value as the fields show it (the defaults where the stored values hold none): what a custom field's `watch` reads.
  const current = useMemo(() => {
    const values: Record<string, FieldValue> = {};
    for (const field of form.sections.flatMap((s) => s.fields)) if (isValueField(field)) values[field.id] = field.id in state.values ? (state.values[field.id] as FieldValue) : field.default;
    return values;
  }, [form.sections, state.values]);

  const pageScope = scopeState(state, PAGE_SCOPE);
  const bar = saveBarState(state, dirty);

  // After a failed submit, move focus to the first invalid field — switching to its tab first when it is on another one.
  // A group's errors are its sub-fields' (`<group>.<index>.<sub-field>`): focus the first of those.
  const firstInvalid = form.sections
    .flatMap((s) => s.fields.map((f) => ({ field: f, section: s, key: firstErrorKey(state.errors, f.id) })))
    .find(({ key }) => key !== undefined);
  useEffect(() => {
    if (!focusAfterErrors.current || !firstInvalid) return;
    if (!onTab(firstInvalid.section, tab)) {
      onTabChange?.(firstInvalid.section.tab);
      return; // focus once the tab is shown (this effect runs again when `tab` changes)
    }
    focusAfterErrors.current = false;
    // A group's sub-field has a row of its own (`<group>.<index>.<sub-field>`); a message inside a value (a code field's
    // line, `<field>.<line>`) belongs to the field's row.
    // In the row, the control marked invalid comes first (a code field's textarea, not its toolbar's Copy button).
    const controls = ':is(input, textarea, button, [role="switch"], [role="combobox"], [role="checkbox"], [role="radio"])';
    const at = (key: string): HTMLElement | null | undefined => {
      const row = container.current?.querySelector<HTMLElement>(`[data-field-id="${key}"]`);
      return row?.querySelector<HTMLElement>(`${controls}[aria-invalid="true"]`) ?? row?.querySelector<HTMLElement>(controls);
    };
    (at(firstInvalid.key as string) ?? at(firstInvalid.field.id))?.focus();
  }, [state.errors, firstInvalid, tab, onTabChange, container]);

  const submit = (scope: string): void => {
    focusAfterErrors.current = true;
    void save(scope);
  };

  // Ctrl/⌘+S inside the form saves a form with a Save Bar.
  useSaveShortcut(
    container,
    form.save === 'global'
      ? () => {
          if (dirty.length > 0 && pageScope.status !== 'saving') submit(PAGE_SCOPE);
        }
      : null,
  );

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
      if (!action || !runAction) return;
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

  // The page fades in when it mounts (the shell remounts it per page); a tab switch fades only the cards.
  const lastTab = useRef(tab);
  const tabSwitched = useRef(false);
  if (tab !== lastTab.current) {
    tabSwitched.current = true;
    lastTab.current = tab;
  }

  const cards = (current: string) => (
    <div
      key={current}
      inert={busy || undefined}
      aria-busy={busy || undefined}
      className={cn('fy:mt-6 fy:flex fy:flex-col fy:gap-6', tabSwitched.current && 'fy:fade-in', busy && 'fy:opacity-60')}
    >
      {form.sections
        .filter((section) => onTab(section, current))
        .map((section) => (
          <SectionCard
            key={section.id}
            title={section.title}
            description={section.description}
            tone={section.tone}
            {...(section.tone === 'danger' && section.action && runAction ? dangerFooter(section) : savesHere(form, section) ? footer(section) : {})}
          >
            {section.fields.map((field, index) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={field.type === 'notice' ? null : field.id in state.values ? (state.values[field.id] as FieldValue) : field.default}
                error={state.errors[field.id]}
                errors={state.errors}
                reveal={state.reveal}
                divider={index < section.fields.length - 1}
                onChange={setValue}
                onGroupChange={(id, next, clear) => setValue(id, next, undefined, clear)}
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
    <FormValuesContext.Provider value={current}>
      <RelationSearchContext.Provider value={search}>
        {state.conflict ? <ConflictNotice kind={kind} reloading={state.reloading} onReload={() => void reload()} /> : null}

        {tabs.length > 0 ? (
          <Tabs
            className="fy:mt-6"
            label={form.title ?? ''}
            locale={locale}
            value={tab || (tabs[0]?.id ?? '')}
            onValueChange={(next) => onTabChange?.(next)}
            tabs={tabs.map((t) => ({ id: t.id, label: t.label, icon: t.icon || undefined, badge: t.badge || undefined }))}
          >
            {cards}
          </Tabs>
        ) : (
          cards('')
        )}

        {form.save === 'global' ? (
          <SaveBar state={bar} errorMessage={pageScope.message || undefined} onSave={() => submit(PAGE_SCOPE)} onDiscard={discard} />
        ) : null}
        {endSpace && (form.save !== 'global' || bar === null) ? <div className="fy:pb-10" /> : null}

        {runAction ? (
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
        ) : null}
      </RelationSearchContext.Provider>
    </FormValuesContext.Provider>
  );
}
