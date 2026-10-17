/**
 * Custom pages: the plugin's own ES module draws a whole page (a list of records, a record editor, a dashboard) inside
 * Fyldo's content column. Imported before the first render with the custom fields' modules (app/lib/modules.ts); the
 * module gets the same SDK (app/lib/sdk.ts).
 */
import type { ComponentType } from 'react';
import { isCustomPage, type FyldoConfig, type JsonValue } from '../types';
import type { RequestFn } from './api';
import { createModuleRegistry } from './modules';
import type { FyldoSdk } from './sdk';

/** What the page gets, in React (`Component` props) and in plain DOM (`mount` / `update`). */
export interface CustomPageProps {
  page: { id: string; title: string; description: string; icon: string };
  /** The URL segments after the page's id, decoded: `#/announcements/42/edit` → ['42', 'edit']; [] at the page itself. */
  path: string[];
  /** The page's `props` from PHP. */
  props: Record<string, JsonValue>;
  locale: string;
  dir: 'ltr' | 'rtl';
  /**
   * Show another path of this page (`'42/edit'` or `['42', 'edit']`; '' or [] = the page itself). It adds a history
   * entry (`replace`: it does not), and asks first when the page has unsaved changes.
   */
  navigate: (path: string | string[], options?: { replace?: boolean }) => void;
  /** The plugin's own REST routes, relative to the site's REST root, with the user's nonce. */
  request: RequestFn;
  /** Toasts in Fyldo's stack: one short sentence without a final period; an error may offer one action ("Retry"). */
  toast: {
    success: (message: string) => void;
    error: (message: string, options?: { action?: { label: string; onClick: () => void } }) => void;
  };
  /** The page has unsaved changes (a `<Form>` reports its own): leaving it, or its path, asks first. */
  setDirty: (dirty: boolean) => void;
  /** Put it on the page's h1 (`ui.PageHeader`'s `headingRef`): focus goes there after a page or path change. */
  headingRef: (element: HTMLElement | null) => void;
}

export interface CustomPageMountHandle {
  /** New props (another path, a new `navigate`…). */
  update?: (props: CustomPageProps) => void;
  /** The page leaves the screen. */
  destroy?: () => void;
}

export interface CustomPageDefinition {
  /** A React component, rendered with Fyldo's own React (hooks work; never bundle a second React). */
  Component?: ComponentType<CustomPageProps>;
  /** Plain DOM, or any framework: draw into `element`. Used when there is no `Component`. */
  mount?: (element: HTMLElement, props: CustomPageProps) => CustomPageMountHandle | void;
}

/** A module's default export: the definition, or a function of the SDK that returns it. */
export type CustomPageExport = CustomPageDefinition | ((sdk: FyldoSdk) => CustomPageDefinition);

const registry = createModuleRegistry<CustomPageDefinition>('custom page');

/** Use `exported` for the pages whose `module` is `url` (the loader does this; tests too). */
export const defineCustomPage = (url: string, exported: unknown): void => registry.define(url, exported);

/** The definition for a module URL; null when it could not be loaded or used (the page says so). */
export const customPageDefinition = (url: string): CustomPageDefinition | null => registry.get(url);

/** Every custom page's `module`. */
export const collectPageModules = (config: Pick<FyldoConfig, 'pages'>): string[] => [...new Set(config.pages.filter(isCustomPage).map((p) => p.module))];

/** Import every module in parallel. Never rejects: a module that fails is reported and its page says so. */
export const loadCustomPages = (urls: string[]): Promise<void> => registry.load(urls);
