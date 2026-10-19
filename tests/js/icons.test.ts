import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Icon } from '../../app/icons/Icon';
import { normalizeIconName } from '../../app/icons/normalize';
import { collectIconNames, loadIcon, peekIcon, preloadIcons, resetIconCache, setIconLoader } from '../../app/icons/registry';
import { RTL_FLIP } from '../../app/icons/rtl-flip';
import { iconSvg } from '../../app/icons/svg';

const ALL_KEYS: string[] = JSON.parse(readFileSync(resolve(__dirname, '../../tools/icons/all-keys.generated.json'), 'utf8'));

afterEach(() => {
  setIconLoader(null);
  resetIconCache();
  vi.restoreAllMocks();
});

describe('icon names', () => {
  it('normalises kebab, Pascal and digit-leading names to one key', () => {
    expect(normalizeIconName('setting-2')).toBe('setting2');
    expect(normalizeIconName('Setting2')).toBe('setting2');
    expect(normalizeIconName('SETTING-2')).toBe('setting2');
    expect(normalizeIconName('I3Dcube')).toBe('3dcube');
    expect(normalizeIconName('3d-cube')).toBe('3dcube');
  });

  it('the whole Iconsax set has no name collisions', () => {
    expect(new Set(ALL_KEYS).size).toBe(ALL_KEYS.length);
    expect(ALL_KEYS.length).toBeGreaterThan(900);
  });

  it('every name in the RTL flip list is a real icon', () => {
    expect([...RTL_FLIP].filter((k) => !ALL_KEYS.includes(k))).toEqual([]);
  });

  it('never flips vertical arrows, chevrons, ticks, closes or settings', () => {
    for (const key of ['arrowdown', 'arrowup', 'arrowdown2', 'arrowup2', 'tickcircle', 'closecircle', 'setting2', 'searchnormal']) {
      expect(RTL_FLIP.has(key), key).toBe(false);
    }
  });
});

describe('collectIconNames', () => {
  it('finds every string under an `icon` key, anywhere in the config', () => {
    const config = { pages: [{ icon: 'setting-2', sections: [{ fields: [{ icon: 'global' }, { label: 'x' }] }] }], links: [{ icon: 'book' }, { icon: '' }], icon: 'danger' };
    expect(collectIconNames(config).sort()).toEqual(['book', 'danger', 'global', 'setting-2']);
  });
});

describe('preloading', () => {
  it('imports every named icon in PARALLEL before first render, once per icon', async () => {
    const started: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    setIconLoader(async (key) => {
      started.push(key);
      await gate;
      return [['path', { d: 'M0 0' }]];
    });

    const done = preloadIcons(['book', 'message-question', 'book', 'user-add']);
    await Promise.resolve();
    expect(started.sort()).toEqual(['book', 'messagequestion', 'useradd']); // all in flight at once, duplicates collapsed
    release();
    await done;
    expect(peekIcon('book')).not.toBeUndefined();
    expect(peekIcon('user-add')).not.toBeUndefined();
  });

  it('an unknown icon warns ONCE and renders nothing (a reserved, aria-hidden box, no layout shift)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    setIconLoader(async () => {
      throw new Error('404');
    });

    await Promise.all([loadIcon('not-an-icon'), loadIcon('NotAnIcon')]);
    await loadIcon('not-an-icon');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('not-an-icon');

    const { container } = render(createElement(Icon, { name: 'not-an-icon', size: 16 }));
    expect(container.querySelector('svg')).toBeNull();
    const box = container.firstElementChild as HTMLElement;
    expect(box.getAttribute('aria-hidden')).toBe('true');
    expect(box.style.width).toBe('16px');
  });
});

describe('<Icon>', () => {
  it('draws an inlined icon: Linear, currentColor, decorative by default', () => {
    const { container } = render(createElement(Icon, { name: 'tick-circle', size: 16 }));
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg.querySelector('path')?.getAttribute('stroke')).toBe('currentColor');
    expect(svg.querySelector('path')?.getAttribute('vector-effect')).toBe('non-scaling-stroke');
  });

  it('a labelled icon is announced, not hidden', () => {
    const { getByRole } = render(createElement(Icon, { name: 'tick-circle', label: 'Saved' }));
    expect(getByRole('img', { name: 'Saved' })).toBeInTheDocument();
  });

  it('flips directional icons under rtl and leaves the rest alone', async () => {
    setIconLoader(async () => [['path', { d: 'M0 0' }]]);
    await preloadIcons(['arrow-left', 'arrow-down-2']);
    const left = render(createElement(Icon, { name: 'arrow-left' })).container.querySelector('svg') as SVGElement;
    const down = render(createElement(Icon, { name: 'arrow-down-2' })).container.querySelector('svg') as SVGElement;
    expect(left.getAttribute('class')).toContain('fy:rtl:-scale-x-100');
    expect(down.getAttribute('class') ?? '').not.toContain('scale-x');
  });
});

describe('iconSvg', () => {
  it('gives the same markup as PHP Fyldo::icon(): kebab attributes, currentColor, decorative', async () => {
    setIconLoader(async () => [['g', {}, [['path', { d: 'M0 0', stroke: 'currentColor', strokeWidth: '1.5', strokeLinecap: 'round' }]]]]);
    expect(await iconSvg('pen-close')).toBe(
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><g><path d="M0 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></g></svg>',
    );
    expect(await iconSvg('pen-close', { size: 20, className: 'a "b"', label: 'Edit' })).toMatch(
      /^<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http:\/\/www.w3.org\/2000\/svg" class="a &quot;b&quot;" role="img" aria-label="Edit" focusable="false">/,
    );
  });

  it('drops unknown elements and attributes and escapes values', async () => {
    setIconLoader(async () => [['script', { src: 'x' }], ['path', { d: 'M1 1" onload="x', onLoad: 'x', style: 'x' }, [['image', { href: 'x' }]]]]);
    expect(await iconSvg('heart')).toBe(
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M1 1&quot; onload=&quot;x"/></svg>',
    );
  });

  it('loads only that icon, once, and gives "" for names that are not icons', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const loaded: string[] = [];
    setIconLoader(async (key) => {
      loaded.push(key);
      if (key !== 'heart') throw new Error('404');
      return [['path', { d: 'M0 0' }]];
    });
    await iconSvg('heart');
    await iconSvg('heart');
    expect(await iconSvg('no-such-icon')).toBe('');
    expect(await iconSvg('../chunks/app')).toBe('');
    expect(await iconSvg('Heart')).toBe('');
    expect(loaded).toEqual(['heart', 'nosuchicon']);
  });
});
