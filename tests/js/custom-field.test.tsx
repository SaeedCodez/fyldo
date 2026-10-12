/**
 * `custom` fields (docs/custom-fields.md): the developer's module draws the control, Fyldo the row, the validation and
 * the save. The React path is driven with the demo's real module (demo/custom/working-hours.js, also in the fixture page).
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error -- a plain JavaScript module, exactly as a developer would write it (no types, no build step).
import workingHours from '../../demo/custom/working-hours.js';
import { SettingsPage } from '../../app/components/fyldo/SettingsPage';
import { ApiError } from '../../app/lib/api';
import { collectCustomModules, customError, customFieldApi, defineCustomField, type CustomFieldProps } from '../../app/lib/custom-fields';
import { groupErrors } from '../../app/lib/group';
import { PortalContainerContext } from '../../app/lib/portal';
import type { CustomFieldDef, FieldValue, GroupFieldDef, PageDef } from '../../app/types';

const fixture = JSON.parse(readFileSync(resolve(__dirname, '../fixtures/form-fields-page.client.json'), 'utf8')) as PageDef;
const hours = fixture.sections.flatMap((s) => s.fields).find((f): f is CustomFieldDef => f.type === 'custom') as CustomFieldDef;

defineCustomField(hours.module, workingHours);

/** A page with one custom field (the fixture's, with another module and value when given). */
function pageWith(field: Partial<CustomFieldDef> = {}, value: FieldValue = '09:00-17:00'): PageDef {
  return {
    ...fixture,
    sections: [{ id: 'main', tab: '', title: 'Hours', description: '', tone: 'default', fields: [{ ...hours, ...field }] }],
    values: { opening_hours: value },
  };
}

function setup(page: PageDef = pageWith()) {
  const savePage = vi.fn(async (_id: string, values: Record<string, FieldValue>) => ({ values: { ...page.values, ...values }, revision: 'rev-2' }));
  const root = document.createElement('div');
  document.body.append(root);
  const utils = render(
    <PortalContainerContext.Provider value={root}>
      <SettingsPage page={page} api={{ savePage, readPage: vi.fn(), runAction: vi.fn() }} />
    </PortalContainerContext.Provider>,
  );
  return { savePage, ...utils };
}

const saveChanges = () => within(screen.getByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save changes' });

async function pick(select: string, option: string): Promise<void> {
  await userEvent.click(screen.getByRole('combobox', { name: select }));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('Custom field, React path (the demo module)', () => {
  it('splits the stored value into its two selects, inside a group named by the row title', () => {
    setup();
    const group = screen.getByRole('group', { name: 'Opening hours' });
    expect(group).toHaveAccessibleDescription('Saved as one value, like 09:00-17:00.');
    expect(within(group).getByRole('combobox', { name: 'Opens' })).toHaveTextContent('09:00');
    expect(within(group).getByRole('combobox', { name: 'Closes' })).toHaveTextContent('17:00');
  });

  it('saves the two selects as ONE value', async () => {
    const { savePage } = setup();
    await pick('Closes', '18:00');
    await userEvent.click(saveChanges());
    expect(savePage).toHaveBeenCalledWith('fields', { opening_hours: '09:00-18:00' }, 'rev-1');
  });

  it("the module's validate() shows its message right after a pick and blocks the save", async () => {
    const { savePage } = setup();
    await pick('Closes', '08:00');
    expect(await screen.findByText('The closing time must be after the opening time.')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Closes' })).toHaveAttribute('aria-invalid', 'true');
    await userEvent.click(saveChanges());
    expect(savePage).not.toHaveBeenCalled();
  });

  it('a value the server refuses comes back under the field', async () => {
    const { savePage } = setup();
    savePage.mockRejectedValueOnce(new ApiError('Some values are not valid.', 422, 'invalid', { opening_hours: 'Closed on that day.' }));
    await pick('Opens', '10:00');
    await userEvent.click(saveChanges());
    expect(await screen.findByText('Closed on that day.')).toBeVisible();
  });

  it('follows the page numerals in its labels (Persian), the values stay ASCII', async () => {
    render(<WorkingHoursAlone locale="fa_IR" />);
    expect(screen.getByRole('combobox', { name: 'Opens' })).toHaveTextContent('۰۹:۰۰');
  });
});

/** The demo component on its own, outside a page. */
function WorkingHoursAlone({ locale }: { locale: string }) {
  const { Component } = workingHours(customFieldApi);
  const props: CustomFieldProps = {
    value: '09:00-17:00',
    onChange: () => undefined,
    onBlur: () => undefined,
    disabled: false,
    invalid: false,
    labelledBy: '',
    props: hours.props,
    field: { id: 'h', label: 'Hours', description: '' },
    locale,
  };
  return <Component {...props} />;
}

describe('Custom field, plain DOM path (mount)', () => {
  it('mounts once, updates on every change, reports changes and blur, and is destroyed when the page goes', async () => {
    const calls: string[] = [];
    defineCustomField('/plain.js', {
      mount(element: HTMLElement, props: CustomFieldProps) {
        calls.push('mount');
        const input = document.createElement('input');
        input.setAttribute('aria-labelledby', props.labelledBy);
        input.value = String(props.value);
        input.addEventListener('input', () => props.onChange(input.value));
        input.addEventListener('blur', () => props.onBlur());
        element.append(input);
        return {
          update(next: CustomFieldProps) {
            calls.push(`update:${String(next.value)}`);
            if (input.value !== next.value) input.value = String(next.value);
          },
          destroy: () => calls.push('destroy'),
        };
      },
      validate: (value: unknown) => (value === 'bad' ? 'Not that.' : null),
    });

    const { savePage, unmount } = setup(pageWith({ module: '/plain.js' }, 'x'));
    const input = screen.getByRole('textbox', { name: 'Opening hours' });
    expect(input).toHaveValue('x');

    await userEvent.clear(input);
    await userEvent.type(input, 'bad');
    await userEvent.tab();
    expect(await screen.findByText('Not that.')).toBeVisible();

    await userEvent.clear(input);
    await userEvent.type(input, 'ok');
    await userEvent.click(saveChanges());
    expect(savePage).toHaveBeenCalledWith('fields', { opening_hours: 'ok' }, 'rev-1');
    expect(calls.filter((c) => c === 'mount')).toHaveLength(1);
    expect(calls).toContain('update:ok');

    unmount();
    expect(calls.at(-1)).toBe('destroy');
  });
});

describe('Custom field failures stay inside their row', () => {
  it('a module that could not be loaded says so; the rest of the page still saves', () => {
    setup(pageWith({ module: '/never-loaded.js' }));
    expect(screen.getByText('This field could not be loaded.')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).toBeNull(); // its value is untouched, nothing to save
  });

  it('a module that exports neither Component nor mount is reported and not used', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    defineCustomField('/empty.js', () => ({}));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('neither a `Component` nor a `mount`'));
    setup(pageWith({ module: '/empty.js' }));
    expect(screen.getByText('This field could not be loaded.')).toBeVisible();
    error.mockRestore();
  });

  it('a component that throws is caught by the row', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    defineCustomField('/crash.js', {
      Component: () => {
        throw new Error('boom');
      },
    });
    setup(pageWith({ module: '/crash.js' }));
    expect(screen.getByText('This field could not be loaded.')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1 })).toBeVisible();
    error.mockRestore();
  });
});

describe('Custom field helpers', () => {
  it('collects every module once: fields and the sub-fields of groups', () => {
    const group = { id: 'days', type: 'group', fields: [{ ...hours, id: 'h', module: '/in-group.js' }] } as unknown as GroupFieldDef;
    const page = { ...pageWith(), sections: [{ ...pageWith().sections[0]!, fields: [hours, hours, group] }] };
    expect(collectCustomModules({ pages: [page] })).toEqual([hours.module, '/in-group.js']);
  });

  it("a group checks its custom sub-fields with the module's validate()", () => {
    const group = { id: 'days', type: 'group', validate: {}, min: null, max: null, fields: [{ ...hours, id: 'hours' }] } as unknown as GroupFieldDef;
    expect(groupErrors(group, [{ hours: '09:00-17:00' }, { hours: '18:00-09:00' }])).toEqual({ 'days.1.hours': 'The closing time must be after the opening time.' });
  });

  it('a validate() that throws counts as valid (the server still checks)', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    defineCustomField('/throws.js', {
      Component: () => null,
      validate: () => {
        throw new Error('x');
      },
    });
    expect(customError({ ...hours, module: '/throws.js' }, 'v')).toBeNull();
    error.mockRestore();
  });
});
