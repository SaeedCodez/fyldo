import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DateRangeField } from '../../app/components/ui/date-range-field';
import { setLocaleData } from '../../app/i18n';
import { durationText, rangeDuration, rangeEndMin, setClock, setDateSettings, type MomentKind } from '../../app/lib/datetime';
import type { DateRangeValue } from '../../app/types';

beforeEach(() => {
  // Saturday 17 October 2026, 10:00 in UTC: "today" in the pack.
  setClock(() => new Date('2026-10-17T10:00:00Z'));
  setDateSettings({ timezone: 'UTC', startOfWeek: 1, calendar: 'gregorian', locale: 'en' });
});

afterEach(() => setClock(null));

describe('duration line', () => {
  it('a date range counts both days', () => {
    expect(durationText('date', '2026-10-20', '2026-10-26', 'en')).toBe('Duration: 7 days');
    expect(durationText('date', '2026-10-20', '2026-10-20', 'en')).toBe('Duration: 1 day');
    expect(durationText('date', '2026-10-20', '2026-10-19', 'en')).toBe('');
    expect(durationText('date', '2026-10-20', '', 'en')).toBe('');
  });

  it('a time range shows hours and minutes, leaving out zero parts, singular and plural', () => {
    expect(durationText('time', '09:00', '17:30', 'en')).toBe('Duration: 8 hours and 30 minutes');
    expect(durationText('time', '09:00', '10:01', 'en')).toBe('Duration: 1 hour and 1 minute');
    expect(durationText('time', '09:00', '09:45', 'en')).toBe('Duration: 45 minutes');
    expect(durationText('time', '09:00', '09:00', 'en')).toBe(''); // equal ends are an error, not a duration
  });

  it('an overnight time range ends the next day', () => {
    expect(rangeDuration('time', '22:00', '06:00')).toEqual({ days: 0, hours: 8, minutes: 0, nextDay: true });
    expect(durationText('time', '22:00', '06:00', 'en')).toBe('Duration: 8 hours, ends the next day');
    expect(durationText('time', '23:30', '00:15', 'en')).toBe('Duration: 45 minutes, ends the next day');
  });

  it('a datetime range shows days, hours and minutes of end − start', () => {
    expect(durationText('datetime', '2026-10-20 05:30:00', '2026-10-26 15:00:00', 'en')).toBe('Duration: 6 days, 9 hours and 30 minutes');
    expect(durationText('datetime', '2026-10-20 05:30:00', '2026-10-22 05:30:00', 'en')).toBe('Duration: 2 days');
    expect(durationText('datetime', '2026-10-20 05:30:00', '2026-10-21 06:30:00', 'en')).toBe('Duration: 1 day and 1 hour');
    expect(durationText('datetime', '2026-10-20 05:30:00', '2026-10-20 05:30:00', 'en')).toBe('');
  });

  it('a datetime range counts real time across a daylight-saving change (the UTC values)', () => {
    setDateSettings({ timezone: 'Europe/Berlin' });
    // Midnight to midnight on the site's clock, 29 → 30 March 2026: the clocks went forward, so 23 hours passed.
    expect(durationText('datetime', '2026-03-28 23:00:00', '2026-03-29 22:00:00', 'en')).toBe('Duration: 23 hours');
    // 25 October: 02:30 CEST → 02:15 CET reads earlier on the clock but is 45 minutes later.
    expect(durationText('datetime', '2026-10-25 00:30:00', '2026-10-25 01:15:00', 'en')).toBe('Duration: 45 minutes');
  });

  it('Persian joins the parts with «و» and writes Persian numerals', () => {
    const parts: Array<[string, string]> = [
      ['%d day', '%d روز'],
      ['%d hour', '%d ساعت'],
      ['%d minute', '%d دقیقه'],
    ];
    setLocaleData({
      locale_data: {
        messages: {
          '': { domain: 'fyldo' },
          ...Object.fromEntries(parts.map(([en, fa]) => [en, [fa, fa]])),
          'duration parts\u0004%1$s, %2$s': ['%1$s و %2$s'],
          'duration parts\u0004%1$s and %2$s': ['%1$s و %2$s'],
          'Duration: %s': ['مدت: %s'],
          'Duration: %s, ends the next day': ['مدت: %s، پایان روز بعد'],
        },
      },
    });
    try {
      expect(durationText('datetime', '2026-10-20 05:30:00', '2026-10-26 15:00:00', 'fa')).toBe('مدت: ۶ روز و ۹ ساعت و ۳۰ دقیقه');
      expect(durationText('time', '22:00', '06:00', 'fa')).toBe('مدت: ۸ ساعت، پایان روز بعد');
      expect(durationText('date', '2026-10-20', '2026-10-26', 'fa')).toBe('مدت: ۷ روز');
    } finally {
      setLocaleData(null);
    }
  });
});

describe('the end picker’s min', () => {
  it('is the later of the field’s min and the start', () => {
    expect(rangeEndMin('date', 'today', '2026-10-20')).toBe('2026-10-20');
    expect(rangeEndMin('date', '2026-11-01', '2026-10-20')).toBe('2026-11-01');
    expect(rangeEndMin('date', 'today', '')).toBe('2026-10-17');
    expect(rangeEndMin('date', undefined, '2026-10-20')).toBe('2026-10-20');
    expect(rangeEndMin('date', undefined, '')).toBeUndefined();
    expect(rangeEndMin('datetime', 'now', '2026-10-20 05:30:00')).toBe('2026-10-20 05:30:00');
  });
});

describe('Date Range Field', () => {
  function Range({ kind = 'date', initial, min }: { kind?: MomentKind; initial: DateRangeValue; min?: string }) {
    const [value, setValue] = useState(initial);
    return (
      <>
        <DateRangeField label="Sale period" kind={kind} value={value} onValueChange={setValue} min={min} calendar="gregorian" />
        <output>{JSON.stringify(value)}</output>
      </>
    );
  }

  const grid = () => screen.getByRole('grid');
  const cell = (name: string) => within(grid()).getByRole('gridcell', { name });

  it('is a group named by its label; the end opens on the start’s month with the days before the start disabled', async () => {
    render(<Range initial={{ start: '2026-08-10', end: '' }} />);
    expect(screen.getByRole('group', { name: 'Sale period' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Start date/ })).toHaveTextContent('Aug 10, 2026');

    await userEvent.click(screen.getByRole('button', { name: /^End date/ }));
    await screen.findByRole('dialog', { name: 'Choose a date' });
    expect(grid()).toHaveAccessibleName('August 2026');
    expect(cell('Sunday, Aug 9, 2026')).toHaveAttribute('aria-disabled', 'true');
    expect(cell('Monday, Aug 10, 2026')).not.toHaveAttribute('aria-disabled');

    await userEvent.click(cell('Sunday, Aug 16, 2026'));
    expect(screen.getByRole('status')).toHaveTextContent('{"start":"2026-08-10","end":"2026-08-16"}');
    expect(screen.getByText('Duration: 7 days')).toBeVisible();
  });

  it('a start moved past the end clears the end; a time range keeps an earlier end (overnight)', async () => {
    const { unmount } = render(<Range initial={{ start: '2026-10-20', end: '2026-10-22' }} />);
    await userEvent.click(screen.getByRole('button', { name: /^Start date/ }));
    await screen.findByRole('dialog');
    await userEvent.click(cell('Friday, Oct 23, 2026'));
    expect(screen.getByRole('status')).toHaveTextContent('{"start":"2026-10-23","end":""}');
    unmount();

    render(<Range kind="time" initial={{ start: '09:00', end: '06:00' }} />);
    const start = screen.getByRole('textbox', { name: 'Start time' });
    await userEvent.clear(start);
    await userEvent.type(start, '22:00');
    await userEvent.tab();
    expect(screen.getByRole('status')).toHaveTextContent('{"start":"22:00","end":"06:00"}');
    expect(screen.getByText('Duration: 8 hours, ends the next day')).toBeVisible();
  });
});
