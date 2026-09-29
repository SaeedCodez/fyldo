import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FieldRenderer } from '../../app/components/fyldo/FieldRenderer';
import { Notice } from '../../app/components/ui/notice';
import { NumberInput } from '../../app/components/ui/number-input';
import type { FieldDef, FieldValue, NoticeTone, ValueFieldDef } from '../../app/types';

const base = { description: '', default: '' as FieldValue, disabled: false as boolean | string, layout: 'stacked' as const, validate: {} };

function renderField(field: FieldDef, value: FieldValue, extra: { error?: string; dir?: 'rtl' } = {}) {
  const onChange = vi.fn();
  const onBlur = vi.fn();
  render(
    <div dir={extra.dir}>
      <FieldRenderer field={field} value={value} error={extra.error} divider={false} onChange={onChange} onBlur={onBlur} />
      <button type="button">outside</button>
    </div>,
  );
  return { onChange, onBlur };
}

describe('Notice', () => {
  const TONES: [NoticeTone, string, string][] = [
    ['gray', 'status-neutral', 'Note'],
    ['blue', 'status-info', 'Information'],
    ['green', 'status-success', 'Success'],
    ['amber', 'status-warning', 'Warning'],
    ['red', 'status-error', 'Error'],
  ];

  it.each(TONES)('%s: tone tokens, an icon, and the tone word in the accessible name', (tone, token, word) => {
    render(
      <Notice tone={tone} title="Heads up">
        Message text.
      </Notice>,
    );
    const notice = screen.getByRole('region', { name: `${word}: Heads up` });
    expect(notice).toHaveAttribute('data-tone', tone);
    expect(notice.className).toContain(`bg-${token}-bg`);
    expect(notice.className).toContain(`border-${token}-border`);
    expect(notice.className).toContain(`text-${token}-text`);
    expect(notice.querySelector('svg')).not.toBeNull();
    expect(notice.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(notice).toHaveTextContent('Heads upMessage text.');
  });

  it('the title is optional; the region is then named by the tone alone', () => {
    render(<Notice tone="amber">Your license expires in 7 days.</Notice>);
    expect(screen.getByRole('region', { name: 'Warning' })).toHaveTextContent('Your license expires in 7 days.');
  });

  it('is not a live region: a notice that is there from the start must not interrupt a screen reader', () => {
    render(<Notice tone="red">Failed.</Notice>);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('notice field', () => {
  const field = (tone: NoticeTone) => ({ id: 'note', type: 'notice' as const, label: 'Before you connect', description: 'Keys are never shown again.', tone });

  it.each(['gray', 'blue', 'green', 'amber', 'red'] as NoticeTone[])('renders the %s tone from the field description', (tone) => {
    renderField(field(tone), null);
    expect(screen.getByRole('region', { name: /Before you connect$/ })).toHaveAttribute('data-tone', tone);
    expect(screen.getByText('Keys are never shown again.')).toBeVisible();
  });

  it('has no control: nothing to focus, nothing to change, no label wiring', () => {
    const { onChange, onBlur } = renderField(field('blue'), null);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(document.querySelector('[data-slot=fy-setting-row]')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(onBlur).not.toHaveBeenCalled();
  });

  it('an empty label means no title', () => {
    renderField({ ...field('gray'), label: '' }, null);
    expect(screen.getByRole('region', { name: 'Note' })).toBeVisible();
    expect(screen.queryByRole('heading')).toBeNull();
  });
});

describe('password field', () => {
  const field = { ...base, id: 'api_key', type: 'password' as const, label: 'API key', placeholder: '', autocomplete: 'new-password' as const };

  it('is a password input that asks browsers not to autofill the login password', () => {
    renderField(field, '');
    const input = screen.getByLabelText('API key');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'new-password');
    expect(input).toHaveAttribute('spellcheck', 'false');
    expect(input).toHaveAttribute('autocapitalize', 'off');
  });

  it('the developer can pick another autocomplete token', () => {
    renderField({ ...field, autocomplete: 'off' }, '');
    expect(screen.getByLabelText('API key')).toHaveAttribute('autocomplete', 'off');
  });

  it('a stored secret is never in the DOM: the field is empty, says "•••• set", and screen readers hear that a value is saved', () => {
    renderField(field, null);
    const input = screen.getByLabelText('API key');
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', '•••• set');
    expect(input).toHaveAccessibleDescription('A value is already saved. Leave this empty to keep it, or type a new one to replace it.');
  });

  it('nothing set: the developer placeholder shows and there is no "already saved" note', () => {
    renderField({ ...field, placeholder: 'sk-…' }, '');
    const input = screen.getByLabelText('API key');
    expect(input).toHaveAttribute('placeholder', 'sk-…');
    expect(input).not.toHaveAccessibleDescription(/already saved/);
  });

  it('typing reports each character exactly as typed: no trimming, no digit change', async () => {
    const { onChange } = renderField(field, '');
    await userEvent.type(screen.getByLabelText('API key'), ' a۱٣ ');
    // (the field is controlled and the value stays '', so each call carries one character)
    expect(onChange.mock.calls.map((c) => c[1])).toEqual([' ', 'a', '۱', '٣', ' ']);
  });
});

describe('number field', () => {
  function Harness({ initial = '' as number | string, onValue = vi.fn() }: { initial?: number | string; onValue?: (v: number | string) => void }) {
    const [value, setValue] = useState<number | string>(initial);
    return (
      <>
        <label>
          Amount
          <NumberInput
            value={value}
            onValueChange={(next) => {
              setValue(next);
              onValue(next);
            }}
          />
        </label>
        <output data-testid="held">{JSON.stringify(value)}</output>
        <button type="button" onClick={() => setValue(10)}>
          set ten
        </button>
      </>
    );
  }

  it('is a decimal-keyboard text input, always LTR (a minus sign must not jump sides in RTL)', () => {
    render(<Harness />);
    const input = screen.getByLabelText('Amount');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAttribute('dir', 'ltr');
    expect(input).toHaveAttribute('autocomplete', 'off');
  });

  it('reads Persian and Arabic-Indic digits as ASCII while typing, in the box and in the value', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByLabelText('Amount');
    await userEvent.type(input, '۴٢');
    expect(input).toHaveValue('42');
    expect(onValue).toHaveBeenLastCalledWith(42);
    expect(screen.getByTestId('held')).toHaveTextContent('42');
  });

  it('pasted Persian digits are read too', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Amount');
    await userEvent.click(input);
    await userEvent.paste('۱۲۵');
    expect(input).toHaveValue('125');
    expect(screen.getByTestId('held')).toHaveTextContent('125');
  });

  it('keeps what is half-typed ("-", "1.") but holds a number or the unreadable text', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByLabelText('Amount');
    await userEvent.type(input, '-');
    expect(input).toHaveValue('-');
    expect(onValue).toHaveBeenLastCalledWith('-'); // not a number yet: the `number` rule will say so
    await userEvent.type(input, '1.');
    expect(input).toHaveValue('-1.');
    expect(onValue).toHaveBeenLastCalledWith(-1);
    await userEvent.clear(input);
    expect(onValue).toHaveBeenLastCalledWith('');
  });

  it('a change that did not come from typing (Discard, save) replaces the text', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Amount'), '5.');
    await userEvent.click(screen.getByRole('button', { name: 'set ten' }));
    expect(screen.getByLabelText('Amount')).toHaveValue('10');
  });

  it('the caret stays where it was when a digit in the middle is replaced', async () => {
    render(<Harness initial={19} />);
    const input = screen.getByLabelText('Amount') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(1, 1);
    await userEvent.keyboard('۲');
    expect(input).toHaveValue('129');
    expect(input.selectionStart).toBe(2);
  });

  it('the Persian separators: ٫ is read as a decimal point, ٬ is dropped', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByLabelText('Amount');
    await userEvent.type(input, '۱٬۲۳۴٫۵');
    expect(input).toHaveValue('1234.5');
    expect(onValue).toHaveBeenLastCalledWith(1234.5);
  });

  it('the caret stays after the text before it when a dropped ٬ shortens that text', async () => {
    render(<Harness initial={1000} />);
    const input = screen.getByLabelText('Amount') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(1, 1);
    await userEvent.keyboard('٬');
    expect(input).toHaveValue('1000');
    expect(input.selectionStart).toBe(1);
  });
});

describe('URL and email inputs', () => {
  const url = { ...base, id: 'site', type: 'url' as const, label: 'Site URL', placeholder: '' };
  const email = { ...base, id: 'mail', type: 'email' as const, label: 'Email', placeholder: '' };
  const text = { ...base, id: 'title', type: 'text' as const, label: 'Title', placeholder: '' };

  it('in RTL the input text is dir="ltr" but the label keeps the page direction', () => {
    renderField(url, '', { dir: 'rtl' });
    const input = screen.getByLabelText('Site URL');
    expect(input).toHaveAttribute('dir', 'ltr');
    const label = screen.getByText('Site URL');
    expect(label.closest('[dir]')).toHaveAttribute('dir', 'rtl'); // inherited: the label is not forced LTR
    expect(label).not.toHaveAttribute('dir', 'ltr');
    expect(input).toHaveAttribute('type', 'url');
    expect(input).toHaveAttribute('inputmode', 'url');
  });

  it('email: dir="ltr", email keyboard', () => {
    renderField(email, '', { dir: 'rtl' });
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('dir', 'ltr');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('inputmode', 'email');
  });

  it('plain text keeps the page direction (no dir attribute of its own)', () => {
    renderField(text, '', { dir: 'rtl' });
    expect(screen.getByLabelText('Title')).not.toHaveAttribute('dir');
  });

  it('URL and email read Persian digits as ASCII; text does not', async () => {
    const a = renderField(url, '');
    await userEvent.type(screen.getByLabelText('Site URL'), '۱');
    expect(a.onChange).toHaveBeenLastCalledWith('site', '1');
    document.body.innerHTML = '';

    const b = renderField(email, '');
    await userEvent.type(screen.getByLabelText('Email'), '٢');
    expect(b.onChange).toHaveBeenLastCalledWith('mail', '2');
    document.body.innerHTML = '';

    const c = renderField(text, '');
    await userEvent.type(screen.getByLabelText('Title'), '۳');
    expect(c.onChange).toHaveBeenLastCalledWith('title', '۳');
  });
});

describe('disabled with a reason', () => {
  const reason = 'Managed by your hosting provider.';

  const toggle = { ...base, id: 'toggle', type: 'toggle' as const, label: 'Caching', layout: 'inline' as const, default: false };
  const checkbox = { ...base, id: 'agree', type: 'checkbox' as const, label: 'Agree', layout: 'inline' as const, default: false };
  const text = { ...base, id: 'title', type: 'text' as const, label: 'Title', placeholder: '' };
  const textarea = { ...base, id: 'meta', type: 'textarea' as const, label: 'Meta', placeholder: '', rows: 4, resize: 'vertical' as const };
  const number = { ...base, id: 'n', type: 'number' as const, label: 'Amount', placeholder: '' };
  const password = { ...base, id: 'pw', type: 'password' as const, label: 'Secret', placeholder: '', autocomplete: 'new-password' as const };
  const select = { ...base, id: 'sel', type: 'select' as const, label: 'Language', placeholder: '', searchable: false, options: [{ value: 'en', label: 'English' }] };
  const multi = { ...base, id: 'multi', type: 'multi_select' as const, label: 'Types', placeholder: '', searchable: true, clearable: false, options: [{ value: 'a', label: 'A' }] };
  const group = { ...base, id: 'grp', type: 'checkbox_group' as const, label: 'Show on', parent: '', options: [{ value: 'a', label: 'A', disabled: false }] };
  const radio = { ...base, id: 'rad', type: 'radio' as const, label: 'Layout', options: [{ value: 'a', label: 'A', disabled: false }, { value: 'b', label: 'B', disabled: false }] };

  const controls: [string, ValueFieldDef, FieldValue, () => HTMLElement][] = [
    ['toggle', toggle, false, () => screen.getByRole('switch', { name: 'Caching' })],
    ['checkbox', checkbox, false, () => screen.getByRole('checkbox', { name: 'Agree' })],
    ['text', text, '', () => screen.getByRole('textbox', { name: 'Title' })],
    ['textarea', textarea, '', () => screen.getByRole('textbox', { name: 'Meta' })],
    ['number', number, '', () => screen.getByRole('textbox', { name: 'Amount' })],
    ['password', password, '', () => screen.getByLabelText('Secret')],
    ['select', select, 'en', () => screen.getByRole('combobox', { name: 'Language' })],
    ['multi select', multi, [], () => screen.getByRole('combobox', { name: 'Types' })],
    ['checkbox group', group, [], () => screen.getByRole('group', { name: 'Show on' })],
    ['radio group', radio, 'a', () => screen.getByRole('radiogroup', { name: 'Layout' })],
  ];

  it.each(controls)('%s: disabled, the reason is visible and is part of its accessible description', (_name, field, value, control) => {
    renderField({ ...field, disabled: reason }, value);
    const element = control();
    expect(screen.getByText(reason)).toBeVisible();
    expect(element).toHaveAccessibleDescription(expect.stringContaining(reason));
  });

  it.each(controls)('%s: `disabled: true` disables it with no reason text', (_name, field, value, control) => {
    renderField({ ...field, disabled: true }, value);
    expect(document.querySelector('[data-slot=fy-disabled-reason]')).toBeNull();
    const element = control();
    const disabled = element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true' || element.hasAttribute('data-disabled');
    expect(disabled).toBe(true);
  });

  it('the description and the reason are both announced, in that order', () => {
    renderField({ ...text, description: 'The site name.', disabled: reason }, '');
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveAccessibleDescription(`The site name. ${reason}`);
  });

  it('a disabled text input cannot be typed into and stays disabled for assistive technology', async () => {
    const { onChange } = renderField({ ...text, disabled: reason }, 'fixed');
    const input = screen.getByRole('textbox', { name: 'Title' });
    expect(input).toBeDisabled();
    await userEvent.type(input, 'x');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('the reason keeps a readable colour (text-secondary), not the faded disabled one', () => {
    renderField({ ...text, disabled: reason }, '');
    expect(screen.getByText(reason).className).toContain('text-text-secondary');
    expect(screen.getByText(reason).className).not.toContain('text-disabled');
  });
});
