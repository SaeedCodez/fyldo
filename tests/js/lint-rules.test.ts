/**
 * The project ESLint rule `fyldo/icon-button-tooltip` (design rule 10: every icon-only button has a Tooltip), checked on
 * snippets — and on the app itself, so a new icon-only button without a Tooltip cannot slip in unnoticed.
 */
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import tseslint from 'typescript-eslint';
import fyldo from '../../tools/lint/fyldo-plugin.js';

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.tsx'],
      languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { fyldo },
      rules: { 'fyldo/icon-button-tooltip': 'error' },
    },
  ],
});

async function messages(code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: 'snippet.tsx' });
  return (result?.messages ?? []).map((m) => m.message);
}

describe('fyldo/icon-button-tooltip', () => {
  it('flags an icon-only button without a Tooltip', async () => {
    expect(await messages('const a = <button type="button" aria-label="Edit"><Icon name="edit" /></button>;')).toHaveLength(1);
    expect(await messages('const a = <Button onClick={f}><Icon name="edit" /></Button>;')).toHaveLength(1);
    expect(await messages('const a = <Dialog.Close aria-label="Close"><Icon name="close-circle" /></Dialog.Close>;')).toHaveLength(1);
    expect(await messages('const a = <Toast.Close><Spinner /></Toast.Close>;')).toHaveLength(1);
    expect(await messages('const a = <button type="button"><svg /></button>;')).toHaveLength(1);
  });

  it('accepts one inside a <Tooltip> (and says how to fix it otherwise)', async () => {
    expect(await messages('const a = <Tooltip label="Edit"><button type="button" aria-label="Edit"><Icon name="edit" /></button></Tooltip>;')).toEqual([]);
    const [message] = await messages('const a = <button><Icon name="edit" /></button>;');
    expect(message).toMatch(/IconButton/);
    expect(message).toMatch(/Tooltip/);
  });

  it('leaves buttons with text, and non-buttons, alone', async () => {
    expect(await messages('const a = <Button><Icon name="edit" /> Edit</Button>;')).toEqual([]);
    expect(await messages('const a = <button type="button">Save</button>;')).toEqual([]);
    expect(await messages('const a = <span><Icon name="edit" /></span>;')).toEqual([]);
    expect(await messages('const a = <Button />;')).toEqual([]);
  });

  it('holds for the whole app: every icon-only button is an <IconButton> or sits in a <Tooltip> (two documented exceptions carry a disable comment)', async () => {
    const results = await new ESLint({ cwd: process.cwd() }).lintFiles(['app/**/*.tsx']);
    const offenders = results.flatMap((r) => r.messages.filter((m) => m.ruleId === 'fyldo/icon-button-tooltip').map((m) => `${r.filePath}:${m.line}`));
    expect(offenders).toEqual([]);
  });
});
