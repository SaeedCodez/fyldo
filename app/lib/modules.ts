/**
 * The developer's own ES modules (custom fields, custom pages). Every module named in the config is imported before the
 * first render (like the icons), so nothing pops in and nothing is written to `window`: a module gets React and Fyldo's
 * components from its default export's argument (the SDK, app/lib/sdk.ts) instead of from globals.
 */
import { sdk, type FyldoSdk } from './sdk';

/** A field's or a page's definition: React (`Component`) or plain DOM (`mount`). */
interface Drawable {
  Component?: unknown;
  mount?: unknown;
}

export interface ModuleRegistry<D> {
  /** Use `exported` (a module's default export) for `url`: the loader does this; tests too. */
  define(url: string, exported: unknown): void;
  /** The definition for a module URL; null when it could not be loaded or used (whoever draws it says so). */
  get(url: string): D | null;
  /** Import every module in parallel. Never rejects: a module that fails is reported and left out. */
  load(urls: string[]): Promise<void>;
}

/**
 * `kind` names the modules in console errors ("custom field", "custom page"). A function declaration on purpose:
 * modules → sdk → Form → … → custom-fields → modules is an import cycle, and custom-fields may call this before this
 * module has been evaluated.
 */
export function createModuleRegistry<D extends Drawable>(kind: string): ModuleRegistry<D> {
  const entries = new Map<string, { definition: D } | { error: string }>();

  const resolve = (exported: unknown): { definition: D } | { error: string } => {
    let definition: unknown;
    try {
      definition = typeof exported === 'function' ? (exported as (api: FyldoSdk) => unknown)(sdk) : exported;
    } catch (e) {
      return { error: `its default export threw: ${String(e)}` };
    }
    const candidate = definition as D | null;
    if (!candidate || typeof candidate !== 'object' || (typeof candidate.Component !== 'function' && typeof candidate.mount !== 'function')) {
      return { error: 'its default export gives neither a `Component` nor a `mount` function' };
    }
    return { definition: candidate };
  };

  const define = (url: string, exported: unknown): void => {
    const entry = resolve(exported);
    if ('error' in entry) console.error(`Fyldo: ${kind} module "${url}" is not usable: ${entry.error}.`);
    entries.set(url, entry);
  };

  return {
    define,
    get(url) {
      const entry = entries.get(url);
      return entry && 'definition' in entry ? entry.definition : null;
    },
    async load(urls) {
      await Promise.all(
        urls.map(async (url) => {
          try {
            const module = (await import(/* @vite-ignore */ url)) as { default?: unknown };
            define(url, module.default);
          } catch (e) {
            console.error(`Fyldo: ${kind} module "${url}" could not be loaded.`, e);
            entries.set(url, { error: String(e) });
          }
        }),
      );
    },
  };
}
