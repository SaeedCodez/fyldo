import { DirectionProvider } from '@base-ui/react/direction-provider';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FieldRenderer } from '../../app/components/fyldo/FieldRenderer';
import { calendarCellClass } from '../../app/components/ui/calendar-cell';
import { CalendarPanel } from '../../app/components/ui/calendar-panel';
import { DateField, TimeField } from '../../app/components/ui/date-field';
import { TimePanel } from '../../app/components/ui/time-panel';
import { setClock, setDateSettings, type CalendarKind, type Time } from '../../app/lib/datetime';
import type { DateTimeFieldDef } from '../../app/types';

beforeEach(() => {
  // Saturday 17 October 2026, 10:00 in UTC: "today" in the pack's Calendar Panel.
  setClock(() => new Date('2026-10-17T10:00:00Z'));
  setDateSettings({ timezone: 'UTC', startOfWeek: 1, calendar: 'gregorian', locale: 'en' });
});

afterEach(() => setClock(null));

function Panel({
  initial = '2026-10-20',
  kind = 'date',
  calendar = 'gregorian',
  dir = 'ltr',
  min,
  max,
  onChange = () => undefined,
}: {
  initial?: string;
  kind?: 'date' | 'datetime';
  calendar?: CalendarKind;
  dir?: 'ltr' | 'rtl';
  min?: string;
  max?: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <DirectionProvider direction={dir}>
      <div dir={dir}>
        <CalendarPanel
          kind={kind}
          value={value}
          calendar={calendar}
          min={min}
          max={max}
          step={5}
          onValueChange={(next) => {
            setValue(next);
            onChange(next);
          }}
        />
      </div>
    </DirectionProvider>
  );
}

const grid = () => screen.getByRole('grid');
const cell = (name: string) => within(grid()).getByRole('gridcell', { name });
const focused = () => document.activeElement as HTMLElement;

describe('Calendar Panel · day grid', () => {
  it('is a grid named by its month, weeks from the site start day, today and the selected day marked', () => {
    render(<Panel />);
    expect(grid()).toHaveAccessibleName('October 2026');
    const heads = within(grid()).getAllByRole('columnheader');
    expect(heads.map((h) => h.textContent)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
    expect(heads[0]).toHaveAccessibleName('Monday');
    expect(within(grid()).getAllByRole('gridcell')).toHaveLength(42);

    const selected = cell('Tuesday, Oct 20, 2026');
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected).toHaveAttribute('tabindex', '0');
    expect(cell('Saturday, Oct 17, 2026')).toHaveAttribute('aria-current', 'date');
    // the first row starts on Monday 28 September, a day of the month before
    expect(within(grid()).getAllByRole('gridcell')[0]).toHaveAccessibleName('Monday, Sep 28, 2026');
    expect(within(grid()).getAllByRole('gridcell')[0]).toHaveAttribute('data-outside');
  });

  it('arrows move by day and week, Home / End to the week ends, Page Up / Down by month, Enter chooses', async () => {
    const onChange = vi.fn();
    render(<Panel onChange={onChange} />);
    cell('Tuesday, Oct 20, 2026').focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(focused()).toHaveAccessibleName('Wednesday, Oct 21, 2026');
    await userEvent.keyboard('{ArrowDown}');
    expect(focused()).toHaveAccessibleName('Wednesday, Oct 28, 2026');
    await userEvent.keyboard('{ArrowLeft}{ArrowUp}');
    expect(focused()).toHaveAccessibleName('Tuesday, Oct 20, 2026');
    await userEvent.keyboard('{Home}');
    expect(focused()).toHaveAccessibleName('Monday, Oct 19, 2026');
    await userEvent.keyboard('{End}');
    expect(focused()).toHaveAccessibleName('Sunday, Oct 25, 2026');
    await userEvent.keyboard('{PageDown}');
    expect(grid()).toHaveAccessibleName('November 2026');
    expect(focused()).toHaveAccessibleName('Wednesday, Nov 25, 2026');
    await userEvent.keyboard('{PageUp}{PageUp}');
    expect(grid()).toHaveAccessibleName('September 2026');
    await userEvent.keyboard('{Shift>}{PageDown}{/Shift}');
    expect(grid()).toHaveAccessibleName('September 2027');
    // leaving the month by arrow shows the next month
    await userEvent.keyboard('{PageUp}{PageUp}{PageUp}{PageUp}{PageUp}{PageUp}{PageUp}{PageUp}{PageUp}{PageUp}{PageUp}{PageUp}');
    expect(grid()).toHaveAccessibleName('September 2026');
    expect(onChange).not.toHaveBeenCalled(); // moving is not choosing

    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('2026-09-25');
    expect(focused()).toHaveAttribute('aria-selected', 'true');
  });

  it('mirrors the arrows in Persian (right-to-left)', async () => {
    render(<Panel dir="rtl" />);
    cell('Tuesday, Oct 20, 2026').focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(focused()).toHaveAccessibleName('Wednesday, Oct 21, 2026');
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(focused()).toHaveAccessibleName('Monday, Oct 19, 2026');
  });

  it('disables (and strikes through) the days outside min / max: they take focus but cannot be chosen', async () => {
    const onChange = vi.fn();
    render(<Panel min="2026-10-17" max="2026-10-25" onChange={onChange} />);
    const before = cell('Friday, Oct 16, 2026');
    expect(before).toHaveAttribute('aria-disabled', 'true');
    expect(before.className).toContain('line-through');
    expect(cell('Monday, Oct 26, 2026')).toHaveAttribute('aria-disabled', 'true');
    expect(cell('Saturday, Oct 17, 2026')).not.toHaveAttribute('aria-disabled');

    await userEvent.click(before);
    before.focus();
    await userEvent.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(cell('Saturday, Oct 17, 2026'));
    expect(onChange).toHaveBeenCalledWith('2026-10-17');
  });

  it('switching the calendar changes the view, never the value; Jalali weeks start on Saturday', async () => {
    const onChange = vi.fn();
    render(<Panel onChange={onChange} />);
    const calendars = screen.getByRole('radiogroup', { name: 'Calendar' });
    expect(within(calendars).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Gregorian', 'Jalali']);

    await userEvent.click(within(calendars).getByRole('radio', { name: 'Jalali' }));
    expect(grid()).toHaveAccessibleName('Mehr 1405');
    expect(within(grid()).getAllByRole('columnheader')[0]).toHaveAccessibleName('Saturday');
    expect(cell('Tuesday, 28 Mehr 1405')).toHaveAttribute('aria-selected', 'true');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a locked calendar has no switch', () => {
    render(
      <CalendarPanel value="2026-10-20" calendar="jalali" switchable={false} onValueChange={() => undefined} />,
    );
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(grid()).toHaveAccessibleName('Mehr 1405');
  });

  it('the title opens the Months and the Years views; choosing goes back down', async () => {
    render(<Panel />);
    await userEvent.click(screen.getByRole('button', { name: 'October 2026' }));
    expect(grid()).toHaveAccessibleName('2026');
    expect(within(grid()).getByRole('gridcell', { name: 'October' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('button', { name: '2026' }));
    expect(grid()).toHaveAccessibleName('2020 – 2031');
    expect(within(grid()).getAllByRole('gridcell')).toHaveLength(12);
    await userEvent.click(within(grid()).getByRole('gridcell', { name: '2028' }));
    expect(grid()).toHaveAccessibleName('2028');
    await userEvent.click(within(grid()).getByRole('gridcell', { name: 'March' }));
    expect(grid()).toHaveAccessibleName('March 2028');
  });

  it('Today chooses the site’s today; Clear empties the value', async () => {
    const onChange = vi.fn();
    render(<Panel onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-10-17');
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('a datetime is picked in the site’s time and stored in UTC', async () => {
    setDateSettings({ timezone: 'Asia/Tehran' });
    const onChange = vi.fn();
    render(<Panel kind="datetime" initial="2026-10-20 11:00:00" onChange={onChange} />);
    // 11:00 UTC is 14:30 in Tehran
    expect(screen.getByRole('listbox', { name: 'Hour' }).querySelector('[aria-selected=true]')).toHaveTextContent('14');
    expect(screen.getByRole('listbox', { name: 'Minute' }).querySelector('[aria-selected=true]')).toHaveTextContent('30');

    await userEvent.click(within(screen.getByRole('listbox', { name: 'Hour' })).getByRole('option', { name: '09' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-10-20 06:00:00'); // 09:30 in Tehran
    await userEvent.click(cell('Wednesday, Oct 21, 2026'));
    expect(onChange).toHaveBeenLastCalledWith('2026-10-21 06:00:00');
  });
});

describe('Time Panel', () => {
  function Columns({ onChange = () => undefined }: { onChange?: (t: Time) => void }) {
    const [value, setValue] = useState<Time | null>({ hour: 14, minute: 30 });
    return (
      <TimePanel
        value={value}
        step={15}
        onNow={() => undefined}
        onValueChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    );
  }

  it('is two listboxes, hour then minute, the minutes on the step; arrows move the selection', async () => {
    const onChange = vi.fn();
    render(<Columns onChange={onChange} />);
    const hours = screen.getByRole('listbox', { name: 'Hour' });
    const minutes = screen.getByRole('listbox', { name: 'Minute' });
    expect(within(hours).getAllByRole('option')).toHaveLength(24);
    expect(within(minutes).getAllByRole('option').map((o) => o.textContent)).toEqual(['00', '15', '30', '45']);
    expect(hours.parentElement).toHaveAttribute('dir', 'ltr'); // hour → minute, left to right, in every language

    const fourteen = within(hours).getByRole('option', { name: '14' });
    expect(fourteen).toHaveAttribute('aria-selected', 'true');
    fourteen.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenLastCalledWith({ hour: 15, minute: 30 });
    expect(focused()).toHaveAccessibleName('15');
    await userEvent.keyboard('{End}');
    expect(onChange).toHaveBeenLastCalledWith({ hour: 23, minute: 30 });
    await userEvent.click(within(minutes).getByRole('option', { name: '45' }));
    expect(onChange).toHaveBeenLastCalledWith({ hour: 23, minute: 45 });
  });
});

describe('Date and time fields', () => {
  function Dated({ initial = '' }: { initial?: string }) {
    const [value, setValue] = useState(initial);
    return (
      <div>
        <button type="button">Elsewhere</button>
        <DateField label="Sale starts" description="The first day the discount applies." value={value} onValueChange={setValue} calendar="auto" />
      </div>
    );
  }

  it('shows the placeholder, then the value and the same day in the other calendar under it', async () => {
    render(<Dated />);
    const trigger = screen.getByRole('button', { name: 'Sale starts' });
    expect(trigger).toHaveTextContent('Pick a date…');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Choose a date' });
    // nothing chosen yet: focus starts on today
    await waitFor(() => expect(focused()).toHaveAccessibleName('Saturday, Oct 17, 2026'));
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{Enter}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus()); // Enter chose, closed and gave focus back
    expect(trigger).toHaveTextContent('Oct 20, 2026');
    expect(screen.getByText('28 Mehr 1405 · Jalali')).toBeVisible();
    expect(trigger).toHaveAccessibleDescription(expect.stringContaining('28 Mehr 1405 · Jalali'));
    expect(dialog).not.toBeInTheDocument();
  });

  it('Escape closes and returns focus without changing the value', async () => {
    render(<Dated initial="2026-10-20" />);
    const trigger = screen.getByRole('button', { name: 'Sale starts' });
    await userEvent.click(trigger);
    await screen.findByRole('dialog');
    await waitFor(() => expect(focused()).toHaveAccessibleName('Tuesday, Oct 20, 2026'));
    await userEvent.keyboard('{ArrowDown}{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveTextContent('Oct 20, 2026');
  });

  it('a time is typed (Persian digits too) or picked; the text is always left to right', async () => {
    function Timed() {
      const [value, setValue] = useState('09:00');
      return (
        <>
          <TimeField label="Send at" value={value} onValueChange={setValue} step={15} />
          <output>{value}</output>
        </>
      );
    }
    render(<Timed />);
    const input = screen.getByRole('textbox', { name: 'Send at' });
    expect(input).toHaveValue('09:00');
    expect(input).toHaveAttribute('dir', 'ltr');

    await userEvent.clear(input);
    await userEvent.type(input, '۱۴۳۰');
    await userEvent.tab();
    expect(screen.getByRole('status')).toHaveTextContent('14:30');
    expect(input).toHaveValue('14:30');

    input.focus();
    await userEvent.keyboard('{ArrowDown}');
    await screen.findByRole('dialog', { name: 'Choose a time' });
    await userEvent.click(within(screen.getByRole('listbox', { name: 'Minute' })).getByRole('option', { name: '45' }));
    expect(screen.getByRole('status')).toHaveTextContent('14:45');
  });
});

describe('in a Setting Row', () => {
  const field: DateTimeFieldDef = {
    id: 'launch_date',
    type: 'date',
    label: 'Launch date',
    description: '',
    default: '',
    disabled: false,
    layout: 'field',
    validate: { date: { min: 'today' } },
    calendar: 'jalali',
    placeholder: '',
  };

  it('a locked Jalali field writes Jalali, has no switch and disables the days before today', async () => {
    render(<FieldRenderer field={field} value="2026-10-20" divider={false} onChange={() => undefined} onBlur={() => undefined} />);
    const trigger = screen.getByRole('button', { name: 'Launch date' });
    expect(trigger).toHaveTextContent('28 Mehr 1405');
    expect(screen.getByText('Oct 20, 2026 · Gregorian')).toBeVisible();
    await userEvent.click(trigger);
    await screen.findByRole('dialog');
    expect(screen.queryByRole('radiogroup', { name: 'Calendar' })).toBeNull();
    expect(cell('Friday, 24 Mehr 1405')).toHaveAttribute('aria-disabled', 'true'); // 16 October
    expect(cell('Saturday, 25 Mehr 1405')).not.toHaveAttribute('aria-disabled'); // today
  });
});

describe('Calendar Cell classes', () => {
  // Classes are composed without tailwind-merge: two text colours on one cell would be decided by stylesheet order.
  const colours = (c: string) => c.split(' ').filter((n) => /^fy:text-(text|brand)-/.test(n));

  it('gives each state exactly one text colour, white on the selected fill', () => {
    expect(colours(calendarCellClass('day', { selected: true }))).toEqual(['fy:text-text-inverse']);
    expect(colours(calendarCellClass('wide', { selected: true, today: true }))).toEqual(['fy:text-text-inverse']);
    expect(colours(calendarCellClass('day', { today: true }))).toEqual(['fy:text-brand-text']);
    expect(colours(calendarCellClass('day', { outside: true }))).toEqual(['fy:text-text-tertiary']);
    expect(colours(calendarCellClass('day', { disabled: true, outside: true }))).toEqual(['fy:text-text-disabled']);
    expect(colours(calendarCellClass('day', {}))).toEqual(['fy:text-text-primary']);
    expect(calendarCellClass('day', { selected: true }).split(' ')).not.toContain('fy:text-label-14');
  });
});
