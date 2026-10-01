import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FieldRenderer } from '../../app/components/fyldo/FieldRenderer';
import type { ChoiceCardContent } from '../../app/components/ui/choice-card';
import { ChoiceCardGroup } from '../../app/components/ui/choice-card-group';
import type { ChoiceFieldDef } from '../../app/types';

const OPTIONS = [
  { value: 'light', label: 'Light', description: 'Bright surfaces', image: '/light.svg' },
  { value: 'dark', label: 'Dark', description: 'Low-light ready', image: '/dark.svg' },
  { value: 'system', label: 'System', description: 'Match device', image: '/system.svg', disabled: true },
  { value: 'contrast', label: 'Contrast', description: 'Sharper borders', image: '/contrast.svg' },
];

function Group({
  dir = 'ltr',
  content = 'image_text',
  initial = 'light',
  error,
  disabled,
}: {
  dir?: 'ltr' | 'rtl';
  content?: ChoiceCardContent;
  initial?: string;
  error?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <DirectionProvider direction={dir}>
      <div dir={dir}>
        <ChoiceCardGroup
          label="Theme"
          description="Choose how the settings panel looks."
          options={OPTIONS}
          content={content}
          columns={2}
          value={value}
          onValueChange={setValue}
          error={error}
          disabled={disabled}
        />
      </div>
    </DirectionProvider>
  );
}

const checked = (name: string) => screen.getByRole('radio', { name }).getAttribute('aria-checked') === 'true';

describe('Choice Card Group', () => {
  it('is a named radiogroup of cards, each named by its label and described by its description', () => {
    render(<Group />);
    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(group).toHaveAccessibleDescription('Choose how the settings panel looks.');
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    const light = screen.getByRole('radio', { name: 'Light' });
    expect(light).toHaveAccessibleDescription('Bright surfaces');
    expect(light).toHaveAttribute('aria-checked', 'true');
    expect(checked('Dark')).toBe(false);
  });

  it('Image only: the label stays as the accessible name and the picture is decoration', () => {
    const { container } = render(<Group content="image" />);
    const light = screen.getByRole('radio', { name: 'Light' });
    expect(light).toHaveAttribute('aria-label', 'Light');
    expect(screen.queryByText('Bright surfaces')).toBeNull();
    const pictures = container.querySelectorAll('img');
    expect(pictures).toHaveLength(4);
    pictures.forEach((img) => expect(img).toHaveAttribute('alt', ''));
  });

  it('Text only draws no picture', () => {
    const { container } = render(<Group content="text" />);
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(screen.getByText('Bright surfaces')).toBeInTheDocument();
  });

  it('click selects a card; a disabled card cannot be chosen', async () => {
    render(<Group />);
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(checked('Dark')).toBe(true);
    expect(checked('Light')).toBe(false);
    await userEvent.click(screen.getByRole('radio', { name: 'System' }));
    expect(checked('System')).toBe(false);
    expect(checked('Dark')).toBe(true);
  });

  it('arrow keys move the choice and skip the disabled card', async () => {
    render(<Group initial="dark" />);
    screen.getByRole('radio', { name: 'Dark' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(checked('Contrast')).toBe(true);
    await userEvent.keyboard('{ArrowLeft}');
    expect(checked('Dark')).toBe(true);
  });

  it('Space selects the focused card', async () => {
    render(<Group />);
    screen.getByRole('radio', { name: 'Dark' }).focus();
    await userEvent.keyboard(' ');
    expect(checked('Dark')).toBe(true);
    expect(checked('Light')).toBe(false);
  });

  it('in Persian the cards run right to left: the horizontal arrows are mirrored', async () => {
    render(<Group dir="rtl" initial="dark" />);
    expect(screen.getByRole('radiogroup', { name: 'Theme' }).closest('[dir]')).toHaveAttribute('dir', 'rtl');
    screen.getByRole('radio', { name: 'Dark' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(checked('Contrast')).toBe(true);
    await userEvent.keyboard('{ArrowRight}');
    expect(checked('Dark')).toBe(true);
  });

  it('nothing selected + an error: the group is invalid and the message replaces the helper (no icon)', () => {
    const { container } = render(<Group initial="" error="Choose a theme to continue." />);
    expect(screen.getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Choose a theme to continue.')).toBeInTheDocument();
    expect(screen.queryByText('Choose how the settings panel looks.')).toBeNull();
    expect(container.querySelector('[data-slot="fy-field-error"] svg')).toBeNull();
  });

  it('disabled: no card can be chosen', async () => {
    render(<Group disabled />);
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(checked('Light')).toBe(true);
    expect(checked('Dark')).toBe(false);
  });
});

describe('choice field in a Setting Row', () => {
  const field: ChoiceFieldDef = {
    id: 'theme',
    type: 'choice',
    label: 'Theme',
    description: 'Choose how the settings panel looks.',
    default: '',
    disabled: false,
    layout: 'stacked',
    validate: { required: true, allowed: ['light', 'dark', 'contrast'] },
    content: 'image_text',
    columns: 3,
    options: [
      { value: 'light', label: 'Light', disabled: false, description: 'Bright surfaces', image: '/light.svg' },
      { value: 'dark', label: 'Dark', disabled: false, description: 'Low-light ready', image: '/dark.svg' },
      { value: 'contrast', label: 'Contrast', disabled: false, description: 'Sharper borders', image: '/contrast.svg' },
    ],
  };

  it('the row title names the group, the control column is the 576px one, and a pick is reported by value', async () => {
    const onChange = vi.fn();
    const { container } = render(<FieldRenderer field={field} value="" divider={false} onChange={onChange} onBlur={() => undefined} />);
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toHaveAccessibleDescription('Choose how the settings panel looks.');
    expect(container.querySelector('[class~="fy:w-144"]')).not.toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(onChange).toHaveBeenCalledWith('theme', 'dark');
  });

  it('shows the row error when nothing is selected', () => {
    render(<FieldRenderer field={field} value="" error="This field is required." divider={false} onChange={() => undefined} onBlur={() => undefined} />);
    expect(screen.getByText('This field is required.')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toHaveAttribute('aria-invalid', 'true');
  });
});
