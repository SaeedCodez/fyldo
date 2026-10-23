import { Component as ReactComponent, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactElement, type ReactNode, type Ref, type RefObject } from 'react';
import { __ } from '../../i18n';
import type { RequestFn } from '../../lib/api';
import { customPageDefinition, type CustomPageDefinition, type CustomPageMountHandle, type CustomPageProps } from '../../lib/custom-pages';
import { DirtyContext, type DirtyRegistry, type DirtyScope } from '../../lib/dirty';
import type { Toaster } from '../../lib/toast';
import type { CustomPageDef } from '../../types';
import { Notice } from '../ui/notice';
import { PageHeader } from './PageHeader';
import { toUtilityLinks } from './nav-model';
import { CONTENT_COLUMN } from './SettingsPage';

export interface CustomPageHostProps {
  page: CustomPageDef;
  path: string[];
  locale: string;
  dir: 'ltr' | 'rtl';
  /** Show another path of this page (through the unsaved-changes guard). */
  navigate: (path: string[], options?: { replace?: boolean }) => void;
  request: RequestFn;
  toaster: Toaster | null;
  /** The app's registry of unsaved edits on custom pages. */
  dirty: DirtyRegistry;
  /** The app's heading ref: focus goes there after a page or path change. */
  heading: RefObject<HTMLElement | null>;
  /** The content column: focus goes there instead when the page puts no `headingRef` on its h1. */
  column?: Ref<HTMLDivElement>;
}

/** The setDirty() flag's entry in the registry; a Form's entries are its own ids. */
const PAGE_ENTRY = 'page';
const FLAGGED = { isDirty: () => true };

/** Said in place of a page whose module could not be loaded, or that crashed. The navigation still works. */
function Unavailable({ page, headingRef }: { page: CustomPageDef; headingRef: (element: HTMLElement | null) => void }): ReactElement {
  return (
    <>
      <PageHeader title={page.title} description={page.description} links={toUtilityLinks(page.links)} headingRef={headingRef} />
      <Notice className="fy:mt-6" tone="red">
        {__('This page couldn’t be loaded.', 'fyldo')}
      </Notice>
    </>
  );
}

/** A crash in the plugin's page stays inside the content column. */
class Boundary extends ReactComponent<{ id: string; fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(`Fyldo: custom page "${this.props.id}" crashed.`, error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Plain-DOM path: `mount` once, `update` on every new set of props, `destroy` when the page goes away. */
function Mounted({ id, mount, props, onFail }: { id: string; mount: NonNullable<CustomPageDefinition['mount']>; props: CustomPageProps; onFail: () => void }): ReactElement {
  const element = useRef<HTMLDivElement>(null);
  const handle = useRef<CustomPageMountHandle | void>(undefined);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const host = element.current;
    if (!host) return undefined;
    try {
      handle.current = mount(host, latest.current);
    } catch (e) {
      console.error(`Fyldo: the mount() of custom page "${id}" threw.`, e);
      onFail();
    }
    return () => {
      try {
        handle.current?.destroy?.();
      } catch (e) {
        console.error(`Fyldo: the destroy() of custom page "${id}" threw.`, e);
      }
      handle.current = undefined;
      host.replaceChildren();
    };
  }, [id, mount, onFail]);

  useEffect(() => {
    try {
      handle.current?.update?.(props);
    } catch (e) {
      console.error(`Fyldo: the update() of custom page "${id}" threw.`, e);
    }
  });

  return <div ref={element} data-slot="fy-custom-page-mount" className="fy:flex fy:flex-col" />;
}

/**
 * A page the plugin draws (docs: custom pages), in the same content column as a settings page, so its screens line up
 * with the rest. The column itself takes focus after a page or path change when the page puts no `headingRef` on its h1.
 */
export function CustomPage({ page, path, locale, dir, navigate, request, toaster, dirty, heading, column }: CustomPageHostProps): ReactElement {
  const definition = customPageDefinition(page.module);
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => setFailed(true), []);

  const scope = useMemo<DirtyScope>(() => ({ set: (entry, value) => dirty.set(page.id, entry, value) }), [dirty, page.id]);

  // Stable callbacks: a page may keep the ones it got first (in `mount`, or in its own effects).
  const go = useRef(navigate);
  go.current = navigate;
  const pageNavigate = useCallback<CustomPageProps['navigate']>(
    (next, options) => go.current(typeof next === 'string' ? next.split('/').filter((part) => part !== '') : [...next], options),
    [],
  );
  const setDirty = useCallback((value: boolean) => scope.set(PAGE_ENTRY, value ? FLAGGED : null), [scope]);
  const headingRef = useCallback(
    (element: HTMLElement | null) => {
      heading.current = element;
    },
    [heading],
  );
  const toast = useMemo<CustomPageProps['toast']>(
    () => ({
      success: (message) => void toaster?.success(message),
      error: (message, options) => void toaster?.error(message, options?.action ? { action: options.action } : undefined),
    }),
    [toaster],
  );
  const info = useMemo(
    () => ({ id: page.id, title: page.title, description: page.description, icon: page.icon, links: toUtilityLinks(page.links) }),
    [page],
  );

  const props: CustomPageProps = { page: info, path, props: page.props, locale, dir, navigate: pageNavigate, request, toast, setDirty, headingRef };
  const fallback = <Unavailable page={page} headingRef={headingRef} />;
  const { Component, mount } = definition ?? {};

  return (
    <div ref={column} data-slot="fy-content" data-page="custom" tabIndex={-1} className={`${CONTENT_COLUMN} fy:outline-none`}>
      <DirtyContext.Provider value={scope}>
        {!definition || failed ? (
          fallback
        ) : (
          <Boundary id={page.id} fallback={fallback}>
            {Component ? <Component {...props} /> : mount ? <Mounted id={page.id} mount={mount} props={props} onFail={fail} /> : null}
          </Boundary>
        )}
      </DirtyContext.Provider>
      <div className="fy:pb-10" />
    </div>
  );
}
