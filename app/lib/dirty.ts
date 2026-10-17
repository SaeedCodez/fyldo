/**
 * Unsaved edits on custom pages, for the unsaved-changes guard. A settings page's edits are in the app's form store; a
 * custom page's are wherever the plugin keeps them, so the page reports them here: `setDirty()` from its props, and every
 * `<Form>` on it registers itself. Entries are read when the guard asks (never a copy that a re-render could leave stale).
 */
import { createContext, useContext } from 'react';

export interface DirtyEntry {
  isDirty: () => boolean;
  /** Called by Discard in the unsaved-changes dialog (a Form drops its edits). */
  discard?: () => void;
}

export interface DirtyRegistry {
  /** null removes the entry. */
  set(page: string, entry: string, value: DirtyEntry | null): void;
  isDirty(page: string): boolean;
  /** Discard every entry of the page and forget them. */
  discard(page: string): void;
}

export function createDirtyRegistry(): DirtyRegistry {
  const pages = new Map<string, Map<string, DirtyEntry>>();
  return {
    set(page, entry, value) {
      const entries = pages.get(page) ?? new Map<string, DirtyEntry>();
      if (value) entries.set(entry, value);
      else entries.delete(entry);
      pages.set(page, entries);
    },
    isDirty: (page) => [...(pages.get(page)?.values() ?? [])].some((entry) => entry.isDirty()),
    discard(page) {
      pages.get(page)?.forEach((entry) => entry.discard?.());
      pages.delete(page);
    },
  };
}

/** The shown custom page's part of the registry (none outside a custom page: nothing to guard). */
export interface DirtyScope {
  set(entry: string, value: DirtyEntry | null): void;
}

export const DirtyContext = createContext<DirtyScope | null>(null);

export const useDirtyScope = (): DirtyScope | null => useContext(DirtyContext);
