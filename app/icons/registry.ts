import { useSyncExternalStore } from 'react';
import { INLINE_ICONS } from './inline.generated';
import { normalizeIconName } from './normalize';
import type { IconNode } from './types';

type Loader = (key: string) => Promise<IconNode[]>;

/** key → nodes (loaded) | null (unknown / failed) */
const cache = new Map<string, IconNode[] | null>(Object.entries(INLINE_ICONS));
const pending = new Map<string, Promise<void>>();
const warned = new Set<string>();
const listeners = new Set<() => void>();

const defaultLoader: Loader = async (key) => {
  // Icons live next to app.js (assets/dist/icons/<key>.js). The relative path is built in a variable on purpose: Vite treats
  // `new URL(`./icons/${key}.js`, import.meta.url)` as an asset glob and rewrites it to `undefined` in the production bundle.
  const relative = ['.', 'icons', `${key}.js`].join('/');
  const url = new URL(relative, import.meta.url).href;
  const mod = (await import(/* @vite-ignore */ url)) as { default: IconNode[] };
  return mod.default;
};

let loader: Loader = defaultLoader;

/** Tests inject their own loader. */
export function setIconLoader(next: Loader | null): void {
  loader = next ?? defaultLoader;
}

export function resetIconCache(): void {
  cache.clear();
  pending.clear();
  warned.clear();
  for (const [key, nodes] of Object.entries(INLINE_ICONS)) cache.set(key, nodes);
}

const notify = () => listeners.forEach((l) => l());

function warnUnknown(name: string, key: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`Fyldo: unknown icon "${name}". Use an Iconsax name such as "setting-2".`);
}

/** Start loading an icon (no-op when known). Resolves when it is available or known to be unavailable. */
export function loadIcon(name: string): Promise<void> {
  const key = normalizeIconName(name);
  if (cache.has(key)) return Promise.resolve();

  const existing = pending.get(key);
  if (existing) return existing;

  const promise = loader(key)
    .then((nodes) => {
      cache.set(key, nodes);
    })
    .catch(() => {
      cache.set(key, null);
      warnUnknown(name, key);
    })
    .finally(() => {
      pending.delete(key);
      notify();
    });
  pending.set(key, promise);
  return promise;
}

/** Import every named icon in parallel — awaited before the first render so config-chosen icons never pop in. */
export async function preloadIcons(names: Iterable<string>): Promise<void> {
  await Promise.all([...new Set(names)].filter(Boolean).map(loadIcon));
}

export function peekIcon(name: string): IconNode[] | null | undefined {
  return cache.get(normalizeIconName(name));
}

/** Every string under an `icon` key of a config object (pages, groups, fields, links, actions, empty states…). */
export function collectIconNames(config: unknown): string[] {
  const names: string[] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (k === 'icon' && typeof v === 'string' && v !== '') names.push(v);
        else walk(v);
      }
    }
  };
  walk(config);
  return names;
}

/** Subscribes a component to the icon: renders immediately when cached, re-renders once a lazy load lands. */
export function useIconNodes(name: string): IconNode[] | null {
  const key = normalizeIconName(name);
  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  };
  const nodes = useSyncExternalStore(subscribe, () => cache.get(key));

  if (nodes === undefined) void loadIcon(name);
  return nodes ?? null;
}
