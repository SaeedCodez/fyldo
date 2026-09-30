/**
 * Toasts: the manager the app queues them on (Base UI's `createToastManager` behind Fyldo's design rules). Where they
 * are drawn is `ToastProvider` (app/components/ui/toast.tsx).
 *
 * Rules from the Toast usage frame, kept here so callers cannot forget them:
 *  - Neutral and Success dismiss after 5 s (the timer pauses while the pointer or focus is inside — Base UI);
 *    Error and Loading stay until resolved or closed.
 *  - At most one action, a single verb ("Undo", "Retry") — one `action`, not a list.
 *  - Error is announced assertively (`role="alert"`); the others politely (`role="status"`).
 *  - The global Save Bar's "Saved" is the confirmation of a save: never queue a toast for it. Never for validation.
 */
import { Toast } from '@base-ui/react/toast';

export type ToastTone = 'neutral' | 'success' | 'error' | 'loading';

export interface ToastOptions {
  /** Figma `Tone`; default neutral. */
  tone?: ToastTone;
  /** One short sentence, no final period. */
  title: string;
  /** Only when it helps the next step. */
  description?: string;
  /** Figma `Action`: one verb. Clicking it runs `onClick` and closes the toast. */
  action?: { label: string; onClick: () => void };
  /** Milliseconds before it goes away; 0 = until closed. Default 5000 (neutral, success) or 0 (error, loading). */
  timeout?: number;
  /** Queue under a known id to update that toast in place instead of adding one. */
  id?: string;
}

/** How long Neutral and Success stay (design rule 5). */
export const TOAST_TIMEOUT_MS = 5000;

/** At most this many are visible; the newest is at the bottom and older ones move up (design rule 5). */
export const TOAST_LIMIT = 3;

export interface PromiseMessages<Value> {
  loading: string;
  success: string | ((result: Value) => string);
  error: string | ((error: unknown) => string);
}

export interface Toaster {
  /** Queues (or, with an existing `id`, updates) a toast. Returns its id. */
  show(options: ToastOptions): string;
  neutral(title: string, rest?: Omit<ToastOptions, 'title' | 'tone'>): string;
  success(title: string, rest?: Omit<ToastOptions, 'title' | 'tone'>): string;
  error(title: string, rest?: Omit<ToastOptions, 'title' | 'tone'>): string;
  /** A task that takes a while: stays until you `update` it or the promise helper resolves it. */
  loading(title: string, rest?: Omit<ToastOptions, 'title' | 'tone'>): string;
  update(id: string, options: Partial<ToastOptions>): void;
  /** Loading while `promise` runs, then Success or Error with the given texts. Resolves/rejects like `promise`. */
  promise<Value>(promise: Promise<Value>, messages: PromiseMessages<Value>): Promise<Value>;
  /** Closes one toast, or all of them without an id. */
  close(id?: string): void;
  /** For `<Toast.Provider toastManager>`. */
  readonly manager: ReturnType<typeof Toast.createToastManager>;
}

const persists = (tone: ToastTone): boolean => tone === 'error' || tone === 'loading';

/** What Base UI is given for a toast: tone → `type`, error → high priority, the action → the action button's props. */
function toBase(o: Partial<ToastOptions> & { tone: ToastTone }) {
  const { tone, title, description, action, timeout } = o;
  if (process.env.NODE_ENV !== 'production' && title && /[.。]$/.test(title.trim())) {
    console.warn(`Fyldo: a toast is one short sentence without a final period ("${title}").`);
  }
  return {
    type: tone,
    title,
    description,
    timeout: timeout ?? (persists(tone) ? 0 : TOAST_TIMEOUT_MS),
    priority: tone === 'error' ? ('high' as const) : ('low' as const),
    actionProps: action ? { children: action.label, onClick: action.onClick } : undefined,
  };
}

export function createToaster(): Toaster {
  const manager = Toast.createToastManager();

  const show = (options: ToastOptions): string => {
    const { id } = options;
    const base = toBase({ ...options, tone: options.tone ?? 'neutral' });
    if (id !== undefined) {
      // A known id updates the toast in place (and restarts its timer); an unknown one adds it under that id.
      return manager.add({ ...base, id });
    }
    return manager.add(base);
  };

  const withTone = (tone: ToastTone) => (title: string, rest: Omit<ToastOptions, 'title' | 'tone'> = {}) => show({ ...rest, title, tone });

  const update = (id: string, options: Partial<ToastOptions>): void => {
    manager.update(id, toBase({ ...options, tone: options.tone ?? 'neutral' }));
  };

  return {
    manager,
    show,
    neutral: withTone('neutral'),
    success: withTone('success'),
    error: withTone('error'),
    loading: withTone('loading'),
    update,
    close: (id) => manager.close(id),
    promise: async (promise, messages) => {
      const id = show({ tone: 'loading', title: messages.loading });
      try {
        const result = await promise;
        update(id, { tone: 'success', title: typeof messages.success === 'function' ? messages.success(result) : messages.success });
        return result;
      } catch (error) {
        update(id, { tone: 'error', title: typeof messages.error === 'function' ? messages.error(error) : messages.error });
        throw error;
      }
    },
  };
}
