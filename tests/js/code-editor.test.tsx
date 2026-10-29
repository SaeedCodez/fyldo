/**
 * The Code Editor (Figma "Code Editor") and the `code` field: syntax colours against the design's own sample, the
 * keyboard (Tab indents, Escape then Tab leaves, Enter keeps the indentation), copy, and a CSS message at its line.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingRow } from '../../app/components/fyldo/SettingRow';
import { SettingsPage } from '../../app/components/fyldo/SettingsPage';
import { CodeEditor, type CodeEditorProps } from '../../app/components/ui/code-editor';
import { highlight, type CodeTokenKind } from '../../app/lib/code-highlight';
import { PortalContainerContext } from '../../app/lib/portal';
import type { CodeFieldDef, FieldValue, PageDef } from '../../app/types';

interface PackText {
  characters: string;
  segments?: Array<{ characters: string; token?: string }>;
}
interface PackNode {
  name: string;
  text?: PackText;
  children?: PackNode[];
}
const pack = JSON.parse(readFileSync(resolve(__dirname, '../../design/figma/components/code-editor.json'), 'utf8')) as { variants: Array<{ name: string; node: PackNode }> };
const layer = (node: PackNode, name: string): PackNode | undefined => (node.name === name ? node : node.children?.map((c) => layer(c, name)).find(Boolean));

/** The design's colour tokens for each kind of run. */
const TOKEN: Record<CodeTokenKind, string[]> = {
  muted: ['text/tertiary'],
  name: ['status/info/text'],
  key: ['text/primary'],
  plain: ['text/primary'],
  value: ['status/success/text'],
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('highlight', () => {
  it('colours the design’s CSS sample exactly as Figma does, character by character', () => {
    const variant = pack.variants.find((v) => v.name === 'Locale=EN, State=Default') as { node: PackNode };
    const sample = layer(variant.node, 'Code')?.text as PackText;
    const design = (sample.segments ?? []).flatMap((run) => [...run.characters].map((ch) => ({ ch, token: run.token })));
    const ours = highlight('css', sample.characters)
      .flatMap((line, i, all) => [...line.flatMap((t) => [...t.text].map((ch) => ({ ch, kind: t.kind }))), ...(i < all.length - 1 ? [{ ch: '\n', kind: 'plain' as CodeTokenKind }] : [])]);

    expect(ours.map((c) => c.ch).join('')).toBe(sample.characters);
    design.forEach(({ ch, token }, i) => {
      if (/\s/.test(ch)) return; // the colour of a space is not seen
      expect(TOKEN[(ours[i] as { kind: CodeTokenKind }).kind], `"${ch}" at ${i}`).toContain(token);
    });
  });

  it('JSON: keys, values and punctuation; HTML: tags, attributes and their values', () => {
    const kinds = (language: 'json' | 'html', code: string) => highlight(language, code).flat().map((t) => `${t.kind}:${t.text}`);
    expect(kinds('json', '{"a": [1, true, "x"]}')).toEqual(['muted:{', 'name:"a"', 'muted::', 'plain: ', 'muted:[', 'value:1', 'muted:,', 'plain: ', 'value:true', 'muted:,', 'plain: ', 'value:"x"', 'muted:]', 'muted:}']);
    expect(kinds('html', '<a href="/x">Hi</a><!-- c -->')).toEqual(['muted:<', 'name:a', 'plain: ', 'key:href', 'muted:=', 'value:"/x"', 'muted:>', 'plain:Hi', 'muted:</', 'name:a', 'muted:>', 'muted:<!-- c -->']);
    expect(highlight('text', 'a\nb')).toEqual([[{ text: 'a', kind: 'plain' }], [{ text: 'b', kind: 'plain' }]]);
  });

  it('never fails on code it does not understand', () => {
    expect(() => highlight('css', 'a { color: "unterminated')).not.toThrow();
    expect(() => highlight('html', '<a href="x')).not.toThrow();
    expect(highlight('css', '').length).toBe(1);
  });
});

function Editor(props: Partial<CodeEditorProps> & { initial?: string; onValue?: (value: string) => void }) {
  const { initial = '', onValue, ...rest } = props;
  const [value, setValue] = useState(initial);
  return (
    <SettingRow title="Custom CSS" description="Loaded after your theme styles." layout="stacked" width="full">
      <CodeEditor
        language="css"
        {...rest}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValue?.(next);
        }}
      />
    </SettingRow>
  );
}

const code = () => screen.getByRole('textbox', { name: 'Custom CSS' }) as HTMLTextAreaElement;

describe('CodeEditor', () => {
  it('is a textarea named and described by its row, left to right, with the language, a copy button and line numbers', () => {
    render(<Editor initial={'a {\n  color: red;\n}'} />);

    expect(code()).toHaveAccessibleDescription(expect.stringContaining('Loaded after your theme styles.'));
    expect(code()).toHaveAccessibleDescription(expect.stringContaining('To leave the editor, press Escape, then Tab.'));
    expect(code().closest('[data-slot=fy-code-editor]')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText('CSS')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeVisible();
    expect(document.querySelector('[data-slot=fy-code-lines]')).toHaveTextContent('123');
  });

  it('without the toolbar and the line numbers', () => {
    render(<Editor toolbar={false} lineNumbers={false} />);
    expect(screen.queryByRole('button', { name: 'Copy code' })).toBeNull();
    expect(document.querySelector('[data-slot=fy-code-lines]')).toBeNull();
  });

  it('Tab inserts two spaces, Shift+Tab takes them away, Enter keeps the indentation', async () => {
    const onValue = vi.fn();
    render(<Editor initial={'a {'} onValue={onValue} />);
    await userEvent.click(code());
    code().setSelectionRange(3, 3);

    await userEvent.keyboard('{Enter}');
    expect(code().value).toBe('a {\n');
    await userEvent.keyboard('{Tab}color: red;{Enter}');
    expect(code().value).toBe('a {\n  color: red;\n  ');
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}}');
    expect(code().value).toBe('a {\n  color: red;\n}');
    expect(code()).toHaveFocus();
  });

  it('Escape, then Tab, leaves the editor: it never traps the keyboard', async () => {
    render(
      <>
        <Editor initial="a {}" />
        <button type="button">After</button>
      </>,
    );
    await userEvent.click(code());
    await userEvent.keyboard('{Escape}');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    expect(code().value).toBe('a {}');
  });

  it('copies the code and says so', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<Editor initial=".a { color: red; }" />);

    await userEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    expect(writeText).toHaveBeenCalledWith('.a { color: red; }');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Copied');
  });

  it('marks the lines with an error: their number and their values', () => {
    render(<Editor initial={'a {\n  color: red;\n}'} invalidLines={[2]} />);
    expect(document.querySelector('[data-slot=fy-code-lines] [data-invalid]')).toHaveTextContent('2');
    expect(document.querySelector('[data-slot=fy-code-layer] [data-line="2"]')).toHaveAttribute('data-invalid');
  });

  it('the coloured copy follows the textarea when it scrolls', () => {
    render(<Editor initial={Array.from({ length: 30 }, (_, i) => `a${i} {}`).join('\n')} />);
    Object.defineProperty(code(), 'scrollTop', { value: 120, configurable: true });
    fireEvent.scroll(code());
    expect((document.querySelector('[data-slot=fy-code-layer]') as HTMLElement).style.transform).toBe('translate(0px, -120px)');
  });
});

describe('The code field on a settings page', () => {
  const field: CodeFieldDef = {
    id: 'custom_css',
    type: 'code',
    label: 'Custom CSS',
    description: 'Loaded after your theme styles.',
    default: '',
    disabled: false,
    layout: 'stacked',
    validate: { code: { language: 'css' } },
    language: 'css',
    rows: 7,
    toolbar: true,
    line_numbers: true,
  };
  const page: PageDef = {
    id: 'advanced',
    title: 'Advanced',
    description: '',
    icon: '',
    group: '',
    badge: '',
    save: 'global',
    tabs: [],
    sections: [{ id: 'css', tab: '', title: 'Styles', description: '', tone: 'default', fields: [field] }],
    values: { custom_css: 'a {\n  color: red;\n}' },
    revision: 'r1',
    media: {},
  } as unknown as PageDef;

  function setup() {
    const savePage = vi.fn(async (_id: string, values: Record<string, FieldValue>) => ({ values: { ...page.values, ...values }, revision: 'r2' }));
    const root = document.createElement('div');
    document.body.append(root);
    render(
      <PortalContainerContext.Provider value={root}>
        <SettingsPage page={page} api={{ savePage, readPage: vi.fn(), runAction: vi.fn() }} />
      </PortalContainerContext.Provider>,
    );
    return savePage;
  }

  it('says which line holds markup, marks it, refuses the save and focuses the code', async () => {
    const savePage = setup();
    const textarea = code();
    await userEvent.click(textarea);
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    await userEvent.keyboard('{Enter}</style>');
    await userEvent.click(within(screen.getByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Line 4: Markup is not allowed in CSS.')).toBeVisible();
    expect(document.querySelector('[data-slot=fy-code-lines] [data-invalid]')).toHaveTextContent('4');
    await waitFor(() => expect(textarea).toHaveFocus());
    expect(savePage).not.toHaveBeenCalled();
  });

  it('saves the code as typed', async () => {
    const savePage = setup();
    await userEvent.click(code());
    code().setSelectionRange(0, 0);
    await userEvent.keyboard('.b > .c {{}{Enter}');
    await userEvent.click(within(screen.getByRole('region', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(savePage).toHaveBeenCalledWith('advanced', { custom_css: '.b > .c {}\na {\n  color: red;\n}' }, 'r1'));
  });
});
