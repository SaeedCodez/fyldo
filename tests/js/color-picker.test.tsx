import { DirectionProvider } from '@base-ui/react/direction-provider';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FieldRenderer } from '../../app/components/fyldo/FieldRenderer';
import { ColorPickerField } from '../../app/components/ui/color-picker-field';
import { ColorPickerPanel } from '../../app/components/ui/color-picker-panel';
import { setLocaleData } from '../../app/i18n';
import { DEFAULT_PRESETS, hexToHsv, hsvToHex, parseHex } from '../../app/lib/color';
import type { ColorFieldDef } from '../../app/types';

function Panel({ initial = '#2271b1', presets, onChange = () => undefined, dir = 'ltr' }: { initial?: string; presets?: string[] | false; onChange?: (hex: string) => void; dir?: 'ltr' | 'rtl' }) {
  const [value, setValue] = useState(initial);
  return (
    <DirectionProvider direction={dir}>
      <div dir={dir}>
        <ColorPickerPanel
          value={value}
          presets={presets}
          locale={dir === 'rtl' ? 'fa-IR' : 'en'}
          onValueChange={(next) => {
            setValue(next);
            onChange(next);
          }}
        />
      </div>
    </DirectionProvider>
  );
}

function Field({ initial = '', dir = 'ltr', onBlur }: { initial?: string; dir?: 'ltr' | 'rtl'; onBlur?: () => void }) {
  const [value, setValue] = useState(initial);
  return (
    <DirectionProvider direction={dir}>
      <div dir={dir}>
        <button type="button">Elsewhere</button>
        <ColorPickerField label="Accent color" description="Used for links." value={value} onValueChange={setValue} onBlur={onBlur} />
      </div>
    </DirectionProvider>
  );
}

const area = () => screen.getByRole('slider', { name: 'Saturation and brightness' });
const hue = () => screen.getByRole('slider', { name: 'Hue' });

describe('colour maths', () => {
  it('round-trips hex through HSV', () => {
    for (const hex of ['#2271b1', '#000000', '#ffffff', '#d63638', '#00a32a', '#8e44ad']) expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 100, v: 100 });
    expect(Math.round(hexToHsv('#0000ff').h)).toBe(240);
  });

  it('reads #rgb, #rrggbb, with or without the hash, in any case', () => {
    expect(parseHex('#ABC')).toBe('#aabbcc');
    expect(parseHex(' 2271B1 ')).toBe('#2271b1');
    expect(parseHex('#abcd')).toBeNull();
    expect(parseHex('red')).toBeNull();
  });

  it('ships the 16 colours of the pack panel', () => {
    expect(DEFAULT_PRESETS).toHaveLength(16);
    expect(DEFAULT_PRESETS.every((hex) => parseHex(hex) === hex)).toBe(true);
  });
});

describe('Color Picker Panel', () => {
  it('the area is a slider: arrows move saturation / brightness by 1, with Shift by 10, and say so in aria-valuetext', async () => {
    const onChange = vi.fn();
    render(<Panel onChange={onChange} />);
    expect(area()).toHaveAttribute('aria-valuetext', 'Saturation 81%, brightness 69%');

    area().focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(area()).toHaveAttribute('aria-valuetext', 'Saturation 82%, brightness 69%');
    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(area()).toHaveAttribute('aria-valuetext', 'Saturation 72%, brightness 69%');
    await userEvent.keyboard('{ArrowUp}');
    expect(area()).toHaveAttribute('aria-valuetext', 'Saturation 72%, brightness 70%');
    await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(area()).toHaveAttribute('aria-valuetext', 'Saturation 72%, brightness 60%');
    expect(onChange).toHaveBeenCalledTimes(4);
    expect(onChange).toHaveBeenLastCalledWith(expect.stringMatching(/^#[0-9a-f]{6}$/));
  });

  it('the area stops at the edges', async () => {
    render(<Panel initial="#ffffff" />);
    area().focus();
    await userEvent.keyboard('{ArrowLeft}{ArrowUp}');
    expect(area()).toHaveAttribute('aria-valuetext', 'Saturation 0%, brightness 100%');
  });

  it('the hue strip is a slider: arrows, Shift, Home and End', async () => {
    render(<Panel />);
    const start = Number(hue().getAttribute('aria-valuenow'));
    expect(start).toBe(207);
    hue().focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(hue()).toHaveAttribute('aria-valuenow', '208');
    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(hue()).toHaveAttribute('aria-valuenow', '198');
    await userEvent.keyboard('{Home}');
    expect(hue()).toHaveAttribute('aria-valuenow', '0');
    expect(hue()).toHaveAttribute('aria-valuetext', '0°');
    await userEvent.keyboard('{End}');
    expect(hue()).toHaveAttribute('aria-valuenow', '360');
    expect(hue()).toHaveAttribute('aria-valuemax', '360');
  });

  it('the hue survives a trip through black', async () => {
    render(<Panel initial="#ff0000" />);
    hue().focus();
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
    area().focus();
    await userEvent.keyboard('{Shift>}' + '{ArrowDown}'.repeat(10) + '{/Shift}');
    expect(area()).toHaveAttribute('aria-valuetext', 'Saturation 100%, brightness 0%');
    expect(hue()).toHaveAttribute('aria-valuenow', '10');
  });

  it('the hex box commits as soon as the text is a colour and keeps what is typed until it blurs', async () => {
    const onChange = vi.fn();
    render(<Panel onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Hex color' });
    expect(input).toHaveValue('#2271B1');

    await userEvent.clear(input);
    await userEvent.type(input, 'abc');
    expect(onChange).toHaveBeenLastCalledWith('#aabbcc');
    expect(input).toHaveValue('abc');
    await userEvent.type(input, 'd');
    expect(onChange).toHaveBeenCalledTimes(1); // "abcd" is not a colour: nothing is committed
    await userEvent.type(input, 'ef');
    expect(onChange).toHaveBeenLastCalledWith('#abcdef');

    await userEvent.tab();
    expect(input).toHaveValue('#ABCDEF');
  });

  it('text that is not a colour goes back to the last valid one on blur', async () => {
    const onChange = vi.fn();
    render(<Panel onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Hex color' });
    await userEvent.clear(input);
    await userEvent.type(input, 'zz');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(input).toHaveValue('#2271B1');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('an emptied hex box clears the colour on blur', async () => {
    const onChange = vi.fn();
    render(<Panel onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Hex color' });
    await userEvent.clear(input);
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith('');
    expect(input).toHaveValue('');
  });

  it('presets are one radio group: click chooses, the chosen one is checked and moves the hex box', async () => {
    render(<Panel />);
    const group = screen.getByRole('radiogroup', { name: 'Presets' });
    expect(group.querySelectorAll('[role=radio]')).toHaveLength(16);
    expect(screen.getByRole('radio', { name: '#2271b1' })).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(screen.getByRole('radio', { name: '#d63638' }));
    expect(screen.getByRole('radio', { name: '#d63638' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '#2271b1' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('textbox', { name: 'Hex color' })).toHaveValue('#D63638');
  });

  it('presets are a roving-tabindex list: one tab stop, arrows move focus, rows are 8 wide', async () => {
    render(<Panel />);
    const swatches = screen.getAllByRole('radio');
    expect(swatches.filter((s) => s.getAttribute('tabindex') === '0')).toEqual([screen.getByRole('radio', { name: '#2271b1' })]);

    screen.getByRole('radio', { name: '#2271b1' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: '#135e96' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: '#135e96' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: '#2271b1' })).toHaveAttribute('tabindex', '-1');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: '#e25c9a' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('radio', { name: '#1d2327' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('radio', { name: '#e25c9a' })).toHaveFocus();
    // moving focus does not choose; Enter does
    expect(screen.getByRole('radio', { name: '#e25c9a' })).toHaveAttribute('aria-checked', 'false');
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('radio', { name: '#e25c9a' })).toHaveAttribute('aria-checked', 'true');
  });

  it('in Persian the presets mirror (ArrowLeft goes on) while the area and hue stay left to right', async () => {
    render(<Panel dir="rtl" />);
    screen.getByRole('radio', { name: '#2271b1' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: '#135e96' })).toHaveFocus();

    expect(area()).toHaveAttribute('dir', 'ltr');
    expect(hue()).toHaveAttribute('dir', 'ltr');
    area().focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(area().getAttribute('aria-valuetext')).toMatch(/۸۲.*۶۹/); // Persian numerals
    // the hex stays left to right
    expect(screen.getByRole('textbox', { name: 'Hex color' })).toHaveAttribute('dir', 'ltr');
  });

  it('presets={false} hides the section; an empty value shows no preset checked', () => {
    const { unmount } = render(<Panel presets={false} />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    unmount();
    render(<Panel initial="" />);
    expect(screen.getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Hex color' })).toHaveValue('');
  });
});

describe('Color Picker field', () => {
  it('shows the placeholder while empty and the upper-case hex, left to right, once there is a colour', () => {
    const { unmount } = render(<Field />);
    const trigger = screen.getByRole('button', { name: 'Accent color' });
    expect(trigger).toHaveTextContent('Pick a color…');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAccessibleDescription('Used for links.');
    unmount();

    render(<Field initial="#2271b1" dir="rtl" />);
    const filled = screen.getByRole('button', { name: 'Accent color' });
    expect(filled).toHaveTextContent('#2271B1');
    expect(filled.querySelector('bdi')).toHaveAttribute('dir', 'ltr');
  });

  it('opens the panel on click (lazy), closes on Escape and gives focus back to the field', async () => {
    const onBlur = vi.fn();
    render(<Field initial="#2271b1" onBlur={onBlur} />);
    const trigger = screen.getByRole('button', { name: 'Accent color' });

    await userEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Color picker' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(dialog.querySelector('[data-slot=fy-color-picker-panel]')).not.toBeNull();
    expect(onBlur).not.toHaveBeenCalled(); // focus going into the panel is not leaving the field

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('closes on an outside press; pressing the field again closes it too', async () => {
    render(<Field initial="#2271b1" />);
    const trigger = screen.getByRole('button', { name: 'Accent color' });

    await userEvent.click(trigger);
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await userEvent.click(trigger);
    await screen.findByRole('dialog');
    await userEvent.click(trigger);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a preset chosen in the panel lands in the field', async () => {
    render(<Field />);
    await userEvent.click(screen.getByRole('button', { name: 'Accent color' }));
    await userEvent.click(await screen.findByRole('radio', { name: '#8e44ad' }));
    expect(screen.getByRole('button', { name: 'Accent color' })).toHaveTextContent('#8E44AD');
  });
});

describe('Color field in a Setting Row', () => {
  const field: ColorFieldDef = {
    id: 'accent',
    type: 'color',
    label: 'Accent color',
    description: 'Used for links.',
    default: '#2271b1',
    disabled: false,
    layout: 'stacked',
    validate: { color: true },
    presets: ['#111111', '#222222'],
  };

  it('is named by the row title, shows its own presets and reports the colour as #rrggbb', async () => {
    const onChange = vi.fn();
    render(<FieldRenderer field={field} value="#2271b1" divider={false} onChange={onChange} onBlur={() => undefined} />);
    const trigger = screen.getByRole('button', { name: 'Accent color' });
    await userEvent.click(trigger);
    expect(await screen.findAllByRole('radio')).toHaveLength(2);
    await userEvent.click(screen.getByRole('radio', { name: '#222222' }));
    expect(onChange).toHaveBeenCalledWith('accent', '#222222');
  });

  it('hides the presets when the field says false, and speaks Persian numerals in a Persian page', async () => {
    setLocaleData(null);
    render(
      <DirectionProvider direction="rtl">
        <div dir="rtl">
          <FieldRenderer field={{ ...field, presets: false }} value="#2271b1" divider={false} onChange={() => undefined} onBlur={() => undefined} locale="fa-IR" />
        </div>
      </DirectionProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Accent color' }));
    await screen.findByRole('dialog');
    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(area().getAttribute('aria-valuetext')).toMatch(/۸۱.*۶۹/);
  });
});
