import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MultiSelectField } from '../../app/components/ui/multi-select-field';
import { Tag } from '../../app/components/ui/tag';
import { PortalContainerContext } from '../../app/lib/portal';

const OPTIONS = [
  { value: 'post', label: 'Posts' },
  { value: 'page', label: 'Pages' },
  { value: 'product', label: 'Products' },
  { value: 'author', label: 'Authors' },
  { value: 'tag', label: 'Tags' },
  { value: 'media', label: 'Media', disabled: true },
];

function Harness({ initial = [], onChange, ...props }: { initial?: string[]; onChange?: (v: string[]) => void } & Partial<Parameters<typeof MultiSelectField>[0]>) {
  const [value, setValue] = useState(initial);
  return (
    <MultiSelectField
      label="Show on"
      description="Choose where."
      placeholder="Select post types…"
      options={OPTIONS}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      {...props}
    />
  );
}

function setup(props: Parameters<typeof Harness>[0] = {}) {
  const root = document.createElement('div');
  document.body.append(root);
  const onChange = vi.fn();
  const utils = render(
    <PortalContainerContext.Provider value={root}>
      <Harness onChange={onChange} {...props} />
    </PortalContainerContext.Provider>,
  );
  return { onChange, ...utils, field: () => screen.getByRole('combobox', { name: 'Show on' }) };
}

/** Opens the popup and waits until the search box (inside it) has focus. */
async function openPopup(field: HTMLElement): Promise<HTMLInputElement> {
  await userEvent.click(field);
  const search = within(await screen.findByRole('dialog')).getByRole('combobox', { name: 'Search options' }) as HTMLInputElement;
  await waitFor(() => expect(search).toHaveFocus());
  return search;
}

const tagsOf = (field: HTMLElement) => [...field.querySelectorAll('[data-slot=fy-tag]')].map((t) => t.textContent);

describe('Tag', () => {
  it('a removable tag has a labelled remove button that only removes', async () => {
    const onRemove = vi.fn();
    render(<Tag label="Posts" onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove Posts' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('without onRemove it is the non-removable overflow chip, read out in full', () => {
    render(<Tag label="+2" srLabel="2 more selected" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('2 more selected')).toBeInTheDocument();
    expect(screen.getByText('+2')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is sized Small 20 / Medium 24 and a disabled tag cannot be removed', () => {
    const { rerender } = render(<Tag label="A" onRemove={() => undefined} />);
    expect(screen.getByText('A').closest('[data-slot=fy-tag]')?.className).toContain('h-5');
    rerender(<Tag label="A" size="md" disabled onRemove={() => undefined} />);
    expect(screen.getByText('A').closest('[data-slot=fy-tag]')?.className).toContain('h-6');
    expect(screen.getByRole('button', { name: 'Remove A' })).toBeDisabled();
  });
});

describe('Multi Select', () => {
  it('is a combobox named by its label and described by its helper; the placeholder shows while empty', () => {
    const { field } = setup();
    expect(field()).toHaveAccessibleDescription('Choose where.');
    expect(field()).toHaveTextContent('Select post types…');
    expect(field()).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the picked values as tags, three at most, then a non-removable "+n"', () => {
    const { field } = setup({ initial: ['post', 'page', 'product', 'author', 'tag'] });
    expect(tagsOf(field())).toEqual(['Posts', 'Pages', 'Products', '+2' + '2 more selected']);
    expect(screen.queryByRole('button', { name: /Remove Authors/ })).toBeNull();
  });

  it('maxVisibleTags is respected', () => {
    const { field } = setup({ initial: ['post', 'page'], maxVisibleTags: 1 });
    expect(tagsOf(field())).toEqual(['Posts', '+11 more selected']);
  });

  it('opens with Enter, Space or the pointer, the search row sits INSIDE the popup and takes focus', async () => {
    const { field } = setup();
    field().focus();
    await userEvent.keyboard('{Enter}');
    const popup = await screen.findByRole('dialog');
    const search = within(popup).getByRole('combobox', { name: 'Search options' });
    await waitFor(() => expect(search).toHaveFocus());
    expect(search).toHaveAttribute('placeholder', 'Search…');
    expect(field()).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(field()).toHaveFocus();

    await userEvent.keyboard(' ');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.click(field());
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('options carry a checkbox state and the popup shows the count and Clear', async () => {
    setup({ initial: ['post', 'page'] });
    await userEvent.click(screen.getByRole('combobox', { name: 'Show on' }));
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => [o.textContent, o.getAttribute('aria-selected')])).toEqual([
      ['Posts', 'true'],
      ['Pages', 'true'],
      ['Products', 'false'],
      ['Authors', 'false'],
      ['Tags', 'false'],
      ['Media', 'false'],
    ]);
    expect(options[5]).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeEnabled();
  });

  it('type to filter; the filter stays while several results are ticked; an empty result says so', async () => {
    const { onChange } = setup();
    await openPopup(screen.getByRole('combobox', { name: 'Show on' }));
    await userEvent.keyboard('p');
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['Posts', 'Pages', 'Products']);
    await userEvent.click(screen.getByRole('option', { name: 'Posts' }));
    await userEvent.click(screen.getByRole('option', { name: 'Pages' }));
    expect(onChange).toHaveBeenLastCalledWith(['post', 'page']);
    expect(screen.getAllByRole('option')).toHaveLength(3); // still filtered by "p"

    await userEvent.keyboard('zzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  it('toggles the highlighted option with Enter, and with Space while the search is empty', async () => {
    const { onChange, field } = setup();
    await openPopup(field());
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(['post']);
    await userEvent.keyboard('{ArrowDown} ');
    expect(onChange).toHaveBeenLastCalledWith(['post', 'page']);
    await userEvent.keyboard(' '); // toggles Pages off again
    expect(onChange).toHaveBeenLastCalledWith(['post']);
    expect(tagsOf(field())).toEqual(['Posts']);
  });

  it('Space is a space once something has been typed', async () => {
    const { onChange } = setup();
    const search = await openPopup(screen.getByRole('combobox', { name: 'Show on' }));
    await userEvent.keyboard('a{ArrowDown} ');
    expect(onChange).not.toHaveBeenCalled();
    expect(search).toHaveValue('a ');
  });

  it('the value always comes back in option order', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('combobox', { name: 'Show on' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Tags' }));
    await userEvent.click(screen.getByRole('option', { name: 'Posts' }));
    expect(onChange).toHaveBeenLastCalledWith(['post', 'tag']);
  });

  it('a disabled option cannot be picked', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('combobox', { name: 'Show on' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Media' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Backspace removes the last tag: on the field, and on an empty search in the popup — never while text is typed', async () => {
    const { onChange, field } = setup({ initial: ['post', 'page', 'product'] });
    field().focus();
    await userEvent.keyboard('{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith(['post', 'page']);

    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('combobox')).toHaveFocus());
    await userEvent.keyboard('x{Backspace}'); // erases the typed letter only
    expect(onChange).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith(['post']);
    expect(document.querySelector('[data-slot=fy-multi-announce]')).toHaveTextContent('Pages removed');
  });

  it('the remove button on a tag removes just that tag and does not open the popup', async () => {
    const { onChange } = setup({ initial: ['post', 'page'] });
    await userEvent.click(screen.getByRole('button', { name: 'Remove Posts' }));
    expect(onChange).toHaveBeenLastCalledWith(['page']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Clear all in the footer empties the selection and keeps the popup open with the search focused', async () => {
    const { onChange, field } = setup({ initial: ['post', 'page'] });
    await userEvent.click(field());
    await userEvent.click(await screen.findByRole('button', { name: 'Clear all' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.getByText('0 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeDisabled();
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('combobox')).toHaveFocus());
  });

  it('the inline Clear button is opt-in and clears without opening', async () => {
    const { onChange, rerender } = setup({ initial: ['post'] });
    expect(document.querySelector('[data-slot=fy-multi-clear]')).toBeNull();
    rerender(
      <PortalContainerContext.Provider value={document.body}>
        <Harness initial={['post']} clearable onChange={onChange} />
      </PortalContainerContext.Provider>,
    );
    await userEvent.click(document.querySelector('[data-slot=fy-multi-clear]') as HTMLElement);
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reports onBlur once the user is done: popup closed, or focus left the field', async () => {
    const onBlur = vi.fn();
    const { field } = setup({ onBlur });
    await userEvent.click(field());
    await screen.findByRole('dialog');
    expect(onBlur).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onBlur).toHaveBeenCalled();
  });

  it('error state: the helper is replaced by the message and the field is invalid', () => {
    const { field } = setup({ error: 'Select at least one post type.' });
    expect(screen.getByText('Select at least one post type.')).toBeVisible();
    expect(screen.queryByText('Choose where.')).toBeNull();
    expect(field()).toHaveAttribute('aria-invalid', 'true');
  });

  it('disabled: cannot open, tags cannot be removed', async () => {
    const { field } = setup({ disabled: true, initial: ['post'] });
    await userEvent.click(field());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove Posts' })).toBeDisabled();
  });

  it('searchable=false hides the search row; the footer can be turned off', async () => {
    setup({ searchable: false, menuFooter: false });
    await userEvent.click(screen.getByRole('combobox', { name: 'Show on' }));
    await screen.findByRole('dialog');
    expect(document.querySelector('[data-slot=fy-multi-search]')?.className).toContain('sr-only');
    expect(document.querySelector('[data-slot=fy-multi-footer]')).toBeNull();
  });
});
