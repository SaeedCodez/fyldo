/**
 * Custom-page components: Pagination (labels, disabled ends, RTL numerals), Item Card (opening by the title, actions
 * apart, the optional media area), Stat Card (delta tone and arrow) and the Modal's Content slot. Behaviour and ARIA; the
 * pixels are in the Playwright harness (e2e/harness/pack-visual-custom-pages.spec.ts).
 */
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Badge } from '../../app/components/ui/badge';
import { Checkbox } from '../../app/components/ui/checkbox';
import { IconButton } from '../../app/components/ui/icon-button';
import { AddItemCard, ItemCard } from '../../app/components/ui/item-card';
import { Modal } from '../../app/components/ui/modal';
import { Pagination } from '../../app/components/ui/pagination';
import { StatCard } from '../../app/components/ui/stat-card';
import { ToastProvider } from '../../app/components/ui/toast';
import { TooltipProvider } from '../../app/components/ui/tooltip';
import { RTL_FLIP } from '../../app/icons/rtl-flip';
import { PortalContainerContext } from '../../app/lib/portal';
import { sdk } from '../../app/lib/sdk';
import { createToaster } from '../../app/lib/toast';

function mount(node: ReactNode, dir: 'ltr' | 'rtl' = 'ltr') {
  const root = document.createElement('div');
  root.setAttribute('dir', dir);
  root.setAttribute('lang', dir === 'rtl' ? 'fa-IR' : 'en');
  document.body.append(root);
  render(
    <PortalContainerContext.Provider value={root}>
      <DirectionProvider direction={dir}>
        <TooltipProvider>{node}</TooltipProvider>
      </DirectionProvider>
    </PortalContainerContext.Provider>,
    { container: root.appendChild(document.createElement('div')) },
  );
  return root;
}

describe('Pagination', () => {
  function Harness({ count = 3, start = 1, onChange }: { count?: number; start?: number; onChange?: (page: number) => void }) {
    const [page, setPage] = useState(start);
    return (
      <Pagination
        page={page}
        pageCount={count}
        summary="Showing 1–8 of 24 items"
        onPageChange={(next) => {
          onChange?.(next);
          setPage(next);
        }}
      />
    );
  }

  it('is a nav named "Pagination" with the summary, "Page 1 of 3" and named Previous / Next buttons', () => {
    mount(<Harness />);
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(nav).getByText('Showing 1–8 of 24 items')).toBeVisible();
    expect(within(nav).getByText('Page 1 of 3')).toHaveAttribute('aria-live', 'polite');
    expect(within(nav).getByRole('button', { name: 'Previous page' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Next page' })).toBeInTheDocument();
  });

  it('takes its accessible name from `label`', () => {
    mount(<Pagination page={1} pageCount={2} onPageChange={() => undefined} aria-label="Stories pages" />);
    expect(screen.getByRole('navigation', { name: 'Stories pages' })).toBeInTheDocument();
  });

  it('disables (never hides) Previous on the first page and Next on the last; the ends stay focusable', async () => {
    const onChange = vi.fn();
    mount(<Harness onChange={onChange} />);
    const previous = screen.getByRole('button', { name: 'Previous page' });
    const next = screen.getByRole('button', { name: 'Next page' });
    expect(previous).toHaveAttribute('aria-disabled', 'true');
    expect(next).not.toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(previous);
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(next);
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(previous).not.toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(next);
    expect(onChange).toHaveBeenLastCalledWith(3);
    expect(next).toHaveAttribute('aria-disabled', 'true');
    expect(next).toHaveFocus(); // focus is not lost when the last page disables the button
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledTimes(2);

    await userEvent.click(previous);
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it('renders nothing for one page (or none)', () => {
    const root = mount(
      <>
        <Pagination page={1} pageCount={1} onPageChange={() => undefined} />
        <Pagination page={1} pageCount={0} onPageChange={() => undefined} />
      </>,
    );
    expect(root.querySelector('[data-slot=fy-pagination]')).toBeNull();
  });

  it('writes the page numbers in the page’s numerals in RTL; the arrows mirror there', () => {
    mount(<Pagination page={2} pageCount={12} onPageChange={() => undefined} />, 'rtl');
    expect(screen.getByText('Page ۲ of ۱۲')).toBeInTheDocument();
    // Previous comes first (at the start: on the right in RTL) and draws `arrow-left`, which RTL_FLIP mirrors to point right
    const [previous, next] = screen.getAllByRole('button');
    expect(previous).toHaveAccessibleName('Previous page');
    expect(next).toHaveAccessibleName('Next page');
    expect(RTL_FLIP.has('arrowleft') && RTL_FLIP.has('arrowright')).toBe(true);
  });
});

describe('Item Card', () => {
  const actions = (onEdit: () => void) => [<IconButton key="edit" icon="edit-2" label="Edit" onClick={onEdit} />, <IconButton key="delete" icon="trash" label="Delete" />];

  it('opens through its title, a button whose box covers the card; the card is an article named by it', async () => {
    const onOpen = vi.fn();
    mount(<ItemCard title="Breakfast in 5 minutes" meta="3 slides" tags={['Home page', 'Blog']} onOpen={onOpen} />);
    const card = screen.getByRole('article', { name: 'Breakfast in 5 minutes' });
    const open = within(card).getByRole('button', { name: 'Breakfast in 5 minutes' });
    expect(open.className).toContain('fy:after:inset-0');
    await userEvent.click(open);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(within(card).getByText('3 slides')).toBeInTheDocument();
    expect(card.querySelectorAll('[data-slot=fy-tag]')).toHaveLength(2);
    expect(card.querySelector('[data-slot=fy-tag-remove]')).toBeNull(); // tags are not removable here
  });

  it('opens by link with `href`', () => {
    mount(<ItemCard title="Sleep better" href="#/stories/7" />);
    expect(screen.getByRole('link', { name: 'Sleep better' })).toHaveAttribute('href', '#/stories/7');
  });

  it('action buttons do not open the card', async () => {
    const onOpen = vi.fn();
    const onEdit = vi.fn();
    mount(<ItemCard title="Breakfast" onOpen={onOpen} actions={actions(onEdit)} details={[{ icon: 'clock', label: 'Ends in 23 hours' }]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
    // keyboard order: the title first, then each action
    (document.activeElement as HTMLElement).blur();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Breakfast' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveFocus();
  });

  it('has no media area when `media` is omitted; the badges then sit above the title', () => {
    const root = mount(<ItemCard title="Breakfast" status={<Badge tone="green">Published</Badge>} />);
    expect(root.querySelector('[data-slot=fy-item-card-media]')).toBeNull();
    const badges = root.querySelector('[data-slot=fy-item-card-badges]') as HTMLElement;
    expect(badges.closest('[data-slot=fy-item-card-body]')).not.toBeNull();
    expect(within(badges).getByText('Published')).toBeInTheDocument();
  });

  it('puts the media and both badges in the media area', () => {
    const root = mount(
      <ItemCard title="Breakfast" media={<img alt="" src="data:," />} status={<Badge tone="green">Published</Badge>} flag={<Badge>Pinned</Badge>} />,
    );
    const media = root.querySelector('[data-slot=fy-item-card-media]') as HTMLElement;
    expect(media.querySelector('img')).not.toBeNull();
    expect(within(media).getByText('Published')).toBeInTheDocument();
    expect(within(media).getByText('Pinned')).toBeInTheDocument();
  });

  it('shows at most two footer details, and no footer without details or actions', () => {
    const { container } = render(
      <ItemCard
        title="A"
        details={[
          { icon: 'clock', label: 'one' },
          { icon: 'chart', label: 'two' },
          { icon: 'user', label: 'three' },
        ]}
      />,
    );
    expect(within(container).getByText('two')).toBeInTheDocument();
    expect(within(container).queryByText('three')).toBeNull();
    const plain = render(<ItemCard title="B" />);
    expect(plain.container.querySelector('[data-slot=fy-item-card-footer]')).toBeNull();
    expect(within(plain.container).queryByRole('button')).toBeNull(); // nothing opens: the title is plain text
  });

  it('the Add card is a real button (or a link with href)', async () => {
    const onClick = vi.fn();
    mount(<AddItemCard title="Add item" description="Create a new item to show it in this list." onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: /Add item/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
    render(<AddItemCard title="New story" href="#/stories/new" />);
    expect(screen.getByRole('link', { name: 'New story' })).toHaveAttribute('href', '#/stories/new');
  });
});

describe('Stat Card', () => {
  const tone = () => document.querySelector('[data-slot=fy-badge]')?.getAttribute('data-tone');
  const arrow = () => document.querySelector('[data-slot=fy-badge] [data-fyldo-icon], [data-slot=fy-badge] span[aria-hidden]');

  it('up is green with an arrow, and screen readers hear "Up" before the change', () => {
    render(<StatCard label="Views" value="4,820" icon="chart" delta={{ value: '12%', trend: 'up' }} comparison="vs previous 30 days" />);
    expect(screen.getByText('4,820')).toBeInTheDocument();
    expect(screen.getByText('vs previous 30 days')).toBeInTheDocument();
    expect(tone()).toBe('green');
    expect(arrow()).not.toBeNull();
    expect(document.querySelector('[data-slot=fy-badge]')).toHaveTextContent('Up 12%');
  });

  it('down is red; neutral is gray without an arrow', () => {
    const down = render(<StatCard label="Views" value="1" delta={{ value: '3%', trend: 'down' }} />);
    expect(tone()).toBe('red');
    expect(document.querySelector('[data-slot=fy-badge]')).toHaveTextContent('Down 3%');
    down.unmount();
    render(<StatCard label="Views" value="1" delta={{ value: '0%', trend: 'neutral' }} />);
    expect(tone()).toBe('gray');
    expect(arrow()).toBeNull();
    expect(document.querySelector('[data-slot=fy-badge]')).toHaveTextContent(/^0%$/);
  });

  it('`tone` overrides the colour when up is bad news', () => {
    render(<StatCard label="Bounce rate" value="41%" delta={{ value: '5%', trend: 'up', tone: 'negative' }} />);
    expect(tone()).toBe('red');
    expect(arrow()).not.toBeNull();
  });

  it('without an icon there is no icon box; without delta and comparison no footer', () => {
    const { container } = render(<StatCard label="Views" value="4,820" />);
    expect(container.querySelector('[aria-hidden=true]')).toBeNull();
    expect(container.querySelector('[data-slot=fy-badge]')).toBeNull();
  });
});

describe('Modal: Content slot', () => {
  it('renders children between the text and the footer, inside the dialog', () => {
    mount(
      <Modal open onOpenChange={() => undefined} title="Delete “Summer sale”?" cancelLabel="Cancel" confirmLabel="Delete" onConfirm={() => undefined}>
        <Checkbox label="Also delete its media files" description="If unchecked, the images stay in the media library." />
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Delete “Summer sale”?' });
    const content = dialog.querySelector('[data-slot=fy-modal-content]') as HTMLElement;
    expect(within(content).getByRole('checkbox', { name: 'Also delete its media files' })).toBeInTheDocument();
    // after the header's close button, before Cancel
    const close = within(dialog).getByRole('button', { name: 'Close' });
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
    expect(close.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(content.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has no Content frame without children', () => {
    mount(<Modal open onOpenChange={() => undefined} title="Discard?" cancelLabel="Cancel" confirmLabel="Discard" onConfirm={() => undefined} />);
    expect(screen.getByRole('dialog').querySelector('[data-slot=fy-modal-content]')).toBeNull();
  });
});

describe('Field controls on a custom page', () => {
  const { ui } = sdk;

  it('work outside a Setting Row (a toolbar, a card of the page’s own)', () => {
    mount(
      <>
        <ui.ColorPicker value="#ff6b4a" onValueChange={() => undefined} aria-label="Colour" />
        <ui.DatePicker value="2026-10-17" calendar="gregorian" onValueChange={() => undefined} aria-label="From" />
        <ui.TimePicker value="09:30" onValueChange={() => undefined} aria-label="At" />
        <ui.DateRangePicker value={{ start: '2026-10-01', end: '2026-10-05' }} calendar="gregorian" onValueChange={() => undefined} />
        <ui.MediaPicker kind="image" label="Cover" value={0} onValueChange={() => undefined} onError={() => undefined} />
        <ui.IconPicker value="star" onValueChange={() => undefined} aria-label="Icon" />
        <ui.GroupItem title="Slide 1" open onOpenChange={() => undefined}>
          Body
        </ui.GroupItem>
      </>,
    );

    // On its own the date field links the line in the other calendar itself (in a Setting Row the row does).
    const date = screen.getByRole('button', { name: 'From' });
    expect(date).toHaveAccessibleDescription(screen.getByText((_, node) => node?.getAttribute('data-slot') === 'fy-date-equivalent').textContent ?? '');
    expect(screen.getByRole('button', { name: 'Colour' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Icon' })).toHaveTextContent('star');
    expect(screen.getByRole('group', { name: 'Cover' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Slide 1' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('Group Item: status labels describe the item’s button, and an inactive item is marked', () => {
    mount(
      <>
        <ui.GroupItem title="Weekend offer" open={false} onOpenChange={() => undefined} status={[{ label: 'Scheduled', tone: 'blue', icon: 'clock' }]}>
          Body
        </ui.GroupItem>
        <ui.GroupItem title="Morning stretch" open={false} onOpenChange={() => undefined} inactive status={[{ label: 'Inactive' }, { label: '' }]}>
          Body
        </ui.GroupItem>
        <ui.GroupItem title="Spring sale" open={false} onOpenChange={() => undefined}>
          Body
        </ui.GroupItem>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Weekend offer' })).toHaveAccessibleDescription('Scheduled');
    const stretch = screen.getByRole('button', { name: 'Morning stretch' });
    expect(stretch).toHaveAccessibleDescription('Inactive'); // an empty label is not drawn
    expect(stretch.closest('[data-slot=fy-group-item]')).toHaveAttribute('data-inactive');
    expect(screen.getByRole('button', { name: 'Spring sale' })).not.toHaveAttribute('aria-describedby');
    expect(screen.getAllByText('Scheduled')[0]?.closest('[data-slot=fy-group-item-status]')).not.toBeNull();
  });

  it('write in the screen’s language without being given one (the root’s lang)', () => {
    const root = mount(<ui.DatePicker value="2026-10-17" calendar="gregorian" onValueChange={() => undefined} aria-label="Start" />, 'rtl');
    expect(root.textContent).toContain('۲۰۲۶');
    expect(root.textContent).not.toContain('2026');
    root.remove();
  });
});

describe('GroupList on a custom page (the page’s own items)', () => {
  type Slide = { title: string; hidden?: boolean; link?: string };

  function Slides({ initial, errors = {}, reveal = 0 }: { initial: Slide[]; errors?: Record<number, number>; reveal?: number }) {
    const [slides, setSlides] = useState(initial);
    const { ui } = sdk;
    return (
      <ToastProvider toaster={createToaster()}>
        <ui.GroupList<Slide>
          aria-label="Slides"
          items={slides}
          onChange={setSlides}
          title={(slide) => slide.title}
          summary={(slide) => (slide.link ? { text: slide.link, mono: true } : null)}
          status={(slide) => (slide.hidden ? [{ label: 'Inactive' }] : [])}
          inactive={(slide) => Boolean(slide.hidden)}
          errorCount={(_, index) => errors[index] ?? 0}
          sortable
          addable
          create={() => ({ title: '' })}
          max={4}
          addLabel="Add slide"
          reveal={reveal}
        >
          {(slide, index, update) => <ui.Input aria-label={`Title of slide ${index + 1}`} value={slide.title} onValueChange={(title: string) => update({ ...slide, title })} />}
        </ui.GroupList>
        <p data-testid="order">{slides.map((s) => s.title || '·').join(',')}</p>
      </ToastProvider>
    );
  }

  const order = () => screen.getByTestId('order').textContent;

  it('draws the items with their titles, status and fade, named on its own', () => {
    mount(<Slides initial={[{ title: 'Breakfast', link: '/a' }, { title: 'Stretch', hidden: true }]} />);
    expect(screen.getByRole('group', { name: 'Slides' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stretch' })).toHaveAccessibleDescription('Inactive');
    expect(screen.getByRole('button', { name: 'Stretch' }).closest('[data-slot=fy-group-item]')).toHaveAttribute('data-inactive');
    expect(screen.getByText('2 of 4')).toBeVisible();
  });

  it('reorders with the keyboard, announcing each step; Escape puts it back', async () => {
    mount(<Slides initial={[{ title: 'A' }, { title: 'B' }, { title: 'C' }]} />);
    const handle = screen.getByRole('button', { name: 'Reorder A' });
    handle.focus();
    await userEvent.keyboard(' ');
    expect(screen.getByText(/A picked up\. Position 1 of 3\./)).toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}{ArrowDown} ');
    expect(order()).toBe('B,C,A');
    expect(screen.getByRole('button', { name: 'Reorder A' })).toHaveFocus();

    await userEvent.keyboard(' {ArrowUp}{Escape}');
    expect(order()).toBe('B,C,A');
  });

  it('adds (opening it, focus in its body), duplicates, edits through `update`, and removes with Undo', async () => {
    mount(<Slides initial={[{ title: 'A' }]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add slide' }));
    expect(order()).toBe('A,·');
    expect(screen.getByRole('textbox', { name: 'Title of slide 2' })).toHaveFocus();
    await userEvent.keyboard('New');
    expect(order()).toBe('A,New');

    await userEvent.click(screen.getByRole('button', { name: 'Duplicate A' }));
    expect(order()).toBe('A,A,New');
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove A' })[0] as HTMLElement);
    expect(order()).toBe('A,New');
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(order()).toBe('A,A,New');
  });

  it('a refused save opens the first item with errors', () => {
    const { rerender } = render(<Slides initial={[{ title: 'A' }, { title: 'B' }]} errors={{ 1: 2 }} />);
    expect(screen.queryByRole('textbox', { name: 'Title of slide 2' })).toBeNull();
    rerender(<Slides initial={[{ title: 'A' }, { title: 'B' }]} errors={{ 1: 2 }} reveal={1} />);
    expect(screen.getByRole('textbox', { name: 'Title of slide 2' })).toBeVisible();
    expect(screen.getByText('2 errors')).toBeVisible();
  });
});
