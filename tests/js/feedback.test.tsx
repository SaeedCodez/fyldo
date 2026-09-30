/**
 * M4 — feedback components: Tooltip (on every Icon Button), Icon Button, Notice (Action, Dismiss, live roles), Empty State
 * and the Modal's Danger type (typed confirmation, running state). Behaviour, keyboard and ARIA; the pixels are in the
 * Playwright harness (e2e/harness/pack-visual-feedback.spec.ts).
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button, ButtonLink } from '../../app/components/ui/button';
import { EmptyState } from '../../app/components/ui/empty-state';
import { IconButton } from '../../app/components/ui/icon-button';
import { Modal } from '../../app/components/ui/modal';
import { Notice } from '../../app/components/ui/notice';
import { Tooltip, TooltipProvider } from '../../app/components/ui/tooltip';
import { setLocaleData } from '../../app/i18n';
import { PortalContainerContext } from '../../app/lib/portal';
import { DirectionProvider } from '@base-ui/react/direction-provider';

function mount(node: ReactNode, dir: 'ltr' | 'rtl' = 'ltr') {
  const root = document.createElement('div');
  root.setAttribute('dir', dir);
  document.body.append(root);
  render(
    <PortalContainerContext.Provider value={root}>
      <DirectionProvider direction={dir}>
        <TooltipProvider>{node}</TooltipProvider>
      </DirectionProvider>
    </PortalContainerContext.Provider>,
  );
  return root;
}

describe('Icon Button + Tooltip (design rule 10)', () => {
  it('the tooltip text IS the accessible name, opens on hover after 300ms and closes on leave', async () => {
    const root = mount(<IconButton icon="edit" label="Edit" />);
    const button = screen.getByRole('button', { name: 'Edit' });
    expect(button).toHaveAttribute('aria-label', 'Edit');

    await userEvent.hover(button);
    expect(screen.queryByText('Edit', { selector: '[data-slot=fy-tooltip]' })).toBeNull(); // not before the delay
    const tip = await screen.findByText('Edit', { selector: '[data-slot=fy-tooltip]' }, { timeout: 1500 });
    expect(root.contains(tip)).toBe(true); // portalled into the Fyldo root, never document.body

    await userEvent.unhover(button);
    await waitFor(() => expect(screen.queryByText('Edit', { selector: '[data-slot=fy-tooltip]' })).toBeNull());
  });

  it('opens at once on keyboard focus and closes on Esc and on blur', async () => {
    mount(
      <>
        <IconButton icon="edit" label="Edit" />
        <button type="button">next</button>
      </>,
    );
    await userEvent.tab();
    expect(await screen.findByText('Edit', { selector: '[data-slot=fy-tooltip]' }, { timeout: 200 })).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('Edit', { selector: '[data-slot=fy-tooltip]' })).toBeNull());

    await userEvent.tab({ shift: true });
    await userEvent.tab();
    expect(await screen.findByText('Edit', { selector: '[data-slot=fy-tooltip]' })).toBeVisible();
    await userEvent.tab();
    await waitFor(() => expect(screen.queryByText('Edit', { selector: '[data-slot=fy-tooltip]' })).toBeNull());
  });

  it('Start and End follow the reading direction (logical sides), Top is the default', async () => {
    const sides: Array<[('top' | 'bottom' | 'start' | 'end'), string]> = [
      ['top', 'top'],
      ['bottom', 'bottom'],
      ['start', 'inline-start'],
      ['end', 'inline-end'],
    ];
    for (const dir of ['ltr', 'rtl'] as const) {
      for (const [side, expected] of sides) {
        const { unmount } = render(
          <PortalContainerContext.Provider value={document.body}>
            <DirectionProvider direction={dir}>
              <TooltipProvider>
                <IconButton icon="edit" label={`Edit ${dir} ${side}`} tooltipSide={side} />
              </TooltipProvider>
            </DirectionProvider>
          </PortalContainerContext.Provider>,
        );
        await userEvent.tab();
        const tip = await screen.findByText(`Edit ${dir} ${side}`, { selector: '[data-slot=fy-tooltip]' });
        expect(tip).toHaveAttribute('data-side', expected);
        unmount();
      }
    }
    render(
      <PortalContainerContext.Provider value={document.body}>
        <TooltipProvider>
          <IconButton icon="edit" label="Default side" />
        </TooltipProvider>
      </PortalContainerContext.Provider>,
    );
    await userEvent.tab();
    expect(await screen.findByText('Default side', { selector: '[data-slot=fy-tooltip]' })).toHaveAttribute('data-side', 'top');
  });

  it('a plain Tooltip can name any focusable element', async () => {
    mount(
      <Tooltip label="Copy shortcode">
        <button type="button">[form id=1]</button>
      </Tooltip>,
    );
    await userEvent.tab();
    expect(await screen.findByText('Copy shortcode', { selector: '[data-slot=fy-tooltip]' })).toBeVisible();
  });

  it('sizes are 32 / 40 / 48 squares; Loading replaces the icon with the spinner and ignores clicks', async () => {
    const onClick = vi.fn();
    mount(
      <>
        <IconButton icon="close-circle" label="Small" />
        <IconButton icon="close-circle" label="Medium" size="md" />
        <IconButton icon="close-circle" label="Large" size="lg" />
        <IconButton icon="close-circle" label="Saving" loading onClick={onClick} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Small' })).toHaveClass('fy:size-8');
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveClass('fy:size-10');
    expect(screen.getByRole('button', { name: 'Large' })).toHaveClass('fy:size-12');
    expect(screen.getByRole('button', { name: 'Large' }).querySelector('svg')).toHaveAttribute('width', '20'); // 20px icon at Large
    expect(screen.getByRole('button', { name: 'Small' }).querySelector('svg')).toHaveAttribute('width', '16');

    const saving = screen.getByRole('button', { name: 'Saving' });
    expect(saving).toHaveAttribute('aria-busy', 'true');
    expect(saving.querySelector('[data-fyldo-spinner]')).not.toBeNull();
    await userEvent.click(saving);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Notice: Action, Dismiss and live regions', () => {
  it('a notice present from the start is a labelled region, named with the tone word — not a live region', () => {
    mount(
      <Notice tone="amber" title="Renew soon">
        Your license expires in 7 days.
      </Notice>,
    );
    expect(screen.getByRole('region', { name: 'Warning: Renew soon' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('a notice injected after load is announced: status for gray/blue/green, alert for amber/red, the tone word first', () => {
    mount(
      <>
        <Notice tone="green" live title="Settings saved">
          Your changes are live on the site.
        </Notice>
        <Notice tone="red" live>
          Check your API key and try again.
        </Notice>
      </>,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Success: Settings saved');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Error: Check your API key and try again.');
  });

  it('the action is one Secondary Small button after the content, and the dismiss control is last with its own tooltip', async () => {
    const onDismiss = vi.fn();
    const onAction = vi.fn();
    mount(
      <Notice
        tone="green"
        title="Settings saved"
        onDismiss={onDismiss}
        action={
          <Button variant="secondary" size="sm" onClick={onAction}>
            View logs
          </Button>
        }
      >
        Live.
      </Notice>,
    );
    const region = screen.getByRole('region', { name: 'Success: Settings saved' });
    const buttons = within(region).getAllByRole('button');
    expect(buttons.map((b) => b.textContent || b.getAttribute('aria-label'))).toEqual(['View logs', 'Dismiss']); // action, then dismiss (at the end)

    await userEvent.click(buttons[0] as HTMLElement);
    expect(onAction).toHaveBeenCalledTimes(1);

    await userEvent.tab({ shift: true }); // back from after the region… focus the dismiss button by keyboard
    const dismiss = within(region).getByRole('button', { name: 'Dismiss' });
    dismiss.focus();
    expect(await screen.findByText('Dismiss', { selector: '[data-slot=fy-tooltip]' })).toBeVisible();
    await userEvent.keyboard('{Enter}');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('without onDismiss there is no dismiss control, and never the WordPress `notice` class', () => {
    mount(<Notice tone="red">Failed.</Notice>);
    const region = screen.getByRole('region');
    expect(within(region).queryByRole('button')).toBeNull();
    expect(region.className.split(/\s+/)).not.toContain('notice');
    expect(region.querySelector('.notice, [class*="notice-"]')).toBeNull();
  });
});

describe('Empty State', () => {
  it('Large and Small: icon box, title, description; actions in order Primary then Secondary, drawn Primary/Secondary Small', () => {
    const { rerender } = render(
      <PortalContainerContext.Provider value={document.body}>
        <EmptyState
          icon="element-plus"
          title="No integrations yet"
          description="Connect a service to sync forms and analytics with your site."
          primaryAction={<Button>Add integration</Button>}
          secondaryAction={<ButtonLink href="https://acme.test/docs">Learn more</ButtonLink>}
        />
      </PortalContainerContext.Provider>,
    );
    const large = document.querySelector('[data-slot=fy-empty-state]') as HTMLElement;
    expect(large).toHaveAttribute('data-size', 'lg');
    expect(screen.getByRole('heading', { level: 3, name: 'No integrations yet' })).toHaveClass('fy:text-heading-20');
    expect(screen.getByText('Connect a service to sync forms and analytics with your site.')).toHaveClass('fy:text-copy-14');
    expect(large.querySelector('[data-slot=fy-empty-state-icon]')).toHaveClass('fy:size-12', 'fy:rounded-lg');
    expect(large.querySelector('[data-slot=fy-empty-state-icon] svg')).toHaveAttribute('width', '24');

    const actions = [...large.querySelectorAll('[data-slot=fy-empty-state-actions] > *')] as HTMLElement[];
    expect(actions.map((a) => a.textContent)).toEqual(['Add integration', 'Learn more']);
    expect(actions.map((a) => [a.dataset.variant, a.dataset.size])).toEqual([
      ['primary', 'sm'],
      ['secondary', 'sm'],
    ]);
    expect(screen.getByRole('link', { name: 'Learn more' })).toHaveAttribute('href', 'https://acme.test/docs');

    rerender(
      <PortalContainerContext.Provider value={document.body}>
        <EmptyState size="sm" icon="search-normal" title="No results for “cache”" description="Try a different keyword." secondaryAction={<Button>Clear search</Button>} headingLevel={2} />
      </PortalContainerContext.Provider>,
    );
    const small = document.querySelector('[data-slot=fy-empty-state]') as HTMLElement;
    expect(small).toHaveAttribute('data-size', 'sm');
    expect(screen.getByRole('heading', { level: 2, name: 'No results for “cache”' })).toHaveClass('fy:text-heading-16');
    expect(small.querySelector('[data-slot=fy-empty-state-icon]')).toHaveClass('fy:size-10', 'fy:rounded-md');
    expect(small.querySelector('[data-slot=fy-empty-state-icon] svg')).toHaveAttribute('width', '20');
    expect(small.querySelectorAll('[data-slot=fy-empty-state-actions] > *')).toHaveLength(1); // no Primary: just "Clear search"
  });

  it('description and actions are optional', () => {
    render(<EmptyState icon="element-plus" title="Nothing to show" />);
    expect(document.querySelector('[data-slot=fy-empty-state-actions]')).toBeNull();
    expect(document.querySelector('p')).toBeNull();
  });
});

describe('Modal: Danger type', () => {
  function Harness({ onConfirm, keyword = 'RESET', type = 'danger' as 'danger' | 'default' }: { onConfirm: () => void | Promise<void>; keyword?: string; type?: 'danger' | 'default' }): ReactElement {
    const [open, setOpen] = useState(true);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          trigger
        </button>
        <Modal
          open={open}
          onOpenChange={setOpen}
          type={type}
          title="Reset all settings?"
          description="Every option will return to its default value. This can’t be undone."
          cancelLabel="Cancel"
          confirmLabel="Reset settings"
          confirmKeyword={keyword}
          onConfirm={onConfirm}
        />
      </>
    );
  }
  const dialog = () => screen.getByRole('alertdialog', { name: 'Reset all settings?' });

  it('is an alertdialog named by its title and described by its text, in the root; focus starts on the keyword field', async () => {
    const root = mount(<Harness onConfirm={() => undefined} />);
    expect(root.contains(dialog())).toBe(true);
    expect(dialog()).toHaveAccessibleDescription('Every option will return to its default value. This can’t be undone.');
    expect(dialog()).toHaveAttribute('data-type', 'danger');
    await waitFor(() => expect(within(dialog()).getByRole('textbox', { name: 'Type RESET to confirm' })).toHaveFocus());
    expect(within(dialog()).getByRole('textbox')).toHaveAttribute('placeholder', 'RESET');
  });

  it('Confirm is the Error button and stays disabled until the exact keyword is typed (case-sensitive, trimmed)', async () => {
    const onConfirm = vi.fn();
    mount(<Harness onConfirm={onConfirm} />);
    const confirm = within(dialog()).getByRole('button', { name: 'Reset settings' });
    const input = within(dialog()).getByRole('textbox');
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAttribute('data-variant', 'error');

    await userEvent.type(input, 'reset');
    expect(confirm).toBeDisabled(); // case matters
    await userEvent.clear(input);
    await userEvent.type(input, 'RESE');
    expect(confirm).toBeDisabled();
    await userEvent.type(input, 'T');
    expect(confirm).toBeEnabled();
    await userEvent.type(input, 'X');
    expect(confirm).toBeDisabled();
    await userEvent.type(input, '{Backspace}  ');
    expect(confirm).toBeEnabled(); // surrounding spaces are ignored

    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Enter in the keyword field confirms only when it matches', async () => {
    const onConfirm = vi.fn();
    mount(<Harness onConfirm={onConfirm} />);
    const input = within(dialog()).getByRole('textbox');
    await userEvent.type(input, 'RES{Enter}');
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.type(input, 'ET{Enter}');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('closes only through Cancel or the close button: not Esc, not the scrim', async () => {
    mount(<Harness onConfirm={() => undefined} />);
    await userEvent.keyboard('{Escape}');
    expect(dialog()).toBeInTheDocument();
    await userEvent.click(document.querySelector('[data-slot=fy-modal-backdrop]') as HTMLElement);
    expect(dialog()).toBeInTheDocument();

    await userEvent.click(within(dialog()).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('Cancel closes it and returns focus to the trigger', async () => {
    mount(<Harness onConfirm={() => undefined} />);
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'trigger' })); // open it the way a user does …
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: 'trigger' })).toHaveFocus()); // … and focus goes back to it
  });

  it('the typed text is forgotten when it opens again', async () => {
    mount(<Harness onConfirm={() => undefined} />);
    await userEvent.type(within(dialog()).getByRole('textbox'), 'RESET');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'trigger' }));
    expect(within(dialog()).getByRole('textbox')).toHaveValue('');
    expect(within(dialog()).getByRole('button', { name: 'Reset settings' })).toBeDisabled();
  });

  it('while the action runs: Confirm is loading, Cancel, the close button and the field are disabled, and nothing closes it', async () => {
    let finish: () => void = () => undefined;
    const running = new Promise<void>((resolve) => (finish = resolve));
    mount(<Harness onConfirm={() => running} />);
    await userEvent.type(within(dialog()).getByRole('textbox'), 'RESET');
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Reset settings' }));

    const confirm = within(dialog()).getByRole('button', { name: 'Reset settings' });
    await waitFor(() => expect(confirm).toHaveAttribute('aria-busy', 'true'));
    expect(within(dialog()).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(within(dialog()).getByRole('button', { name: 'Close' })).toBeDisabled();
    expect(within(dialog()).getByRole('textbox')).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(dialog()).toBeInTheDocument();

    await act(async () => finish());
    await waitFor(() => expect(within(dialog()).getByRole('button', { name: 'Reset settings' })).not.toHaveAttribute('aria-busy'));
    expect(within(dialog()).getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('without a keyword there is no field, Confirm is enabled at once and focus starts on Cancel', async () => {
    mount(<Harness onConfirm={() => undefined} keyword="" />);
    expect(within(dialog()).queryByRole('textbox')).toBeNull();
    expect(within(dialog()).getByRole('button', { name: 'Reset settings' })).toBeEnabled();
    await waitFor(() => expect(within(dialog()).getByRole('button', { name: 'Cancel' })).toHaveFocus());
  });

  it('a Default modal still closes on Esc and the scrim, and is a plain dialog', async () => {
    mount(<Harness onConfirm={() => undefined} type="default" keyword="ignored" />);
    const plain = screen.getByRole('dialog', { name: 'Reset all settings?' });
    expect(plain).toHaveAttribute('data-type', 'default');
    expect(within(plain).queryByRole('textbox')).toBeNull(); // the keyword belongs to Danger only
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('the close button has a tooltip that repeats its name (design rule 10)', async () => {
    mount(<Harness onConfirm={() => undefined} type="default" />);
    const close = within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' });
    close.focus();
    expect(await screen.findByText('Close', { selector: '[data-slot=fy-tooltip]' })).toBeVisible();
  });

  it('Persian: the strings come translated, Cancel sits at the start (right) and Confirm at the end', async () => {
    setLocaleData({ locale_data: { messages: { '': { domain: 'fyldo' }, 'Type %s to confirm': ['برای تأیید، «%s» را تایپ کنید'], Close: ['بستن'] } } });
    try {
      mount(<Harness onConfirm={() => undefined} keyword="بازنشانی" />, 'rtl');
      expect(within(dialog()).getByRole('textbox', { name: 'برای تأیید، «بازنشانی» را تایپ کنید' })).toBeInTheDocument();
      expect(within(dialog()).getByRole('button', { name: 'بستن' })).toBeInTheDocument();
      const buttons = within(dialog()).getAllByRole('button');
      const order = buttons.map((b) => b.textContent || b.getAttribute('aria-label'));
      expect(order.slice(-2)).toEqual(['Cancel', 'Reset settings']); // DOM order Cancel → Confirm; the flex row mirrors it
    } finally {
      setLocaleData(null);
    }
  });
});
