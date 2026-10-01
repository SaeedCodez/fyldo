import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SettingRow } from '../../app/components/fyldo/SettingRow';
import { Button } from '../../app/components/ui/button';
import { Input } from '../../app/components/ui/input';
import { Select } from '../../app/components/ui/select';
import { TextField } from '../../app/components/ui/text-field';
import { Toggle } from '../../app/components/ui/toggle';
import { PortalContainerContext } from '../../app/lib/portal';

describe('Button', () => {
  it('is a real button; loading is busy, disabled, keeps its label and shows the spinner', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save changes
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('data-loading');
    expect(button.querySelector('svg[data-fyldo-spinner]')).not.toBeNull();
    button.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('maps Figma types and sizes to data attributes and stays a plain button by default', async () => {
    const onClick = vi.fn();
    render(
      <Button variant="secondary" size="lg" onClick={onClick}>
        Discard
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Discard' });
    expect(button).toHaveAttribute('data-variant', 'secondary');
    expect(button).toHaveAttribute('data-size', 'lg');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled buttons ignore clicks', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Nope' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Setting Row + Input', () => {
  it('the row title labels the control and the description describes it', () => {
    render(
      <SettingRow title="Site title" description="Shown in the browser tab.">
        <Input defaultValue="Fyldo" />
      </SettingRow>,
    );
    const input = screen.getByRole('textbox', { name: 'Site title' });
    expect(input).toHaveAccessibleDescription('Shown in the browser tab.');
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('an error marks the control invalid, is announced as its description, and is shown as text', () => {
    render(
      <SettingRow title="Site title" description="Shown in the browser tab." error="This field is required.">
        <Input defaultValue="" />
      </SettingRow>,
    );
    const input = screen.getByRole('textbox', { name: 'Site title' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('This field is required.')).toBeVisible();
  });

  it('a disabled row disables its control and explains why', () => {
    render(
      <SettingRow title="Site title" disabled disabledReason="Managed in wp-config.php">
        <Input defaultValue="x" />
      </SettingRow>,
    );
    expect(screen.getByRole('textbox', { name: 'Site title' })).toBeDisabled();
    expect(screen.getByText('Managed in wp-config.php')).toBeInTheDocument();
  });

  it('layout="field" puts a stacked-width control at the end of the row, with its error under it', () => {
    render(
      <SettingRow title="Site title" description="Shown in the browser tab." layout="field" error="This field is required.">
        <Input defaultValue="" />
      </SettingRow>,
    );
    const row = document.querySelector('[data-slot=fy-setting-row]') as HTMLElement;
    const input = screen.getByRole('textbox', { name: 'Site title' });
    const column = input.closest('[data-slot=fy-setting-row] > div:last-child') as HTMLElement;
    const text = row.firstElementChild as HTMLElement;

    // beside the text (not stacked), text takes the room, the control keeps the 320px stacked width and does not shrink
    expect(row).toHaveClass('fy:items-center', 'fy:gap-8', 'fy:wp-mobile:flex-col');
    expect(row).not.toHaveClass('fy:flex-col');
    expect(text).toHaveClass('fy:flex-1');
    expect(column).toHaveClass('fy:w-80', 'fy:shrink-0');
    // the error is inside the control's column, under the control, and still names the control as invalid
    const error = screen.getByText('This field is required.');
    expect(column).toContainElement(error);
    expect(input.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('layout="field" uses the wide control column when `wide`, and works the same in RTL', () => {
    render(
      <div dir="rtl">
        <SettingRow title="عنوان سایت" layout="field" wide>
          <Input defaultValue="" />
        </SettingRow>
      </div>,
    );
    const input = screen.getByRole('textbox', { name: 'عنوان سایت' });
    expect(input.closest('[data-slot=fy-setting-row] > div:last-child')).toHaveClass('fy:w-90', 'fy:shrink-0');
    // placement is logical (flex order + gap), nothing is pinned to a physical side
    const row = document.querySelector('[data-slot=fy-setting-row]') as HTMLElement;
    expect(row.className).not.toMatch(/fy:(left|right|ml|mr|pl|pr)-/);
  });

  it('URLs and emails can be forced left-to-right', () => {
    render(
      <SettingRow title="Canonical URL">
        <Input ltr defaultValue="https://example.com" />
      </SettingRow>,
    );
    expect(screen.getByRole('textbox', { name: 'Canonical URL' })).toHaveAttribute('dir', 'ltr');
  });
});

describe('TextField (the full Figma "Input")', () => {
  it('label → control → helper; an error REPLACES the helper', () => {
    const { rerender } = render(<TextField label="Site title" description="Helper text" />);
    expect(screen.getByRole('textbox', { name: 'Site title' })).toHaveAccessibleDescription('Helper text');

    rerender(<TextField label="Site title" description="Helper text" error="Too long" />);
    expect(screen.queryByText('Helper text')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Site title' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Too long')).toBeVisible();
  });

  it('can hide the visible label without losing the accessible name', () => {
    render(<TextField label="Search" hideLabel />);
    expect(screen.getByRole('textbox', { name: 'Search' })).toBeInTheDocument();
  });
});

describe('Toggle', () => {
  function Controlled() {
    const [on, setOn] = useState(false);
    return (
      <SettingRow title="Maintenance mode" layout="inline">
        <Toggle size="md" checked={on} onCheckedChange={setOn} />
      </SettingRow>
    );
  }

  it('is a named switch that flips with click and keyboard', async () => {
    render(<Controlled />);
    const toggle = screen.getByRole('switch', { name: 'Maintenance mode' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    toggle.focus();
    await userEvent.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('clicking the row title toggles it (the whole label is the target)', async () => {
    render(<Controlled />);
    await userEvent.click(screen.getByText('Maintenance mode'));
    expect(screen.getByRole('switch', { name: 'Maintenance mode' })).toHaveAttribute('aria-checked', 'true');
  });

  it('a labelled toggle carries its own name and description', () => {
    render(<Toggle label="Enable caching" description="Store rendered pages." />);
    const toggle = screen.getByRole('switch', { name: 'Enable caching' });
    expect(toggle).toHaveAccessibleDescription('Store rendered pages.');
  });

  it('disabled toggles cannot be changed', async () => {
    const onChange = vi.fn();
    render(<Toggle label="Locked" disabled onCheckedChange={onChange} />);
    await userEvent.click(screen.getByRole('switch', { name: 'Locked' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Select', () => {
  const options = [
    { value: 'en', label: 'English' },
    { value: 'fa', label: 'فارسی' },
    { value: 'de', label: 'Deutsch', disabled: true },
  ];

  it('opens a listbox INSIDE the provided root, selects with the keyboard and reports the value', async () => {
    const onValueChange = vi.fn();
    const root = document.createElement('div');
    root.setAttribute('data-testid', 'fyldo-root');
    document.body.append(root);

    render(
      <PortalContainerContext.Provider value={root}>
        <SettingRow title="Language">
          <Select options={options} value="" onValueChange={onValueChange} placeholder="Choose…" />
        </SettingRow>
      </PortalContainerContext.Provider>,
    );

    const trigger = screen.getByRole('combobox', { name: 'Language' });
    expect(trigger).toHaveTextContent('Choose…');
    await userEvent.click(trigger);

    const listbox = await screen.findByRole('listbox');
    expect(root.contains(listbox)).toBe(true); // portalled into the Fyldo root, not <body>
    expect(screen.getByRole('option', { name: 'Deutsch' })).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(screen.getByRole('option', { name: 'فارسی' }));
    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith('fa'));
    root.remove();
  });
});
