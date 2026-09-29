import { createRoot } from 'react-dom/client';
import { App } from './components/fyldo/App';
import { setLocaleData } from './i18n';
import { collectIconNames, preloadIcons } from './icons/registry';
import type { FyldoConfig } from './types';
import './styles/app.css';

/** Name of the per-major root attribute; its VALUE is the instance slug (docs/ARCHITECTURE.md §6.5). */
const ROOT_ATTRIBUTE = 'data-fyldo-v1';

/** PHP writes the config to `window.__fyldo_<slug>__`; read it once and delete it: no lasting global. */
function takeConfig(slug: string): FyldoConfig | null {
  const key = `__fyldo_${slug.replace(/-/g, '_')}__`;
  const bag = window as unknown as Record<string, FyldoConfig | undefined>;
  const config = bag[key] ?? null;
  delete bag[key];
  return config;
}

async function mount(root: HTMLElement): Promise<void> {
  const slug = root.getAttribute(ROOT_ATTRIBUTE) ?? '';
  const config = takeConfig(slug);
  if (!config) {
    console.error(`Fyldo: no config found for "${slug}".`);
    return;
  }

  setLocaleData(config.i18n);
  // Import every icon named anywhere in the config in parallel BEFORE the first render: no pop-in.
  await preloadIcons(collectIconNames(config));

  createRoot(root).render(<App config={config} root={root} />);
}

document.querySelectorAll<HTMLElement>(`[${ROOT_ATTRIBUTE}]`).forEach((root) => void mount(root));
