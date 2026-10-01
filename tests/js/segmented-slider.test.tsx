import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FieldRenderer } from '../../app/components/fyldo/FieldRenderer';
import { SegmentedControlField } from '../../app/components/ui/segmented-control-field';
import { SliderField } from '../../app/components/ui/slider-field';
import type { SegmentedFieldDef, SliderFieldDef } from '../../app/types';

const SEGMENTS = [
  { value: 'order', label: 'By order' },
  { value: 'product', label: 'By product' },
  { value: 'pro', label: 'Pro', disabled: true },
  { value: 'simple', label: 'Simple' },
];

function Segmented({ dir = 'ltr' }: { dir?: 'ltr' | 'rtl' }) {
  const [value, setValue] = useState('product');
  return (
    <DirectionProvider direction={dir}>
      <div dir={dir}>
        <SegmentedControlField label="Sort products" description="Choose how the list is grouped." options={SEGMENTS} value={value} onValueChange={setValue} />
      </div>
    </DirectionProvider>
  );
}

describe('Segmented Control', () => {
  it('is a named radiogroup with one selected segment, in option order, described by its helper', () => {
    render(<Segmented />);
    const group = screen.getByRole('radiogroup', { name: 'Sort products' });
    expect(group).toHaveAccessibleDescription('Choose how the list is grouped.');
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['By order', 'By product', 'Pro', 'Simple']);
    expect(screen.getByRole('radio', { name: 'By product' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'By order' })).toHaveAttribute('aria-checked', 'false');
  });

  it('click selects; a disabled segment cannot be chosen', async () => {
    render(<Segmented />);
    await userEvent.click(screen.getByRole('radio', { name: 'Simple' }));
    expect(screen.getByRole('radio', { name: 'Simple' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Pro' }));
    expect(screen.getByRole('radio', { name: 'Pro' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Simple' })).toHaveAttribute('aria-checked', 'true');
  });

  it('arrow keys move the selection and skip the disabled segment', async () => {
    render(<Segmented />);
    screen.getByRole('radio', { name: 'By product' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Simple' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'By product' })).toHaveAttribute('aria-checked', 'true');
  });

  it('in RTL the horizontal arrows are mirrored: the first option is on the right', async () => {
    render(<Segmented dir="rtl" />);
    screen.getByRole('radio', { name: 'By product' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Simple' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'By product' })).toHaveAttribute('aria-checked', 'true');
  });

  it('inside a Setting Row the row title names the group and the field reports changes', async () => {
    const onChange = vi.fn();
    const field: SegmentedFieldDef = {
      id: 'sort_by',
      type: 'segmented',
      label: 'Sort products',
      description: 'Choose how the list is grouped.',
      default: 'product',
      disabled: false,
      layout: 'stacked',
      validate: { required: true },
      options: [
        { value: 'order', label: 'By order' },
        { value: 'product', label: 'By product' },
      ],
    };
    render(<FieldRenderer field={field} value="product" divider={false} onChange={onChange} onBlur={() => undefined} />);
    expect(screen.getByRole('radiogroup', { name: 'Sort products' })).toHaveAccessibleDescription('Choose how the list is grouped.');
    await userEvent.click(screen.getByRole('radio', { name: 'By order' }));
    expect(onChange).toHaveBeenCalledWith('sort_by', 'order');
  });
});

function Slider({ dir = 'ltr', disabled = false }: { dir?: 'ltr' | 'rtl'; disabled?: boolean }) {
  const [value, setValue] = useState(75);
  return (
    <DirectionProvider direction={dir}>
      <div dir={dir}>
        <SliderField
          label="Image quality"
          description="Higher quality creates larger files."
          value={value}
          onValueChange={setValue}
          min={0}
          max={100}
          step={5}
          formatValue={(n) => `${n}%`}
          disabled={disabled}
        />
      </div>
    </DirectionProvider>
  );
}

describe('Slider', () => {
  // Base UI keeps the edge-aligned thumb hidden until it has measured the control; jsdom has no layout, so give it sizes.
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const width = this.dataset.slot === 'fy-slider-thumb' ? 32 : 320;
      return { x: 0, y: 0, top: 0, left: 0, right: width, bottom: 24, width, height: 24, toJSON: () => ({}) };
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('is a named slider; the value shown in the header is the same text as aria-valuetext, always LTR', () => {
    render(<Slider dir="rtl" />);
    const slider = screen.getByRole('slider', { name: 'Image quality' });
    expect(slider).toHaveAccessibleDescription('Higher quality creates larger files.');
    expect(slider).toHaveAttribute('aria-valuetext', '75%');
    expect(slider).toHaveValue('75');
    const shown = document.querySelector('[data-slot=fy-slider-value]');
    expect(shown).toHaveTextContent('75%');
    expect(shown).toHaveAttribute('dir', 'ltr');
  });

  it('arrows move one step, Home/End jump to the ends, PageUp/PageDown move a tenth of the range', async () => {
    render(<Slider />);
    const slider = screen.getByRole('slider', { name: 'Image quality' });
    slider.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(slider).toHaveAttribute('aria-valuetext', '80%');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(slider).toHaveAttribute('aria-valuetext', '70%');
    await userEvent.keyboard('{PageUp}');
    expect(slider).toHaveAttribute('aria-valuetext', '80%');
    await userEvent.keyboard('{PageDown}{PageDown}');
    expect(slider).toHaveAttribute('aria-valuetext', '60%');
    await userEvent.keyboard('{End}');
    expect(slider).toHaveAttribute('aria-valuetext', '100%');
    expect(document.querySelector('[data-slot=fy-slider-value]')).toHaveTextContent('100%');
    await userEvent.keyboard('{ArrowRight}');
    expect(slider).toHaveAttribute('aria-valuetext', '100%'); // never past max
    await userEvent.keyboard('{Home}');
    expect(slider).toHaveAttribute('aria-valuetext', '0%');
  });

  it('in RTL the horizontal arrows are mirrored: the value grows to the left', async () => {
    render(<Slider dir="rtl" />);
    const slider = screen.getByRole('slider', { name: 'Image quality' });
    slider.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(slider).toHaveAttribute('aria-valuetext', '80%');
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(slider).toHaveAttribute('aria-valuetext', '70%');
  });

  it('a disabled slider ignores the keyboard and says so', async () => {
    render(<Slider disabled />);
    const slider = screen.getByRole('slider', { name: 'Image quality' });
    expect(slider).toBeDisabled();
    await userEvent.keyboard('{ArrowRight}');
    expect(slider).toHaveAttribute('aria-valuetext', '75%');
  });

  it('inside a Setting Row the title names it, the value sits above it in the page numerals and changes are reported', async () => {
    const onChange = vi.fn();
    const field: SliderFieldDef = {
      id: 'image_quality',
      type: 'slider',
      label: 'کیفیت تصویر',
      description: 'کیفیت بالاتر فایل‌های بزرگ‌تری می‌سازد.',
      default: 75,
      disabled: false,
      layout: 'stacked',
      validate: { required: true, number: true, min: 0, max: 100, step: 5 },
      min: 0,
      max: 100,
      step: 5,
    };
    render(
      <DirectionProvider direction="rtl">
        <div dir="rtl">
          <FieldRenderer field={field} value={75} divider={false} onChange={onChange} onBlur={() => undefined} locale="fa" />
        </div>
      </DirectionProvider>,
    );
    const slider = screen.getByRole('slider', { name: 'کیفیت تصویر' });
    expect(slider).toHaveAttribute('aria-valuetext', '۷۵');
    expect(document.querySelector('[data-slot=fy-slider-value]')).toHaveTextContent('۷۵');
    slider.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('image_quality', 80);
  });
});
