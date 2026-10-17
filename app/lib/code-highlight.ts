/**
 * Syntax colours of the Code Editor (Figma "Code Editor", its code sample): a small tokenizer per language, not a
 * parser. It never fails: text it does not understand stays `plain`. Five kinds, each one a token of the design:
 * `muted` (comments, punctuation: text/tertiary), `name` (a CSS selector or at-rule, an HTML tag, a JSON key:
 * status/info/text), `key` (a CSS property, an HTML attribute: text/primary), `value` (a CSS value, a string, a number:
 * status/success/text, status/error/text on a line with an error) and `plain` (text/primary).
 */
import type { CodeLanguage } from '../types';

export type CodeTokenKind = 'plain' | 'muted' | 'name' | 'key' | 'value';

export interface CodeToken {
  text: string;
  kind: CodeTokenKind;
}

type Push = (text: string, kind: CodeTokenKind) => void;

/** Where a quoted string that starts at `start` ends (after its closing quote, or at the end of the code). */
function stringEnd(code: string, start: number): number {
  const quote = code[start];
  let i = start + 1;
  while (i < code.length && code[i] !== quote) i += code[i] === '\\' ? 2 : 1;
  return Math.min(i + 1, code.length);
}

function css(code: string, push: Push): void {
  let depth = 0;
  let i = 0;
  while (i < code.length) {
    const ch = code[i] as string;
    if (/\s/.test(ch)) {
      const start = i;
      while (i < code.length && /\s/.test(code[i] as string)) i++;
      push(code.slice(start, i), 'plain');
    } else if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i + 2);
      const stop = end < 0 ? code.length : end + 2;
      push(code.slice(i, stop), 'muted');
      i = stop;
    } else if (ch === '{' || ch === '}' || ch === ';') {
      depth = ch === '{' ? depth + 1 : ch === '}' ? Math.max(0, depth - 1) : depth;
      push(ch, 'muted');
      i++;
    } else {
      // A chunk up to the next `;`, `{` or `}` (or comment): a selector when a block follows or outside any block,
      // otherwise `property: value`.
      const start = i;
      while (i < code.length && !';{}'.includes(code[i] as string) && !code.startsWith('/*', i)) i = code[i] === '"' || code[i] === "'" ? stringEnd(code, i) : i + 1;
      const chunk = code.slice(start, i);
      const colon = chunk.indexOf(':');
      if (code[i] === '{' || depth === 0 || colon < 0) {
        push(chunk, code[i] === '{' || depth === 0 ? 'name' : 'key');
      } else {
        push(chunk.slice(0, colon), 'key');
        push(':', 'muted');
        push(chunk.slice(colon + 1), 'value');
      }
    }
  }
}

function json(code: string, push: Push): void {
  let i = 0;
  while (i < code.length) {
    const ch = code[i] as string;
    if (ch === '"') {
      const end = stringEnd(code, i);
      // A key is a string followed by `:`.
      push(code.slice(i, end), /^\s*:/.test(code.slice(end)) ? 'name' : 'value');
      i = end;
    } else if ('{}[],:'.includes(ch)) {
      push(ch, 'muted');
      i++;
    } else {
      const word = /^(?:-?\d[\d.eE+-]*|true|false|null)/.exec(code.slice(i));
      if (word) {
        push(word[0], 'value');
        i += word[0].length;
      } else {
        push(ch, 'plain');
        i++;
      }
    }
  }
}

function html(code: string, push: Push): void {
  let i = 0;
  while (i < code.length) {
    if (code.startsWith('<!--', i)) {
      const end = code.indexOf('-->', i + 4);
      const stop = end < 0 ? code.length : end + 3;
      push(code.slice(i, stop), 'muted');
      i = stop;
      continue;
    }
    const tag = /^<\/?[A-Za-z][\w:-]*/.exec(code.slice(i));
    if (!tag) {
      const next = code.indexOf('<', i + 1);
      const stop = next < 0 ? code.length : next;
      push(code.slice(i, stop), 'plain');
      i = stop;
      continue;
    }
    const slash = tag[0].startsWith('</') ? 2 : 1;
    push(tag[0].slice(0, slash), 'muted');
    push(tag[0].slice(slash), 'name');
    i += tag[0].length;
    // Attributes up to `>`: name, `=`, value.
    while (i < code.length && code[i] !== '>') {
      const ch = code[i] as string;
      if (/\s/.test(ch)) {
        push(ch, 'plain');
        i++;
      } else if (ch === '=' || ch === '/') {
        push(ch, 'muted');
        i++;
      } else if (ch === '"' || ch === "'") {
        const end = stringEnd(code, i);
        push(code.slice(i, end), 'value');
        i = end;
      } else {
        const start = i;
        while (i < code.length && !/[\s=>/"']/.test(code[i] as string)) i++;
        push(code.slice(start, i), code[start - 1] === '=' ? 'value' : 'key');
      }
    }
    if (code[i] === '>') {
      push('>', 'muted');
      i++;
    }
  }
}

const TOKENIZERS: Record<Exclude<CodeLanguage, 'text'>, (code: string, push: Push) => void> = { css, json, html };

/** The code as lines of coloured runs (no `\n` inside a run); one line for empty code. */
export function highlight(language: CodeLanguage, code: string): CodeToken[][] {
  const lines: CodeToken[][] = [[]];
  const push: Push = (text, kind) => {
    text.split('\n').forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part !== '') (lines[lines.length - 1] as CodeToken[]).push({ text: part, kind });
    });
  };
  if (language === 'text') push(code, 'plain');
  else TOKENIZERS[language](code, push);
  return lines;
}
