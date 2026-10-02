import { DirectionProvider } from '@base-ui/react/direction-provider';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FieldRenderer } from '../../app/components/fyldo/FieldRenderer';
import { IconPickerField } from '../../app/components/ui/icon-picker-field';
import { resetIconCache, setIconLoader } from '../../app/icons/registry';
import { ICON_NAMES } from '../../app/icons/names.generated';
import { setLocaleData } from '../../app/i18n';
import type { IconFieldDef } from '../../app/types';

const NAMES = ['home-2', 'setting-2', 'star', 'user', 'arrow-down'];

function Field({ initial = '', icons = NAMES, dir = 'ltr', onValueChange, onBlur }: { initial?: string; icons?: string[] | null; dir?: 'ltr' | 'rtl'; onValueChange?: (value: string) => void; onBlur?: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <DirectionProvider direction={dir}>
      <div dir={dir}>
        <IconPickerField
          label="Menu icon"
          description="Shown next to the menu item."
          value={value}
          icons={icons}
          onValueChange={(next) => {
            setValue(next);
            onValueChange?.(next);
          }}
          onBlur={onBlur}
        />
      </div>
    </DirectionProvider>
  );
}

const trigger = () => screen.getByRole('button', { name: 'Menu icon' });
const open = async () => {
  await userEvent.click(trigger());
  return screen.findByRole('dialog', { name: 'Choose an icon' });
};
const search = () => screen.getByRole('textbox', { name: 'Search icons' });
// Plain DOM queries: the whole library is ~1,000 tiles and role queries over that many nodes are slow in jsdom.
const options = () => [...document.querySelectorAll<HTMLElement>('[role=option]')];
const option = (name: string): HTMLElement => {
  const tile = document.querySelector<HTMLElement>(`[role=option][data-icon="${name}"]`);
  if (!tile) throw new Error(`no tile named "${name}"`);
  return tile;
};
const selectButton = () => screen.getByRole('button', { name: 'Select icon' });

beforeEach(() => {
  setLocaleData(null);
  setIconLoader(async () => [['path', { d: 'M3 12h18' }]]);
});
afterEach(() => {
  setIconLoader(null);
  resetIconCache();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
});

describe('Icon Picker field', () => {
  it('shows the placeholder while empty and the name, left to right, once there is an icon', () => {
    const { unmount } = render(<Field />);
    expect(trigger()).toHaveTextContent('Choose an icon…');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).toHaveAccessibleDescription('Shown next to the menu item.');
    unmount();

    render(<Field initial="home-2" dir="rtl" />);
    expect(trigger()).toHaveTextContent('home-2');
    expect(trigger().querySelector('bdi')).toHaveAttribute('dir', 'ltr');
  });

  it('opens a named dialog (lazily) with focus in the search box; the grid is a listbox of tiles named by their icon', async () => {
    render(<Field initial="star" />);
    const dialog = await open();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(dialog).toHaveAccessibleDescription('Search the library, then pick one icon.');
    await waitFor(() => expect(search()).toHaveFocus());

    const grid = within(dialog).getByRole('listbox', { name: 'Icons' });
    expect(within(grid).getAllByRole('option').map((o) => o.getAttribute('aria-label'))).toEqual(NAMES);
    expect(within(grid).getByRole('option', { name: 'home-2' })).toBeInTheDocument();
    expect(within(dialog).getByRole('status')).toHaveTextContent('5 icons');
  });

  it('preselects the current icon, scrolls it into view and shows it in the footer', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(<Field initial="star" />);
    await open();

    expect(option('star')).toHaveAttribute('aria-selected', 'true');
    expect(options().filter((o) => o.getAttribute('aria-selected') === 'true')).toHaveLength(1);
    expect(scroll).toHaveBeenCalledWith({ block: 'center' });
    expect(scroll.mock.contexts.some((el) => (el as HTMLElement).dataset.icon === 'star')).toBe(true);
    expect(screen.getByText('Selected icon')).toBeInTheDocument();
    expect(document.querySelector('[data-slot=fy-icon-selection-name]')).toHaveTextContent('star');
    expect(selectButton()).toBeEnabled();
  });

  it('with no icon yet nothing is selected and "Select icon" waits for a tile', async () => {
    render(<Field />);
    await open();

    expect(options().every((o) => o.getAttribute('aria-selected') === 'false')).toBe(true);
    expect(screen.getByText('No icon selected')).toBeInTheDocument();
    expect(selectButton()).toBeDisabled();

    await userEvent.click(option('user'));
    expect(option('user')).toHaveAttribute('aria-selected', 'true');
    expect(selectButton()).toBeEnabled();
  });
});

describe('searching', () => {
  it('filters the whole library by a case-insensitive substring and counts what it found', async () => {
    render(<Field icons={null} />);
    await open();
    expect(screen.getByRole('status')).toHaveTextContent(`${ICON_NAMES.length} icons`);

    await userEvent.type(search(), ' ARROW ');
    const expected = ICON_NAMES.filter((name) => name.includes('arrow'));
    expect(expected.length).toBeGreaterThan(5);
    expect(options()).toHaveLength(expected.length);
    expect(options().every((o) => o.getAttribute('aria-label')?.includes('arrow'))).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent(`${expected.length} results for “ARROW”`);
  }, 20_000);

  it('says so when nothing matches, and the clear button brings the grid back', async () => {
    render(<Field icons={NAMES} />);
    await open();
    await userEvent.type(search(), 'xyzzy');

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByText('No icons found')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('0 results for “xyzzy”');

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(search()).toHaveValue('');
    expect(search()).toHaveFocus();
    expect(options()).toHaveLength(NAMES.length);
  });

  it('keeps the choice made in an earlier search', async () => {
    render(<Field />);
    await open();
    await userEvent.click(option('arrow-down'));
    await userEvent.type(search(), 'star');

    expect(options()).toHaveLength(1);
    expect(option('star')).toHaveAttribute('aria-selected', 'false');
    expect(selectButton()).toBeEnabled();
    expect(document.querySelector('[data-slot=fy-icon-selection-name]')).toHaveTextContent('arrow-down');
  });
});

describe('choosing', () => {
  it('applies only on "Select icon": the value changes, the dialog closes, focus is back on the field', async () => {
    const onValueChange = vi.fn();
    const onBlur = vi.fn();
    render(<Field initial="home-2" onValueChange={onValueChange} onBlur={onBlur} />);
    await open();
    expect(onBlur).not.toHaveBeenCalled(); // focus going into the modal is not leaving the field

    await userEvent.click(option('setting-2'));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(trigger()).toHaveTextContent('home-2');

    await userEvent.click(selectButton());
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('setting-2');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger()).toHaveFocus());
    expect(trigger()).toHaveTextContent('setting-2');
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Cancel', async () => userEvent.click(screen.getByRole('button', { name: 'Cancel' }))],
    ['the close button', async () => userEvent.click(screen.getByRole('button', { name: 'Close' }))],
    ['Escape', async () => userEvent.keyboard('{Escape}')],
  ])('%s leaves the value alone, gives focus back, and the next opening starts from the stored icon', async (_name, dismiss) => {
    const onValueChange = vi.fn();
    render(<Field initial="home-2" onValueChange={onValueChange} />);
    await open();
    await userEvent.click(option('user'));
    await dismiss();

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger()).toHaveFocus());
    expect(onValueChange).not.toHaveBeenCalled();
    expect(trigger()).toHaveTextContent('home-2');

    await open();
    expect(option('home-2')).toHaveAttribute('aria-selected', 'true');
    expect(option('user')).toHaveAttribute('aria-selected', 'false');
  });

  it('a press on the dimmed page does not throw the choice away', async () => {
    render(<Field />);
    await open();
    await userEvent.click(option('user'));
    await userEvent.click(document.querySelector('[data-slot=fy-modal-backdrop]') as HTMLElement);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(option('user')).toHaveAttribute('aria-selected', 'true');
  });

  it('a name that is not in the offered list is not shown as selected and does not enable "Select icon"', async () => {
    render(<Field initial="not-in-the-list" />);
    await open();

    expect(options().every((o) => o.getAttribute('aria-selected') === 'false')).toBe(true);
    expect(selectButton()).toBeDisabled();
  });
});

describe('grid keyboard', () => {
  const MANY = Array.from({ length: 20 }, (_, i) => `tile-${String(i + 1).padStart(2, '0')}`);
  const focused = () => document.activeElement?.getAttribute('aria-label');
  const eightColumns = () => Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 568 });

  it('is one tab stop (roving tabindex) that starts on the selected tile', async () => {
    render(<Field initial="tile-05" icons={MANY} />);
    await open();

    expect(options().filter((o) => o.tabIndex === 0).map((o) => o.getAttribute('aria-label'))).toEqual(['tile-05']);
    await userEvent.keyboard('{Tab}'); // search → clear? nothing typed, so the next stop is the grid
    expect(focused()).toBe('tile-05');
  });

  it('moves by one tile, by one row (the column count) and to the ends, and does not wrap', async () => {
    eightColumns();
    render(<Field initial="tile-01" icons={MANY} />);
    await open();
    await userEvent.keyboard('{ArrowDown}'); // from the search box into the grid
    expect(focused()).toBe('tile-01');

    await userEvent.keyboard('{ArrowRight}');
    expect(focused()).toBe('tile-02');
    await userEvent.keyboard('{ArrowDown}');
    expect(focused()).toBe('tile-10');
    await userEvent.keyboard('{ArrowDown}');
    expect(focused()).toBe('tile-18');
    await userEvent.keyboard('{ArrowDown}'); // the last row: nowhere to go
    expect(focused()).toBe('tile-18');
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(focused()).toBe('tile-02');
    await userEvent.keyboard('{ArrowUp}');
    expect(focused()).toBe('tile-02');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(focused()).toBe('tile-01');
    await userEvent.keyboard('{End}');
    expect(focused()).toBe('tile-20');
    await userEvent.keyboard('{ArrowRight}');
    expect(focused()).toBe('tile-20');
    await userEvent.keyboard('{Home}');
    expect(focused()).toBe('tile-01');
    expect(options().filter((o) => o.tabIndex === 0).map((o) => o.getAttribute('aria-label'))).toEqual(['tile-01']);
  });

  it('a short last row: Down from above it lands on the last tile', async () => {
    eightColumns();
    render(<Field initial="tile-12" icons={MANY} />);
    await open();
    await userEvent.keyboard('{ArrowDown}');
    expect(focused()).toBe('tile-12');
    await userEvent.keyboard('{ArrowDown}'); // 12 + 8 = 20 is the last tile
    expect(focused()).toBe('tile-20');
  });

  it('fits as many columns as the width allows: fewer on a narrower grid', async () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 352 }); // (352 + 8) / 72 = 5 columns
    render(<Field initial="tile-01" icons={MANY} />);
    await open();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(focused()).toBe('tile-06');
  });

  it('mirrors the arrows in a right-to-left page (the grid starts at the right)', async () => {
    eightColumns();
    render(<Field initial="tile-01" icons={MANY} dir="rtl" />);
    await open();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowLeft}');
    expect(focused()).toBe('tile-02');
    await userEvent.keyboard('{ArrowRight}');
    expect(focused()).toBe('tile-01');
  });

  it('Enter and Space select the focused tile (and only that one)', async () => {
    render(<Field icons={MANY} />);
    await open();
    await userEvent.keyboard('{ArrowDown}'); // into the grid, on the first tile
    await userEvent.keyboard('{ArrowRight}{Enter}');
    expect(option('tile-02')).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{ArrowRight}[Space]');
    expect(option('tile-03')).toHaveAttribute('aria-selected', 'true');
    expect(option('tile-02')).toHaveAttribute('aria-selected', 'false');
    expect(selectButton()).toBeEnabled();
  });
});

describe('Icon field in a Setting Row', () => {
  const field: IconFieldDef = {
    id: 'menu_icon',
    type: 'icon',
    label: 'Menu icon',
    description: 'Shown next to the menu item.',
    default: '',
    disabled: false,
    layout: 'field',
    validate: { pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' },
    icons: NAMES,
  };

  it('is named by the row title, offers its own icons and reports the chosen name', async () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(<FieldRenderer field={field} value="" divider={false} onChange={onChange} onBlur={onBlur} />);
    await userEvent.click(screen.getByRole('button', { name: 'Menu icon' }));
    await screen.findByRole('dialog');
    expect(options()).toHaveLength(NAMES.length);

    await userEvent.click(option('user'));
    await userEvent.click(selectButton());
    expect(onChange).toHaveBeenCalledWith('menu_icon', 'user');
    expect(onBlur).toHaveBeenCalledWith('menu_icon');
  });

  it('offers every Iconsax icon when the field does not restrict them', async () => {
    render(<FieldRenderer field={{ ...field, icons: null }} value="home-2" divider={false} onChange={() => undefined} onBlur={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Menu icon' }));
    await screen.findByRole('dialog');
    expect(options()).toHaveLength(ICON_NAMES.length);
    expect(option('home-2')).toHaveAttribute('aria-selected', 'true');
  }, 20_000);
});
