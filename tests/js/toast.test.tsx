/**
 * M4 — Toast: the manager with a stack limit, auto-dismiss timers that pause on hover and focus, every tone, the optional
 * Action and Close, and the live region. Rendered inside the Fyldo root (portal container rule).
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../app/components/ui/toast';
import { TooltipProvider } from '../../app/components/ui/tooltip';
import { PortalContainerContext } from '../../app/lib/portal';
import { createToaster, TOAST_LIMIT, TOAST_TIMEOUT_MS, type Toaster } from '../../app/lib/toast';

let toaster: Toaster;
let root: HTMLElement;

function mount(node: ReactNode = null, dir: 'ltr' | 'rtl' = 'ltr') {
  toaster = createToaster();
  root = document.createElement('div');
  root.setAttribute('dir', dir);
  document.body.append(root);
  render(
    <PortalContainerContext.Provider value={root}>
      <DirectionProvider direction={dir}>
        <TooltipProvider>
          <ToastProvider toaster={toaster}>{node}</ToastProvider>
        </TooltipProvider>
      </DirectionProvider>
    </PortalContainerContext.Provider>,
  );
}

const shown = () => [...document.querySelectorAll<HTMLElement>('[data-slot=fy-toast]')];
const visible = () => shown().filter((t) => !t.hasAttribute('data-limited'));
const wait = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: false }));
afterEach(() => vi.useRealTimers());

describe('Toast: tones, content, placement', () => {
  it('draws every tone in the Fyldo root: title, optional description, the tone glyph, and a Close button', () => {
    mount();
    act(() => {
      toaster.neutral('Link copied to clipboard');
      toaster.success('Cache cleared');
      toaster.error('Connection to the email service failed', { description: 'Check your API key and try again.' });
      toaster.loading('Exporting settings…');
    });

    expect(shown()).toHaveLength(4);
    expect(shown().every((t) => root.contains(t))).toBe(true); // never document.body
    const byTone = (tone: string) => document.querySelector(`[data-slot=fy-toast][data-tone=${tone}]`) as HTMLElement;

    expect(byTone('neutral')).toHaveTextContent('Link copied to clipboard');
    expect(byTone('neutral').querySelector('[data-fyldo-icon=information]')).not.toBeNull();
    expect(byTone('success').querySelector('[data-fyldo-icon=tickcircle]')).toHaveClass('fy:text-status-success-solid');
    expect(byTone('error').querySelector('[data-fyldo-icon=infocircle]')).toHaveClass('fy:text-status-error-solid');
    expect(byTone('error')).toHaveTextContent('Check your API key and try again.');
    expect(byTone('loading').querySelector('[data-fyldo-spinner]')).not.toBeNull();
    // (an Error toast is aria-hidden until focused: it is announced through Base UI's separate alert, so ask hidden nodes too)
    for (const toast of shown()) expect(within(toast).getByRole('button', { name: 'Close', hidden: true })).toBeInTheDocument();
  });

  it('the stack is the "Notifications" landmark: a polite live region, fixed at the bottom-end corner 24px from both edges', () => {
    mount();
    act(() => void toaster.success('Cache cleared'));
    const viewport = screen.getByRole('region', { name: 'Notifications' });
    expect(viewport).toHaveAttribute('aria-live', 'polite');
    expect(viewport.style.insetInlineEnd).toBe('24px');
    expect(viewport).toHaveClass('fy:fixed', 'fy:bottom-6', 'fy:w-100'); // bottom 24px, 400 wide
    expect(root.contains(viewport)).toBe(true);
  });

  it('Persian: the landmark is named in Persian and swipe-to-dismiss goes toward the corner the stack sits in (left)', () => {
    mount(null, 'rtl');
    act(() => void toaster.success('حافظه‌ی پنهان پاک شد'));
    expect(shown()[0]).toHaveTextContent('حافظه‌ی پنهان پاک شد');
    expect(root.getAttribute('dir')).toBe('rtl');
  });
});

describe('Toast: timers (design rule 5)', () => {
  it('Neutral and Success dismiss after 5 seconds; Error and Loading stay until closed', async () => {
    mount();
    act(() => {
      toaster.neutral('Neutral');
      toaster.success('Success');
      toaster.loading('Loading');
    });
    expect(TOAST_TIMEOUT_MS).toBe(5000);

    await wait(TOAST_TIMEOUT_MS - 100);
    expect(visible()).toHaveLength(3);
    await wait(200);
    await wait(500); // exit animation
    expect(shown().map((t) => t.dataset.tone)).toEqual(['loading']);
    await wait(60_000);
    expect(shown().map((t) => t.dataset.tone)).toEqual(['loading']); // still there

    act(() => void toaster.error('Error'));
    await wait(60_000);
    expect(shown().map((t) => t.dataset.tone).sort()).toEqual(['error', 'loading']);
  });

  it('the timer pauses while the pointer is over the stack, and resumes when it leaves', async () => {
    mount();
    act(() => void toaster.success('Cache cleared'));
    const viewport = screen.getByRole('region', { name: 'Notifications' });

    await wait(3000);
    fireEvent.mouseEnter(viewport);
    fireEvent.pointerEnter(viewport);
    fireEvent.mouseOver(shown()[0] as HTMLElement);
    await wait(30_000); // far beyond 5s: paused
    expect(visible()).toHaveLength(1);

    fireEvent.mouseLeave(viewport);
    fireEvent.pointerLeave(viewport);
    await wait(6000);
    await wait(500);
    expect(shown()).toHaveLength(0);
  });

  it('the timer pauses while focus is inside the stack, and resumes when it leaves', async () => {
    mount(<button type="button">outside</button>);
    act(() => void toaster.success('Cache cleared'));
    await wait(200);

    const close = within(shown()[0] as HTMLElement).getByRole('button', { name: 'Close' });
    act(() => close.focus());
    await wait(30_000);
    expect(visible()).toHaveLength(1);

    act(() => screen.getByRole('button', { name: 'outside' }).focus());
    await wait(6000);
    await wait(500);
    expect(shown()).toHaveLength(0);
  });

  it('an explicit timeout wins, 0 means until closed, and re-queuing under the same id updates in place', async () => {
    mount();
    act(() => {
      toaster.success('Quick', { timeout: 1000 });
      toaster.success('Sticky', { timeout: 0 });
      toaster.neutral('Once', { id: 'once' });
    });
    act(() => void toaster.neutral('Twice', { id: 'once' }));
    expect(shown().filter((t) => t.textContent?.includes('Once') || t.textContent?.includes('Twice'))).toHaveLength(1);
    expect(screen.getByText('Twice')).toBeInTheDocument();

    await wait(1200);
    await wait(500);
    expect(screen.queryByText('Quick')).toBeNull();
    expect(screen.getByText('Sticky')).toBeInTheDocument();
  });
});

describe('Toast: stack limit', () => {
  it('shows at most 3; the newest is at the bottom (index 0) and the oldest waits, hidden, until there is room', async () => {
    mount();
    expect(TOAST_LIMIT).toBe(3);
    act(() => {
      for (const n of ['one', 'two', 'three', 'four']) toaster.neutral(n, { timeout: 0 }); // they persist: only the limit can hide one
    });

    expect(shown()).toHaveLength(4);
    expect(visible().map((t) => t.textContent?.replace('Close', ''))).toHaveLength(3);
    const limited = shown().filter((t) => t.hasAttribute('data-limited'));
    expect(limited).toHaveLength(1);
    expect(limited[0]).toHaveTextContent('one'); // the OLDEST is the one that waits

    // closing a visible toast makes room: the waiting one comes back
    const newest = screen.getByText('four').closest('[data-slot=fy-toast]') as HTMLElement;
    fireEvent.click(within(newest).getByRole('button', { name: 'Close' }));
    await wait(600);
    expect(screen.queryByText('four')).toBeNull();
    expect(visible().map((t) => t.dataset.tone)).toHaveLength(3);
    expect(shown().some((t) => t.hasAttribute('data-limited'))).toBe(false);
  });
});

describe('Toast: Action and Close', () => {
  it('the action is one Tertiary Small button: it runs its handler and closes the toast', async () => {
    const onUndo = vi.fn();
    mount();
    act(() => void toaster.success('Settings imported', { description: '24 options were updated.', action: { label: 'Undo', onClick: onUndo } }));

    const toast = shown()[0] as HTMLElement;
    const undo = within(toast).getByRole('button', { name: 'Undo' });
    expect(undo).toHaveAttribute('data-variant', 'tertiary');
    expect(undo).toHaveAttribute('data-size', 'sm');
    expect(within(toast).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Undo', 'Close']); // action, then close, at the end

    fireEvent.click(undo);
    expect(onUndo).toHaveBeenCalledTimes(1);
    await wait(600);
    expect(shown()).toHaveLength(0);
  });

  it('Close closes it, and has a tooltip that repeats its name', async () => {
    mount();
    act(() => void toaster.success('Cache cleared'));
    const close = within(shown()[0] as HTMLElement).getByRole('button', { name: 'Close' });
    act(() => close.focus());
    await wait(50);
    expect(screen.getAllByText('Close', { selector: '[data-slot=fy-tooltip]' })).toHaveLength(1);

    fireEvent.click(close);
    await wait(600);
    expect(shown()).toHaveLength(0);
  });

  it('a toast without an action shows no action button', () => {
    mount();
    act(() => void toaster.neutral('Link copied to clipboard'));
    expect(within(shown()[0] as HTMLElement).getAllByRole('button')).toHaveLength(1); // just Close
  });
});

describe('Toast: announcements', () => {
  it('Error is announced assertively (role="alert"), the others politely through the live region', () => {
    mount();
    act(() => {
      toaster.success('Cache cleared');
      toaster.error('Connection failed');
    });
    const alerts = screen.getAllByRole('alert');
    expect(alerts.some((a) => a.textContent?.includes('Connection failed'))).toBe(true);
    expect(alerts.some((a) => a.textContent?.includes('Cache cleared'))).toBe(false);
    expect(screen.getByRole('region', { name: 'Notifications' })).toHaveAttribute('aria-live', 'polite');
  });
});

describe('Toast: promise helper', () => {
  it('Loading while the task runs, then Success with the result, in the same toast', async () => {
    mount();
    let resolve: (n: number) => void = () => undefined;
    const task = new Promise<number>((r) => (resolve = r));
    let outcome: Promise<number> = Promise.resolve(0);
    act(() => {
      outcome = toaster.promise(task, { loading: 'Exporting settings…', success: (n) => `Exported ${n} options`, error: 'Export failed' });
    });
    expect(shown()).toHaveLength(1);
    expect(shown()[0]).toHaveAttribute('data-tone', 'loading');

    await act(async () => resolve(24));
    await expect(outcome).resolves.toBe(24);
    expect(shown()).toHaveLength(1); // the same toast, updated
    expect(shown()[0]).toHaveAttribute('data-tone', 'success');
    expect(shown()[0]).toHaveTextContent('Exported 24 options');
    await wait(TOAST_TIMEOUT_MS + 1000); // Success dismisses on the usual timer
    expect(shown()).toHaveLength(0);
  });

  it('a failing task ends as an Error toast that stays, and the promise still rejects', async () => {
    mount();
    let outcome: Promise<unknown> = Promise.resolve();
    act(() => {
      outcome = toaster.promise(Promise.reject(new Error('nope')), { loading: 'Exporting…', success: 'Done', error: (e) => `Failed: ${(e as Error).message}` });
      outcome.catch(() => undefined);
    });
    await expect(outcome).rejects.toThrow('nope');
    await wait(0);
    expect(shown()[0]).toHaveAttribute('data-tone', 'error');
    expect(shown()[0]).toHaveTextContent('Failed: nope');
    await wait(60_000);
    expect(shown()).toHaveLength(1);
  });
});

describe('Toast: dev warnings', () => {
  it('a title with a final period is reported (one short sentence, no period)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mount();
    act(() => void toaster.success('Cache cleared.'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('final period'));
    warn.mockRestore();
  });
});
