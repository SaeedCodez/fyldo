import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FieldRenderer } from '../../app/components/fyldo/FieldRenderer';
import { SettingRow } from '../../app/components/fyldo/SettingRow';
import { Checkbox, CheckboxGroup } from '../../app/components/ui/checkbox';
import { GroupField, useGroupLabels } from '../../app/components/ui/group-field';
import { RadioGroup } from '../../app/components/ui/radio';
import { Textarea, TextareaField, counterLevel } from '../../app/components/ui/textarea';
import { PortalContainerContext } from '../../app/lib/portal';
import type { CheckboxGroupFieldDef, CheckboxFieldDef, RadioFieldDef, TextareaFieldDef } from '../../app/types';

const OPTIONS = [
  { value: 'post', label: 'Posts' },
  { value: 'page', label: 'Pages' },
  { value: 'product', label: 'Products', description: 'Available in Pro.', disabled: true },
];

describe('Textarea', () => {
  it('is a named textarea whose helper describes it; the limit is never handed to the DOM (no silent truncation)', () => {
    render(<TextareaField label="Meta description" description="Used as the default." limit={160} />);
    const box = screen.getByRole('textbox', { name: 'Meta description' });
    expect(box.tagName).toBe('TEXTAREA');
    expect(box).toHaveAccessibleDescription('Used as the default.');
    expect(box).not.toHaveAttribute('maxlength');
  });

  it('draws the default height Figma specifies (104px = 4 rows) and one 20px line per extra row', () => {
    const { rerender } = render(
      <TextareaField label="A" />,
    );
    expect(screen.getByRole('textbox')).toHaveStyle({ height: '102px' }); // 104 − the wrapper's own 2px border
    rerender(<TextareaField label="A" rows={8} />);
    expect(screen.getByRole('textbox')).toHaveStyle({ height: '182px' }); // 104 + 4 × 20 − 2
    expect(screen.getByRole('textbox').closest('[data-slot=fy-textarea]')).not.toBeNull();
  });

  it('resize can be turned off', () => {
    render(<TextareaField label="A" resize="none" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('data-resize', 'none');
  });

  it('the counter follows the text and counts code points, like the server', async () => {
    render(<TextareaField label="Note" limit={10} />);
    expect(screen.getByText('0/10')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox'), 'a🙂سا');
    expect(screen.getByText('4/10')).toBeInTheDocument();
  });

  it('over the limit: the counter turns red, the text is kept in full, and the error replaces the helper', async () => {
    const { rerender } = render(<TextareaField label="Note" description="Helper" limit={5} defaultValue="123456" />);
    expect(screen.getByText('6/5').className).toContain('text-status-error-text');
    expect(screen.getByRole('textbox')).toHaveValue('123456');

    rerender(<TextareaField label="Note" description="Helper" limit={5} defaultValue="123456" error="Use no more than 5 characters." />);
    expect(screen.queryByText('Helper')).toBeNull();
    expect(screen.getByText('Use no more than 5 characters.')).toBeVisible();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('6/5')).toBeInTheDocument(); // the counter stays next to the error, as in Figma
  });

  it('no limit, no counter', () => {
    render(<TextareaField label="Notes" />);
    expect(screen.queryByText(/\d+\/\d+/)).toBeNull();
  });

  it('announces only when a threshold is crossed (90 %, 100 %, over), not on every keystroke', async () => {
    render(<TextareaField label="Note" limit={10} />);
    const live = document.querySelector('[data-slot=fy-counter-live]') as HTMLElement;
    const box = screen.getByRole('textbox');

    await userEvent.type(box, '12345678'); // 8/10: still quiet
    expect(live).toHaveTextContent('');
    await userEvent.type(box, '9'); // 9/10 = 90 %
    expect(live).toHaveTextContent('1 character remaining.');
    await userEvent.type(box, '0'); // 10/10
    expect(live).toHaveTextContent('0 characters remaining.');
    await userEvent.type(box, '1'); // 11/10
    expect(live).toHaveTextContent('1 character over the limit.');
    await userEvent.type(box, '2'); // 12/10: same level → same message, no new announcement text
    expect(live).toHaveTextContent('1 character over the limit.');
  });

  it('counterLevel thresholds', () => {
    expect([0, 8, 9, 10, 11].map((n) => counterLevel(n, 10))).toEqual(['ok', 'ok', 'near', 'full', 'over']);
  });

  it('renders the digits of the page language in the counter (Persian → ۰–۹)', () => {
    const root = document.createElement('div');
    root.setAttribute('lang', 'fa-IR');
    document.body.append(root);
    render(
      <PortalContainerContext.Provider value={root}>
        <TextareaField label="توضیحات" limit={160} defaultValue="سلام" />
      </PortalContainerContext.Provider>,
    );
    expect(screen.getByText('۴/۱۶۰')).toBeInTheDocument();
  });

  it('bare Textarea works inside a Setting Row: the row title names it', () => {
    render(
      <SettingRow title="Meta description" description="Shown in results." wide>
        <Textarea defaultValue="x" />
      </SettingRow>,
    );
    expect(screen.getByRole('textbox', { name: 'Meta description' })).toHaveAccessibleDescription('Shown in results.');
  });
});

describe('Checkbox', () => {
  it('is a named checkbox that toggles with click, label click and Space', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Send email notifications" onCheckedChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: 'Send email notifications' });
    expect(box).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(box);
    expect(box).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByText('Send email notifications')); // the whole label is the target
    expect(box).toHaveAttribute('aria-checked', 'false');
    box.focus();
    await userEvent.keyboard(' ');
    expect(box).toHaveAttribute('aria-checked', 'true');
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('indeterminate is exposed as mixed and draws the dash, not the check', () => {
    render(<Checkbox label="All post types" indeterminate />);
    const box = screen.getByRole('checkbox', { name: 'All post types' });
    expect(box).toHaveAttribute('aria-checked', 'mixed');
    expect(box).toHaveAttribute('data-indeterminate');
    expect(box.querySelector('[data-glyph=dash]')).not.toBeNull();
  });

  it('a disabled checkbox ignores clicks and keeps its label', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Locked" disabled onCheckedChange={onChange} />);
    await userEvent.click(screen.getByText('Locked'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Locked' })).toHaveAttribute('data-disabled');
  });

  it('shows the description under the label and links it', () => {
    render(<Checkbox label="Notify" description="Notify admins when a form is submitted." />);
    expect(screen.getByRole('checkbox', { name: 'Notify' })).toHaveAccessibleDescription('Notify admins when a form is submitted.');
  });

  it('inside an inline Setting Row the row title names it and clicking the title toggles it', async () => {
    function Row() {
      const [on, setOn] = useState(false);
      return (
        <SettingRow title="I agree to the terms" layout="inline">
          <Checkbox checked={on} onCheckedChange={setOn} />
        </SettingRow>
      );
    }
    render(<Row />);
    const box = screen.getByRole('checkbox', { name: 'I agree to the terms' });
    await userEvent.click(screen.getByText('I agree to the terms'));
    expect(box).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Checkbox group', () => {
  function Group(props: { parent?: string; initial?: string[]; onValue?: (v: string[]) => void }) {
    const [value, setValue] = useState<string[]>(props.initial ?? []);
    return (
      <GroupField label="Show on" description="Post types where this block is displayed.">
        <CheckboxGroup
          options={OPTIONS}
          parent={props.parent}
          value={value}
          onValueChange={(v) => {
            setValue(v);
            props.onValue?.(v);
          }}
        />
      </GroupField>
    );
  }

  it('is a named group of checkboxes; disabled options stay visible and cannot be checked', async () => {
    const onValue = vi.fn();
    render(<Group onValue={onValue} />);
    expect(screen.getByRole('group', { name: 'Show on' })).toHaveAccessibleDescription('Post types where this block is displayed.');
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByRole('checkbox', { name: 'Products' })).toHaveAccessibleDescription('Available in Pro.');

    await userEvent.click(screen.getByRole('checkbox', { name: 'Products' }));
    expect(onValue).not.toHaveBeenCalled();
  });

  it('reports the value in option order, whatever order the user ticks', async () => {
    const onValue = vi.fn();
    render(<Group onValue={onValue} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Pages' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Posts' }));
    expect(onValue).toHaveBeenLastCalledWith(['post', 'page']);
  });

  it('the parent shows Indeterminate for a partial selection, checks everything enabled, and clears', async () => {
    render(<Group parent="All post types" initial={['post']} />);
    const parent = screen.getByRole('checkbox', { name: 'All post types' });
    expect(parent).toHaveAttribute('aria-checked', 'mixed');

    await userEvent.click(parent);
    expect(screen.getByRole('checkbox', { name: 'Posts' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: 'Pages' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: 'Products' })).toHaveAttribute('aria-checked', 'false'); // disabled: untouched
    expect(parent).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(parent);
    expect(screen.getByRole('checkbox', { name: 'Posts' })).toHaveAttribute('aria-checked', 'false');
    expect(parent).toHaveAttribute('aria-checked', 'false');
  });

  it('children indent 24px toward the reading direction (logical padding), the parent does not', () => {
    render(<Group parent="All post types" />);
    const options = document.querySelector('[data-slot=fy-checkbox-options]') as HTMLElement;
    expect(options.className).toContain('ps-6');
    expect(options.closest('[data-slot=fy-checkbox-group]')?.firstElementChild?.getAttribute('data-slot')).toBe('fy-option');
  });
});

describe('Radio group', () => {
  function Group({ dir = 'ltr' }: { dir?: 'ltr' | 'rtl' }) {
    const [value, setValue] = useState('full');
    return (
      <DirectionProvider direction={dir}>
        <div dir={dir}>
          <GroupField label="Layout" description="How content is laid out on the page.">
          <RadioGroup
            value={value}
            onValueChange={setValue}
            options={[
              { value: 'full', label: 'Full width', description: 'Content spans the entire screen.' },
              { value: 'boxed', label: 'Boxed', description: 'Content sits in a centered 1200px column.' },
              { value: 'sidebar', label: 'With sidebar', description: 'Available in the Pro version.', disabled: true },
            ]}
          />
          </GroupField>
        </div>
      </DirectionProvider>
    );
  }

  it('is a named radiogroup with the current option selected and a description per option', () => {
    render(<Group />);
    expect(screen.getByRole('radiogroup', { name: 'Layout' })).toHaveAccessibleDescription('How content is laid out on the page.');
    expect(screen.getByRole('radio', { name: 'Full width' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Boxed' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Boxed' })).toHaveAccessibleDescription('Content sits in a centered 1200px column.');
  });

  it('click and label click select; the disabled option cannot be chosen', async () => {
    render(<Group />);
    await userEvent.click(screen.getByText('Boxed'));
    expect(screen.getByRole('radio', { name: 'Boxed' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Full width' })).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(screen.getByText('With sidebar'));
    expect(screen.getByRole('radio', { name: 'With sidebar' })).toHaveAttribute('aria-checked', 'false');
  });

  it('arrow keys move the selection (and skip the disabled option)', async () => {
    render(<Group />);
    screen.getByRole('radio', { name: 'Full width' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Boxed' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Full width' })).toHaveAttribute('aria-checked', 'true');
  });

  it('in RTL the horizontal arrows are mirrored', async () => {
    render(<Group dir="rtl" />);
    screen.getByRole('radio', { name: 'Full width' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Boxed' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Field renderer: the new field types', () => {
  const base = { description: '', default: '', disabled: false as const, layout: 'stacked' as const, validate: {} };

  function renderField(field: TextareaFieldDef | CheckboxFieldDef | CheckboxGroupFieldDef | RadioFieldDef, value: never, extra: { error?: string } = {}) {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    render(
      <>
        <FieldRenderer field={field} value={value} divider={false} onChange={onChange} onBlur={onBlur} {...extra} />
        <button type="button">outside</button>
      </>,
    );
    return { onChange, onBlur };
  }

  it('textarea: bound to its value, counter from the max_length rule, error in the control footer (once)', async () => {
    const field: TextareaFieldDef = { ...base, id: 'meta', type: 'textarea', label: 'Meta description', placeholder: 'Describe…', rows: 4, resize: 'vertical', validate: { max_length: 160 } };
    const { onChange, onBlur } = renderField(field, 'Hello' as never, { error: 'Use no more than 160 characters.' });

    const box = screen.getByRole('textbox', { name: 'Meta description' });
    expect(box).toHaveValue('Hello');
    expect(box).toHaveAttribute('placeholder', 'Describe…');
    expect(screen.getByText('5/160')).toBeInTheDocument();
    expect(screen.getAllByText('Use no more than 160 characters.')).toHaveLength(1);

    await userEvent.type(box, '!');
    expect(onChange).toHaveBeenLastCalledWith('meta', 'Hello!');
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    expect(onBlur).toHaveBeenCalledWith('meta');
  });

  it('checkbox: an inline row, checked from the value', async () => {
    const field: CheckboxFieldDef = { ...base, id: 'agree', type: 'checkbox', label: 'I agree', layout: 'inline', default: false };
    const { onChange } = renderField(field, false as never);
    const box = screen.getByRole('checkbox', { name: 'I agree' });
    await userEvent.click(box);
    expect(onChange).toHaveBeenCalledWith('agree', true);
  });

  it('checkbox group: the row title names the group, options report in order, blur only fires when focus leaves the group', async () => {
    const field: CheckboxGroupFieldDef = { ...base, id: 'post_types', type: 'checkbox_group', label: 'Show on', description: 'Where the block appears.', parent: 'All post types', options: OPTIONS.map((o) => ({ disabled: false, ...o })) };
    const { onChange, onBlur } = renderField(field, ['post'] as never);

    const group = screen.getByRole('group', { name: 'Show on' });
    expect(group).toHaveAccessibleDescription('Where the block appears.');
    expect(screen.getByRole('checkbox', { name: 'All post types' })).toHaveAttribute('aria-checked', 'mixed');

    await userEvent.click(screen.getByRole('checkbox', { name: 'Pages' }));
    expect(onChange).toHaveBeenLastCalledWith('post_types', ['post', 'page']);
    expect(onBlur).not.toHaveBeenCalled();
    await userEvent.tab();
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    expect(onBlur).toHaveBeenCalledWith('post_types');
  });

  it('radio: a radiogroup named by the row title, an error under it', async () => {
    const field: RadioFieldDef = {
      ...base,
      id: 'robots',
      type: 'radio',
      label: 'Search engine visibility',
      default: 'index',
      options: [
        { value: 'index', label: 'Index', disabled: false },
        { value: 'noindex', label: 'Discourage indexing', disabled: false },
      ],
    };
    const { onChange } = renderField(field, 'index' as never, { error: 'Choose one of the available options.' });
    expect(screen.getByRole('radiogroup', { name: 'Search engine visibility' })).toBeInTheDocument();
    expect(screen.getByText('Choose one of the available options.')).toBeVisible();
    await userEvent.click(screen.getByRole('radio', { name: 'Discourage indexing' }));
    expect(onChange).toHaveBeenCalledWith('robots', 'noindex');
  });
});

describe('useGroupLabels', () => {
  it('is empty in a plain row (its control is labelled through a <label>)', () => {
    function Probe() {
      return <span data-testid="probe">{JSON.stringify(useGroupLabels())}</span>;
    }
    render(
      <SettingRow title="Title">
        <Probe />
      </SettingRow>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('{}');
  });
});

describe('GroupField', () => {
  it('shows an error under the options, marks the group invalid and replaces nothing else', () => {
    render(
      <GroupField label="Show on" error="Select at least 1 option.">
        <CheckboxGroup options={OPTIONS} value={[]} onValueChange={() => undefined} />
      </GroupField>,
    );
    expect(screen.getByText('Select at least 1 option.')).toBeVisible();
    expect(screen.getByRole('group', { name: 'Show on' })).toHaveAttribute('data-invalid');
  });
});

describe('Persian (fa_IR) strings from languages/fyldo-fa_IR.json', () => {
  it('new validation and counter messages are translated', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { setLocaleData } = await import('../../app/i18n');
    const { validateValue } = await import('../../app/lib/validation');
    setLocaleData(JSON.parse(readFileSync(resolve(__dirname, '../../languages/fyldo-fa_IR.json'), 'utf8')));
    try {
      expect(validateValue({ min: 1 }, [])).toBe('دست‌کم 1 گزینه را انتخاب کنید.');
      expect(validateValue({ max: 2 }, ['a', 'b', 'c'])).toBe('حداکثر 2 گزینه را می‌توانید انتخاب کنید.');

      render(<TextareaField label="توضیحات" limit={10} />);
      await userEvent.type(screen.getByRole('textbox'), '123456789');
      expect(document.querySelector('[data-slot=fy-counter-live]')).toHaveTextContent('1 نویسه باقی مانده است.');
    } finally {
      setLocaleData(null);
    }
  });
});
