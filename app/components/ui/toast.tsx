// from shadcn base-nova toast @2026-09-30, restyled for Fyldo (Base UI Toast; Figma "Toast")
import { Toast } from '@base-ui/react/toast';
import { useDirection } from '@base-ui/react/direction-provider';
import { createContext, useContext, type ReactElement, type ReactNode } from 'react';
import { __ } from '../../i18n';
import { Icon } from '../../icons/Icon';
import { Spinner } from '../../icons/Spinner';
import { usePortalContainer } from '../../lib/portal';
import { TOAST_LIMIT, TOAST_TIMEOUT_MS, type Toaster, type ToastTone } from '../../lib/toast';
import { Button } from './button';
import { IconButton } from './icon-button';

const ToasterContext = createContext<Toaster | null>(null);

/** The app's toaster: `useToaster().success('Cache cleared')`. Must be under `ToastProvider`. */
export function useToaster(): Toaster {
  const toaster = useContext(ToasterContext);
  if (!toaster) throw new Error('Fyldo: useToaster() needs a <ToastProvider>.');
  return toaster;
}

/** The toaster when there is one (a page rendered on its own has none): for feedback that is nice to have, never the only feedback. */
export const useOptionalToaster = (): Toaster | null => useContext(ToasterContext);

/** Toast tone → icon glyph and colour (the container is identical for every tone; the icon carries it). */
function ToneIcon({ tone }: { tone: ToastTone }): ReactElement {
  if (tone === 'loading') return <Spinner className="fy:text-icon-primary" />;
  const glyph = { neutral: 'information', success: 'tick-circle', error: 'info-circle' } as const;
  const colour = { neutral: 'fy:text-icon-primary', success: 'fy:text-status-success-solid', error: 'fy:text-status-error-solid' } as const;
  return <Icon name={glyph[tone]} size={16} className={colour[tone]} />;
}

/** Space between stacked toasts, in px (the Toast usage frame draws them 12 apart). */
export const STACK_GAP = 12;

const isTone = (type: string | undefined): type is ToastTone => type === 'neutral' || type === 'success' || type === 'error' || type === 'loading';

/**
 * The stack: `Toast.Viewport` fixed at the bottom-end corner, 24px from both edges, 400 wide (bottom-right in LTR,
 * bottom-left in RTL). Toasts are always laid out expanded — 12px apart (measured on the Toast usage frame), the
 * newest at the bottom, older ones moving up — at most `TOAST_LIMIT` visible; the oldest beyond it wait, hidden, and
 * come back as room frees up. Hovering or focusing the stack pauses every timer (Base UI); F6 jumps into it.
 */
function ToastList(): ReactElement {
  const { toasts, close } = Toast.useToastManager();
  const direction = useDirection();

  return (
    <>
      {toasts.map((toast) => {
        const tone: ToastTone = isTone(toast.type) ? toast.type : 'neutral';
        return (
          <Toast.Root
            key={toast.id}
            toast={toast}
            swipeDirection={['down', direction === 'rtl' ? 'left' : 'right']}
            data-slot="fy-toast"
            data-tone={tone}
            // Base UI hides an Error toast from assistive technology until it is focused (its alert is announced through a
            // separate live region) while leaving it, and its buttons, focusable — an ARIA violation (aria-hidden-focus).
            // A toast stays in the accessibility tree: the announcement still comes from that live region.
            aria-hidden={false}
            className="fy:absolute fy:bottom-0 fy:w-full fy:overflow-hidden fy:rounded-lg fy:border fy:border-border-default fy:bg-background-default fy:shadow-medium fy:select-none fy:transition fy:duration-200 fy:ease-out fy:motion-reduce:transition-none fy:data-starting-style:translate-y-6 fy:data-starting-style:opacity-0 fy:data-ending-style:opacity-0 fy:data-limited:pointer-events-none fy:data-limited:opacity-0"
            style={{
              height: 'var(--toast-height)',
              // The 0th toast is the newest, at the bottom. Each older one sits above the heights of the newer ones
              // (`--toast-offset-y`) plus a 12px gap per toast between them (measured on the Toast usage frame).
              transform: `translateX(var(--toast-swipe-movement-x)) translateY(calc(var(--toast-swipe-movement-y) - var(--toast-offset-y) - var(--toast-index) * ${STACK_GAP}px))`,
              zIndex: 'calc(1000 - var(--toast-index))',
            }}
          >
            <Toast.Content className="fy:flex fy:items-center fy:gap-3 fy:py-2 fy:ps-4 fy:pe-2">
              <span className="fy:flex fy:size-4 fy:shrink-0 fy:items-center fy:justify-center">
                <ToneIcon tone={tone} />
              </span>
              <div className="fy:flex fy:min-w-0 fy:flex-1 fy:flex-col fy:gap-0.5">
                <Toast.Title className="fy:text-label-14-strong fy:text-text-primary" />
                <Toast.Description className="fy:text-copy-13 fy:text-text-secondary" />
              </div>
              {/* Figma `Action`: a Tertiary Small Button, one verb. It runs its handler and closes the toast. */}
              {toast.actionProps ? (
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={(event) => {
                    toast.actionProps?.onClick?.(event);
                    close(toast.id);
                  }}
                >
                  {toast.actionProps.children}
                </Button>
              ) : null}
              <IconButton icon="close-circle" label={__('Close', 'fyldo')} onClick={() => close(toast.id)} />
            </Toast.Content>
          </Toast.Root>
        );
      })}
    </>
  );
}

export interface ToastProviderProps {
  toaster: Toaster;
  children: ReactNode;
}

/**
 * Provides the toaster and draws the stack. Portals into the Fyldo root (never `document.body`), so toasts carry the
 * scoped tokens; the viewport is the "Notifications" landmark — a polite live region, and Error toasts are announced
 * assertively (Base UI: `priority: 'high'`).
 */
export function ToastProvider({ toaster, children }: ToastProviderProps): ReactElement {
  const container = usePortalContainer();

  return (
    <ToasterContext.Provider value={toaster}>
      <Toast.Provider toastManager={toaster.manager} limit={TOAST_LIMIT} timeout={TOAST_TIMEOUT_MS}>
        {children}
        <Toast.Portal container={container ?? undefined}>
          <Toast.Viewport
            aria-label={__('Notifications', 'fyldo')}
            data-slot="fy-toast-viewport"
            className="fy:fixed fy:bottom-6 fy:z-50 fy:w-100"
            // 24px from the bottom-end corner: bottom-right in LTR, bottom-left in RTL; never wider than the screen
            style={{ insetInlineEnd: 24, maxWidth: 'calc(100vw - 48px)' }}
          >
            <ToastList />
          </Toast.Viewport>
        </Toast.Portal>
      </Toast.Provider>
    </ToasterContext.Provider>
  );
}
